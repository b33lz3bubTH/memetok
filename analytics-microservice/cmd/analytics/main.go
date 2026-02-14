package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"analyticsmicro/internal/engine"
	"analyticsmicro/internal/httpapi"
	"analyticsmicro/internal/storage"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	logger := log.New(os.Stdout, "analytics: ", log.LstdFlags)
	store := storage.NewStore("./data")
	svc := engine.NewService(store, logger)
	if err := svc.Start(ctx); err != nil {
		logger.Fatalf("start failed: %v", err)
	}

	server := &http.Server{
		Addr:              ":8081",
		ReadHeaderTimeout: 5 * time.Second,
		Handler:           httpapi.NewServer(svc).Routes(),
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Fatalf("server failed: %v", err)
	}
}
