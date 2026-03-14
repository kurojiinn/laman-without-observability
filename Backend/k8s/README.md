# LamanDelivery — Kubernetes манифесты

## Структура

```
k8s/
  namespace.yaml        # namespace laman-dev
  secrets.yaml          # секреты (НЕ коммитить в git!)
  configmap.yaml        # конфиги
  postgres/
    pvc.yaml            # хранилище данных
    statefulset.yaml    # сам PostgreSQL
    service.yaml        # ClusterIP
  redis/
    statefulset.yaml
    service.yaml
  api/
    deployment.yaml     # Go API
    service.yaml        # LoadBalancer — доступен на localhost:8080
  jaeger/
    deployment.yaml     # Jaeger + два Service
```

## Перед запуском

1. Добавь secrets.yaml в .gitignore:
   ```
   echo "k8s/secrets.yaml" >> .gitignore
   ```

2. Собери Docker образ API:
   ```bash
   docker build -t laman-api:latest .
   ```

3. Если у тебя нет /health эндпоинта — закомментируй livenessProbe
   и readinessProbe в api/deployment.yaml

## Запуск

```bash
# 1. Создать namespace
kubectl apply -f k8s/namespace.yaml

# 2. Применить секреты и конфиги
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml

# 3. Поднять PostgreSQL
kubectl apply -f k8s/postgres/

# 4. Поднять Redis
kubectl apply -f k8s/redis/

# 5. Поднять Jaeger
kubectl apply -f k8s/jaeger/

# 6. Поднять API (после того как postgres и redis готовы)
kubectl apply -f k8s/api/

# Или всё сразу (порядок Kubernetes разрулит сам через readinessProbe)
kubectl apply -f k8s/
```

## Проверка

```bash
# Смотреть все поды
kubectl get pods -n laman-dev

# Следить за статусом в реальном времени
kubectl get pods -n laman-dev -w

# Логи API
kubectl logs -n laman-dev deployment/laman-api -f

# Если под не стартует
kubectl describe pod -n laman-dev <pod-name>
```

## Доступ

- API:        http://localhost:8080
- Jaeger UI:  http://localhost:16686

## Полезные команды

```bash
# Зайти внутрь контейнера API
kubectl exec -it -n laman-dev deployment/laman-api -- sh

# Пробросить порт PostgreSQL локально (для отладки через TablePlus)
kubectl port-forward -n laman-dev service/postgres 5432:5432

# Перезапустить деплой (например после пересборки образа)
kubectl rollout restart deployment/laman-api -n laman-dev

# Удалить всё
kubectl delete namespace laman-dev
```
