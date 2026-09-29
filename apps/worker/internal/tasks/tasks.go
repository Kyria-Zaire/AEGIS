// Package tasks declares Asynq task types, their payloads and handlers.
package tasks

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
	"github.com/rs/zerolog"
)

// Queue names, highest priority first. Weights are wired through asynq.Config.Queues in cmd/worker.
const (
	QueueCritical = "critical"
	QueueDefault  = "default"
	QueueLow      = "low"
)

// Queues maps queue name to its relative priority weight.
var Queues = map[string]int{QueueCritical: 6, QueueDefault: 3, QueueLow: 1}

// TypePing is an end-to-end smoke task (enqueue -> Redis -> worker) used to validate the pipeline.
const TypePing = "system:ping"

type PingPayload struct {
	RequestedAt time.Time `json:"requested_at"`
}

func NewPingTask(now time.Time) (*asynq.Task, error) {
	b, err := json.Marshal(PingPayload{RequestedAt: now.UTC()})
	if err != nil {
		return nil, fmt.Errorf("marshal ping payload: %w", err)
	}
	return asynq.NewTask(TypePing, b, asynq.Queue(QueueLow), asynq.MaxRetry(3), asynq.Timeout(30*time.Second)), nil
}

func handlePing(log zerolog.Logger) asynq.HandlerFunc {
	return func(_ context.Context, t *asynq.Task) error {
		var p PingPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			// Malformed payloads will never succeed: skip retries.
			return fmt.Errorf("decode %s payload: %v: %w", TypePing, err, asynq.SkipRetry)
		}
		log.Info().Str("task", TypePing).Dur("latency", time.Since(p.RequestedAt)).Msg("ping processed")
		return nil
	}
}

// NewServeMux registers every task handler.
func NewServeMux(log zerolog.Logger) *asynq.ServeMux {
	mux := asynq.NewServeMux()
	mux.HandleFunc(TypePing, handlePing(log))
	return mux
}
