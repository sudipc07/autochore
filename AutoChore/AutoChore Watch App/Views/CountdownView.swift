import SwiftUI
import Combine

/// Plain 3-2-1 countdown that calls `onComplete` when it reaches zero.
struct CountdownView: View {
    let choreLabel: String
    let onComplete: () -> Void

    @State private var count = 3
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack {
            Text("\(count)")
                .font(.system(size: 60, weight: .bold))
            Text(choreLabel)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .onReceive(timer) { _ in
            if count > 1 {
                count -= 1
            } else {
                timer.upstream.connect().cancel()
                onComplete()
            }
        }
    }
}
