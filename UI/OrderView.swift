import SwiftUI
import Foundation

struct OrderView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var guestName: String = ""
    @State private var guestPhone: String = ""
    @State private var guestAddress: String = ""
    @State private var deliveryAddress: String = ""
    @State private var comment: String = ""
    @State private var paymentMethod: PaymentMethod = .cash

    @State private var isSubmitting = false
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var createdOrder: Order? = nil

    private let priceColor = Color(red: 0.06, green: 0.73, blue: 0.51)
    private let accentBlue = Color(red: 0.23, green: 0.51, blue: 0.96)
    private var isFormValid: Bool {
        !guestName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !guestPhone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !deliveryAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        Form {
            Section("👤 Клиент") {
                TextField("Имя", text: $guestName)
                TextField("Телефон", text: $guestPhone)
                    .keyboardType(.phonePad)
            }

            Section("📍 Доставка") {
                TextField("Адрес", text: $guestAddress)
                TextField("Адрес доставки", text: $deliveryAddress)
                TextField("Комментарий", text: $comment)
            }

            Section("🧾 Заказ") {
                ForEach(appState.cartItems) { item in
                    HStack {
                        Text("\(item.product.name) × \(item.quantity)")
                        Spacer()
                        Text(priceText(Double(item.quantity) * item.product.price))
                            .foregroundStyle(priceColor)
                    }
                }
            }

            Section("💰 Итог") {
                HStack {
                    Text("Подытог")
                    Spacer()
                    Text(priceText(appState.subtotal))
                }
                HStack {
                    Text("Сервисный сбор")
                    Spacer()
                    Text(priceText(appState.serviceFee))
                }
                HStack {
                    Text("Доставка")
                    Spacer()
                    Text(priceText(appState.deliveryFee))
                }
                HStack {
                    Text("Итого")
                        .font(.headline)
                    Spacer()
                    Text(priceText(appState.total))
                        .font(.headline)
                        .foregroundStyle(priceColor)
                }
            }

            Section {
                Picker("Оплата", selection: $paymentMethod) {
                    Text("Наличные").tag(PaymentMethod.cash)
                    Text("Перевод").tag(PaymentMethod.transfer)
                }
                .pickerStyle(.segmented)
                if paymentMethod == .transfer {
                    Text("Реквизиты будут доступны после подтверждения заказа")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Оформление")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Закрыть") { dismiss() }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Оформить") {
                    Task { await submitOrder() }
                }
                .disabled(appState.totalItems == 0 || isSubmitting || !isFormValid)
            }
        }
        .overlay {
            if isSubmitting {
                ProgressView("Отправляем заказ...")
                    .padding()
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .alert("Ошибка сети", isPresented: $showError) {
            Button("Ок", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
        .sheet(item: $createdOrder) { order in
            VStack(spacing: 12) {
                Text("✅ Заказ #\(order.id.uuidString.prefix(8)) создан!")
                    .font(.title2)
                Text("Telegram уведомление отправлено")
                    .foregroundStyle(.secondary)
                Button("Готово") {
                    createdOrder = nil
                    dismiss()
                }
                .padding(.top, 8)
            }
            .padding()
        }
    }

    private func submitOrder() async {
        guard !appState.cartItems.isEmpty else { return }
        isSubmitting = true
        defer { isSubmitting = false }

        let items = appState.cartItems.map { item in
            CreateOrderItem(productId: item.product.id, quantity: item.quantity)
        }

        let resolvedGuestAddress = guestAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? deliveryAddress
            : guestAddress

        let request = CreateOrderRequest(
            guestName: guestName,
            guestPhone: guestPhone,
            guestAddress: resolvedGuestAddress,
            deliveryAddress: deliveryAddress,
            comment: comment.isEmpty ? nil : comment,
            paymentMethod: paymentMethod,
            storeId: appState.cartItems.first?.product.storeId ?? UUID(),
            items: items
        )

        do {
            let order = try await appState.submitOrder(request: request)
            createdOrder = order
        } catch {
            errorMessage = error.localizedDescription
            showError = true
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
    NavigationStack { OrderView() }
        .environmentObject(appState)
        .environmentObject(CatalogViewModel(appState: appState))
        .environmentObject(StoresViewModel())
}
