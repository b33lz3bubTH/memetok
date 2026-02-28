package httpapi

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type rateLimiter struct {
	mu           sync.Mutex
	requests     map[string][]time.Time
	violations   map[string]int
	blockedUntil map[string]time.Time
	lastSeen     map[string]time.Time
	limit        int
	window       time.Duration
	cleanupTick  *time.Ticker
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		requests:     make(map[string][]time.Time),
		violations:   make(map[string]int),
		blockedUntil: make(map[string]time.Time),
		lastSeen:     make(map[string]time.Time),
		limit:        limit,
		window:       window,
	}
	rl.cleanupTick = time.NewTicker(1 * time.Minute)
	go rl.cleanup()
	return rl
}

func (rl *rateLimiter) cleanup() {
	for range rl.cleanupTick.C {
		rl.mu.Lock()
		now := time.Now()
		for ip := range rl.lastSeen {
			// Purge IP if:
			// 1. Block expired long ago (24h)
			// 2. Sliding window requests are empty
			// 3. Last activity was long ago (24h)

			// Check requests in window
			times := rl.requests[ip]
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

			// Check if we should purge other data
			isBlocked := false
			if until, ok := rl.blockedUntil[ip]; ok {
				if now.Before(until) {
					isBlocked = true
				} else if now.Sub(until) > 24*time.Hour {
					// Block expired more than 24h ago
					delete(rl.blockedUntil, ip)
				}
			}

			if !isBlocked && len(rl.requests[ip]) == 0 && now.Sub(rl.lastSeen[ip]) > 24*time.Hour {
				delete(rl.violations, ip)
				delete(rl.blockedUntil, ip) // already checked above but for safety
				delete(rl.lastSeen, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	rl.lastSeen[ip] = now

	// 1. Check if the IP is currently blocked
	if until, ok := rl.blockedUntil[ip]; ok {
		if now.Before(until) {
			return false
		}
		// Block expired, but we keep the violation count etc. for now.
		// We'll let the sliding window check proceed.
	}

	// 2. Existing sliding window check
	times := rl.requests[ip]
	valid := times[:0]
	for _, t := range times {
		if now.Sub(t) < rl.window {
			valid = append(valid, t)
		}
	}
	rl.requests[ip] = valid

	// 3. Evaluate if request is allowed or it's a new violation
	if len(valid) >= rl.limit {
		// New violation
		rl.violations[ip]++
		vCount := rl.violations[ip]

		var d time.Duration
		if vCount <= 20 {
			// exponential ratimging for doubling the time.
			// Starting with window size as base delay (1 min)
			d = rl.window * time.Duration(1<<(vCount-1))
		} else {
			// after 20 times violation, ratelimit for 24hrs
			d = 24 * time.Hour
		}

		rl.blockedUntil[ip] = now.Add(d)
		return false
	}

	// 4. Request allowed
	rl.requests[ip] = append(rl.requests[ip], now)
	return true
}

func (rl *rateLimiter) getIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		for _, part := range parts {
			ip := strings.TrimSpace(part)
			if parsed := net.ParseIP(ip); parsed != nil {
				return ip
			}
		}
	}
	if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); ip != "" {
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
