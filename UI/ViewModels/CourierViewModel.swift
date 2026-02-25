import Foundation
import Combine

@MainActor
final class CourierViewModel: ObservableObject {
    @Published var isOnShift: Bool = false
    @Published var currentOrder: Order?
    @Published var allOrders: [Order] = []
    @Published var locationStatusMessage: String?

    private let api: LamanAPI
    private let locationService: LocationService

    init(api: LamanAPI? = nil) {
        let resolvedAPI = api ?? LamanAPI()
        self.api = resolvedAPI
        self.locationService = LocationService(api: resolvedAPI)
        self.locationService.onStatusMessage = { [weak self] message in
            Task { @MainActor in
                self?.locationStatusMessage = message
            }
        }
    }

    func startShift() {
        isOnShift = true
        locationService.startTracking()
    }

    func endShift() {
        isOnShift = false
        currentOrder = nil
        locationService.stopTracking()
        locationStatusMessage = nil
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
