package model

import "time"

type Event struct {
	Timestamp time.Time         `json:"timestamp"`
	Type      string            `json:"type"`
	VideoID   string            `json:"video_id,omitempty"`
	UserID    string            `json:"user_id,omitempty"`
	Payload   map[string]string `json:"payload,omitempty"`
}

func (e Event) DayKey() string {
	return e.Timestamp.UTC().Format("2006-01-02")
}
