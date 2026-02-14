FROM golang:1.22-alpine AS builder

WORKDIR /build

COPY go.mod ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o analytics ./cmd/analytics

FROM alpine:3.20

RUN apk --no-cache add ca-certificates && \
    addgroup -S app && adduser -S -D -H -h /app -s /sbin/nologin -G app app

WORKDIR /app

COPY --from=builder /build/analytics ./analytics

RUN mkdir -p /app/data && chown -R app:app /app

USER app:app

ENV ANALYTICS_DATA_DIR=/app/data

EXPOSE 8997

CMD ["./analytics"]
