package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"analyticsmicro/internal/engine"
	"analyticsmicro/internal/model"
)

type Server struct {
	svc *engine.Service
}

func NewServer(svc *engine.Service) *Server { return &Server{svc: svc} }

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /events", s.handleEvent)
	mux.HandleFunc("GET /analytics", s.handleAnalytics)
	return mux
}

type eventRequest struct {
	Timestamp string `json:"timestamp"`
	VideoID   string `json:"video_id"`
	UserID    string `json:"user_id"`
}

func (s *Server) handleEvent(w http.ResponseWriter, r *http.Request) {
	var req eventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	ts, err := time.Parse(time.RFC3339, req.Timestamp)
	if err != nil || req.VideoID == "" || req.UserID == "" {
		http.Error(w, "invalid event", http.StatusBadRequest)
		return
	}
	ev := model.Event{Timestamp: ts, VideoID: req.VideoID, UserID: req.UserID}
	select {
	case s.svc.IngestChan() <- ev:
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	default:
		http.Error(w, "queue full", http.StatusServiceUnavailable)
	}
}

func (s *Server) handleAnalytics(w http.ResponseWriter, r *http.Request) {
	days := 30
	if q := r.URL.Query().Get("days"); q != "" {
		parsed, err := strconv.Atoi(q)
		if err != nil {
			http.Error(w, "invalid days", http.StatusBadRequest)
			return
		}
		days = parsed
	}
	out, err := s.svc.ReadAnalytics(days)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}
