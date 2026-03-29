# Picker Panel

React + TypeScript панель сборщика для `Laman`.

## Возможности

- login сборщика через `POST /api/v1/picker/auth/login`
- очередь заказов через `GET /api/v1/picker`
- карточка заказа через `GET /api/v1/picker/orders/:id`
- смена статуса через `PUT /api/v1/picker/orders/:id/status`
- realtime обновления через `GET /api/v1/picker/events` (SSE over fetch stream)

## Локальный запуск

```bash
cd /Users/ependihadziev/GolandProjects/Laman-App/Backend/picker-panel
cp .env.example .env
npm install
npm run dev
```

По умолчанию:

- panel: `http://localhost:5174`
- backend: `http://192.168.32.225:8080`

## Тесты и сборка

```bash
npm test
npm run build
```
