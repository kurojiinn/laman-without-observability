package middleware

import "github.com/gin-gonic/gin"

// MetricsMiddleware — заглушка, оставлена для совместимости.
func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) { c.Next() }
}
