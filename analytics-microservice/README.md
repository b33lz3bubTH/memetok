# analytics-microservice

Standalone Go analytics engine in a separate root folder.

Supported event types (strategy-based):
- view (active aggregation)
- search (ingested, strategy placeholder)
- like (ingested, strategy placeholder)
- comment (ingested, strategy placeholder)

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

Requests to non-health endpoints require `X-API-Key` when `ANALYTICS_API_KEY` is set.

## API quick checks

```bash
BASE_URL="http://localhost:8997"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

curl -i "$BASE_URL/healthz"

curl -i -X POST "$BASE_URL/events" \
  -H "X-API-Key: change-me" \
  -H "Content-Type: application/json" \
  -d "{\"timestamp\":\"$NOW\",\"type\":\"view\",\"video_id\":\"video-101\",\"user_id\":\"user-a\"}"

curl -s "$BASE_URL/analytics?days=1" \
  -H "X-API-Key: change-me" | jq
```
