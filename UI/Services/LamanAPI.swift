import Foundation

final class LamanAPI {
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL = URL(string: "http://localhost:8080")!, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
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
            let message = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw LamanAPIError.serverError(message)
        }
    }
}

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
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}

extension JSONEncoder {
    static var laman: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return encoder
    }
}
