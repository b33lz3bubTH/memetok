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
