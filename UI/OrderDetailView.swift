import SwiftUI
import Foundation

struct OrderDetailView: View {
    @EnvironmentObject private var appState: AppState

    let order: Order

    @State private var isUpdating = false
    @State private var showError = false
    @State private var errorMessage = ""

    private let priceColor = Color(red: 0.06, green: 0.73, blue: 0.51)

    var body: some View {
        List {
            Section("Статус") {
                HStack {
                    Text("Текущий статус")
                    Spacer()
                    Text(statusText(order.status))
                        .foregroundStyle(statusColor(order.status))
                }
            }

            Section("Клиент") {
                if let name = order.guestName {
                    Text("Имя: \(name)")
                }
                if let phone = order.guestPhone {
                    Text("Телефон: \(phone)")
                }
                if let address = order.guestAddress {
                    Text("Адрес: \(address)")
                }
                if let comment = order.comment, !comment.isEmpty {
                    Text("Комментарий: \(comment)")
                }
                if let method = order.paymentMethod {
                    Text("Оплата: \(method.rawValue)")
                }
            }

            Section("Товары") {
                if let items = order.items, !items.isEmpty {
                    ForEach(items) { item in
                        HStack {
                            Text("\(appState.productName(for: item.productId)) × \(item.quantity)")
                            Spacer()
                            Text(priceText(Double(item.quantity) * item.price))
                                .foregroundStyle(priceColor)
                        }
                    }
                } else {
                    Text("Список товаров недоступен")
                        .foregroundStyle(.secondary)
                }
            }

            Section("Итог") {
                HStack {
                    Text("Подытог")
                    Spacer()
                    Text(priceText(order.itemsTotal ?? 0))
                }
                HStack {
                    Text("Сервисный сбор")
                    Spacer()
                    Text(priceText(order.serviceFee ?? 0))
                }
                HStack {
                    Text("Доставка")
                    Spacer()
                    Text(priceText(order.deliveryFee ?? 0))
                }
                HStack {
                    Text("Итого")
                        .font(.headline)
                    Spacer()
                    Text(priceText(order.finalTotal ?? 0))
                        .font(.headline)
                        .foregroundStyle(priceColor)
                }
            }

            Section {
                Button(role: .destructive) {
                    Task { await cancelOrder() }
                } label: {
                    HStack {
                        Spacer()
                        Text("Отменить заказ")
                        Spacer()
                    }
                }
                .disabled(!canCancel || isUpdating)
            }
        }
        .navigationTitle("Заказ #\(order.id.uuidString.prefix(8))")
        .overlay {
            if isUpdating {
                ProgressView("Обновляем статус...")
                    .padding()
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .alert("Ошибка", isPresented: $showError) {
            Button("Ок", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
    }

    private var canCancel: Bool {
        let status = order.status ?? "NEW"
        return status != "CANCELLED" && status != "DELIVERED"
    }

    private func cancelOrder() async {
        isUpdating = true
        defer { isUpdating = false }
        do {
            try await appState.cancelOrder(order: order)
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
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

    private func statusColor(_ status: String?) -> Color {
        switch status ?? "NEW" {
        case "CANCELLED": return .red
        case "DELIVERED": return .green
        case "IN_PROGRESS": return .orange
        default: return .secondary
        }
    }

    private func priceText(_ price: Double) -> String {
        if price == Double(Int(price)) {
            return "\(Int(price))₽"
        }
        return String(format: "%.2f₽", price)
    }
}

#Preview {
    let appState = CartViewModel()
    let sample = Order(
        id: UUID(),
        guestName: "Ахмед Хаджиев",
        guestPhone: "+79991234567",
        guestAddress: "Грозный, ул. Айтхазарова 45",
        comment: "Звонить за час",
        status: "IN_PROGRESS",
        paymentMethod: .cash,
        itemsTotal: 460,
        serviceFee: 23,
        deliveryFee: 200,
        finalTotal: 683,
        createdAt: Date(),
        items: []
    )
    NavigationStack { OrderDetailView(order: sample) }
        .environmentObject(appState)
        .environmentObject(CatalogViewModel(appState: appState))
        .environmentObject(StoresViewModel())
}
