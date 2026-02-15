package engine

import "time"

const (
	BatchSize         = 1000
	EventChannelSize  = 4096
	FlushInterval     = 10 * time.Second
	SnapshotInterval  = 5 * time.Minute
	RollingWindowDays = 30
)
