import Foundation

/// UserRole описывает роль пользователя в системе.
enum UserRole: String, Codable, CaseIterable, Identifiable {
    case client = "CLIENT"
    case courier = "COURIER"

    var id: String { rawValue }

    /// Возвращает локализованное имя роли для UI.
    var displayName: String {
        switch self {
        case .client:
            return "Клиент"
        case .courier:
            return "Курьер"
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self).uppercased()
        guard let value = UserRole(rawValue: raw) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported user role")
        }
        self = value
    }
}

/// AuthUser представляет пользователя в ответе регистрации/авторизации.
struct AuthUser: Codable {
    let id: UUID
    let phone: String
    let role: UserRole
}

/// AuthResponse представляет ответ backend с токеном и пользователем.
struct AuthResponse: Codable {
    let token: String
    let user: AuthUser
}

final class LamanAPI {
    static let shared = LamanAPI()

    private let baseURL: URL
    private let session: URLSession
    private let keychain = KeychainStore(service: "laman.auth")
    private let tokenKey = "jwt.token"

    init(baseURL: URL = URL(string: "http://192.168.0.14:8080")!, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    /// Запрашивает OTP код для указанного номера телефона.
    func requestCode(phone: String) async throws {
        let url = baseURL.appendingPathComponent("api/v1/auth/request-code")
        let payload = RequestCodePayload(phone: phone)
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder.laman.encode(payload)
        logRequest(url: url, method: "POST", payload: payload)

        let (data, response) = try await session.data(for: req)
        logResponse(response: response, data: data)
        try validate(response: response, data: data)
    }

    /// Подтверждает OTP код и возвращает JWT токен с данными пользователя.
    func verify(phone: String, code: String, role: UserRole?) async throws -> AuthResponse {
        let url = baseURL.appendingPathComponent("api/v1/auth/verify")
        let payload = VerifyCodePayload(phone: phone, code: code, role: role?.rawValue)
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder.laman.encode(payload)
        logRequest(url: url, method: "POST", payload: payload)

        let (data, response) = try await session.data(for: req)
        logResponse(response: response, data: data)
        try validate(response: response, data: data)
        return try JSONDecoder.laman.decode(AuthResponse.self, from: data)
    }

    /// Регистрирует пользователя с выбранной ролью и возвращает auth-токен.
    func register(phone: String, role: UserRole) async throws -> AuthResponse {
        let url = baseURL.appendingPathComponent("api/v1/auth/register")
        let payload = RegisterRequest(phone: phone, role: role.rawValue)
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder.laman.encode(payload)
        logRequest(url: url, method: "POST", payload: payload)

        let (data, response) = try await session.data(for: req)
        logResponse(response: response, data: data)
        try validate(response: response, data: data)
        return try JSONDecoder.laman.decode(AuthResponse.self, from: data)
    }

    /// Выполняет вход зарегистрированного пользователя по номеру телефона.
    func login(phone: String) async throws -> AuthResponse {
        let url = baseURL.appendingPathComponent("api/v1/auth/login")
        let payload = LoginRequest(phone: phone)
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder.laman.encode(payload)
        logRequest(url: url, method: "POST", payload: payload)

        let (data, response) = try await session.data(for: req)
        logResponse(response: response, data: data)
        try validate(response: response, data: data)
        return try JSONDecoder.laman.decode(AuthResponse.self, from: data)
    }

    /// Загружает текущего пользователя по JWT токену.
    func getCurrentUser(token: String) async throws -> AuthUser {
        let url = baseURL.appendingPathComponent("api/v1/auth/me")
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: req)
        logResponse(response: response, data: data)
        try validate(response: response, data: data)
        return try JSONDecoder.laman.decode(AuthUser.self, from: data)
    }

    func getCategories() async throws -> [Category] {
        let url = baseURL.appendingPathComponent("api/v1/catalog/categories")
        return try await fetch(url: url, responseType: [Category].self)
    }

    func getProducts(categoryId: UUID?, subcategoryId: UUID?, search: String?) async throws -> [Product] {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/v1/catalog/products"), resolvingAgainstBaseURL: false)
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "available_only", value: "true")
        ]
        if let categoryId {
            queryItems.append(URLQueryItem(name: "category_id", value: categoryId.uuidString))
        }
        if let subcategoryId {
            queryItems.append(URLQueryItem(name: "subcategory_id", value: subcategoryId.uuidString))
        }
        if let search, !search.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: search))
        }
        components?.queryItems = queryItems
        guard let url = components?.url else { throw LamanAPIError.invalidURL }
        return try await fetch(url: url, responseType: [Product].self)
    }

    func getSubcategories(categoryId: UUID) async throws -> [Subcategory] {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/v1/catalog/subcategories"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "category_id", value: categoryId.uuidString)]
        guard let url = components?.url else { throw LamanAPIError.invalidURL }
        return try await fetch(url: url, responseType: [Subcategory].self)
    }

    func getStores(categoryType: StoreCategoryType?, search: String?) async throws -> [Store] {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/v1/stores"), resolvingAgainstBaseURL: false)
        var queryItems: [URLQueryItem] = []
        if let categoryType {
            queryItems.append(URLQueryItem(name: "category_type", value: categoryType.rawValue))
        }
        if let search, !search.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: search))
        }
        if !queryItems.isEmpty {
            components?.queryItems = queryItems
        }
        guard let url = components?.url else { throw LamanAPIError.invalidURL }
        return try await fetch(url: url, responseType: [Store].self)
    }

    func getStore(id: UUID) async throws -> Store {
        let url = baseURL.appendingPathComponent("api/v1/stores").appendingPathComponent(id.uuidString)
        return try await fetch(url: url, responseType: Store.self)
    }

    func getStoreProducts(storeId: UUID, subcategoryId: UUID?, search: String?, availableOnly: Bool = true) async throws -> [Product] {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/v1/stores").appendingPathComponent(storeId.uuidString).appendingPathComponent("products"), resolvingAgainstBaseURL: false)
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "available_only", value: availableOnly ? "true" : "false")
        ]
        if let subcategoryId {
            queryItems.append(URLQueryItem(name: "subcategory_id", value: subcategoryId.uuidString))
        }
        if let search, !search.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: search))
        }
        components?.queryItems = queryItems
        guard let url = components?.url else { throw LamanAPIError.invalidURL }
        return try await fetch(url: url, responseType: [Product].self)
    }

    func getStoreSubcategories(storeId: UUID) async throws -> [Subcategory] {
        let url = baseURL
            .appendingPathComponent("api/v1/stores")
            .appendingPathComponent(storeId.uuidString)
            .appendingPathComponent("subcategories")
        return try await fetch(url: url, responseType: [Subcategory].self)
    }

    func createOrder(request: CreateOrderRequest) async throws -> Order {
        let url = baseURL.appendingPathComponent("api/v1/orders")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder.laman.encode(request)

        let (data, response) = try await session.data(for: req)
        try validate(response: response, data: data)
        return try JSONDecoder.laman.decode(Order.self, from: data)
    }

    func updateOrderStatus(orderId: UUID, status: String) async throws {
        let url = baseURL
            .appendingPathComponent("api/v1/orders")
            .appendingPathComponent(orderId.uuidString)
            .appendingPathComponent("status")
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder.laman.encode(["status": status])

        let (data, response) = try await session.data(for: req)
        try validate(response: response, data: data)
    }

    /// Отправляет текущие координаты курьера на backend во время активной смены.
    func updateCourierLocation(lat: Double, lng: Double) async throws {
        let token = try keychain.get(for: tokenKey)
        guard let token, !token.isEmpty else {
            throw LamanAPIError.serverError("Пользователь не авторизован")
        }

        let url = baseURL.appendingPathComponent("api/v1/courier/location")
        let payload = CourierLocationPayload(lat: lat, lng: lng)
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder.laman.encode(payload)
        logRequest(url: url, method: "POST", payload: payload)

        let (data, response) = try await session.data(for: req)
        logResponse(response: response, data: data)
        try validate(response: response, data: data)
    }

    /// Открывает смену курьера и передает начальную геопозицию.
    func startShift(lat: Double, lng: Double) async throws {
        let token = try keychain.get(for: tokenKey)
        guard let token, !token.isEmpty else {
            throw LamanAPIError.serverError("Пользователь не авторизован")
        }

        let url = baseURL.appendingPathComponent("api/v1/courier/shift/start")
        let payload = CourierLocationPayload(lat: lat, lng: lng)
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder.laman.encode(payload)
        logRequest(url: url, method: "POST", payload: payload)

        let (data, response) = try await session.data(for: req)
        logResponse(response: response, data: data)
        try validate(response: response, data: data)
    }

    /// Закрывает смену курьера.
    func endShift() async throws {
        let token = try keychain.get(for: tokenKey)
        guard let token, !token.isEmpty else {
            throw LamanAPIError.serverError("Пользователь не авторизован")
        }

        let url = baseURL.appendingPathComponent("api/v1/courier/shift/end")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        logRequest(url: url, method: "POST", payload: EmptyPayload())

        let (data, response) = try await session.data(for: req)
        logResponse(response: response, data: data)
        try validate(response: response, data: data)
    }

    /// Уведомляет backend о старте смены курьера с текущими координатами.
    func startCourierShift(lat: Double, lng: Double) async throws {
        try await startShift(lat: lat, lng: lng)
    }

    /// Уведомляет backend о завершении смены курьера.
    func endCourierShift() async throws {
        try await endShift()
    }

    private func fetch<T: Decodable>(url: URL, responseType: T.Type) async throws -> T {
        let (data, response) = try await session.data(from: url)
        try validate(response: response, data: data)
        return try JSONDecoder.laman.decode(T.self, from: data)
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw LamanAPIError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            let message = Self.extractServerErrorMessage(from: data) ?? String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw LamanAPIError.serverError(message)
        }
    }

    private static func extractServerErrorMessage(from data: Data) -> String? {
        struct ServerErrorBody: Decodable {
            let error: String?
            let err: String?
            let message: String?
        }

        func firstNonEmpty(_ values: [String?]) -> String? {
            values
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first(where: { !$0.isEmpty })
        }

        guard let topLevel = try? JSONDecoder.laman.decode(ServerErrorBody.self, from: data) else {
            return nil
        }

        if let message = firstNonEmpty([topLevel.error, topLevel.err, topLevel.message]) {
            guard let nestedData = message.data(using: .utf8),
                  let nested = try? JSONDecoder.laman.decode(ServerErrorBody.self, from: nestedData),
                  let nestedMessage = firstNonEmpty([nested.error, nested.err, nested.message]) else {
                return message
            }
            return nestedMessage
        }

        return nil
    }

    /// Печатает URL и JSON тела запроса в консоль для диагностики 404/контракта API.
    private func logRequest<T: Encodable>(url: URL, method: String, payload: T) {
        let bodyData = try? JSONEncoder.laman.encode(payload)
        let bodyText = bodyData.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        print("➡️ [API] \(method) \(url.absoluteString)")
        print("➡️ [API] body: \(bodyText)")
    }

    /// Печатает HTTP-статус и тело ответа для диагностики проблем на сетевом слое.
    private func logResponse(response: URLResponse, data: Data) {
        let status = (response as? HTTPURLResponse)?.statusCode ?? -1
        let body = String(data: data, encoding: .utf8) ?? "<non-utf8>"
        print("⬅️ [API] status: \(status)")
        print("⬅️ [API] body: \(body)")
    }
}

private struct RegisterRequest: Encodable {
    let phone: String
    let role: String
}

private struct LoginRequest: Encodable {
    let phone: String
}

private struct RequestCodePayload: Encodable {
    let phone: String
}

private struct VerifyCodePayload: Encodable {
    let phone: String
    let code: String
    let role: String?
}

private struct CourierLocationPayload: Encodable {
    let lat: Double
    let lng: Double
}

private struct EmptyPayload: Encodable {}

enum LamanAPIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Неверный URL"
        case .invalidResponse:
            return "Некорректный ответ сервера"
        case .serverError(let message):
            return message
        }
    }
}

extension JSONDecoder {
    static var laman: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)

            if let date = ISO8601DateFormatter.lamanWithFractional.date(from: value) ??
                ISO8601DateFormatter.lamanStandard.date(from: value) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported date format: \(value)"
            )
        }
        return decoder
    }
}

private extension ISO8601DateFormatter {
    static let lamanStandard: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static let lamanWithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

extension JSONEncoder {
    static var laman: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return encoder
    }
}
