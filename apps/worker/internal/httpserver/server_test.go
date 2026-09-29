package httpserver

import (
	"context"
	"errors"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/rs/zerolog"
)

func up(context.Context) error   { return nil }
func down(context.Context) error { return errors.New("connection refused") }

func TestEndpoints(t *testing.T) {
	cases := []struct {
		name string
		path string
		deps map[string]Checker
		want int
	}{
		{"healthz ignores deps", "/healthz", map[string]Checker{"postgres": CheckerFunc(down)}, 200},
		{"readyz all up", "/readyz", map[string]Checker{"postgres": CheckerFunc(up), "redis": CheckerFunc(up)}, 200},
		{"readyz one down", "/readyz", map[string]Checker{"postgres": CheckerFunc(up), "redis": CheckerFunc(down)}, 503},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app := New(zerolog.New(io.Discard), tc.deps)
			resp, err := app.Test(httptest.NewRequest("GET", tc.path, nil))
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != tc.want {
				t.Fatalf("status = %d, want %d", resp.StatusCode, tc.want)
			}
		})
	}
}
