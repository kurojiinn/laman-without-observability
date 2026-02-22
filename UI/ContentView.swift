import SwiftUI
import Combine

/// AuthViewState представляет состояния запроса регистрации в UI.
enum AuthViewState: Equatable {
    case idle
    case loading
    case success
    case error(String)
}

/// AuthIntent определяет, для какого сценария пользователь запрашивает OTP.
enum AuthIntent {
    case register
    case login
}

/// AuthViewModel управляет регистрацией, сессией пользователя и состояниями экрана auth.
@MainActor
final class AuthViewModel: ObservableObject {
    @Published var state: AuthViewState = .idle
    @Published var token: String?
    @Published var user: AuthUser?
    @Published var isAwaitingCode: Bool = false
    @Published var secondsUntilResend: Int = 0

    private let api: LamanAPI
    private let keychain = KeychainStore(service: "laman.auth")
    private let tokenKey = "jwt.token"
    private var pendingPhone: String?
    private var pendingRole: UserRole?
    private var pendingIntent: AuthIntent?
    private var countdownTask: Task<Void, Never>?

    /// Инициализирует view model и восстанавливает сохраненную сессию пользователя.
    init(api: LamanAPI? = nil) {
        self.api = api ?? LamanAPI()
        restoreToken()
        if token != nil {
            Task {
                await loadCurrentUser()
            }
        }
    }

    /// Запрашивает OTP код для регистрации или входа и сохраняет контекст для шага подтверждения.
    func requestCode(phone: String, role: UserRole?, intent: AuthIntent) async {
        let normalizedPhone = normalizePhoneForBackend(phone)
        guard !normalizedPhone.isEmpty else {
            state = .error("Введите номер телефона")
            return
        }

        state = .loading
        do {
            try await api.requestCode(phone: normalizedPhone)
            pendingPhone = normalizedPhone
            pendingRole = role
            pendingIntent = intent
            isAwaitingCode = true
            startCountdown(seconds: 60)
            state = .idle
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    /// Подтверждает OTP код и завершает авторизацию.
    func verifyCode(_ code: String) async {
        guard let phone = pendingPhone else {
            state = .error("Сначала запросите код")
            return
        }

        state = .loading
        do {
            let roleForVerify: UserRole? = pendingIntent == .register ? pendingRole : nil
            let response = try await api.verify(phone: phone, code: code, role: roleForVerify)
            token = response.token
            user = response.user
            try keychain.set(response.token, for: tokenKey)
            pendingPhone = nil
            pendingRole = nil
            pendingIntent = nil
            isAwaitingCode = false
            secondsUntilResend = 0
            countdownTask?.cancel()
            state = .success
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    /// Повторно запрашивает OTP код для сохраненного номера телефона.
    func resendCode() async {
        guard let pendingPhone, secondsUntilResend == 0 else { return }
        await requestCode(phone: pendingPhone, role: pendingRole, intent: pendingIntent ?? .login)
    }

    /// Сбрасывает авторизацию и удаляет сохраненную сессию.
    func logout() {
        token = nil
        user = nil
        state = .idle
        isAwaitingCode = false
        secondsUntilResend = 0
        pendingPhone = nil
        pendingRole = nil
        pendingIntent = nil
        countdownTask?.cancel()
        try? keychain.remove(for: tokenKey)
    }

    /// Возвращает `true`, если пользователь авторизован и сессия валидна.
    var isAuthorized: Bool {
        token != nil && user != nil
    }

    /// Загружает профиль пользователя по существующему JWT токену.
    func loadCurrentUser() async {
        guard let token else { return }
        do {
            let currentUser = try await api.getCurrentUser(token: token)
            user = currentUser
        } catch {
            logout()
            state = .error("Сессия истекла. Выполните вход снова.")
        }
    }

    /// Очищает текст ошибки в UI после показа alert.
    func resetError() {
        if case .error = state {
            state = .idle
        }
    }

    /// Сбрасывает временное OTP-состояние при переключении режимов вход/регистрация.
    func resetOTPFlow() {
        isAwaitingCode = false
        secondsUntilResend = 0
        pendingPhone = nil
        pendingRole = nil
        pendingIntent = nil
        countdownTask?.cancel()
        resetError()
    }

    /// Восстанавливает JWT токен из Keychain при старте приложения.
    private func restoreToken() {
        token = try? keychain.get(for: tokenKey)
    }

    /// Запускает обратный отсчет до возможности повторной отправки OTP.
    private func startCountdown(seconds: Int) {
        countdownTask?.cancel()
        secondsUntilResend = seconds
        countdownTask = Task {
            while !Task.isCancelled && secondsUntilResend > 0 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                secondsUntilResend -= 1
            }
        }
    }

    /// Приводит номер телефона к формату backend (только цифры, без "+" в начале +7).
    private func normalizePhoneForBackend(_ phone: String) -> String {
        let trimmed = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        let withoutPlus = trimmed.hasPrefix("+7") ? String(trimmed.dropFirst()) : trimmed
        return withoutPlus.filter(\.isNumber)
    }
}

final class AppState: ObservableObject {
    @Published var cart: [UUID: Int] = [:]
    @Published var orders: [Order] = []
 
    private let api = LamanAPI()
    private var productIndex: [UUID: Product] = [:]
    @Published var activeStoreId: UUID? = nil

    func mergeProducts(_ products: [Product]) {
        for product in products {
            productIndex[product.id] = product
        }
    }

    func productName(for productId: UUID) -> String {
        productIndex[productId]?.name ?? "Товар \(productId.uuidString.prefix(8))"
    }

    func quantity(for productID: UUID) -> Int {
        cart[productID] ?? 0
    }

    func setQuantity(_ quantity: Int, for product: Product) {
        productIndex[product.id] = product
        if quantity <= 0 {
            cart.removeValue(forKey: product.id)
        } else {
            cart[product.id] = quantity
        }
        syncActiveStore()
    }

    func removeProduct(_ product: Product) {
        cart.removeValue(forKey: product.id)
        syncActiveStore()
    }

    func clearCart() {
        cart.removeAll()
        activeStoreId = nil
    }

    var cartItems: [CartItem] {
        cart.compactMap { entry in
            let (productID, qty) = entry
            guard qty > 0 else { return nil }
            let product = productIndex[productID] ?? Product(
                id: productID,
                categoryId: nil,
                subcategoryId: nil,
                storeId: UUID(),
                name: "Товар",
                description: nil,
                price: 0,
                weight: nil,
                isAvailable: true
            )
            return CartItem(product: product, quantity: qty)
        }
    }

    var subtotal: Double {
        cartItems.reduce(0) { $0 + (Double($1.quantity) * $1.product.price) }
    }

    var deliveryFee: Double {
        200
    }

    var serviceFee: Double {
        max(0, subtotal * 0.05)
    }

    var total: Double {
        subtotal + deliveryFee + serviceFee
    }

    var totalItems: Int {
        cartItems.reduce(0) { $0 + $1.quantity }
    }

    var totalWeight: Double {
        cartItems.reduce(0) { total, item in
            total + (item.product.weight ?? 0) * Double(item.quantity)
        }
    }

    @MainActor
    func submitOrder(request: CreateOrderRequest) async throws -> Order {
        let order = try await api.createOrder(request: request)
        orders.insert(order, at: 0)
        cart.removeAll()
        activeStoreId = nil
        return order
    }

    @MainActor
    func cancelOrder(order: Order) async throws {
        try await api.updateOrderStatus(orderId: order.id, status: "CANCELLED")
        if let index = orders.firstIndex(where: { $0.id == order.id }) {
            orders[index] = order.withStatus("CANCELLED")
        }
    }

    private func syncActiveStore() {
        let storeIds = Set(cartItems.map { $0.product.storeId })
        if storeIds.count == 1 {
            activeStoreId = storeIds.first
        } else {
            activeStoreId = nil
        }
    }
}

typealias CartViewModel = AppState

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var catalogVM: CatalogViewModel
    @EnvironmentObject private var storesVM: StoresViewModel
    @EnvironmentObject private var authVM: AuthViewModel
    @State private var selectedTab: Tab = .catalog

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                CatalogView(onCheckout: { selectedTab = .cart })
            }
            .tag(Tab.catalog)
            .tabItem {
                Label("Каталог", systemImage: "square.grid.2x2")
            }

            NavigationStack {
                StoresHubView()
            }
            .tag(Tab.stores)
            .tabItem {
                Label("Магазины", systemImage: "building.2")
            }

            NavigationStack {
                CartView()
            }
            .tag(Tab.cart)
            .tabItem {
                Label("Корзина", systemImage: "cart")
            }

            NavigationStack {
                OrdersView()
            }
            .tag(Tab.orders)
            .tabItem {
                Label("Заказы", systemImage: "list.bullet.clipboard")
            }
        }
        .task {
            await storesVM.loadStores()
            await catalogVM.loadInitial()
        }
    }
}

private enum Tab {
    case catalog
    case stores
    case cart
    case orders
}

struct CartItem: Identifiable {
    var id: UUID { product.id }
    let product: Product
    let quantity: Int
}

#Preview {
    let appState = CartViewModel()
    ContentView()
        .environmentObject(appState)
        .environmentObject(CatalogViewModel(appState: appState))
        .environmentObject(StoresViewModel())
        .environmentObject(AuthViewModel())
}
