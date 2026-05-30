import Foundation
import HealthKit

/// Keeps the app running at full sensor rate while recording by holding an
/// HKWorkoutSession. Without this, watchOS throttles CoreMotion to a trickle
/// once the screen sleeps or the wrist drops.
@MainActor
final class WorkoutKeepAlive {
    private let store = HKHealthStore()
    private var session: HKWorkoutSession?

    /// Ask once for permission to record a workout (needed to hold the session).
    func requestAuthorization() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let share: Set = [HKObjectType.workoutType()]
        try? await store.requestAuthorization(toShare: share, read: [])
    }

    func start() {
        guard HKHealthStore.isHealthDataAvailable(), session == nil else { return }
        let config = HKWorkoutConfiguration()
        config.activityType = .other
        config.locationType = .indoor
        do {
            let s = try HKWorkoutSession(healthStore: store, configuration: config)
            session = s
            s.startActivity(with: Date())
        } catch {
            // If the session can't start, recording still works in the foreground.
            session = nil
        }
    }

    func stop() {
        session?.end()
        session = nil
    }
}
