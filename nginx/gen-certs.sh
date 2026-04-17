#!/bin/bash
# Генерирует самоподписанный сертификат для локальной разработки.
# Для production используй Let's Encrypt (certbot) или купи сертификат.
#
# Использование:
#   chmod +x nginx/gen-certs.sh
#   ./nginx/gen-certs.sh

set -e

CERTS_DIR="$(dirname "$0")/certs"
mkdir -p "$CERTS_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/key.pem" \
  -out "$CERTS_DIR/cert.pem" \
  -subj "/C=RU/ST=Chechnya/L=Grozny/O=Laman/CN=localhost" \
  -addext "subjectAltName=IP:127.0.0.1,IP:192.168.0.10,DNS:localhost"

echo "✓ Сертификат создан: $CERTS_DIR/cert.pem"
echo "✓ Ключ создан:       $CERTS_DIR/key.pem"
echo ""
echo "Следующие шаги:"
echo "  1. Добавь COOKIE_SECURE=true в .env"
echo "  2. docker-compose up -d nginx"
echo "  3. API доступен по https://192.168.0.10 (порт 443)"
