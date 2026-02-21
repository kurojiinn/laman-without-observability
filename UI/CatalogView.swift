import SwiftUI
import Foundation

struct CatalogView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var catalogVM: CatalogViewModel

    let onCheckout: () -> Void

    private let accentBlue = Color(red: 0.23, green: 0.51, blue: 0.96)

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [accentBlue.opacity(0.15), Color.orange.opacity(0.12)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            List {
                if !catalogVM.categories.isEmpty {
                    Section("Категории") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                categoryChip(title: "Все", isSelected: catalogVM.selectedCategoryId == nil) {
                                    Task { await catalogVM.selectCategory(nil) }
                                }

                                ForEach(catalogVM.categories) { category in
                                    categoryChip(title: category.name, isSelected: catalogVM.selectedCategoryId == category.id) {
                                        Task { await catalogVM.selectCategory(category.id) }
                                    }
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                if !catalogVM.subcategories.isEmpty {
                    Section("Подкатегории") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                categoryChip(title: "Все", isSelected: catalogVM.selectedSubcategoryId == nil) {
                                    Task { await catalogVM.selectSubcategory(nil) }
                                }

                                ForEach(catalogVM.subcategories) { subcategory in
                                    categoryChip(title: subcategory.name, isSelected: catalogVM.selectedSubcategoryId == subcategory.id) {
                                        Task { await catalogVM.selectSubcategory(subcategory.id) }
                                    }
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                Section("Товары") {
                    ForEach(catalogVM.products) { product in
                        ProductRowView(
                            product: product,
                            quantity: appState.quantity(for: product.id),
                            onQuantityChange: { appState.setQuantity($0, for: product) }
                        )
                    }
                }
            }
            .listStyle(.insetGrouped)
        }
        .navigationTitle("Каталог")
        .searchable(text: Binding(
            get: { catalogVM.searchText },
            set: { catalogVM.searchTextChanged($0) }
        ))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    onCheckout()
                } label: {
                    Text("Оформить (\(appState.totalItems))")
                }
                .disabled(appState.totalItems == 0)
            }
        }
        .overlay {
            if catalogVM.isLoading {
                ProgressView("Загрузка каталога...")
                    .padding()
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .alert("Ошибка сети", isPresented: Binding(
            get: { catalogVM.errorMessage != nil },
            set: { _ in catalogVM.errorMessage = nil }
        )) {
            Button("Ок", role: .cancel) {}
        } message: {
            Text(catalogVM.errorMessage ?? "Неизвестная ошибка")
        }
    }

    private func categoryChip(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? accentBlue : Color.gray.opacity(0.2))
                .foregroundStyle(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct ProductRowView: View {
    let product: Product
    let quantity: Int
    let onQuantityChange: (Int) -> Void

    private let priceColor = Color(red: 0.06, green: 0.73, blue: 0.51)
    private let accentBlue = Color(red: 0.23, green: 0.51, blue: 0.96)

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: productIcon(for: product))
                .font(.title2)
                .foregroundStyle(accentBlue)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 4) {
                Text(product.name)
                    .font(.headline)
                Text(productSubtitle(for: product))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 6) {
                Text(priceText(product.price))
                    .font(.headline)
                    .foregroundStyle(priceColor)

                Stepper(value: Binding(
                    get: { quantity },
                    set: { onQuantityChange($0) }
                ), in: 0...99) {
                    Text("\(quantity)")
                        .font(.subheadline)
                }
                .labelsHidden()
            }
        }
        .padding(.vertical, 4)
    }

    private func productSubtitle(for product: Product) -> String {
        let weight = product.weight != nil ? "• \(String(format: "%.1f", product.weight!)) кг" : ""
        return "\(product.description ?? "") \(weight)".trimmingCharacters(in: .whitespaces)
    }

    private func priceText(_ price: Double) -> String {
        if price == Double(Int(price)) {
            return "\(Int(price))₽"
        }
        return String(format: "%.2f₽", price)
    }

    private func productIcon(for product: Product) -> String {
        let name = product.name.lowercased()
        if name.contains("цемент") {
            return "bag.fill"
        }
        if name.contains("хлеб") {
            return "leaf"
        }
        if name.contains("молоко") {
            return "drop.fill"
        }
        if name.contains("чипс") {
            return "flame.fill"
        }
        return "shippingbox.fill"
    }
}

#Preview {
    let appState = CartViewModel()
    NavigationStack { CatalogView(onCheckout: {}) }
        .environmentObject(appState)
        .environmentObject(CatalogViewModel(appState: appState))
        .environmentObject(StoresViewModel())
}
