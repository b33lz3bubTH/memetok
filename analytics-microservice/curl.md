# Analytics API - cURL Examples

Base URL: `http://localhost:8997` (or your deployed URL)

## POST /events

Track analytics events. No API key required. CORS enabled for all origins.

### Basic Event

```bash
curl -X POST http://localhost:8997/events \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2026-02-15T10:30:00Z",
    "type": "view",
    "video_id": "video123",
    "user_id": "user456"
  }'
```

### Event with Payload

```bash
curl -X POST http://localhost:8997/events \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2026-02-15T10:30:00Z",
    "type": "play",
    "video_id": "video123",
    "user_id": "user456",
    "payload": {
      "duration": "120",
      "quality": "1080p"
    }
  }'
```

### Using Current Timestamp (JavaScript)

For frontend integration, use the current timestamp:

```javascript
const event = {
  timestamp: new Date().toISOString(), // e.g., "2026-02-15T10:30:00.000Z"
  type: "view",
  video_id: "video123",
  user_id: "user456"
};
```

### Response

Success (200 OK):
```json
{"ok":true}
```

Error (400 Bad Request):
```
invalid event
```

## GET /analytics

Get analytics data. Requires `X-API-Key` header if API key auth is enabled.

### Get Analytics (Default 30 days)

```bash
curl "http://localhost:8997/analytics" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Get Analytics for Specific Days

```bash
curl "http://localhost:8997/analytics?days=7" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Response

Success (200 OK):
```json
{
  "window_days": 7,
  "total_views": 1500,
  "unique_users": 920,
  "top_50_videos": [
    {
      "video_id": "video123",
      "views": 120
    }
  ],
  "processed_event_log": ["view", "search", "like", "comment"]
}
```

Error (401 Unauthorized):
```
unauthorized
```

## GET /healthz

Health check endpoint.

```bash
curl http://localhost:8997/healthz
```

Response:
```json
{"status":"ok"}
```

## GET /readyz

Readiness check endpoint.

```bash
curl http://localhost:8997/readyz
```

Response:
```json
{"status":"ready"}
```

## Event Types

Common event types:
- `view` - Video viewed
- `play` - Video playback started
- `pause` - Video paused
- `like` - Video liked
- `share` - Video shared
- `comment` - Comment added

## Notes

- **IMPORTANT**: Timestamp must be in RFC3339 format and should be the current time (e.g., `2026-02-15T10:30:00Z`)
- Analytics queries only return data from the last N days from today, so use current timestamps
- Event `type` is required and will be converted to lowercase
- For "view" events, both `video_id` and `user_id` are required
- `payload` is optional
- Rate limit: 120 requests per minute per IP
- Maximum request body size: 1MB
- Events are batched and flushed every 10 seconds
