import SwiftUI

struct AddChoreView: View {
    @EnvironmentObject var choreStore: ChoreStore
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""

    var body: some View {
        VStack(spacing: 12) {
            Text("New Chore").font(.headline)
            TextField("Chore name", text: $text)   // dictation/scribble on watch
            Button("Add") {
                let label = text
                Task {
                    await choreStore.addChore(label)
                    dismiss()
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding()
    }
}
