package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config содержит всю конфигурацию приложения.
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	SMS      SMSConfig
	Telegram TelegramConfig
	Admin    AdminConfig
	CORS     CORSConfig
	Redis    RedisConfig
	VAPID    VAPIDConfig
	MinIO    MinIOConfig
}

// MinIOConfig содержит конфигурацию MinIO / S3-совместимого хранилища.
type MinIOConfig struct {
	Endpoint  string
	PublicURL string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
}

// VAPIDConfig содержит ключи для Web Push уведомлений.
type VAPIDConfig struct {
	PublicKey  string
	PrivateKey string
	Email      string
}

// ServerConfig содержит конфигурацию сервера.
type ServerConfig struct {
	Port string
	Host string
	// PublicURL используется для генерации публичных ссылок (например, uploads).
	PublicURL string
	// CookieSecure: true — cookie отправляется только по HTTPS (production).
	// false — можно отправлять по HTTP (local dev).
	CookieSecure bool
}

// DatabaseConfig содержит конфигурацию базы данных.
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

// JWTConfig содержит конфигурацию JWT.
type JWTConfig struct {
	Secret string
}

// SMSConfig содержит конфигурацию SMS провайдера.
type SMSConfig struct {
	RuAPIKey string
	TestMode bool
}

// TelegramConfig содержит конфигурацию Telegram бота.
type TelegramConfig struct {
	BotToken string
	ChatID   string
}

// AdminConfig содержит параметры доступа в админ-панель.
type AdminConfig struct {
	User     string
	Password string
}

// CORSConfig содержит список разрешенных origin.
type CORSConfig struct {
	Origins []string
}

// RedisConfig содержит конфигурацию Redis.
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

// Load загружает конфигурацию из переменных окружения.
func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Port:         getEnv("SERVER_PORT", "8080"),
			Host:         getEnv("SERVER_HOST", "0.0.0.0"),
			PublicURL:    getEnv("PUBLIC_URL", "http://localhost:8080"),
			CookieSecure: getEnvBool("COOKIE_SECURE", false),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "postgres"),
			Name:     getEnv("DB_NAME", "laman"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
		},
		SMS: SMSConfig{
			RuAPIKey: getEnv("SMS_RU_KEY", getEnv("SMSRU_API_KEY", "")),
			TestMode: getEnvBool("SMS_RU_TEST", false),
		},
		Telegram: TelegramConfig{
			BotToken: getEnv("TG_BOT_TOKEN", ""),
			ChatID:   getEnv("TG_CHAT_ID", ""),
		},
		Admin: AdminConfig{
			User:     getEnv("ADMIN_USER", ""),
			Password: getEnv("ADMIN_PASSWORD", ""),
		},
		CORS: CORSConfig{
			Origins: splitAndTrim(getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174")),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvAsInt("REDIS_DB", 0),
		},
		VAPID: VAPIDConfig{
			PublicKey:  getEnv("VAPID_PUBLIC_KEY", ""),
			PrivateKey: getEnv("VAPID_PRIVATE_KEY", ""),
			Email:      getEnv("VAPID_EMAIL", ""),
		},
		MinIO: MinIOConfig{
			Endpoint:  getEnv("MINIO_ENDPOINT", "localhost:9000"),
			PublicURL: getEnv("MINIO_PUBLIC_URL", "http://localhost:9000"),
			AccessKey: getEnv("MINIO_ACCESS_KEY", ""),
			SecretKey: getEnv("MINIO_SECRET_KEY", ""),
			Bucket:    getEnv("MINIO_BUCKET", "laman-images"),
			UseSSL:    getEnvBool("MINIO_USE_SSL", false),
		},
	}

	if cfg.JWT.Secret == "your-secret-key-change-in-production" {
		return nil, fmt.Errorf("JWT_SECRET должен быть установлен в переменных окружения")
	}

	if cfg.Admin.User == "" || cfg.Admin.Password == "" {
		return nil, fmt.Errorf("ADMIN_USER и ADMIN_PASSWORD должны быть установлены в переменных окружения")
	}

	return cfg, nil
}

// DSN возвращает строку подключения к базе данных.
func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.Name, d.SSLMode)
}

// Addr возвращает адрес подключения к Redis.
func (r *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%s", r.Host, r.Port)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return strings.EqualFold(value, "true") || value == "1"
}

func splitAndTrim(value string) []string {
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
