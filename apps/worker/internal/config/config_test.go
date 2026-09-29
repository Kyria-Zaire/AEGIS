package config

import (
	"strings"
	"testing"

	"github.com/rs/zerolog"
)

func lookupFrom(env map[string]string) func(string) (string, bool) {
	return func(k string) (string, bool) {
		v, ok := env[k]
		return v, ok
	}
}

func TestLoad_ValidWithDefaults(t *testing.T) {
	cfg, err := Load(lookupFrom(map[string]string{
		"DATABASE_URL": "postgresql://u:p@localhost:5432/aegis",
		"REDIS_URL":    "redis://localhost:6379/0",
	}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HTTPAddr != ":8090" || cfg.Concurrency != 10 || cfg.LogLevel != zerolog.InfoLevel {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
}

func TestLoad_ReportsAllErrorsWithoutValues(t *testing.T) {
	const secret = "mysql://root:hunter2@db/x"
	_, err := Load(lookupFrom(map[string]string{
		"DATABASE_URL":       secret,
		"WORKER_CONCURRENCY": "0",
		"LOG_LEVEL":          "loud",
	}))
	if err == nil {
		t.Fatal("expected an error")
	}
	msg := err.Error()
	for _, want := range []string{"DATABASE_URL", "REDIS_URL", "WORKER_CONCURRENCY", "LOG_LEVEL"} {
		if !strings.Contains(msg, want) {
			t.Errorf("error should mention %s, got: %s", want, msg)
		}
	}
	if strings.Contains(msg, "hunter2") {
		t.Errorf("error leaks secret value: %s", msg)
	}
}
