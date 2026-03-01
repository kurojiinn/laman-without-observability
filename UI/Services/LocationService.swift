import CoreLocation
import Foundation

/// LocationService управляет геолокацией курьера во время смены и отправкой координат на backend.
final class LocationService: NSObject {
    private let manager: CLLocationManager
    private let api: LamanAPI
    private var timer: Timer?
    private var latestLocation: CLLocation?
    private var isTracking: Bool = false
    private var didNotifyShiftStart: Bool = false

    var onStatusMessage: ((String?) -> Void)?

    init(api: LamanAPI) {
        self.api = api
        self.manager = CLLocationManager()
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = kCLDistanceFilterNone
    }

    /// Запрашивает разрешение и запускает трекинг курьера только на время активной смены.
    func startTracking() {
        guard !isTracking else { return }
        isTracking = true
        didNotifyShiftStart = false

        let status = manager.authorizationStatus
        if status == .notDetermined {
            manager.requestWhenInUseAuthorization()
            return
        }

        handleAuthorization(status)
    }

    /// Останавливает получение координат и отправку на backend.
    func stopTracking() {
        if isTracking {
            Task {
                do {
                    try await api.endCourierShift()
                } catch {
                    print("[LocationService] endCourierShift failed: \(error)")
                }
            }
        }

        isTracking = false
        didNotifyShiftStart = false
        latestLocation = nil
        timer?.invalidate()
        timer = nil
        manager.stopUpdatingLocation()
        onStatusMessage?(nil)
    }

    private func handleAuthorization(_ status: CLAuthorizationStatus) {
        guard isTracking else { return }

        switch status {
        case .authorizedWhenInUse:
            onStatusMessage?(nil)
            manager.startUpdatingLocation()
            startSendTimer()
        case .restricted, .denied:
            stopTracking()
            onStatusMessage?("Доступ к геолокации отключен. Включите его в Настройках, чтобы начать смену.")
        case .notDetermined:
            break
        case .authorizedAlways:
            // Для MVP используем обычный in-use сценарий, но разрешение Always тоже допускаем.
            onStatusMessage?(nil)
            manager.startUpdatingLocation()
            startSendTimer()
        @unknown default:
            stopTracking()
            onStatusMessage?("Не удалось определить статус геолокации.")
        }
    }

    private func startSendTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.sendLatestLocationIfNeeded()
        }
        timer?.tolerance = 1
    }

    private func sendLatestLocationIfNeeded() {
        guard isTracking, let latestLocation else { return }

        let lat = latestLocation.coordinate.latitude
        let lng = latestLocation.coordinate.longitude

        Task {
            do {
                try await api.updateCourierLocation(lat: lat, lng: lng)
            } catch {
                // Для MVP не прерываем смену при сетевой ошибке отправки координат.
            }
        }
    }
}

extension LocationService: CLLocationManagerDelegate {
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        handleAuthorization(manager.authorizationStatus)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard isTracking else { return }
        guard let location = locations.last else { return }
        latestLocation = location

        if !didNotifyShiftStart {
            didNotifyShiftStart = true
            Task {
                do {
                    try await api.startCourierShift(
                        lat: location.coordinate.latitude,
                        lng: location.coordinate.longitude
                    )
                } catch {
                    print("[LocationService] startCourierShift failed: \(error)")
                }
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        onStatusMessage?("Не удалось получить геолокацию: \(error.localizedDescription)")
    }
}
