package cache

const CourierLocationKey = "courier:%s:location"
const ActiveCouriersGeoKey = "active_couriers"

// OTPAttemptsKey — ключ счётчика неудачных попыток ввода OTP по номеру телефона.
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
