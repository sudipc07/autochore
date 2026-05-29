import Foundation

enum CharacterNames {
    // Original funny names — no trademarked characters.
    static let pool = [
        "Wobble", "Snickers", "Bubbles", "Pickle", "Noodle", "Waffles",
        "Mochi", "Biscuit", "Pumpkin", "Squiggle", "Tofu", "Gizmo",
        "Pebble", "Marshmallow", "Doodle", "Sprout"
    ]
    static func randomFour() -> [String] {
        Array(pool.shuffled().prefix(4))
    }
}
