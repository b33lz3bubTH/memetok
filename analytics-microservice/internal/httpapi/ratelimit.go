package httpapi

import (
	"net"
	"net/http"
	"sync"
	"time"
)

type rateLimiter struct {
	mu          sync.Mutex
	requests    map[string][]time.Time
	limit       int
	window      time.Duration
	cleanupTick *time.Ticker
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
	rl.cleanupTick = time.NewTicker(1 * time.Minute)
	go rl.cleanup()
	return rl
}

func (rl *rateLimiter) cleanup() {
	for range rl.cleanupTick.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, times := range rl.requests {
			valid := times[:0]
			for _, t := range times {
				if now.Sub(t) < rl.window {
					valid = append(valid, t)
				}
			}
			if len(valid) == 0 {
				delete(rl.requests, ip)
			} else {
				rl.requests[ip] = valid
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	times := rl.requests[ip]
	valid := times[:0]
	for _, t := range times {
		if now.Sub(t) < rl.window {
			valid = append(valid, t)
		}
	}
	rl.requests[ip] = valid

	if len(valid) >= rl.limit {
		return false
	}

	rl.requests[ip] = append(rl.requests[ip], now)
	return true
}

func (rl *rateLimiter) getIP(r *http.Request) string {
	ip := r.Header.Get("X-Forwarded-For")
	if ip != "" {
		if idx := len(ip) - 1; idx >= 0 && ip[idx] == ',' {
			ip = ip[:idx]
		}
		if parsed := net.ParseIP(ip); parsed != nil {
			return ip
		}
	}
	ip = r.Header.Get("X-Real-IP")
	if ip != "" {
		if parsed := net.ParseIP(ip); parsed != nil {
			return ip
		}
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	if host != "" {
		return host
	}
	return r.RemoteAddr
}

func (rl *rateLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := rl.getIP(r)
		if !rl.allow(ip) {
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}
