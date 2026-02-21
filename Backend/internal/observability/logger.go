package observability

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// InitLogger инициализирует продакшн логгер.
func InitLogger() (*zap.Logger, error) {
	config := zap.NewProductionConfig()
	config.EncoderConfig.TimeKey = "timestamp"
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	config.EncoderConfig.LevelKey = "level"
	config.EncoderConfig.MessageKey = "message"
	config.EncoderConfig.CallerKey = "caller"
	config.EncoderConfig.StacktraceKey = "stacktrace"

	logger, err := config.Build()
	if err != nil {
		return nil, err
	}

	return logger, nil
}
