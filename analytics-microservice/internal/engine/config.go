package engine

import "time"

const (
	BatchSize         = 1000
	EventChannelSize  = 4096
	FlushInterval     = 2 * time.Minute
	SnapshotInterval  = 5 * time.Minute
	RollingWindowDays = 30
)
