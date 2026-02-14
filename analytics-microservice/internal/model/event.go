package model

import "time"

type Event struct {
	Timestamp time.Time `json:"timestamp"`
	VideoID   string    `json:"video_id"`
	UserID    string    `json:"user_id"`
}

func (e Event) DayKey() string {
	return e.Timestamp.UTC().Format("2006-01-02")
}
