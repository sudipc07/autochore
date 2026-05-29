import Foundation

enum CharacterNames {
    // Phineas and Ferb characters (internal use).
    static let pool = [
        "Phineas", "Ferb", "Candace", "Perry", "Doofenshmirtz", "Isabella",
        "Baljeet", "Buford", "Jeremy", "Vanessa", "Stacy", "Carl",
        "Norm", "Monogram", "Pinky", "Lawrence"
    ]
    static func randomFour() -> [String] {
        Array(pool.shuffled().prefix(4))
    }
}
