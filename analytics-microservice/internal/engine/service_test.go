package engine

import (
	"encoding/json"
	"io"
	"log"
	"testing"
	"time"

	"analyticsmicro/internal/storage"
)

func TestReadAnalyticsJSONAggregatesRange(t *testing.T) {
	t.Helper()

	root := t.TempDir()
	store := storage.NewStore(root)
	if err := store.EnsureLayout(); err != nil {
		t.Fatalf("ensure layout: %v", err)
	}

	now := time.Now().UTC()
	day0 := now.Format("2006-01-02")
	day1 := now.AddDate(0, 0, -1).Format("2006-01-02")

	if err := store.AppendViewDay(day0, map[string]int{"video-a": 8, "video-b": 2}, map[string]struct{}{
		storage.HashUserID("u1"): {},
		storage.HashUserID("u2"): {},
	}); err != nil {
		t.Fatalf("append day0: %v", err)
	}
	if err := store.AppendViewDay(day1, map[string]int{"video-a": 1, "video-c": 6}, map[string]struct{}{
		storage.HashUserID("u3"): {},
	}); err != nil {
		t.Fatalf("append day1: %v", err)
	}

	svc := NewService(store, log.New(io.Discard, "", 0))
	payload, err := svc.ReadAnalyticsJSON(2)
	if err != nil {
		t.Fatalf("read analytics: %v", err)
	}

	var got AnalyticsResponse
	if err := json.Unmarshal(payload, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if got.WindowDays != 2 {
		t.Fatalf("window days = %d, want 2", got.WindowDays)
	}
	if got.TotalViews != 17 {
		t.Fatalf("total views = %d, want 17", got.TotalViews)
	}
	if got.UniqueUsers != 3 {
		t.Fatalf("unique users = %d, want 3", got.UniqueUsers)
	}
	if len(got.Top50Videos) < 3 {
		t.Fatalf("top list too short: %d", len(got.Top50Videos))
	}
	if got.Top50Videos[0].VideoID != "video-a" || got.Top50Videos[0].Views != 9 {
		t.Fatalf("top[0] = %+v, want video-a with 9", got.Top50Videos[0])
	}
}

func TestReadAnalyticsJSONRejectsOutOfRange(t *testing.T) {
	t.Helper()

	store := storage.NewStore(t.TempDir())
	if err := store.EnsureLayout(); err != nil {
		t.Fatalf("ensure layout: %v", err)
	}
	svc := NewService(store, log.New(io.Discard, "", 0))

	if _, err := svc.ReadAnalyticsJSON(0); err == nil {
		t.Fatal("expected error for 0 days")
	}
	if _, err := svc.ReadAnalyticsJSON(31); err == nil {
		t.Fatal("expected error for >30 days")
	}
}
