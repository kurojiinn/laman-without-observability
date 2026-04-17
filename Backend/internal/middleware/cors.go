package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORSMiddleware позволяет запросы от заданных origin (например, админ-панели).
func CORSMiddleware(origins []string) gin.HandlerFunc {
	allowed := map[string]struct{}{}
	for _, origin := range origins {
		allowed[origin] = struct{}{}
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			allowMethods := "GET,POST,PATCH,PUT,DELETE,OPTIONS"
			allowHeaders := strings.Join([]string{
				"Origin",
				"Authorization",
				"Content-Type",
				"Accept",
				"X-Request-Id",
			}, ", ")

			if _, ok := allowed[origin]; ok {
				// Известный origin — разрешаем с credentials
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
				c.Writer.Header().Set("Vary", "Origin")
				c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
				c.Writer.Header().Set("Access-Control-Allow-Methods", allowMethods)
				c.Writer.Header().Set("Access-Control-Allow-Headers", allowHeaders)
				c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Length")
			}
			// Неизвестный origin — не устанавливаем CORS-заголовки, браузер заблокирует.
			// Мобильные приложения (iOS) не отправляют Origin, поэтому не затронуты.
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
