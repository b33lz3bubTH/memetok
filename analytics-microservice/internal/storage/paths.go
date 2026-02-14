package storage

import (
	"path/filepath"
)

type Paths struct {
	Root          string
	WALPath       string
	WALOffsetPath string
	ViewsDir      string
	DAUDir        string
	SnapshotPath  string
}

func NewPaths(root string) Paths {
	return Paths{
		Root:          root,
		WALPath:       filepath.Join(root, "wal", "events.wal"),
		WALOffsetPath: filepath.Join(root, "meta", "wal.offset"),
		ViewsDir:      filepath.Join(root, "segments", "views"),
		DAUDir:        filepath.Join(root, "segments", "dau"),
		SnapshotPath:  filepath.Join(root, "snapshots", "views.rolling30.snapshot"),
	}
}
