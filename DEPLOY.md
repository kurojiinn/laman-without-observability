# Laman — Справочник по деплою

> Полное руководство: фронт, бэк, БД, Nginx, HTTPS, S3.

---

## Содержание

1. [Общая архитектура](#1-общая-архитектура)
2. [Сервер: подготовка](#2-сервер-подготовка)
3. [Docker и docker-compose](#3-docker-и-docker-compose)
4. [Порты и сетевая схема](#4-порты-и-сетевая-схема)
5. [Dockerfile для фронтендов](#5-dockerfile-для-фронтендов)
6. [Nginx — конфигурация](#6-nginx--конфигурация)
7. [HTTPS через Let's Encrypt](#7-https-через-lets-encrypt)
8. [База данных PostgreSQL](#8-база-данных-postgresql)
9. [Redis](#9-redis)
10. [Хранилище файлов (S3 / MinIO)](#10-хранилище-файлов-s3--minio)
11. [Переменные окружения для прода](#11-переменные-окружения-для-прода)
12. [CI/CD — GitLab pipeline](#12-cicd--gitlab-pipeline)
13. [Чеклист перед деплоем](#13-чеклист-перед-деплоем)

---

## 1. Общая архитектура

```
                        Интернет
                           │
                    ┌──────▼──────┐
                    │    Nginx    │  :80 → redirect HTTPS
                    │  (reverse   │  :443 → SSL termination
                    │   proxy)    │
                    └──────┬──────┘
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──┐  ┌──────▼──┐  ┌─────▼──────┐
       │ client  │  │  admin  │  │   picker   │
       │  :3000  │  │  :5173  │  │   :5174    │
       │ Next.js │  │  Vite   │  │   Vite     │
       └─────────┘  └─────────┘  └────────────┘
              │            │            │
              └────────────▼────────────┘
                    ┌──────────────┐
                    │  Go API      │  :8080
                    │  (Backend)   │
                    └──────┬───────┘
              ┌────────────┼────────────┐
       ┌──────▼──┐  ┌──────▼──┐  ┌─────▼──────┐
       │Postgres │  │  Redis  │  │  S3/MinIO  │
       │  :5432  │  │  :6379  │  │  :9000     │
       └─────────┘  └─────────┘  └────────────┘
```

**Правило:** Nginx — единственный сервис, открытый в интернет.
Все остальные порты доступны только внутри Docker-сети.

---

## 2. Сервер: подготовка

### Минимальные требования
| Параметр | Минимум | Рекомендуется |
|----------|---------|---------------|
| CPU      | 1 vCPU  | 2 vCPU        |
| RAM      | 1 GB    | 2 GB          |
| Диск     | 20 GB   | 40 GB SSD     |
| ОС       | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Установка зависимостей
```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose v2 (уже встроен в Docker Desktop, на сервере может не быть)
sudo apt install docker-compose-plugin -y

# Проверить
docker --version
docker compose version
```

### Настройка firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
# Всё остальное (5432, 6379, 8080) — НЕ открывать наружу!
```

---

## 3. Docker и docker-compose

### Структура docker-compose.yml для прода

```yaml
# docker-compose.yml (production)
version: "3.9"

services:

  # ── База данных ──────────────────────────────────────────
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - internal
    # Порт НЕ пробрасывать наружу! Только внутри сети.

  # ── Redis ────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - internal

  # ── Go Backend ───────────────────────────────────────────
  api:
    build:
      context: ./Backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./Backend/uploads:/app/uploads  # файлы (или S3, см. раздел 10)
    networks:
      - internal
    depends_on:
      - postgres
      - redis
    # Порт 8080 — только внутри сети, Nginx проксирует

  # ── Client App (Next.js) ──────────────────────────────────
  client-app:
    build:
      context: ./Frontend/client-app
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: https://api.yourdomain.com
    networks:
      - internal

  # ── Admin Panel ───────────────────────────────────────────
  admin-panel:
    build:
      context: ./Frontend/admin-panel
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    networks:
      - internal

  # ── Picker Panel ──────────────────────────────────────────
  picker-panel:
    build:
      context: ./Frontend/picker-panel
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    networks:
      - internal

  # ── Nginx ─────────────────────────────────────────────────
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro   # SSL сертификаты
      - certbot_www:/var/www/certbot            # для certbot challenge
    networks:
      - internal
    depends_on:
      - api
      - client-app
      - admin-panel
      - picker-panel

  # ── MinIO (S3-совместимое хранилище) ─────────────────────
  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - minio_data:/data
    networks:
      - internal
    # :9000 — S3 API (внутри сети)
    # :9001 — Web console (можно временно открыть для настройки)

volumes:
  postgres_data:
  redis_data:
  minio_data:
  certbot_www:

networks:
  internal:
    driver: bridge
```

---

## 4. Порты и сетевая схема

### Что открыто наружу (через Nginx)
| Домен                      | Порт | Что обслуживает        |
|----------------------------|------|------------------------|
| laman.app                  | 443  | client-app (Next.js)   |
| admin.laman.app            | 443  | admin-panel (Vite)     |
| picker.laman.app           | 443  | picker-panel (Vite)    |
| api.laman.app              | 443  | Go backend API         |

### Внутренние порты (только Docker-сеть)
| Сервис      | Внутренний порт | Кто обращается         |
|-------------|-----------------|------------------------|
| api         | 8080            | Nginx, фронтенды       |
| postgres    | 5432            | api                    |
| redis       | 6379            | api                    |
| client-app  | 3000            | Nginx                  |
| admin-panel | 5173            | Nginx                  |
| picker-panel| 5174            | Nginx                  |
| minio       | 9000            | api                    |

### Золотое правило
```
Наружу (ports:) → только nginx :80 и :443
Всё остальное → только через networks: internal
```

---

## 5. Dockerfile для фронтендов

### client-app (Next.js) — prod Dockerfile

```dockerfile
# Frontend/client-app/Dockerfile.prod

# ── Стадия 1: сборка ──────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --frozen-lockfile

COPY . .

# Build-time переменные (публичные — не секреты!)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ── Стадия 2: запуск ──────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Копируем только нужное для запуска
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

> **Важно:** Для standalone-режима в `next.config.ts` добавить:
> ```ts
> const nextConfig = {
>   output: 'standalone',
> }
> ```

### admin-panel / picker-panel (Vite) — prod Dockerfile

```dockerfile
# Frontend/admin-panel/Dockerfile.prod  (picker-panel аналогично)

# ── Стадия 1: сборка ──────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --frozen-lockfile

COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build
# Результат в /app/dist

# ── Стадия 2: nginx раздаёт статику ───────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

```nginx
# nginx-spa.conf — для SPA (React Router)
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 6. Nginx — конфигурация

### Структура файлов
```
nginx/
├── nginx.conf          ← основной конфиг
└── conf.d/
    ├── laman.conf      ← client-app
    ├── admin.conf      ← admin-panel
    ├── picker.conf     ← picker-panel
    └── api.conf        ← backend API
```

### nginx/nginx.conf
```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Логи
    log_format main '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent"';
    access_log /var/log/nginx/access.log main;

    sendfile on;
    keepalive_timeout 65;

    # Размер загружаемых файлов (для изображений товаров)
    client_max_body_size 20M;

    # Gzip сжатие
    gzip on;
    gzip_types text/plain text/css application/json
               application/javascript text/xml application/xml
               image/svg+xml;

    include /etc/nginx/conf.d/*.conf;
}
```

### conf.d/api.conf — Backend API
```nginx
server {
    listen 80;
    server_name api.laman.app;
    # Перенаправить всё на HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.laman.app;

    ssl_certificate     /etc/letsencrypt/live/api.laman.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.laman.app/privkey.pem;

    # Безопасные настройки SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass         http://api:8080;
        proxy_http_version 1.1;

        # Заголовки для WebSocket и SSE
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # Таймауты (важно для SSE — долгие соединения)
        proxy_read_timeout  3600s;
        proxy_send_timeout  3600s;
    }

    # Статика (загруженные файлы) — если НЕ используешь S3
    location /uploads/ {
        alias /app/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### conf.d/laman.conf — Client App (Next.js)
```nginx
server {
    listen 80;
    server_name laman.app www.laman.app;
    return 301 https://laman.app$request_uri;
}

server {
    listen 443 ssl;
    server_name laman.app www.laman.app;

    ssl_certificate     /etc/letsencrypt/live/laman.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/laman.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass         http://client-app:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### conf.d/admin.conf и conf.d/picker.conf — Vite SPA
```nginx
# Аналогично laman.conf, только server_name и proxy_pass другие:
# admin.laman.app → proxy_pass http://admin-panel:80;
# picker.laman.app → proxy_pass http://picker-panel:80;
```

---

## 7. HTTPS через Let's Encrypt

### Способ 1 — Certbot (рекомендуется для начала)

```bash
# На сервере (не в Docker!)
sudo apt install certbot -y

# Получить сертификат (nginx должен быть запущен и слушать :80)
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d laman.app \
  -d www.laman.app \
  --email your@email.com \
  --agree-tos

# Повторить для каждого поддомена:
sudo certbot certonly --webroot -w /var/www/certbot \
  -d api.laman.app --email your@email.com --agree-tos

sudo certbot certonly --webroot -w /var/www/certbot \
  -d admin.laman.app --email your@email.com --agree-tos

sudo certbot certonly --webroot -w /var/www/certbot \
  -d picker.laman.app --email your@email.com --agree-tos
```

### Автоматическое обновление
```bash
# Добавить в crontab (раз в день certbot проверяет срок)
sudo crontab -e
# Добавить строку:
0 3 * * * certbot renew --quiet && docker compose -f /path/to/docker-compose.yml exec nginx nginx -s reload
```

### Способ 2 — Traefik (всё автоматически)

Если не хочется возиться с certbot вручную, Traefik — прокси с встроенным Let's Encrypt:

```yaml
# Добавить в docker-compose.yml вместо nginx:
  traefik:
    image: traefik:v3
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.email=your@email.com"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt

# Для каждого сервиса добавить labels:
  api:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.laman.app`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=le"
      - "traefik.http.services.api.loadbalancer.server.port=8080"
```

> Traefik сам получает и обновляет сертификаты. Проще в эксплуатации.

---

## 8. База данных PostgreSQL

### Бэкапы (обязательно!)
```bash
# Создать бэкап вручную
docker compose exec postgres pg_dump -U postgres laman > backup_$(date +%Y%m%d).sql

# Автоматический бэкап (crontab, каждую ночь в 2:00)
0 2 * * * docker compose -f /path/docker-compose.yml exec -T postgres \
  pg_dump -U postgres laman | gzip > /backups/laman_$(date +\%Y\%m\%d).sql.gz

# Восстановить из бэкапа
docker compose exec -T postgres psql -U postgres laman < backup.sql
```

### Миграции при деплое
```bash
# Всегда запускать миграции после обновления кода
docker compose exec api sh -c "cd /app && ./goose -dir /migrations postgres '${DATABASE_URL}' up"
# ИЛИ через Makefile (если api-контейнер содержит make)
docker compose exec api make migrate-up
```

### Подключение из Go бэкенда
```
# Внутри Docker-сети имя хоста = имя сервиса в docker-compose
DB_HOST=postgres   ← не localhost, не IP!
DB_PORT=5432
DB_USER=postgres
DB_NAME=laman
DB_PASSWORD=<секрет>
DB_SSLMODE=disable  # внутри одного сервера SSL не нужен
```

---

## 9. Redis

```
# Внутри Docker-сети
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
```

### Persistence (чтобы данные не терялись при рестарте)
```yaml
# В docker-compose.yml
  redis:
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --appendonly yes          # AOF persistence
      --appendfsync everysec    # сбрасывать на диск каждую секунду
```

---

## 10. Хранилище файлов (S3 / MinIO)

### Проблема с локальными файлами
Сейчас изображения хранятся в `Backend/uploads/`. Это нормально для одного сервера,
но неудобно при масштабировании и переносе. Для прода лучше использовать S3.

### Вариант A — MinIO (self-hosted, бесплатно)
MinIO — S3-совместимое хранилище, запускается в Docker.

```yaml
# docker-compose.yml
  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - minio_data:/data
    networks:
      - internal
    # Для первоначальной настройки временно открыть консоль:
    # ports:
    #   - "9001:9001"
```

**Настройка MinIO:**
1. Открыть консоль `http://server_ip:9001` (временно)
2. Создать bucket `laman-uploads`
3. Установить политику bucket: `public` (для публичного чтения изображений)
4. Создать Access Key + Secret Key для бэкенда
5. Закрыть порт после настройки

**Переменные для бэкенда:**
```env
S3_ENDPOINT=http://minio:9000
S3_BUCKET=laman-uploads
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_REGION=us-east-1          # MinIO не требует реальный регион
S3_PUBLIC_URL=https://api.laman.app/files  # через Nginx прокси
```

**Nginx для MinIO (раздача публичных файлов):**
```nginx
# Добавить в conf.d/api.conf
location /files/ {
    proxy_pass http://minio:9000/laman-uploads/;
    proxy_set_header Host $http_host;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### Вариант B — AWS S3 (managed, платно)
```env
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=laman-uploads
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=...
S3_REGION=eu-central-1
S3_PUBLIC_URL=https://laman-uploads.s3.eu-central-1.amazonaws.com
```

### Как изменить бэкенд для работы с S3

Вместо сохранения файла на диск — загружать в S3:

```go
// Пример функции загрузки (добавить в catalog или отдельный пакет storage/)
func UploadImage(ctx context.Context, file multipart.File, filename string) (string, error) {
    cfg, _ := config.LoadDefaultConfig(ctx,
        config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
            os.Getenv("S3_ACCESS_KEY"),
            os.Getenv("S3_SECRET_KEY"), "")),
        config.WithRegion(os.Getenv("S3_REGION")),
        config.WithEndpointResolverWithOptions(...), // для MinIO
    )
    client := s3.NewFromConfig(cfg)

    _, err := client.PutObject(ctx, &s3.PutObjectInput{
        Bucket:      aws.String(os.Getenv("S3_BUCKET")),
        Key:         aws.String("products/" + filename),
        Body:        file,
        ContentType: aws.String("image/jpeg"),
    })
    if err != nil {
        return "", err
    }

    return os.Getenv("S3_PUBLIC_URL") + "/products/" + filename, nil
}
```

> Go SDK: `github.com/aws/aws-sdk-go-v2/service/s3`
> Работает одинаково для AWS S3 и MinIO (S3-совместимый API).

---

## 11. Переменные окружения для прода

### .env (production)
```env
# ── База данных ──────────────────────────────────────────
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<сильный_пароль_32+_символа>
DB_NAME=laman
DB_SSLMODE=disable

# ── Сервер ───────────────────────────────────────────────
SERVER_PORT=8080
SERVER_HOST=0.0.0.0
PUBLIC_URL=https://api.laman.app
JWT_SECRET=<случайная_строка_64_символа>

# ── Внешние сервисы ──────────────────────────────────────
SMS_RU_KEY=<ключ>
SMSRU_API_KEY=<ключ>
SMS_RU_TEST=false           # ← ОБЯЗАТЕЛЬНО false в проде!
TG_BOT_TOKEN=<токен>
TG_CHAT_ID=<id>
TG_COURIER_GROUP_ID=<id>

# ── Cookie ───────────────────────────────────────────────
COOKIE_SECURE=true          # ← ОБЯЗАТЕЛЬНО true в проде!

# ── Администратор ────────────────────────────────────────
ADMIN_USER=<ваш_логин>
ADMIN_PASSWORD=<сильный_пароль>

# ── CORS ─────────────────────────────────────────────────
CORS_ORIGINS=https://laman.app,https://admin.laman.app,https://picker.laman.app

# ── Redis ────────────────────────────────────────────────
REDIS_PASSWORD=<сильный_пароль>
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# ── S3 / MinIO ───────────────────────────────────────────
S3_ENDPOINT=http://minio:9000
S3_BUCKET=laman-uploads
S3_ACCESS_KEY=<ключ>
S3_SECRET_KEY=<секрет>
S3_REGION=us-east-1
S3_PUBLIC_URL=https://api.laman.app/files

# ── MinIO ────────────────────────────────────────────────
MINIO_USER=<логин>
MINIO_PASSWORD=<пароль>

# ── Web Push ─────────────────────────────────────────────
VAPID_PUBLIC_KEY=<ключ>
VAPID_PRIVATE_KEY=<ключ>
VAPID_EMAIL=admin@laman.app
```

### Генерация секретных ключей
```bash
# JWT_SECRET (64 символа)
openssl rand -hex 32

# Пароль для БД / Redis
openssl rand -base64 32

# VAPID ключи для Web Push
npx web-push generate-vapid-keys
```

---

## 12. CI/CD — GitLab pipeline

```yaml
# .gitlab-ci.yml
stages:
  - lint
  - build
  - deploy_staging
  - deploy_prod

variables:
  REGISTRY: registry.gitlab.com/khadzhiev404/laman-backend
  IMAGE_TAG: $CI_COMMIT_SHORT_SHA

lint:
  stage: lint
  script:
    - cd Backend && golangci-lint run ./...

build:
  stage: build
  script:
    - docker build -t $REGISTRY/api:$IMAGE_TAG ./Backend
    - docker push $REGISTRY/api:$IMAGE_TAG
    # Фронтенды
    - docker build -t $REGISTRY/client:$IMAGE_TAG
        --build-arg NEXT_PUBLIC_API_URL=https://api.laman.app
        ./Frontend/client-app -f ./Frontend/client-app/Dockerfile.prod
    - docker push $REGISTRY/client:$IMAGE_TAG

deploy_prod:
  stage: deploy_prod
  when: manual
  script:
    - ssh deploy@server "cd /app && docker compose pull && docker compose up -d --no-build"
    - ssh deploy@server "docker compose exec -T api ./goose -dir migrations up"
  environment:
    name: production
    url: https://laman.app
```

---

## 13. Чеклист перед деплоем

### Безопасность
- [ ] `.env` нет в git (проверить `git log --all --full-history -- .env`)
- [ ] `SMS_RU_TEST=false`
- [ ] `COOKIE_SECURE=true`
- [ ] Все пароли — случайные строки 32+ символа
- [ ] Firewall: наружу только :80 и :443

### Конфигурация
- [ ] `PUBLIC_URL` и `CORS_ORIGINS` — с доменами, не IP
- [ ] Миграции применены (`make migrate-up`)
- [ ] MinIO bucket создан и настроен

### SSL
- [ ] Сертификаты получены для всех поддоменов
- [ ] Автообновление certbot настроено в cron

### Мониторинг
- [ ] Telegram бот отправляет уведомления о заказах
- [ ] `docker compose logs -f api` — нет FATAL ошибок при старте

### После деплоя
- [ ] Проверить `https://laman.app` в браузере
- [ ] Войти через SMS и сделать тестовый заказ
- [ ] Проверить admin-panel и picker-panel
- [ ] Убедиться, что картинки загружаются и отображаются

---

*Документ актуален для версии проекта на апрель 2026.*
