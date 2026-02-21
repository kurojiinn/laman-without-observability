import SwiftUI
import Foundation

struct StoresHubView: View {
    @EnvironmentObject private var storesVM: StoresViewModel

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
                Section("Категории") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            categoryChip(title: "Все", isSelected: storesVM.selectedCategory == nil) {
                                Task { await storesVM.selectCategory(nil) }
                            }

                            ForEach(StoreCategoryType.visibleCases) { category in
                                categoryChip(title: category.title, isSelected: storesVM.selectedCategory == category) {
                                    Task { await storesVM.selectCategory(category) }
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                Section("Магазины") {
                    ForEach(storesVM.stores) { store in
                        NavigationLink {
                            StoreDetailView(store: store)
                        } label: {
                            StoreCardView(store: store)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
        }
        .navigationTitle("Магазины")
        .searchable(text: Binding(
            get: { storesVM.searchText },
            set: { storesVM.searchTextChanged($0) }
        ))
        .task {
            await storesVM.loadStores()
        }
        .overlay {
            if storesVM.isLoading {
                ProgressView("Загрузка магазинов...")
                    .padding()
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .alert("Ошибка сети", isPresented: Binding(
            get: { storesVM.errorMessage != nil },
            set: { _ in storesVM.errorMessage = nil }
        )) {
            Button("Ок", role: .cancel) {}
        } message: {
            Text(storesVM.errorMessage ?? "Неизвестная ошибка")
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

#Preview {
    let appState = CartViewModel()
    NavigationStack { StoresHubView() }
        .environmentObject(StoresViewModel())
        .environmentObject(appState)
        .environmentObject(CatalogViewModel(appState: appState))
}
