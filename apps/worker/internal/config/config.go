// Package config loads and validates the worker configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

type Config struct {
	DatabaseURL     string
	RedisURL        string
	HTTPAddr        string
	Concurrency     int
	LogLevel        zerolog.Level
	ShutdownTimeout time.Duration
}

// Load reads the configuration from a lookup function (os.LookupEnv in production) and reports
// every invalid variable at once. Values are never included in errors so secrets can't leak to logs.
func Load(lookup func(string) (string, bool)) (Config, error) {
	var errs []error
	get := func(key, fallback string) string {
		if v, ok := lookup(key); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
		return fallback
	}

	cfg := Config{
		DatabaseURL:     get("DATABASE_URL", ""),
		RedisURL:        get("REDIS_URL", ""),
		HTTPAddr:        get("WORKER_HTTP_ADDR", ":8090"),
		ShutdownTimeout: 25 * time.Second,
	}

	if err := requireURL(cfg.DatabaseURL, "postgres", "postgresql"); err != nil {
		errs = append(errs, fmt.Errorf("DATABASE_URL: %w", err))
	}
	if err := requireURL(cfg.RedisURL, "redis", "rediss"); err != nil {
		errs = append(errs, fmt.Errorf("REDIS_URL: %w", err))
	}

	concurrency, err := strconv.Atoi(get("WORKER_CONCURRENCY", "10"))
	switch {
	case err != nil:
		errs = append(errs, errors.New("WORKER_CONCURRENCY: must be an integer"))
	case concurrency < 1 || concurrency > 1000:
		errs = append(errs, errors.New("WORKER_CONCURRENCY: must be between 1 and 1000"))
	default:
		cfg.Concurrency = concurrency
	}

	level, err := zerolog.ParseLevel(get("LOG_LEVEL", "info"))
	if err != nil {
		errs = append(errs, errors.New("LOG_LEVEL: must be one of trace, debug, info, warn, error"))
	}
	cfg.LogLevel = level

	return cfg, errors.Join(errs...)
}

func requireURL(raw string, schemes ...string) error {
	if raw == "" {
		return errors.New("is required")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return errors.New("must be a valid URL")
	}
	for _, s := range schemes {
		if u.Scheme == s {
			return nil
		}
	}
	return fmt.Errorf("scheme must be one of %v", schemes)
}

// LookupEnv is the production lookup function.
func LookupEnv(key string) (string, bool) { return os.LookupEnv(key) }
