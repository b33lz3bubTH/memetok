package engine

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"analyticsmicro/internal/model"
	"analyticsmicro/internal/storage"
)

type VideoCount struct {
	VideoID string `json:"video_id"`
	Views   int    `json:"views"`
}

type AnalyticsResponse struct {
	WindowDays        int          `json:"window_days"`
	FromDay           int          `json:"from_day"`
	ToDay             int          `json:"to_day"`
	TotalViews        int          `json:"total_views"`
	UniqueUsers       int          `json:"unique_users"`
	Top50Videos       []VideoCount `json:"top_50_videos"`
	ProcessedEventLog []string     `json:"processed_event_log"`
}

type AnalyticsQuery struct {
	FromDay int
	ToDay   int
}

type Service struct {
	store       *storage.Store
	ingestCh    chan model.Event
	processCh   chan model.Event
	snapshotReq chan struct{}
	snapRunning atomic.Bool
	logger      *log.Logger
	strategies  map[string]EventStrategy

	analyticsMu sync.Mutex
	analytics   map[string]cachedAnalytics
}

type cachedAnalytics struct {
	json      []byte
	expiresAt time.Time
}

func NewService(store *storage.Store, logger *log.Logger) *Service {
	if logger == nil {
		logger = log.New(io.Discard, "", 0)
	}
	strategies := map[string]EventStrategy{}
	for _, strategy := range []EventStrategy{
		ViewStrategy{},
		NewNoopStrategy("search"),
		NewNoopStrategy("like"),
		NewNoopStrategy("comment"),
	} {
		strategies[strategy.Type()] = strategy
	}
	return &Service{
		store:       store,
		ingestCh:    make(chan model.Event, EventChannelSize),
		processCh:   make(chan model.Event, EventChannelSize),
		snapshotReq: make(chan struct{}, 1),
		logger:      logger,
		strategies:  strategies,
		analytics:   make(map[string]cachedAnalytics),
	}
}

func (s *Service) IngestChan() chan<- model.Event { return s.ingestCh }

func (s *Service) Start(ctx context.Context) error {
	if err := s.store.EnsureLayout(); err != nil {
		return err
	}
	if err := s.recoverOnce(); err != nil {
		return err
	}
	go s.runWALWriter(ctx)
	go s.runProcessor(ctx)
	go s.runSnapshotTicker(ctx)
	go s.runSnapshotWorker(ctx)
	go s.runRetentionWorker(ctx)
	return nil
}

func (s *Service) runWALWriter(ctx context.Context) {
	openWriter := func() (*os.File, *bufio.Writer, error) {
		f, err := os.OpenFile(s.store.Paths.WALPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return nil, nil, err
		}
		return f, bufio.NewWriterSize(f, 1<<20), nil
	}

	f, writer, err := openWriter()
	if err != nil {
		s.logger.Printf("wal open error: %v", err)
		return
	}
	defer f.Close()
	currentDay := time.Now().UTC().Format("2006-01-02")

	flushTicker := time.NewTicker(WALFlushInterval)
	syncTicker := time.NewTicker(WALSyncInterval)
	defer flushTicker.Stop()
	defer syncTicker.Stop()

	rotate := func(now time.Time) {
		targetDay := now.UTC().Format("2006-01-02")
		if targetDay == currentDay {
			return
		}
		_ = writer.Flush()
		_ = f.Sync()
		_ = f.Close()
		rotated := s.store.Paths.WALDir + "/events-" + now.UTC().Format("20060102T150405Z") + ".wal"
		if err := os.Rename(s.store.Paths.WALPath, rotated); err != nil {
			s.logger.Printf("wal rotate rename error: %v", err)
		}
		nf, nw, err := openWriter()
		if err != nil {
			s.logger.Printf("wal reopen error: %v", err)
			return
		}
		f = nf
		writer = nw
		currentDay = targetDay
	}

	for {
		select {
		case <-ctx.Done():
			_ = writer.Flush()
			_ = f.Sync()
			return
		case ev := <-s.ingestCh:
			if err := s.store.AppendWALEvent(writer, ev); err != nil {
				s.logger.Printf("wal append error: %v", err)
				continue
			}
			select {
			case s.processCh <- ev:
			case <-ctx.Done():
				return
			}
		case <-flushTicker.C:
			if err := writer.Flush(); err != nil {
				s.logger.Printf("wal flush error: %v", err)
			}
		case <-syncTicker.C:
			if err := writer.Flush(); err != nil {
				s.logger.Printf("wal flush error: %v", err)
				continue
			}
			if err := f.Sync(); err != nil {
				s.logger.Printf("wal sync error: %v", err)
			}
			rotate(time.Now())
		}
	}
}

func (s *Service) runProcessor(ctx context.Context) {
	buf := make([]model.Event, 0, BatchSize)
	ticker := time.NewTicker(FlushInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case ev := <-s.processCh:
			buf = append(buf, ev)
			if len(buf) >= BatchSize {
				s.processBatch(buf)
				buf = buf[:0]
			}
		case <-ticker.C:
			if len(buf) > 0 {
				s.processBatch(buf)
				buf = buf[:0]
			}
		}
	}
}

func (s *Service) processBatch(events []model.Event) {
	if len(events) == 0 {
		return
	}
	state := NewBatchState()
	for _, ev := range events {
		strategy, ok := s.strategies[ev.Type]
		if !ok {
			continue
		}
		strategy.Accumulate(ev, state)
	}
	for _, day := range state.SortedDays() {
		if err := s.strategies["view"].Flush(day, state, s.store); err != nil {
			s.logger.Printf("append aggregate error: %v", err)
			return
		}
	}
	f, err := os.OpenFile(s.store.Paths.WALPath, os.O_RDONLY, 0o644)
	if err != nil {
		s.logger.Printf("wal open for offset error: %v", err)
		return
	}
	off, err := f.Seek(0, io.SeekEnd)
	_ = f.Close()
	if err != nil {
		s.logger.Printf("wal seek end error: %v", err)
		return
	}
	if err := s.store.WriteOffset(off); err != nil {
		s.logger.Printf("offset write error: %v", err)
		return
	}
	s.invalidateAnalyticsCache()
}

func (s *Service) recoverOnce() error {
	off, err := s.store.ReadOffset()
	if err != nil {
		return err
	}
	events, newOff, err := s.store.LoadWALFromOffset(off)
	if err != nil {
		return err
	}
	if len(events) > 0 {
		s.processBatch(events)
		if err := s.store.WriteOffset(newOff); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) runSnapshotTicker(ctx context.Context) {
	ticker := time.NewTicker(SnapshotInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			select {
			case s.snapshotReq <- struct{}{}:
			default:
			}
		}
	}
}

func (s *Service) runSnapshotWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.snapshotReq:
			if s.snapRunning.CompareAndSwap(false, true) {
				_ = s.store.BuildRollingSnapshot(time.Now(), RollingWindowDays)
				s.invalidateAnalyticsCache()
				s.snapRunning.Store(false)
			}
		}
	}
}

func (s *Service) runRetentionWorker(ctx context.Context) {
	ticker := time.NewTicker(RetentionSweepPeriod)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.store.CleanupOldData(time.Now(), RollingWindowDays); err != nil {
				s.logger.Printf("retention cleanup error: %v", err)
			}
			s.invalidateAnalyticsCache()
		}
	}
}

func (s *Service) ReadAnalytics(days int) (AnalyticsResponse, error) {
	payload, err := s.ReadAnalyticsJSON(AnalyticsQuery{FromDay: 1, ToDay: days})
	if err != nil {
		return AnalyticsResponse{}, err
	}
	var out AnalyticsResponse
	if err := json.Unmarshal(payload, &out); err != nil {
		return AnalyticsResponse{}, err
	}
	return out, nil
}

func (s *Service) ReadAnalyticsJSON(query AnalyticsQuery) ([]byte, error) {
	if query.FromDay < 1 || query.FromDay > RollingWindowDays {
		return nil, fmt.Errorf("from_day must be between 1 and %d", RollingWindowDays)
	}
	if query.ToDay < 1 || query.ToDay > RollingWindowDays {
		return nil, fmt.Errorf("to_day must be between 1 and %d", RollingWindowDays)
	}
	if query.FromDay > query.ToDay {
		return nil, fmt.Errorf("from_day must be less than or equal to to_day")
	}

	now := time.Now()
	s.analyticsMu.Lock()
	defer s.analyticsMu.Unlock()

	cacheKey := fmt.Sprintf("%d:%d", query.FromDay, query.ToDay)
	if cached, ok := s.analytics[cacheKey]; ok && len(cached.json) > 0 && now.Before(cached.expiresAt) {
		return append([]byte(nil), cached.json...), nil
	}

	resp, err := s.buildAnalytics(now, query)
	if err != nil {
		return nil, err
	}
	payload, err := json.Marshal(resp)
	if err != nil {
		return nil, err
	}
	s.analytics[cacheKey] = cachedAnalytics{json: payload, expiresAt: now.Add(AnalyticsCacheTTL)}
	return append([]byte(nil), payload...), nil
}

func (s *Service) buildAnalytics(now time.Time, query AnalyticsQuery) (AnalyticsResponse, error) {
	views, err := s.store.MergeViewsRange(now, query.FromDay, query.ToDay)
	if err != nil {
		return AnalyticsResponse{}, err
	}

	totalUsers, err := s.store.CountDistinctUsersRange(now, query.FromDay, query.ToDay)
	if err != nil {
		return AnalyticsResponse{}, err
	}

	totalViews := 0
	for _, count := range views {
		totalViews += count
	}

	top := make([]VideoCount, 0, len(views))
	for videoID, count := range views {
		top = append(top, VideoCount{VideoID: videoID, Views: count})
	}
	sort.Slice(top, func(i, j int) bool {
		if top[i].Views == top[j].Views {
			return top[i].VideoID < top[j].VideoID
		}
		return top[i].Views > top[j].Views
	})
	if len(top) > 50 {
		top = top[:50]
	}
	windowDays := query.ToDay - query.FromDay + 1
	return AnalyticsResponse{
		WindowDays:        windowDays,
		FromDay:           query.FromDay,
		ToDay:             query.ToDay,
		TotalViews:        totalViews,
		UniqueUsers:       totalUsers,
		Top50Videos:       top,
		ProcessedEventLog: []string{"view", "search", "like", "comment"},
	}, nil
}

func (s *Service) invalidateAnalyticsCache() {
	s.analyticsMu.Lock()
	s.analytics = make(map[string]cachedAnalytics)
	s.analyticsMu.Unlock()
}
