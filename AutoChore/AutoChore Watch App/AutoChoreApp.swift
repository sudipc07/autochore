import SwiftUI

@main
struct AutoChore_Watch_AppApp: App {
    @StateObject private var identity = UserIdentity()
    @StateObject private var choreStore = ChoreStore()

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                Group {
                    if identity.name == nil {
                        NamePickerView()
                    } else {
                        HomeView()
                    }
                }
            }
            .environmentObject(identity)
            .environmentObject(choreStore)
            .task { await retryPending() }
        }
    }

    /// Flush any sessions that failed to upload previously.
    private func retryPending() async {
        let store = SessionStore()
        let client = SupabaseClient()
        for pending in store.loadPending() {
            do {
                try await client.uploadSession(pending.session)
                store.remove(pending.id)
            } catch {
                // Keep on disk; retry on the next launch.
            }
        }
    }
}
