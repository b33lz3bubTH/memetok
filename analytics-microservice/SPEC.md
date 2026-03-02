# Directory structure

```text
analytics-microservice/
  cmd/analytics/main.go
  internal/model/event.go
  internal/storage/paths.go
  internal/storage/store.go
  internal/engine/config.go
  internal/engine/strategy.go
  internal/engine/service.go
  internal/httpapi/handlers.go
  data/
    wal/events.wal
    meta/wal.offset
    segments/views/YYYY-MM-DD.seg
    segments/dau/YYYY-MM-DD.seg
    snapshots/views.rolling30.snapshot
```

# Data structures

```go
type Event struct {
  Timestamp time.Time
  Type      string
  VideoID   string
  UserID    string
  Payload   map[string]string
}

type EventStrategy interface {
  Type() string
  Accumulate(event Event, state *BatchState)
  Flush(day string, state *BatchState, store *Store) error
}

type BatchState struct {
  ViewsByDay map[string]map[string]int
  DAUByDay   map[string]map[string]struct{}
}

type AnalyticsResponse struct {
  WindowDays             int
  TotalViews             int
  UniqueUsersInWindow    int
  UniqueUsersSelectedDay int
  SelectedDay            int
  Top50Videos            []VideoCount
  ProcessedEventLog      []string
}
```

# Goroutine layout

```text
G1 main goroutine
G2 WAL writer goroutine
G3 processor goroutine
G4 snapshot ticker goroutine
G5 snapshot worker goroutine
```

# Pseudocode

## WAL writer

```text
open WAL append fd once
loop:
  select
    case ctx done: return
    case ev <- ingestCh:
      append raw json event to WAL
      fsync WAL
      forward ev to processCh
```

## Processor

```text
buffer := []Event capacity 1000
ticker := 2m
loop:
  select
    case ctx done: return
    case ev <- processCh:
      buffer append ev
      if len(buffer) >= 1000:
        process_once(buffer)
        clear buffer
    case <-ticker:
      if len(buffer) > 0:
        process_once(buffer)
        clear buffer

process_once(events):
  state := new BatchState
  for ev in events:
    strategy := strategies[ev.Type]
    if exists: strategy.Accumulate(ev, state)
  for each day in sorted state days:
    strategy("view").Flush(day, state, store)
  write wal.offset with WAL end (temp->fsync->rename)
```

## Recovery

```text
read wal.offset
seek WAL to offset
read remaining events
if events not empty:
  process_once(events)
  write wal.offset=old_offset+bytes_read
continue runtime loops
```

## Snapshot builder

```text
every 5m enqueue snapshot request nonblocking
worker loop:
  select
    case ctx done: return
    case <-snapshotReq:
      if not running:
        mark running
        merge last 30 view segment files
        write temp snapshot
        fsync
        atomic rename
        mark not running
```

## HTTP handlers

```text
POST /events:
  validate timestamp + type
  enqueue Event on ingest channel
  immediate 200 on success
  no disk access

GET /analytics?days=N&unique_day=D:
  merge view segments for N (`1..30`)
  count distinct users for N-day window
  count distinct users for D (`1..30`, default D=N)
  compute total views + top 50 videos
  return response
```
