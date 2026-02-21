import SwiftUI

@main
struct LamanDeliveryApp: App {
    @StateObject private var appState: AppState
    @StateObject private var catalogVM: CatalogViewModel
    @StateObject private var storesVM: StoresViewModel

    init() {
        let appState = AppState()
        _appState = StateObject(wrappedValue: appState)
        _catalogVM = StateObject(wrappedValue: CatalogViewModel(appState: appState))
        _storesVM = StateObject(wrappedValue: StoresViewModel())
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(catalogVM)
                .environmentObject(storesVM)
        }
    }
}
