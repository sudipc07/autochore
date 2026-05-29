import SwiftUI

struct HomeView: View {
    @EnvironmentObject var identity: UserIdentity
    @EnvironmentObject var choreStore: ChoreStore
    @State private var showAdd = false
    @State private var activeChore: ChoreSelection?

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(choreStore.chores) { chore in
                    Button(chore.label) {
                        activeChore = ChoreSelection(label: chore.label)
                    }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity, minHeight: 60)
                }
                Button { showAdd = true } label: {
                    Label("Add", systemImage: "plus")
                        .frame(maxWidth: .infinity, minHeight: 60)
                }
                .buttonStyle(.bordered)
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle(identity.name ?? "AutoChore")
        .sheet(isPresented: $showAdd) { AddChoreView() }
        .fullScreenCover(item: $activeChore) { selection in
            RecordingFlowView(choreLabel: selection.label) {
                activeChore = nil
            }
        }
        .task { await choreStore.refresh() }
    }
}

/// Wraps a chore label for presentation without making `String` Identifiable globally.
struct ChoreSelection: Identifiable, Hashable {
    let label: String
    var id: String { label }
}
