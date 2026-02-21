import SwiftUI
import Combine

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
}
