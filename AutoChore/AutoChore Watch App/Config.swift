import Foundation

enum Config {
    static let supabaseURL = URL(string: "https://jehrccwdwrjybzzksgmr.supabase.co")!
    static let supabaseKey = "sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA"
    static let sampleRate = 50          // Hz for motion sensors
    static let maxRecordingSeconds = 600 // auto-stop a session after 10 minutes
}
