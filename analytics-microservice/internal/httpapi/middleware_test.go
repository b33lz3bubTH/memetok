package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthMiddlewareAllowsPublicPathsWithoutAPIKey(t *testing.T) {
	t.Parallel()

	tests := []string{"/events", "/healthz", "/readyz"}
	for _, path := range tests {
		path := path
		t.Run(path, func(t *testing.T) {
			t.Parallel()
			wrapped := authMiddleware("secret", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusNoContent)
			}))

			req := httptest.NewRequest(http.MethodGet, path, nil)
			rec := httptest.NewRecorder()
			wrapped.ServeHTTP(rec, req)

			if rec.Code != http.StatusNoContent {
				t.Fatalf("expected status %d, got %d", http.StatusNoContent, rec.Code)
			}
		})
	}
}

func TestAuthMiddlewareProtectsAnalytics(t *testing.T) {
	t.Parallel()

	wrapped := authMiddleware("secret", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("without API key", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodGet, "/analytics", nil)
		rec := httptest.NewRecorder()

		wrapped.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("with API key header", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodGet, "/analytics", nil)
		req.Header.Set("X-API-Key", "secret")
		rec := httptest.NewRecorder()

		wrapped.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
		}
	})

	t.Run("with API key query", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodGet, "/analytics?api_key=secret", nil)
		rec := httptest.NewRecorder()

		wrapped.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
		}
	})
}
