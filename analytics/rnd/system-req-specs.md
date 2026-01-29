# Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for a **C++ Analytics Sidecar Service** designed to ingest high-frequency application events from a Python backend, aggregate them in-memory, and persist aggregated analytics data using append-only files. The system is intended for dashboard analytics where **eventual consistency is acceptable**, prioritizing performance, simplicity, and debuggability.

The project also serves as a **demonstration of modern C++ (C++20/23)** skills for interview and portfolio purposes.

### 1.2 Scope

The analytics sidecar:

* Runs as an independent process alongside backend services
* Receives streamed events from Python services
* Maintains in-memory aggregation state
* Flushes aggregated state to disk based on configurable policies
* Supports crash recovery via replayable persistence
* Is extensible to support new event types and metrics

The system is **not** intended to be:

* Strongly consistent
* Distributed across multiple nodes
* A replacement for Kafka / ClickHouse / BigQuery

### 1.3 Target Users

* Backend engineers
* System designers
* Interviewers evaluating systems and C++ proficiency

---

## 2. System Overview

### 2.1 High-Level Architecture

```
Python Backend
   |
   |  (Event Stream: JSON / binary)
   v
C++ Analytics Sidecar
   ├── Event Receiver
   ├── In-Memory Aggregator
   ├── Flush Scheduler
   ├── Append-Only Storage (WAL / batches)
   └── Query Interface (read-only)
```

### 2.2 Design Principles

* Append-only persistence
* Batching for write efficiency
* Eventual consistency
* Deterministic replay
* Minimal locking
* Clear separation of responsibilities

---

## 3. Functional Requirements

### 3.1 Event Ingestion

#### 3.1.1 Supported Event Schema (Initial)

```json
{
  "type": "action",
  "timestamp": "ISO-8601",
  "user_id": "string",
  "resource_type": "posts:<post_id>",
  "action": "play | pause | unmute | carousel_left | carousel_right | view"
}
```

#### 3.1.2 Event Sources

* Python backend services
* Delivered via:

  * Unix domain socket (preferred)
  * TCP socket
  * (Optional) UDP for fire-and-forget analytics

#### 3.1.3 Ingestion Requirements

* Non-blocking event ingestion
* Backpressure handled via bounded queues
* Events must be timestamped at ingestion time if missing

---

### 3.2 In-Memory Aggregation

#### 3.2.1 Core Aggregation State

The system shall maintain an in-memory state including:

* Total events received
* Per-post statistics
* Per-action counters
* Time-windowed metrics

Example internal state:

```cpp
struct PostStats {
    uint64_t total_views;
    uint64_t plays;
    uint64_t pauses;
    uint64_t unmutes;
};

struct GlobalState {
    std::unordered_map<PostId, PostStats> posts;
    uint64_t total_visitors;
};
```

#### 3.2.2 Initial Metrics to Compute

| Metric         | Description                  |
| -------------- | ---------------------------- |
| total_visitors | Unique users seen            |
| total_views    | Total video views            |
| per_post_views | Views per post               |
| action_counts  | Play, pause, etc             |
| hot_post       | Post with highest engagement |

#### 3.2.3 Hot Post Definition

A `hot_post` is defined as the post with the highest weighted score:

```
score = views + 2 * plays + unmutes - pauses
```

(Weights configurable)

---

### 3.3 Flush & Persistence

#### 3.3.1 Flush Triggers

The system shall flush aggregated data when:

* Number of processed events >= N (configurable)
* OR elapsed time >= T milliseconds

#### 3.3.2 Persistence Format

* Append-only files
* Each flush produces one record

Example record:

```json
{
  "batch_id": 42,
  "from": "2026-01-27T10:00:00Z",
  "to": "2026-01-27T10:00:30Z",
  "aggregates": {
    "total_visitors": 160,
    "hot_post": "post_123"
  }
}
```

#### 3.3.3 File Rotation

* Files rotate after size or batch threshold
* Naming format:

  * `analytics_00001.log`
  * `analytics_00002.log`

---

### 3.4 Crash Recovery

#### 3.4.1 Replay

On startup:

* Read all append-only files
* Rebuild in-memory aggregation state
* Resume processing from last batch

#### 3.4.2 Guarantees

* At-least-once aggregation
* Possible duplicate events tolerated

---

### 3.5 Query Interface (Read-Only)

#### 3.5.1 Supported Queries

* Current aggregated state
* Last flushed batch
* Hot post

#### 3.5.2 Interface Options

* HTTP endpoint (optional)
* Unix socket request-response

---

## 4. Extensibility Requirements

### 4.1 Adding New Event Types

The system shall allow adding new events without rewriting core logic.

Example future events:

* homepage_fetch
* comment_create
* follow_user

Implementation approach:

```cpp
using Event = std::variant<VideoActionEvent, HomepageFetchEvent>;
```

### 4.2 Pluggable Aggregators

Aggregations must be defined as composable units.

```cpp
using AggregatorFn = std::function<void(State&, const Event&)>;
```

---

## 5. Non-Functional Requirements

### 5.1 Performance

* Handle 10k+ events/sec on single core
* Flush operations must not block ingestion

### 5.2 Reliability

* No event loss after ingestion
* Graceful shutdown with state flush

### 5.3 Observability

* Internal metrics (queue size, flush count)
* Structured logging

---

## 6. Modern C++ Features to Use

### 6.1 Language & STL

* C++20 / C++23
* `std::chrono`
* `std::filesystem`
* `std::variant`
* `std::optional`
* `std::atomic`
* `std::span`

### 6.2 Concurrency

* `std::jthread`
* `std::stop_token`
* `std::condition_variable_any`

### 6.3 Memory & Safety

* RAII everywhere
* No raw `new/delete`
* Move semantics

### 6.4 Design Patterns

* Producer–Consumer
* Append-only log
* Snapshot + replay
* Strategy pattern for aggregation

---

## 7. Development Plan (Testable Milestones)

1. Event schema & parser
2. In-memory aggregation engine
3. Flush scheduler (N / T)
4. Append-only writer
5. Replay on startup
6. Hot post calculation
7. Query interface

---

## 8. Future Enhancements

* Sliding window analytics
* Percentile calculations
* Config hot-reload
* Shared memory reader
* Dashboard integration

---

## 9. Summary

This analytics sidecar is a **generic, extensible, and performance-oriented system** demonstrating modern C++ usage in real backend scenarios, emphasizing correctness, simplicity, and system-level thinking.

---

## How to break this into small, testable sections (very interview-friendly)

Build it in this order 👇 (each step is demoable alone):

### Phase 1 — Event & State Core

* Define event structs (`VideoActionEvent`)
* Define `State`, `PostStats`
* Unit-test aggregation logic **without I/O**

👉 At this point you can already say:

> “I separated pure aggregation from I/O for testability.”

---

### Phase 2 — Ingestion + Queue

* Single producer (Python simulator)
* Bounded in-memory queue
* Consumer thread updates state

Test:

* Queue overflow behavior
* Throughput

---

### Phase 3 — Flush Scheduler

* Implement **N OR T** trigger
* Use `std::jthread + stop_token`

Test:

* Flush happens on count
* Flush happens on time

This is where modern C++ really shows.

---

### Phase 4 — Append-only Persistence

* Define batch record format
* Append to file
* Rotate files

Test:

* Crash → restart → replay
* Partial writes

---

### Phase 5 — Hot Post Logic

* Implement weighted scoring
* Deterministic tie-breaking

Test:

* Multiple posts
* Edge cases (no views, only pauses, etc.)

---

### Phase 6 — Read API (Optional but strong)

* Read last batch
* Read current state

Even a CLI command is enough.

---

## Metrics clarification (what to actually calculate)

You asked specifically **what details to calculate**. Here’s a clean starting set that scales well:

### Per-Post Metrics

For `resource_type = posts:<post_id>`

```cpp
struct PostStats {
    uint64_t views;
    uint64_t plays;
    uint64_t pauses;
    uint64_t unmutes;
    uint64_t carousel_left;
    uint64_t carousel_right;
    std::chrono::milliseconds watch_time; // later
};
```

---

### Global Metrics

```cpp
struct GlobalStats {
    uint64_t total_events;
    uint64_t total_visitors; // unique users
    uint64_t homepage_fetches;
};
```

---

### Hot Post (Important)

Do **not** recompute from scratch every time.

Maintain incremental score:

```cpp
score += weight(action)
```

Example weights:

| Action | Weight |
| ------ | ------ |
| view   | +1     |
| play   | +2     |
| unmute | +1     |
| pause  | -1     |

This lets you:

* update in O(1)
* track hot post without scanning all posts

Interviewers *love* this detail.

---

## Why this design scales with “more events later”

You mentioned:

> later i want to add more events

This SRS already supports that cleanly via:

```cpp
using Event = std::variant<
    VideoActionEvent,
    HomepageFetchEvent
>;
```

And pluggable aggregators:

```cpp
AggregatorFn video_agg;
AggregatorFn homepage_agg;
```

Adding a new event means:

* define struct
* add one aggregator
* no core rewrite

That’s **excellent extensibility**.

---

## How to explain this in an interview (one-liner versions)

Short:

> “It’s an append-only, replayable analytics sidecar written in modern C++, optimized for eventual consistency dashboards.”

Medium:

> “Python streams events, C++ aggregates state in memory, flushes batches to disk, and can replay state on crash. It avoids heavy infra like Kafka but keeps the same core ideas.”

Long:

> “It’s basically a mini stream processor with WAL, batching, and snapshot semantics.”

That framing instantly clicks with senior engineers.
