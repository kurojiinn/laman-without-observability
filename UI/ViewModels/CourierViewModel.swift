import Foundation
import Combine

@MainActor
final class CourierViewModel: ObservableObject {
    @Published var isOnShift: Bool = false
    @Published var currentOrder: Order?
    @Published var allOrders: [Order] = []

    private let api: LamanAPI

    init(api: LamanAPI? = nil) {
        self.api = api ?? LamanAPI()
    }

    func startShift() {
        isOnShift = true
    }

    func endShift() {
        isOnShift = false
        currentOrder = nil
    }

    func fetchCurrentOrder() async {
        do {
            // Placeholder via API layer until a dedicated courier endpoint is added.
            currentOrder = try await api.getCourierCurrentOrderPlaceholder()
        } catch {
            currentOrder = nil
        }
    }

    func fetchAllOrders() async {
        do {
            // Placeholder via API layer until a dedicated courier endpoint is added.
            allOrders = try await api.getCourierOrdersPlaceholder()
        } catch {
            allOrders = []
        }
    }

    func updateOrderStatus(orderId: UUID, status: String) async {
        do {
            try await api.updateOrderStatus(orderId: orderId, status: status)

            if let index = allOrders.firstIndex(where: { $0.id == orderId }) {
                allOrders[index] = allOrders[index].withStatus(status)
            }
            if currentOrder?.id == orderId {
                currentOrder = currentOrder?.withStatus(status)
            }
        } catch {
            // Keep existing state if API update fails.
        }
    }
}

private extension LamanAPI {
    func getCourierCurrentOrderPlaceholder() async throws -> Order? {
        nil
    }

    func getCourierOrdersPlaceholder() async throws -> [Order] {
        []
    }
}
