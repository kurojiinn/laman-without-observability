package middleware

import (
	"net/http"
	"go.uber.org/zap"
	"github.com/gin-gonic/gin"
)

// RecoveryMiddleware обрабатывает паники и логирует ошибку.
func RecoveryMiddleware(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("Паника обработана",
					zap.Any("error", recovered),
					zap.String("path", c.Request.URL.Path),
					zap.String("method", c.Request.Method),
				)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "внутренняя ошибка сервера"})
				c.Abort()
			}
		}()
		c.Next()
	}
}
