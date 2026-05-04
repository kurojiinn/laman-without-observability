package cache

// OTPAttemptsKey — ключ счётчика неудачных попыток ввода OTP-кода.
// Используется для ограничения числа попыток верификации кода (verify-code).
//
// Формат: otp:attempts:{phone}
// Пример: otp:attempts:79640691596
//
// Лучшая практика именования ключей Redis (используется в Uber, Notion, Stripe):
//   - префикс через двоеточие задаёт "namespace" — изолирует данные разных модулей
//   - читается слева направо от общего к частному: сущность → действие → идентификатор
//   - никогда не используй пробелы и спецсимволы кроме ":" и "_"
//
// Плохо:  "phone_otp_79640691596_attempts"  (сложно читать, нет иерархии)
// Хорошо: "otp:attempts:79640691596"        (namespace:action:id)
const OTPAttemptsKey = "otp:attempts:%s"

// OTPSendKey — ключ счётчика запросов на отправку OTP-кода.
// Используется для ограничения числа SMS отправленных на один номер (request-code).
// Отдельный ключ от OTPAttemptsKey чтобы иметь независимые лимиты:
//   - request-code: 3 запроса за 10 минут (защита от SMS-флуда)
//   - verify-code:  5 попыток за 15 минут (защита от брутфорса кода)
const OTPSendKey = "otp:send:%s"

// JWTRevokedKey — ключ отозванного JWT токена в блэклисте.
// Используется для logout: JTI токена сохраняется с TTL = оставшееся время жизни.
//
// Формат: jwt:revoked:{jti}
// Пример: jwt:revoked:550e8400-e29b-41d4-a716-446655440000
//
// Почему TTL = оставшееся время жизни токена:
//   - Токен сам по себе истекает через `exp` — после этого проверять блэклист не нужно
//   - Хранить отозванные токены вечно — расточительно и избыточно
//   - Redis автоматически удаляет ключ когда TTL истекает
const JWTRevokedKey = "jwt:revoked:%s"

// LoginAttemptsKey — ключ счётчика попыток входа по телефону (endpoint /auth/login).
// Формат: login:attempts:{phone}
const LoginAttemptsKey = "login:attempts:%s"

// CheckUserIPKey — ключ счётчика запросов к /auth/check-user по IP.
// Формат: checkuser:ip:{ip}
const CheckUserIPKey = "checkuser:ip:%s"
