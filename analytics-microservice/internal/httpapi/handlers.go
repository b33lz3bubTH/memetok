package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"analyticsmicro/internal/engine"
	"analyticsmicro/internal/model"
)

const maxEventBodyBytes int64 = 1 << 20 // 1 MiB

type Server struct {
	svc    *engine.Service
	apiKey string
}

func NewServer(svc *engine.Service, apiKey string) *Server { return &Server{svc: svc, apiKey: apiKey} }

func (s *Server) Routes() http.Handler {
	limiter := newRateLimiter(120, 1*time.Minute)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /events", s.handleEvent)
	mux.HandleFunc("GET /analytics", s.handleAnalytics)
	mux.HandleFunc("GET /healthz", s.handleHealth)
	mux.HandleFunc("GET /readyz", s.handleReady)

	var handler http.Handler = mux

	handler = limiter.middleware(handler)
	handler = methodGuardMiddleware(handler)
	handler = requestIDMiddleware(handler)
	handler = securityHeadersMiddleware(handler)
	handler = recoverMiddleware(handler)
	handler = authMiddleware(s.apiKey, handler)

	// ⚠ CORS LAST (so it runs FIRST)
	handler = corsMiddleware(handler)

	return handler
}

type eventRequest struct {
	Timestamp string            `json:"timestamp"`
	Type      string            `json:"type"`
	VideoID   string            `json:"video_id"`
	UserID    string            `json:"user_id"`
	Payload   map[string]string `json:"payload"`
}

func (s *Server) handleEvent(w http.ResponseWriter, r *http.Request) {
	if ct := r.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "application/json") {
		http.Error(w, "content type must be application/json", http.StatusUnsupportedMediaType)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxEventBodyBytes)
	defer r.Body.Close()

	var req eventRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	ts, err := time.Parse(time.RFC3339, req.Timestamp)
	if err != nil || strings.TrimSpace(req.Type) == "" {
		http.Error(w, "invalid event", http.StatusBadRequest)
		return
	}
	ev := model.Event{
		Timestamp: ts,
		Type:      strings.ToLower(strings.TrimSpace(req.Type)),
		VideoID:   strings.TrimSpace(req.VideoID),
		UserID:    strings.TrimSpace(req.UserID),
		Payload:   req.Payload,
	}
	select {
	case s.svc.IngestChan() <- ev:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	default:
		http.Error(w, "queue full", http.StatusServiceUnavailable)
	}
}

func (s *Server) handleAnalytics(w http.ResponseWriter, r *http.Request) {
	query := engine.AnalyticsQuery{FromDay: 1, ToDay: engine.RollingWindowDays}

	if daysRaw := strings.TrimSpace(r.URL.Query().Get("days")); daysRaw != "" {
		parsedDays, err := strconv.Atoi(daysRaw)
		if err != nil {
			http.Error(w, "days must be an integer", http.StatusBadRequest)
			return
		}
		query.ToDay = parsedDays
	}

	if fromRaw := strings.TrimSpace(r.URL.Query().Get("from_day")); fromRaw != "" {
		parsedFrom, err := strconv.Atoi(fromRaw)
		if err != nil {
			http.Error(w, "from_day must be an integer", http.StatusBadRequest)
			return
		}
		query.FromDay = parsedFrom
	}

	if toRaw := strings.TrimSpace(r.URL.Query().Get("to_day")); toRaw != "" {
		parsedTo, err := strconv.Atoi(toRaw)
		if err != nil {
			http.Error(w, "to_day must be an integer", http.StatusBadRequest)
			return
		}
		query.ToDay = parsedTo
	}

	payload, err := s.svc.ReadAnalyticsJSON(query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(payload)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func (s *Server) handleReady(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ready"}`))
}
