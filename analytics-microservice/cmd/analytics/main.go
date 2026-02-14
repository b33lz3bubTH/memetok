package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"analyticsmicro/internal/engine"
	"analyticsmicro/internal/httpapi"
	"analyticsmicro/internal/storage"
)

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return fallback
}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	logger := log.New(os.Stdout, "analytics: ", log.LstdFlags)
	dataDir := getEnv("ANALYTICS_DATA_DIR", "./data")
	apiKey := os.Getenv("ANALYTICS_API_KEY")
	port := getEnv("ANALYTICS_PORT", "8997")

	store := storage.NewStore(dataDir)
	svc := engine.NewService(store, logger)
	if err := svc.Start(ctx); err != nil {
		logger.Fatalf("start failed: %v", err)
	}

	server := &http.Server{
		Addr:              ":" + port,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    getEnvInt("ANALYTICS_MAX_HEADER_BYTES", 1<<20),
		Handler:           httpapi.NewServer(svc, apiKey).Routes(),
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	logger.Printf("[info]: starting analytics server on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Fatalf("server failed: %v", err)
	}
}
