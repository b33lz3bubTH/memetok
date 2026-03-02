# analytics-microservice

Standalone Go analytics engine in a separate root folder.

Supported event types (strategy-based):
- view (aggregated for top videos + unique users)
- search (WAL-only storage)
- like (WAL-only storage)
- comment (WAL-only storage)

## Production hardening included

- HTTP server timeouts (`ReadTimeout`, `WriteTimeout`, `IdleTimeout`) and header size limits.
- Optional API key protection via `X-API-Key` (`ANALYTICS_API_KEY`).
- Health/readiness probes: `GET /healthz`, `GET /readyz`.
- JSON request validation + body size limits (1 MiB).
- In-process rate limiting and secure response headers.
- NGINX hardening (`server_tokens off`, request rate limiting, method allowlist, stricter body/timeouts).
- Hardened container runtime defaults (non-root app user, no-new-privileges, read-only nginx filesystem, health checks).

## Run local binary

```bash
go run ./cmd/analytics
```

Service defaults to port `8997`.

## Run with Docker Compose

```bash
cd /workspace/memetok/analytics-microservice
export ANALYTICS_API_KEY="change-me"
docker compose up --build -d
```

Requests to non-health endpoints require `X-API-Key` when `ANALYTICS_API_KEY` is set (query param auth is not used).

## API quick checks

```bash
BASE_URL="http://localhost:8997"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

curl -i "$BASE_URL/healthz"

curl -i -X POST "$BASE_URL/events" \
  -H "X-API-Key: change-me" \
  -H "Content-Type: application/json" \
  -d "{\"timestamp\":\"$NOW\",\"type\":\"view\",\"video_id\":\"video-101\",\"user_id\":\"user-a\"}"

curl -s "$BASE_URL/analytics" \
  -H "X-API-Key: change-me" | jq
```


## Retention and throughput behavior

- Event ingestion writes to a buffered WAL writer and syncs periodically (not per event) to sustain higher request rates.
- Processed WAL is rotated to timestamped files under `data/wal/`.
- The analytics API returns:
  - total views and unique users over a selectable day range in the last 30 days
  - top 50 videos for the selected range
  - range selectors:
    - `days=N` → shorthand for `from_day=1&to_day=N`
    - `from_day` / `to_day` (`1-30`, where `1` is today, `30` is 30 days ago)
  - cached analytics payloads (2s TTL) per requested window to avoid repeated segment scans under high read throughput
- Backlogs older than 30 days are cleaned from segments and rotated WAL files on a periodic retention sweep.
