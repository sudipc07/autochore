import SwiftUI

struct NamePickerView: View {
    @EnvironmentObject var identity: UserIdentity
    @State private var options = CharacterNames.randomFour()

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text("Who are you?")
                    .font(.headline)
                ForEach(options, id: \.self) { name in
                    Button(name) { identity.save(name) }
                        .buttonStyle(.borderedProminent)
                        .frame(maxWidth: .infinity)
                }
                Button("Shuffle") { options = CharacterNames.randomFour() }
                    .font(.footnote)
                    .padding(.top, 4)
            }
            .padding()
        }
    }
}
