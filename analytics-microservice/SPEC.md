# Directory structure

```text
analytics-microservice/
  cmd/analytics/main.go
  internal/model/event.go
  internal/storage/paths.go
  internal/storage/store.go
  internal/engine/config.go
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
  VideoID   string
  UserID    string
}

type Service struct {
  store       *Store
  ingestCh    chan Event      // fixed size
  processCh   chan Event      // fixed size
  snapshotReq chan struct{}   // fixed size 1
  snapRunning atomic.Bool
}

type Store struct {
  Paths struct {
    WALPath       string
    WALOffsetPath string
    ViewsDir      string
    DAUDir        string
    SnapshotPath  string
  }
}
```

# Goroutine layout

```text
G1 main goroutine
  - boot service
  - start HTTP server

G2 WAL writer goroutine
  - read ingestCh
  - append event to WAL
  - fsync WAL
  - forward event to processCh

G3 processor goroutine
  - maintain []Event buffer
  - maintain ticker(2m)
  - process batch on size>=1000 OR ticker fire with buffer>0

G4 snapshot ticker goroutine
  - ticker(5m)
  - enqueue snapshot request if none pending

G5 snapshot worker goroutine
  - serialize snapshot build execution
```

# Pseudocode

## WAL writer

```text
open WAL append fd once
loop:
  select
    case ctx done: return
    case ev <- ingestCh:
      write json(ev)+"\n" to WAL
      fsync WAL
      send ev to processCh (blocking select on ctx/processCh)
```

## Processor

```text
buffer := make([]Event, 0, 1000)
ticker := NewTicker(2m)
loop:
  select
    case ctx done: return
    case ev <- processCh:
      append(buffer, ev)
      if len(buffer) >= 1000:
        process_once(buffer)
        clear(buffer)
    case <-ticker:
      if len(buffer) > 0:
        process_once(buffer)
        clear(buffer)

process_once(events):
  group by day
  for each day:
    viewsMap[videoID]++
    dauSet[hash(userID)] = true
    append viewsMap lines to /segments/views/day.seg
    append dauSet lines to /segments/dau/day.seg
    fsync segment files
  walEnd := seek WAL end
  write wal.offset with walEnd using temp->fsync->rename
  fsync meta dir
```

## Recovery

```text
startup:
  off := read wal.offset
  seek WAL to off
  events := read remaining WAL lines
  if len(events) > 0:
    process_once(events)
    write wal.offset = off + bytes_read using temp->fsync->rename
  enter normal runtime loops
```

## Snapshot builder

```text
ticker goroutine every 5m:
  try nonblocking enqueue snapshotReq

worker goroutine loop:
  select
    case ctx done: return
    case <-snapshotReq:
      if not currently running:
        mark running
        agg := empty map[videoID]int
        for d in last 30 days:
          stream read /segments/views/day.seg
          merge counts into agg
        write agg json to temp snapshot
        fsync temp
        rename temp -> views.rolling30.snapshot
        fsync snapshots dir
        mark not running
```

## HTTP handlers

```text
POST /events:
  decode+validate request
  select
    case ingestCh <- Event: return 200 immediately
    default: return 503 queue full
  never touch disk

GET /analytics?days=30:
  parse days
  if days==30 and snapshot exists:
    read snapshot and return
  else:
    stream merge segment files for requested days
    return merged counts
```
