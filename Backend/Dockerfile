# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/bin/api ./cmd/api

# Build goose migration tool
RUN go install github.com/pressly/goose/v3/cmd/goose@v3.19.2

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

# Создаём непривилегированного пользователя.
# Контейнер по умолчанию запускается от root (UID 0) — это опасно:
# если приложение взломают через RCE, атакующий получает root внутри контейнера,
# что упрощает побег из контейнера и горизонтальное перемещение по инфраструктуре.
#
# addgroup -S / adduser -S — создаёт системного пользователя без пароля и shell.
# -S означает "system" — без home directory и без записи в /etc/shadow.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/bin/api .

# Copy goose binary
COPY --from=builder /go/bin/goose /usr/local/bin/goose

# Copy migrations
COPY --from=builder /app/migrations ./migrations

# Передаём владение файлами созданному пользователю.
# Без этого appuser не сможет читать файлы скопированные выше (они принадлежат root).
RUN chown -R appuser:appgroup /app

# Переключаемся на непривилегированного пользователя.
# Всё что ниже этой строки (включая CMD) запускается от appuser (не root).
USER appuser

EXPOSE 8080

CMD ["./api"]
