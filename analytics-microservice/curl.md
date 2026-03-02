# Analytics API - cURL Examples

Base URL: `http://localhost:8997` (or your deployed URL)

## POST /events

Track analytics events. If `ANALYTICS_API_KEY` is configured, include `X-API-Key`.

```bash
curl -X POST http://localhost:8997/events \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2026-02-15T10:30:00Z",
    "type": "view",
    "video_id": "video123",
    "user_id": "user456"
  }'
```

## GET /analytics

Query windowed analytics where `days=1..30`:
- `days=1` → today only
- `days=10` → today + previous 9 days

```bash
curl "http://localhost:8997/analytics?days=10" \
  -H "X-API-Key: YOUR_API_KEY"
```

Success (200 OK):
```json
{
  "window_days": 10,
  "window_start": "2026-02-06",
  "window_end": "2026-02-15",
  "total_views": 94320,
  "total_unique_users": 11890,
  "top_50_videos": [
    {"video_id": "video123", "views": 5500}
  ],
  "processed_event_log": ["view", "search", "like", "comment"]
}
```

## GET /healthz

```bash
curl http://localhost:8997/healthz
```

## GET /readyz

```bash
curl http://localhost:8997/readyz
```
