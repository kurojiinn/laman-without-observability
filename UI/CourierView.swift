import SwiftUI
import UIKit

struct CourierView: View {
    @StateObject private var viewModel = CourierViewModel()
    @EnvironmentObject private var authVM: AuthViewModel

    var body: some View {
        VStack(spacing: 16) {
            if let locationStatusMessage = viewModel.locationStatusMessage {
                Text(locationStatusMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if !viewModel.isOnShift {
                Spacer()
                Button("Начать смену") {
                    viewModel.startShift()
                    Task {
                        await viewModel.fetchCurrentOrder()
                        await viewModel.fetchAllOrders()
                    }
                }
                Spacer()
            } else {
                TabView {
                    CourierActiveOrderView(viewModel: viewModel)
                        .tabItem {
                            Label("Заказ", systemImage: "shippingbox")
                        }

                    CourierOrdersHistoryView(viewModel: viewModel)
                        .tabItem {
                            Label("История", systemImage: "clock")
                        }
                }
            }
        }
        .padding()
        .navigationTitle("Курьер")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Выйти", role: .destructive) {
                    authVM.logout()
                }
            }
        }
        .task {
            if viewModel.isOnShift {
                await viewModel.fetchCurrentOrder()
                await viewModel.fetchAllOrders()
            }
        }
    }
}

private struct CourierActiveOrderView: View {
    @ObservedObject var viewModel: CourierViewModel

    var body: some View {
        VStack(spacing: 16) {
            if let order = viewModel.currentOrder {
                ActiveOrderCard(order: order) { status in
                    Task {
                        await viewModel.updateOrderStatus(orderId: order.id, status: status)
                        await viewModel.fetchCurrentOrder()
                        await viewModel.fetchAllOrders()
                    }
                }
            } else {
                Spacer()
                Text("Ожидание заказа...")
                    .frame(maxWidth: .infinity, alignment: .center)
                Spacer()
            }

            Button("Завершить смену", role: .destructive) {
                viewModel.endShift()
            }
            .frame(maxWidth: .infinity)
        }
    }
}

private struct ActiveOrderCard: View {
    let order: Order
    let onUpdateStatus: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Заказ #\(order.id.uuidString.prefix(8))")
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(order.guestAddress ?? "Адрес не указан")
                .font(.headline)

            HStack {
                Text(order.guestPhone ?? "Телефон не указан")
                Spacer()
                Button("Позвонить") {
                    callClient(order.guestPhone)
                }
                .disabled(sanitizedPhone(order.guestPhone).isEmpty)
            }

            Button("Открыть в картах") {
                openInMaps(address: order.guestAddress)
            }
            .disabled((order.guestAddress ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            HStack(spacing: 8) {
                Button("Забрал заказ") {
                    onUpdateStatus("COURIER_PICKED_UP")
                }
                .disabled(currentProgress >= 1)

                Button("В пути") {
                    onUpdateStatus("DELIVERING")
                }
                .disabled(currentProgress >= 2 || currentProgress < 1)

                Button("Доставил") {
                    onUpdateStatus("DELIVERED")
                }
                .disabled(currentProgress >= 3 || currentProgress < 2)
            }
            .font(.footnote)
        }
        .padding()
        .background(Color(.systemBackground))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color(.separator), lineWidth: 1)
        )
    }

    private var currentProgress: Int {
        switch order.status ?? "NEW" {
        case "NEW", "ACCEPTED_BY_PICKER", "ASSEMBLING", "ASSEMBLED", "WAITING_COURIER", "NEEDS_CONFIRMATION":
            return 0
        case "COURIER_PICKED_UP":
            return 1
        case "DELIVERING":
            return 2
        case "DELIVERED":
            return 3
        default:
            return 0
        }
    }

    private func sanitizedPhone(_ phone: String?) -> String {
        guard let phone else { return "" }
        return phone.filter(\.isNumber)
    }

    private func callClient(_ phone: String?) {
        let digits = sanitizedPhone(phone)
        guard !digits.isEmpty, let url = URL(string: "tel://\(digits)") else { return }
        UIApplication.shared.open(url)
    }

    private func openInMaps(address: String?) {
        let query = (address ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return }

        var components = URLComponents(string: "http://maps.apple.com/")
        components?.queryItems = [URLQueryItem(name: "q", value: query)]

        guard let url = components?.url else { return }
        UIApplication.shared.open(url)
    }
}

#Preview {
    NavigationStack {
        CourierView()
    }
}
