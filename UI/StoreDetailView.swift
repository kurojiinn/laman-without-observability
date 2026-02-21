import SwiftUI
import Foundation

struct StoreDetailView: View {
    @EnvironmentObject private var appState: AppState

    let store: Store

    @State private var localProducts: [Product] = []
    @State private var storeSubcategories: [Subcategory] = []
    @State private var selectedSubcategoryId: UUID? = nil
    @State private var isLoading = false
    @State private var errorMessage: String? = nil
    @State private var showStoreMismatch = false
    @State private var pendingProduct: Product? = nil
    @State private var searchText: String = ""

    private let accentBlue = Color(red: 0.23, green: 0.51, blue: 0.96)
    private var isPreview: Bool {
        ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1"
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(store.name)
                        .font(.title2)
                    if let desc = store.description {
                        Text(desc)
                            .foregroundStyle(.secondary)
                    }
                    if let address = store.address, !address.isEmpty {
                        Text(address)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Адрес не указан")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    if let phone = store.phone, !phone.isEmpty {
                        Text(phone)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    HStack(spacing: 6) {
                        Image(systemName: "star.fill")
                            .foregroundStyle(.yellow)
                        Text(String(format: "%.1f", store.rating))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if !storeSubcategories.isEmpty {
                Section("Подкатегории") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            categoryChip(title: "Все", isSelected: selectedSubcategoryId == nil) {
                                selectedSubcategoryId = nil
                                Task { await loadProducts() }
                            }

                            ForEach(storeSubcategories) { subcategory in
                                categoryChip(title: subcategory.name, isSelected: selectedSubcategoryId == subcategory.id) {
                                    selectedSubcategoryId = subcategory.id
                                    Task { await loadProducts() }
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }

            Section("Товары") {
                ForEach(localProducts) { product in
                    ProductRowView(
                        product: product,
                        quantity: appState.quantity(for: product.id),
                        onQuantityChange: { newValue in
                            handleAdd(product: product, newQuantity: newValue)
                        }
                    )
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(store.name)
        .searchable(text: $searchText)
        .onChange(of: searchText, initial: false) { _, _ in
            Task { await loadProducts() }
        }
        .task {
            if isPreview {
                localProducts = previewProducts
                storeSubcategories = previewSubcategories
                return
            }
            await loadSubcategories()
            await loadProducts()
        }
        .overlay {
            if isLoading {
                ProgressView("Загрузка товаров...")
                    .padding()
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .alert("Ошибка сети", isPresented: Binding(
            get: { errorMessage != nil },
            set: { _ in errorMessage = nil }
        )) {
            Button("Ок", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "Неизвестная ошибка")
        }
        .alert("Очистить корзину?", isPresented: $showStoreMismatch) {
            Button("Отмена", role: .cancel) {}
            Button("Очистить", role: .destructive) {
                appState.clearCart()
                if let product = pendingProduct {
                    appState.setQuantity(1, for: product)
                }
                pendingProduct = nil
            }
        } message: {
            Text("Можно заказывать только из одного магазина за раз.")
        }
    }

    private func loadProducts() async {
        if isPreview {
            localProducts = previewProducts
            return
        }
        isLoading = true
        errorMessage = nil
        do {
            localProducts = try await LamanAPI().getStoreProducts(
                storeId: store.id,
                subcategoryId: selectedSubcategoryId,
                search: searchText.isEmpty ? nil : searchText
            )
            appState.mergeProducts(localProducts)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func loadSubcategories() async {
        if isPreview {
            storeSubcategories = previewSubcategories
            return
        }
        do {
            storeSubcategories = try await LamanAPI().getStoreSubcategories(storeId: store.id)
        } catch {
            storeSubcategories = []
        }
    }

    private func handleAdd(product: Product, newQuantity: Int) {
        if let activeStore = appState.activeStoreId, activeStore != product.storeId, newQuantity > 0 {
            pendingProduct = product
            showStoreMismatch = true
            return
        }
        appState.setQuantity(newQuantity, for: product)
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

    private var previewProducts: [Product] {
        [
            Product(
                id: UUID(),
                categoryId: nil,
                subcategoryId: nil,
                storeId: store.id,
                name: "Молоко 1л",
                description: "Пастеризованное",
                price: 80,
                weight: 1.0,
                isAvailable: true
            ),
            Product(
                id: UUID(),
                categoryId: nil,
                subcategoryId: nil,
                storeId: store.id,
                name: "Хлеб",
                description: "Свежий",
                price: 50,
                weight: 0.5,
                isAvailable: true
            )
        ]
    }

    private var previewSubcategories: [Subcategory] {
        [
            Subcategory(id: UUID(), categoryId: UUID(), name: "Пиццы", createdAt: nil),
            Subcategory(id: UUID(), categoryId: UUID(), name: "Напитки", createdAt: nil)
        ]
    }
}

#Preview {
    let appState = CartViewModel()
    return StoreDetailView(store: Store(
        id: UUID(),
        name: "Додо Пицца",
        address: "Грозный, пр. Мира 12",
        phone: "+7 (999) 101-01-01",
        description: "Пицца и напитки",
        imageUrl: nil,
        rating: 4.7,
        categoryType: .food
    ))
    .environmentObject(appState)
    .environmentObject(StoresViewModel())
}
