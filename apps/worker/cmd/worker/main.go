// Command worker runs the Aegis background job processor (Asynq) and its ops HTTP server (Fiber).
package main

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog"

	"aegis/apps/worker/internal/config"
	"aegis/apps/worker/internal/httpserver"
	"aegis/apps/worker/internal/tasks"
)

func main() {
	log := zerolog.New(os.Stdout).With().Timestamp().Str("service", "worker").Logger()
	if err := run(log); err != nil {
		log.Fatal().Err(err).Msg("worker stopped with error")
	}
}

func run(log zerolog.Logger) error {
	// Local dev convenience: pick up the monorepo root .env. Never overrides real env vars.
	if err := godotenv.Load("../../.env"); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}

	cfg, err := config.Load(config.LookupEnv)
	if err != nil {
		return err
	}
	log = log.Level(cfg.LogLevel)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	redisOpt, err := asynq.ParseRedisURI(cfg.RedisURL)
	if err != nil {
		return err
	}
	inspector := asynq.NewInspector(redisOpt)
	defer inspector.Close()

	srv := asynq.NewServer(redisOpt, asynq.Config{
		Concurrency:     cfg.Concurrency,
		Queues:          tasks.Queues,
		ShutdownTimeout: cfg.ShutdownTimeout,
		Logger:          newAsynqLogger(log),
		ErrorHandler: asynq.ErrorHandlerFunc(func(_ context.Context, t *asynq.Task, err error) {
			log.Error().Err(err).Str("task", t.Type()).Msg("task failed")
		}),
	})
	if err := srv.Start(tasks.NewServeMux(log)); err != nil {
		return err
	}
	defer srv.Shutdown()

	app := httpserver.New(log, map[string]httpserver.Checker{
		"postgres": pool,
		"redis": httpserver.CheckerFunc(func(context.Context) error {
			_, err := inspector.Queues()
			return err
		}),
	})

	httpErr := make(chan error, 1)
	go func() {
		httpErr <- app.Listen(cfg.HTTPAddr, fiber.ListenConfig{DisableStartupMessage: true})
	}()
	log.Info().Str("http_addr", cfg.HTTPAddr).Int("concurrency", cfg.Concurrency).Msg("worker started")

	select {
	case <-ctx.Done():
		log.Info().Msg("shutdown signal received")
	case err := <-httpErr:
		return err
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return app.ShutdownWithContext(shutdownCtx)
}
