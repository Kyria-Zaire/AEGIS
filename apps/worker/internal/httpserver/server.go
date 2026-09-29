// Package httpserver exposes the worker's operational HTTP endpoints (liveness / readiness).
package httpserver

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/rs/zerolog"
)

// Checker reports whether a dependency is reachable.
type Checker interface {
	Ping(ctx context.Context) error
}

// CheckerFunc adapts a function to Checker.
type CheckerFunc func(ctx context.Context) error

func (f CheckerFunc) Ping(ctx context.Context) error { return f(ctx) }

const readinessTimeout = 2 * time.Second

// New builds the Fiber app. deps are probed by /readyz; /healthz only reports the process is up.
func New(log zerolog.Logger, deps map[string]Checker) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:      "aegis-worker",
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		IdleTimeout:  30 * time.Second,
	})

	app.Get("/healthz", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	app.Get("/readyz", func(c fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.Context(), readinessTimeout)
		defer cancel()

		checks := make(fiber.Map, len(deps))
		ready := true
		for name, dep := range deps {
			if err := dep.Ping(ctx); err != nil {
				ready = false
				checks[name] = "down"
				log.Warn().Err(err).Str("dependency", name).Msg("readiness check failed")
				continue
			}
			checks[name] = "up"
		}

		status, label := fiber.StatusOK, "ok"
		if !ready {
			status, label = fiber.StatusServiceUnavailable, "unavailable"
		}
		return c.Status(status).JSON(fiber.Map{"status": label, "checks": checks})
	})

	return app
}
