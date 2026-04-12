# План деплоя на Selectel

## Текущее состояние (локальная разработка)

```
docker-compose up -d          → postgres, redis, jaeger, prometheus, grafana, api
cd Frontend/client-app        → npm run dev   (port 3000)
cd Frontend/picker-panel      → npm run dev   (port 5174)
cd Frontend/admin-panel       → npm run dev   (port 5173)
```

---

## Проблемы текущей конфигурации для продакшна

1. **Dockerfiles фронтендов запускают `npm run dev`** — dev-сервер без оптимизаций, без сжатия, не предназначен для продакшна
2. **client-app вообще нет Dockerfile** — нельзя задеплоить как контейнер
3. **Нет nginx** — каждый сервис висит на отдельном порту, нет единой точки входа, нет SSL
4. **Нет разделения dev/prod конфигов** — один docker-compose на всё

---

## Целевая архитектура на Selectel

```
Интернет (80/443)
        ↓
    nginx (SSL + reverse proxy)
        ├── /          → client-app (Next.js, :3000)
        ├── /picker    → picker-panel (статика nginx, :5174)
        ├── /admin     → admin-panel (статика nginx, :5173)
        └── /api       → backend Go (:8080)

Внутренняя сеть Docker:
    backend → postgres, redis, jaeger
```

Один публичный IP, один порт 443 (HTTPS). Всё остальное — внутри Docker сети, снаружи недоступно.

---

## Что нужно сделать перед деплоем

### 1. Переписать Dockerfile picker-panel (multi-stage, nginx)

`Frontend/picker-panel/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 2. То же самое для admin-panel

`Frontend/admin-panel/Dockerfile` — идентичная структура.

### 3. Создать Dockerfile для client-app (сейчас вообще нет)

`Frontend/client-app/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["npx", "next", "start"]
```

### 4. Добавить nginx.conf для каждого Vite-фронта

`Frontend/picker-panel/nginx.conf` и `Frontend/admin-panel/nginx.conf`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA — все маршруты отдаём index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статики
    location ~* \.(js|css|png|jpg|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 5. Создать docker-compose.prod.yml

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - laman-network
    restart: always
    # НЕТ проброса портов наружу — только внутри сети

  redis:
    image: redis:7-alpine
    networks:
      - laman-network
    restart: always
    # НЕТ проброса портов наружу

  api:
    build:
      context: ./Backend
      dockerfile: Dockerfile
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      # ... остальные переменные из .env.prod
    volumes:
      - ./Backend/uploads:/root/uploads
      - ./Backend/migrations:/root/migrations
    depends_on:
      - postgres
      - redis
    networks:
      - laman-network
    restart: always
    # НЕТ проброса портов наружу — только nginx видит

  client-app:
    build:
      context: ./Frontend/client-app
      args:
        NEXT_PUBLIC_API_URL: https://api.laman.ru
    networks:
      - laman-network
    restart: always

  picker-panel:
    build:
      context: ./Frontend/picker-panel
      args:
        VITE_API_BASE_URL: https://api.laman.ru
    networks:
      - laman-network
    restart: always

  admin-panel:
    build:
      context: ./Frontend/admin-panel
      args:
        VITE_API_BASE_URL: https://api.laman.ru
    networks:
      - laman-network
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl        # SSL сертификаты
    depends_on:
      - api
      - client-app
      - picker-panel
      - admin-panel
    networks:
      - laman-network
    restart: always

networks:
  laman-network:
    driver: bridge

volumes:
  postgres_data:
```

### 6. Создать nginx/nginx.conf (главный reverse proxy)

```nginx
events {}

http {
    upstream api        { server api:8080; }
    upstream client     { server client-app:3000; }
    upstream picker     { server picker-panel:80; }
    upstream admin      { server admin-panel:80; }

    server {
        listen 80;
        server_name laman.ru www.laman.ru;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl;
        server_name laman.ru www.laman.ru;

        ssl_certificate     /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location /api/     { proxy_pass http://api; }
        location /picker/  { proxy_pass http://picker; }
        location /admin/   { proxy_pass http://admin; }
        location /         { proxy_pass http://client; }
    }
}
```

---

## Порядок деплоя на Selectel (когда придёт время)

1. Арендовать VPS на Selectel (минимум 2 CPU, 4GB RAM)
2. Установить Docker + Docker Compose
3. Получить SSL сертификат (Let's Encrypt через certbot)
4. Создать `.env.prod` с продакшн значениями (другой JWT_SECRET, пароли БД и т.д.)
5. Клонировать репозиторий на сервер
6. Запустить: `docker-compose -f docker-compose.prod.yml up -d --build`
7. Настроить DNS (A-запись домена → IP сервера Selectel)

---

## Мониторинг на продакшне

Jaeger + Prometheus + Grafana — оставить в docker-compose.prod.yml, но:
- Закрыть порты наружу
- Пробросить через nginx с базовой HTTP-авторизацией (`/grafana`, `/jaeger`)
- Или доступ только по VPN/SSH tunnel

---

## Что НЕ делать

- Не открывать порты postgres (5432) и redis (6379) наружу
- Не хранить `.env.prod` в git (добавить в `.gitignore`)
- Не использовать `npm run dev` в продакшн Dockerfile
- Не использовать `restart: unless-stopped` на проде — использовать `restart: always`
