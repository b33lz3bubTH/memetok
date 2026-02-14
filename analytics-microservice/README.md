# analytics-microservice

Standalone Go analytics engine in a separate root folder.

Supported event types (strategy-based):
- view (active aggregation)
- search (ingested, strategy placeholder)
- like (ingested, strategy placeholder)
- comment (ingested, strategy placeholder)

Run:

```bash
go run ./cmd/analytics
```


POST /events for ingestion.

GET /analytics?days=N for aggregated reads.
This is wired in the HTTP handlers. 

It runs on port 8997 by default. 

1) Start the service
cd /workspace/memetok/analytics-microservice
go run ./cmd/analytics
(From README + main entrypoint). 

2) Set base URL + timestamps
In a second terminal:

BASE_URL="http://localhost:8997"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
YESTERDAY="$(date -u -d '1 day ago' +"%Y-%m-%dT%H:%M:%SZ")"
3) Insert events (manual data creation)
A) Add view events (these affect analytics counters)
curl -i -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$NOW\",
    \"type\": \"view\",
    \"video_id\": \"video-101\",
    \"user_id\": \"user-a\",
    \"payload\": {\"source\": \"feed\", \"device\": \"ios\"}
  }"
curl -i -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$NOW\",
    \"type\": \"view\",
    \"video_id\": \"video-101\",
    \"user_id\": \"user-b\",
    \"payload\": {\"source\": \"search\"}
  }"
curl -i -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$YESTERDAY\",
    \"type\": \"view\",
    \"video_id\": \"video-202\",
    \"user_id\": \"user-a\",
    \"payload\": {\"source\": \"profile\"}
  }"
Expected success body:

{"ok":true}
That response comes from handleEvent. 

B) Add non-view events (accepted, but currently placeholder strategy)
Supported types include search, like, comment. 

curl -i -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$NOW\",
    \"type\": \"like\",
    \"video_id\": \"video-101\",
    \"user_id\": \"user-c\",
    \"payload\": {\"reaction\": \"heart\"}
  }"
4) Read analytics (see resulting shape)
Default window (30 days if omitted)
curl -s "$BASE_URL/analytics" | jq
Explicit window
curl -s "$BASE_URL/analytics?days=1" | jq
curl -s "$BASE_URL/analytics?days=2" | jq
curl -s "$BASE_URL/analytics?days=30" | jq
The response shape is:

days

total_views

total_users

top_50_videos (array of {video_id, views})

event_support
Defined in AnalyticsResponse. 

Example output (illustrative):

{
  "days": 2,
  "total_views": 3,
  "total_users": 2,
  "top_50_videos": [
    { "video_id": "video-101", "views": 2 },
    { "video_id": "video-202", "views": 1 }
  ],
  "event_support": ["view", "search", "like", "comment"]
}
5) Negative tests (to understand validation/errors)
Invalid JSON
curl -i -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"bad-json"'
Should return 400 invalid json. 

Invalid timestamp or empty type
curl -i -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp":"not-rfc3339",
    "type":"",
    "video_id":"video-1",
    "user_id":"user-1"
  }'
Should return 400 invalid event. 

Invalid days
curl -i "$BASE_URL/analytics?days=abc"
curl -i "$BASE_URL/analytics?days=0"
non-integer => 400 invalid days. 

zero/negative => 400 days must be positive. 

