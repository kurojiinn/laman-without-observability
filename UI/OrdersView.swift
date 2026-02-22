import SwiftUI
import Foundation

struct OrdersView: View {
    @EnvironmentObject private var appState: AppState

    private let priceColor = Color(red: 0.06, green: 0.73, blue: 0.51)

    var body: some View {
        List {
            if appState.orders.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "list.bullet.rectangle")
                        .font(.system(size: 32))
                        .foregroundStyle(.secondary)
                    Text("Заказов пока нет")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, 24)
            } else {
                ForEach(appState.orders) { order in
                    NavigationLink {
                        OrderDetailView(order: order)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Заказ #\(order.id.uuidString.prefix(8))")
                                .font(.headline)
                            if let name = order.guestName {
                                Text(name)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            HStack {
                                Text("Статус")
                                Spacer()
                                Text(statusText(order.status))
                                    .foregroundStyle(.secondary)
                            }
                            HStack {
                                Text("Итого")
                                Spacer()
                                Text(priceText(order.finalTotal ?? 0))
                                    .foregroundStyle(priceColor)
                            }
                        }
                        .padding(.vertical, 6)
                    }
                }
            }
        }
        .navigationTitle("Заказы")
        .listStyle(.insetGrouped)
    }

    private func priceText(_ price: Double) -> String {
        if price == Double(Int(price)) {
            return "\(Int(price))₽"
        }
        return String(format: "%.2f₽", price)
    }

    private func statusText(_ status: String?) -> String {
        switch status ?? "NEW" {
        case "NEW": return "Новый"
        case "NEEDS_CONFIRMATION": return "Требует подтверждения"
        case "CONFIRMED": return "Подтвержден"
        case "IN_PROGRESS": return "В работе"
        case "DELIVERED": return "Доставлен"
        case "CANCELLED": return "Отменён"
        default: return status ?? "NEW"
        }
    }
}

#Preview {
    let appState = CartViewModel()
    NavigationStack { OrdersView() }
        .environmentObject(appState)
        .environmentObject(CatalogViewModel(appState: appState))
        .environmentObject(StoresViewModel())
}
