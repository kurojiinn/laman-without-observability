.PHONY: help build run test migrate-up migrate-down migrate-create docker-up docker-down docker-build docker-logs clean

# Variables
DB_HOST ?= localhost
DB_PORT ?= 5432
DB_USER ?= postgres
DB_PASSWORD ?= postgres
DB_NAME ?= laman
MIGRATE_CMD = migrate -path ./migrations -database "postgres://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=disable"

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the application
	@echo "Building application..."
	@go build -o bin/api ./cmd/api

run: ## Run the application locally
	@echo "Running application..."
	@go run ./cmd/api

test: ## Run tests
	@echo "Running tests..."
	@go test -v ./...

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	@go test -v -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

migrate-up: ## Run database migrations up
	@echo "Running migrations up..."
	@$(MIGRATE_CMD) up

migrate-down: ## Run database migrations down
	@echo "Running migrations down..."
	@$(MIGRATE_CMD) down

migrate-force: ## Force migration version (use VERSION=xxx)
	@echo "Forcing migration version $(VERSION)..."
	@$(MIGRATE_CMD) force $(VERSION)

migrate-version: ## Show current migration version
	@echo "Current migration version:"
	@$(MIGRATE_CMD) version

migrate-create: ## Create a new migration (use NAME=xxx)
	@if [ -z "$(NAME)" ]; then \
		echo "Error: NAME is required. Usage: make migrate-create NAME=create_users_table"; \
		exit 1; \
	fi
	@echo "Creating migration: $(NAME)..."
	@migrate create -ext sql -dir ./migrations -seq $(NAME)

docker-up: ## Start all services with docker-compose
	@echo "Starting services with docker-compose..."
	@docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 5
	@echo "Services started. API: http://localhost:8080"
	@echo "Grafana: http://localhost:3000 (admin/admin)"
	@echo "Jaeger: http://localhost:16686"
	@echo "Prometheus: http://localhost:9090"

docker-down: ## Stop all services
	@echo "Stopping services..."
	@docker-compose down

docker-build: ## Build docker images
	@echo "Building docker images..."
	@docker-compose build

docker-logs: ## Show docker logs
	@docker-compose logs -f

docker-restart: ## Restart all services
	@echo "Restarting services..."
	@docker-compose restart

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	@rm -rf bin/
	@rm -f coverage.out coverage.html

deps: ## Download dependencies
	@echo "Downloading dependencies..."
	@go mod download
	@go mod tidy

lint: ## Run linter
	@echo "Running linter..."
	@golangci-lint run ./...

fmt: ## Format code
	@echo "Formatting code..."
	@go fmt ./...

vet: ## Run go vet
	@echo "Running go vet..."
	@go vet ./...
