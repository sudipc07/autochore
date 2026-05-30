import SwiftUI

/// The full record flow for one chore: countdown → recording → upload.
/// Presented as a cover; calls `onDone` to dismiss back to Home.
struct RecordingFlowView: View {
    let choreLabel: String
    let onDone: () -> Void

    @State private var phase: Phase = .countdown
    enum Phase { case countdown, recording }

    var body: some View {
        switch phase {
        case .countdown:
            CountdownView(choreLabel: choreLabel) { phase = .recording }
        case .recording:
            RecordingView(choreLabel: choreLabel, onDone: onDone)
        }
    }
}

struct RecordingView: View {
    let choreLabel: String
    let onDone: () -> Void

    @EnvironmentObject var identity: UserIdentity
    @StateObject private var recorder = SensorRecorder()

    @State private var startTime = Date()
    @State private var status: Status = .recording

    private let store = SessionStore()
    private let client = SupabaseClient()

    enum Status { case recording, uploading, done, failed }

    var body: some View {
        VStack(spacing: 12) {
            Text(choreLabel).font(.headline)

            switch status {
            case .recording:
                // System-updated stopwatch — stays correct in Always-On Display
                // and while backgrounded (counts up from startTime).
                Text(startTime, style: .timer)
                    .font(.system(size: 34, weight: .semibold).monospacedDigit())
                    .multilineTextAlignment(.center)
                Text("Hold to stop")
                    .font(.footnote)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(Capsule().fill(.red.opacity(0.35)))
                    .onLongPressGesture(minimumDuration: 1.0) { stopAndUpload() }
            case .uploading:
                ProgressView("Uploading…")
            case .done:
                Label("Saved", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            case .failed:
                Label("Saved locally — will retry", systemImage: "arrow.clockwise")
                    .multilineTextAlignment(.center)
            }
        }
        .onAppear {
            startTime = Date()
            Task { await recorder.requestAuthorization() }
            recorder.start()
        }
    }

    private func stopAndUpload() {
        status = .uploading
        Task {
            let result = await recorder.stop()
            let session = Session(
                userId: identity.name ?? "unknown",
                choreLabel: choreLabel,
                startTime: startTime,
                endTime: Date(),
                sampleRate: Config.sampleRate,
                notes: nil,
                motionSamples: result.motion,
                altitudeSamples: result.altitude,
                floorSummary: result.floors)
            do {
                try await client.postSession(session)
                status = .done
            } catch {
                _ = try? store.save(session)
                status = .failed
            }
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            onDone()
        }
    }
}
