package engine

import "time"

const (
	BatchSize            = 4000
	EventChannelSize     = 65536
	FlushInterval        = 10 * time.Second
	SnapshotInterval     = 5 * time.Minute
	AnalyticsCacheTTL    = 2 * time.Second
	RollingWindowDays    = 30
	WALFlushInterval     = 250 * time.Millisecond
	WALSyncInterval      = 1 * time.Second
	RetentionSweepPeriod = 12 * time.Hour
)
