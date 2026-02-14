package engine

import (
	"context"
	"errors"
	"io"
	"log"
	"os"
	"sync/atomic"
	"time"

	"analyticsmicro/internal/model"
	"analyticsmicro/internal/storage"
)

type Service struct {
	store       *storage.Store
	ingestCh    chan model.Event
	processCh   chan model.Event
	snapshotReq chan struct{}
	snapRunning atomic.Bool
	logger      *log.Logger
}

func NewService(store *storage.Store, logger *log.Logger) *Service {
	if logger == nil {
		logger = log.New(io.Discard, "", 0)
	}
	return &Service{
		store:       store,
		ingestCh:    make(chan model.Event, EventChannelSize),
		processCh:   make(chan model.Event, EventChannelSize),
		snapshotReq: make(chan struct{}, 1),
		logger:      logger,
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
	return nil
}

func (s *Service) runWALWriter(ctx context.Context) {
	f, err := os.OpenFile(s.store.Paths.WALPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		s.logger.Printf("wal open error: %v", err)
		return
	}
	defer f.Close()
	for {
		select {
		case <-ctx.Done():
			return
		case ev := <-s.ingestCh:
			if err := s.store.AppendWALEvent(f, ev); err != nil {
				s.logger.Printf("wal append error: %v", err)
				continue
			}
			if err := f.Sync(); err != nil {
				s.logger.Printf("wal sync error: %v", err)
				continue
			}
			select {
			case s.processCh <- ev:
			case <-ctx.Done():
				return
			}
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
	viewsByDay := make(map[string]map[string]int)
	dauByDay := make(map[string]map[string]struct{})
	for _, ev := range events {
		day := ev.DayKey()
		if _, ok := viewsByDay[day]; !ok {
			viewsByDay[day] = make(map[string]int)
			dauByDay[day] = make(map[string]struct{})
		}
		viewsByDay[day][ev.VideoID]++
		dauByDay[day][storage.HashUserID(ev.UserID)] = struct{}{}
	}
	for day, views := range viewsByDay {
		if err := s.store.AppendAggregates(day, views, dauByDay[day]); err != nil {
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
	}
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
				s.snapRunning.Store(false)
			}
		}
	}
}

func (s *Service) ReadAnalytics(days int) (map[string]int, error) {
	if days <= 0 {
		return nil, errors.New("days must be positive")
	}
	if days == RollingWindowDays {
		if snap, err := s.store.ReadSnapshot(); err == nil {
			return snap, nil
		}
	}
	return s.store.MergeViews(time.Now(), days)
}
