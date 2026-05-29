import SwiftUI

struct NamePickerView: View {
    @EnvironmentObject var identity: UserIdentity
    @State private var options: [String] = []
    @State private var loading = true
    @State private var registering = false
    private let client = SupabaseClient()

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text("Who are you?")
                    .font(.headline)

                if loading {
                    ProgressView()
                        .padding(.top, 12)
                } else {
                    ForEach(options, id: \.self) { name in
                        Button(name) { pick(name) }
                            .buttonStyle(.borderedProminent)
                            .frame(maxWidth: .infinity)
                            .disabled(registering)
                    }
                    Button("Shuffle") { Task { await loadOptions() } }
                        .font(.footnote)
                        .padding(.top, 4)
                        .disabled(registering)
                }
            }
            .padding()
        }
        .task { await loadOptions() }
    }

    private func loadOptions() async {
        loading = true
        let taken = (try? await client.fetchTakenNames()) ?? []
        let available = CharacterNames.pool.filter { !taken.contains($0) }
        // If everything's taken (or offline), fall back to the full pool.
        let base = available.isEmpty ? CharacterNames.pool : available
        options = Array(base.shuffled().prefix(4))
        loading = false
    }

    private func pick(_ name: String) {
        registering = true
        Task {
            try? await client.registerDevice(deviceId: DeviceID.current, name: name)
            identity.save(name)   // lock locally + route to Home
            registering = false
        }
    }
}
