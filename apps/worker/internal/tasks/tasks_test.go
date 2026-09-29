package tasks

import (
	"context"
	"errors"
	"io"
	"testing"
	"time"

	"github.com/hibiken/asynq"
	"github.com/rs/zerolog"
)

func TestPing_RoundTrip(t *testing.T) {
	task, err := NewPingTask(time.Now())
	if err != nil {
		t.Fatalf("NewPingTask: %v", err)
	}
	mux := NewServeMux(zerolog.New(io.Discard))
	if err := mux.ProcessTask(context.Background(), task); err != nil {
		t.Fatalf("ProcessTask: %v", err)
	}
}

func TestPing_MalformedPayloadSkipsRetry(t *testing.T) {
	mux := NewServeMux(zerolog.New(io.Discard))
	err := mux.ProcessTask(context.Background(), asynq.NewTask(TypePing, []byte("{not json")))
	if !errors.Is(err, asynq.SkipRetry) {
		t.Fatalf("expected SkipRetry, got %v", err)
	}
}
