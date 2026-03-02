package engine

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"testing"
	"time"

	"analyticsmicro/internal/storage"
)

func TestReadAnalyticsJSONIncludesWindowTotalsAndSelectedDay(t *testing.T) {
	tmp := t.TempDir()
	store := storage.NewStore(tmp)
	if err := store.EnsureLayout(); err != nil {
		t.Fatalf("ensure layout: %v", err)
	}

	now := time.Now().UTC()
	day1 := now.Format("2006-01-02")
	day2 := now.AddDate(0, 0, -1).Format("2006-01-02")

	if err := os.WriteFile(filepath.Join(store.Paths.ViewsDir, day1+".seg"), []byte("video-a,4\nvideo-b,1\n"), 0o644); err != nil {
		t.Fatalf("write day1 views: %v", err)
	}
	if err := os.WriteFile(filepath.Join(store.Paths.ViewsDir, day2+".seg"), []byte("video-a,3\nvideo-c,2\n"), 0o644); err != nil {
		t.Fatalf("write day2 views: %v", err)
	}
	if err := os.WriteFile(filepath.Join(store.Paths.DAUDir, day1+".seg"), []byte("u1\nu2\n"), 0o644); err != nil {
		t.Fatalf("write day1 dau: %v", err)
	}
	if err := os.WriteFile(filepath.Join(store.Paths.DAUDir, day2+".seg"), []byte("u2\nu3\n"), 0o644); err != nil {
		t.Fatalf("write day2 dau: %v", err)
	}

	svc := NewService(store, log.New(os.Stderr, "", 0))
	payload, err := svc.ReadAnalyticsJSON(2, 1)
	if err != nil {
		t.Fatalf("read analytics: %v", err)
	}

	var out AnalyticsResponse
	if err := json.Unmarshal(payload, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if out.TotalViews != 10 {
		t.Fatalf("expected total views 10, got %d", out.TotalViews)
	}
	if out.UniqueUsersInWindow != 3 {
		t.Fatalf("expected unique users in window 3, got %d", out.UniqueUsersInWindow)
	}
	if out.UniqueUsersSelectedDay != 2 {
		t.Fatalf("expected selected day unique users 2, got %d", out.UniqueUsersSelectedDay)
	}
	if out.SelectedDay != 1 {
		t.Fatalf("expected selected day 1, got %d", out.SelectedDay)
	}
	if len(out.Top50Videos) == 0 || out.Top50Videos[0].VideoID != "video-a" || out.Top50Videos[0].Views != 7 {
		t.Fatalf("unexpected top videos: %+v", out.Top50Videos)
	}
}
