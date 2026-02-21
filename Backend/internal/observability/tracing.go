package observability

import (
	"context"
	"fmt"
	"Laman/internal/config"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/sdk/resource"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	"go.opentelemetry.io/otel/trace"
)

// InitTracing инициализирует трейсинг OpenTelemetry с экспортером Jaeger.
func InitTracing(cfg *config.Config) (*tracesdk.TracerProvider, error) {
	// Создание экспортера Jaeger
	exp, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(cfg.Jaeger.Endpoint)))
	if err != nil {
		return nil, fmt.Errorf("не удалось создать экспортер Jaeger: %w", err)
	}

	// Создание tracer provider
	tp := tracesdk.NewTracerProvider(
		tracesdk.WithBatcher(exp),
		tracesdk.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceNameKey.String("laman-api"),
		)),
	)

	otel.SetTracerProvider(tp)

	return tp, nil
}

// GetTracer возвращает tracer для указанного имени.
func GetTracer(name string) trace.Tracer {
	return otel.Tracer(name)
}

// StartSpan начинает новый span с указанным именем.
func StartSpan(ctx context.Context, name string) (context.Context, trace.Span) {
	return otel.Tracer("laman-api").Start(ctx, name)
}
