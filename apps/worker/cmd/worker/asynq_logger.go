package main

import (
	"fmt"

	"github.com/rs/zerolog"
)

// asynqLogger adapts zerolog to asynq.Logger so all worker output is structured JSON.
type asynqLogger struct{ log zerolog.Logger }

func newAsynqLogger(log zerolog.Logger) asynqLogger {
	return asynqLogger{log: log.With().Str("component", "asynq").Logger()}
}

func (l asynqLogger) Debug(args ...any) { l.log.Debug().Msg(fmt.Sprint(args...)) }
func (l asynqLogger) Info(args ...any)  { l.log.Info().Msg(fmt.Sprint(args...)) }
func (l asynqLogger) Warn(args ...any)  { l.log.Warn().Msg(fmt.Sprint(args...)) }
func (l asynqLogger) Error(args ...any) { l.log.Error().Msg(fmt.Sprint(args...)) }
func (l asynqLogger) Fatal(args ...any) { l.log.Fatal().Msg(fmt.Sprint(args...)) }
