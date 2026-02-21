import Foundation
import Combine

@MainActor
final class StoresViewModel: ObservableObject {
    @Published var stores: [Store] = []
    @Published var selectedCategory: StoreCategoryType? = nil
    @Published var searchText: String = ""
    @Published var isLoading = false
    @Published var errorMessage: String? = nil

    private let api = LamanAPI()
    private var searchTask: Task<Void, Never>?

    func loadStores() async {
        isLoading = true
        errorMessage = nil
        do {
            let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            stores = try await api.getStores(
                categoryType: selectedCategory,
                search: query.isEmpty ? nil : query
            )
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func selectCategory(_ category: StoreCategoryType?) async {
        selectedCategory = category
        await loadStores()
    }

    func searchTextChanged(_ text: String) {
        searchText = text
        scheduleSearch()
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        searchTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard let self, !Task.isCancelled else { return }
            if query.isEmpty {
                await self.loadStores()
            } else {
                await self.loadStores()
            }
        }
    }
}
