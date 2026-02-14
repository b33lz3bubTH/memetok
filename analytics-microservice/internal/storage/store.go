package storage

import (
	"bufio"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"analyticsmicro/internal/model"
)

type Store struct {
	Paths Paths
}

func NewStore(dataRoot string) *Store {
	return &Store{Paths: NewPaths(dataRoot)}
}

func (s *Store) EnsureLayout() error {
	dirs := []string{
		filepath.Dir(s.Paths.WALPath),
		filepath.Dir(s.Paths.WALOffsetPath),
		s.Paths.ViewsDir,
		s.Paths.DAUDir,
		filepath.Dir(s.Paths.SnapshotPath),
	}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	if _, err := os.Stat(s.Paths.WALOffsetPath); errors.Is(err, os.ErrNotExist) {
		if err := s.writeOffset(0); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) AppendWALEvent(w io.Writer, event model.Event) error {
	b, err := json.Marshal(event)
	if err != nil {
		return err
	}
	if _, err := w.Write(append(b, '\n')); err != nil {
		return err
	}
	return nil
}

func (s *Store) ReadOffset() (int64, error) {
	f, err := os.Open(s.Paths.WALOffsetPath)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	var off int64
	if err := binary.Read(f, binary.LittleEndian, &off); err != nil {
		if errors.Is(err, io.EOF) {
			return 0, nil
		}
		return 0, err
	}
	return off, nil
}

func (s *Store) WriteOffset(off int64) error {
	return s.writeOffset(off)
}

func (s *Store) writeOffset(off int64) error {
	tmp := s.Paths.WALOffsetPath + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, off); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmp, s.Paths.WALOffsetPath); err != nil {
		return err
	}
	return fsyncDir(filepath.Dir(s.Paths.WALOffsetPath))
}

func (s *Store) LoadWALFromOffset(off int64) ([]model.Event, int64, error) {
	f, err := os.OpenFile(s.Paths.WALPath, os.O_CREATE|os.O_RDONLY, 0o644)
	if err != nil {
		return nil, off, err
	}
	defer f.Close()
	if _, err := f.Seek(off, io.SeekStart); err != nil {
		return nil, off, err
	}
	r := bufio.NewReader(f)
	events := make([]model.Event, 0, 1024)
	var consumed int64
	for {
		line, err := r.ReadBytes('\n')
		if len(line) > 0 {
			consumed += int64(len(line))
			line = bytesTrimSpace(line)
			if len(line) > 0 {
				var ev model.Event
				if um := json.Unmarshal(line, &ev); um == nil {
					events = append(events, ev)
				}
			}
		}
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, off, err
		}
	}
	return events, off + consumed, nil
}

func (s *Store) AppendAggregates(day string, views map[string]int, userHashes map[string]struct{}) error {
	viewsPath := filepath.Join(s.Paths.ViewsDir, day+".seg")
	dauPath := filepath.Join(s.Paths.DAUDir, day+".seg")

	vf, err := os.OpenFile(viewsPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	for videoID, c := range views {
		if _, err := vf.WriteString(videoID + "," + strconv.Itoa(c) + "\n"); err != nil {
			vf.Close()
			return err
		}
	}
	if err := vf.Sync(); err != nil {
		vf.Close()
		return err
	}
	if err := vf.Close(); err != nil {
		return err
	}

	df, err := os.OpenFile(dauPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	for h := range userHashes {
		if _, err := df.WriteString(h + "\n"); err != nil {
			df.Close()
			return err
		}
	}
	if err := df.Sync(); err != nil {
		df.Close()
		return err
	}
	if err := df.Close(); err != nil {
		return err
	}
	return nil
}

func (s *Store) BuildRollingSnapshot(now time.Time, days int) error {
	agg, err := s.MergeViews(now, days)
	if err != nil {
		return err
	}
	tmp := s.Paths.SnapshotPath + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	enc := json.NewEncoder(f)
	if err := enc.Encode(agg); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmp, s.Paths.SnapshotPath); err != nil {
		return err
	}
	return fsyncDir(filepath.Dir(s.Paths.SnapshotPath))
}

func (s *Store) ReadSnapshot() (map[string]int, error) {
	f, err := os.Open(s.Paths.SnapshotPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var out map[string]int
	if err := json.NewDecoder(f).Decode(&out); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) MergeViews(now time.Time, days int) (map[string]int, error) {
	out := make(map[string]int, 256)
	for i := 0; i < days; i++ {
		day := now.UTC().AddDate(0, 0, -i).Format("2006-01-02")
		path := filepath.Join(s.Paths.ViewsDir, day+".seg")
		if err := s.mergeSegment(path, out); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			return nil, err
		}
	}
	return out, nil
}

func (s *Store) mergeSegment(path string, out map[string]int) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	scan := bufio.NewScanner(f)
	for scan.Scan() {
		parts := strings.SplitN(scan.Text(), ",", 2)
		if len(parts) != 2 {
			continue
		}
		v, err := strconv.Atoi(parts[1])
		if err != nil {
			continue
		}
		out[parts[0]] += v
	}
	return scan.Err()
}

func HashUserID(id string) string {
	sum := sha256.Sum256([]byte(id))
	return fmt.Sprintf("%x", sum[:8])
}

func SortKeys(m map[string]int) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func bytesTrimSpace(in []byte) []byte {
	return []byte(strings.TrimSpace(string(in)))
}

func fsyncDir(dir string) error {
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}
