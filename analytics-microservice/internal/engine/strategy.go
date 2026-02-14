package engine

import (
	"sort"

	"analyticsmicro/internal/model"
	"analyticsmicro/internal/storage"
)

type EventStrategy interface {
	Type() string
	Accumulate(event model.Event, state *BatchState)
	Flush(day string, state *BatchState, store *storage.Store) error
}

type BatchState struct {
	ViewsByDay map[string]map[string]int
	DAUByDay   map[string]map[string]struct{}
}

func NewBatchState() *BatchState {
	return &BatchState{
		ViewsByDay: make(map[string]map[string]int),
		DAUByDay:   make(map[string]map[string]struct{}),
	}
}

func (s *BatchState) SortedDays() []string {
	days := make([]string, 0, len(s.ViewsByDay))
	for day := range s.ViewsByDay {
		days = append(days, day)
	}
	sort.Strings(days)
	return days
}

type ViewStrategy struct{}

func (ViewStrategy) Type() string { return "view" }

func (ViewStrategy) Accumulate(event model.Event, state *BatchState) {
	if event.VideoID == "" || event.UserID == "" {
		return
	}
	day := event.DayKey()
	if _, ok := state.ViewsByDay[day]; !ok {
		state.ViewsByDay[day] = make(map[string]int)
		state.DAUByDay[day] = make(map[string]struct{})
	}
	state.ViewsByDay[day][event.VideoID]++
	state.DAUByDay[day][storage.HashUserID(event.UserID)] = struct{}{}
}

func (ViewStrategy) Flush(day string, state *BatchState, store *storage.Store) error {
	return store.AppendViewDay(day, state.ViewsByDay[day], state.DAUByDay[day])
}

type NoopStrategy struct{ eventType string }

func NewNoopStrategy(eventType string) NoopStrategy { return NoopStrategy{eventType: eventType} }

func (n NoopStrategy) Type() string { return n.eventType }

func (NoopStrategy) Accumulate(_ model.Event, _ *BatchState) {}

func (NoopStrategy) Flush(_ string, _ *BatchState, _ *storage.Store) error { return nil }
