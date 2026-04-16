package middleware

import (
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// maskQuery удаляет чувствительные параметры из query string перед логированием.
func maskQuery(raw string) string {
	if raw == "" {
		return ""
	}
	vals, err := url.ParseQuery(raw)
	if err != nil {
		return "[unparseable]"
	}
	if _, ok := vals["token"]; ok {
		vals.Set("token", "[REDACTED]")
	}
	return vals.Encode()
}

// LoggingMiddleware логирует HTTP запросы.
func LoggingMiddleware(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := maskQuery(c.Request.URL.RawQuery)

		c.Next()

		latency := time.Since(start)
		logger.Info("HTTP Request",
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.String("query", query),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", latency),
			zap.String("ip", c.ClientIP()),
			zap.String("user_agent", c.Request.UserAgent()),
		)
	}
}
