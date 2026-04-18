package observability

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

// StartSpan начинает новый span. Без инициализированного провайдера работает как noop.
func StartSpan(ctx context.Context, name string) (context.Context, trace.Span) {
	return otel.Tracer("laman-api").Start(ctx, name)
}
