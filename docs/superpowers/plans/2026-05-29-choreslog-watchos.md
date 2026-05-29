# ChoresLog watchOS App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone watchOS app that records Apple Watch motion + altitude + floor data while a janitor performs a chore, labels it from a shared chore list, and POSTs each session directly to Supabase.

**Architecture:** SwiftUI watchOS app. `CoreMotion` collects accelerometer/gyroscope/magnetometer at 50 Hz, `CMAltimeter` collects relative altitude, `CMPedometer` provides floor counts. Sessions serialize to `Codable` JSON and POST to the Supabase REST API (PostgREST). Failed POSTs persist to disk and retry on next launch. Chores come from a shared Supabase `chores` table, cached locally.

**Tech Stack:** Swift 5, SwiftUI, CoreMotion, Foundation `URLSession`, watchOS 10+, Supabase (PostgREST), XCTest.

---

## Pre-requisites (done by the user, not by an agent)

1. **Create the Supabase tables** — run the SQL in Task 1 in the Supabase SQL Editor.
2. **Create the empty Xcode project** — Xcode → File → New → Project → watchOS → App:
   - Product Name: `ChoresLog`
   - Interface: SwiftUI, Language: Swift
   - Watch-only (standalone), no Notification scene
   - Saved inside `/Users/sudiptohome/Store/autochore/`
   - Set **Team** to the paid developer team and a bundle id like `com.rode.ChoresLog`.
3. In the watch app target's **Info** tab, add key **`NSMotionUsageDescription`** with value:
   `ChoresLog records motion to log how chores are performed.`

All source-file paths below are relative to the Watch App source folder created by Xcode (referred to as `ChoresLog Watch App/` — adjust if Xcode names it differently). Each new `.swift` file must be added to the Watch App target.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `Config.swift` | Supabase URL + publishable key constants |
| `Models/Chore.swift` | `Codable` chore row from the shared list |
| `Models/Session.swift` | `Codable` session + sample structs (the POST payload) |
| `Network/SupabaseClient.swift` | GET chores, POST chore, POST session |
| `Storage/ChoreStore.swift` | Fetch + cache chore list, add custom chore |
| `Storage/SessionStore.swift` | Persist failed sessions to disk, retry queue |
| `Sensors/SensorRecorder.swift` | CoreMotion wrapper, 50 Hz buffering, floor/altitude |
| `Identity/CharacterNames.swift` | Pool of funny character names + random pick of 4 |
| `Identity/UserIdentity.swift` | Save/load locked character name in UserDefaults |
| `Views/NamePickerView.swift` | First-launch name picker |
| `Views/HomeView.swift` | Chore tile grid + "+ Add" tile |
| `Views/AddChoreView.swift` | Dictation entry for new chore |
| `Views/CountdownView.swift` | 3-2-1 countdown |
| `Views/RecordingView.swift` | Timer + tap-and-hold-to-stop + upload |
| `ChoresLogApp.swift` | App entry, routes NamePicker vs Home (modify Xcode's generated file) |
| Test target | XCTest unit tests for models, identity, stores |

---

## Task 1: Create Supabase tables

**Files:** none in repo — this is run in the Supabase SQL Editor by the user.

- [ ] **Step 1: Run this SQL in Supabase → SQL Editor → New query**

```sql
-- Shared chore list
create table if not exists public.chores (
  id          uuid primary key default gen_random_uuid(),
  label       text not null unique,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now()
);

-- Recorded sessions
create table if not exists public.sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  chore_label       text not null,
  start_time        timestamptz not null,
  end_time          timestamptz not null,
  sample_rate       integer not null,
  sample_count      integer not null,
  notes             text,
  motion_samples    jsonb not null,
  altitude_samples  jsonb not null default '[]'::jsonb,
  floor_summary     jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists idx_sessions_chore on public.sessions (chore_label);
create index if not exists idx_sessions_user  on public.sessions (user_id);
create index if not exists idx_sessions_start on public.sessions (start_time);

-- Seed preset chores
insert into public.chores (label, sort_order) values
  ('Mop', 10), ('Vacuum', 20), ('Sweep', 30), ('Dust', 40),
  ('Clean Toilets', 50), ('Wipe Windows', 60), ('Wipe Surfaces', 70),
  ('Empty Trash', 80), ('Mop Stairs', 90), ('Cook', 100)
on conflict (label) do nothing;
```

- [ ] **Step 2: Verify in Supabase → Table Editor**

Expected: `chores` table shows 10 rows; `sessions` table exists and is empty.

- [ ] **Step 3: Verify the REST API is reachable**

Run from a terminal:

```bash
curl "https://jehrccwdwrjybzzksgmr.supabase.co/rest/v1/chores?select=label&order=sort_order" \
  -H "apikey: sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA"
```

Expected: JSON array of 10 chore labels, Mop first.

---

## Task 2: Config constants

**Files:**
- Create: `Config.swift`

- [ ] **Step 1: Write the config**

```swift
import Foundation

enum Config {
    static let supabaseURL = URL(string: "https://jehrccwdwrjybzzksgmr.supabase.co")!
    static let supabaseKey = "sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA"
    static let sampleRate = 50          // Hz for motion sensors
}
```

- [ ] **Step 2: Commit**

```bash
git add "ChoresLog Watch App/Config.swift"
git commit -m "feat: add Supabase config constants"
```

---

## Task 3: Chore model

**Files:**
- Create: `Models/Chore.swift`
- Test: `ChoresLogTests/ChoreTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import ChoresLog_Watch_App   // adjust to the generated module name

final class ChoreTests: XCTestCase {
    func test_decodesFromSupabaseJSON() throws {
        let json = """
        [{"id":"a","label":"Mop","sort_order":10},
         {"id":"b","label":"Vacuum","sort_order":20}]
        """.data(using: .utf8)!
        let chores = try JSONDecoder().decode([Chore].self, from: json)
        XCTAssertEqual(chores.count, 2)
        XCTAssertEqual(chores[0].label, "Mop")
        XCTAssertEqual(chores[1].sortOrder, 20)
    }

    func test_encodesNewChoreWithoutId() throws {
        let chore = Chore(id: nil, label: "Windows", sortOrder: 100)
        let data = try JSONEncoder().encode(chore)
        let str = String(data: data, encoding: .utf8)!
        XCTAssertTrue(str.contains("\"label\":\"Windows\""))
        XCTAssertFalse(str.contains("\"id\""))   // nil id omitted for insert
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

In Xcode: Product → Test (⌘U). Expected: FAIL — `Chore` not defined.

- [ ] **Step 3: Write minimal implementation**

```swift
import Foundation

struct Chore: Codable, Identifiable, Hashable {
    let id: String?
    let label: String
    let sortOrder: Int

    enum CodingKeys: String, CodingKey {
        case id
        case label
        case sortOrder = "sort_order"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        if let id { try c.encode(id, forKey: .id) }
        try c.encode(label, forKey: .label)
        try c.encode(sortOrder, forKey: .sortOrder)
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

⌘U. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "ChoresLog Watch App/Models/Chore.swift" ChoresLogTests/ChoreTests.swift
git commit -m "feat: add Chore model with Supabase codable"
```

---

## Task 4: Session + sample models

**Files:**
- Create: `Models/Session.swift`
- Test: `ChoresLogTests/SessionTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import ChoresLog_Watch_App

final class SessionTests: XCTestCase {
    func test_encodesPayloadWithSnakeCaseKeys() throws {
        let session = Session(
            userId: "Goofy",
            choreLabel: "Mop",
            startTime: Date(timeIntervalSince1970: 0),
            endTime: Date(timeIntervalSince1970: 5),
            sampleRate: 50,
            notes: "test",
            motionSamples: [MotionSample(t: 0, ax: 1, ay: 2, az: 3,
                                         gx: 4, gy: 5, gz: 6,
                                         mx: 7, my: 8, mz: 9)],
            altitudeSamples: [AltitudeSample(t: 0, relativeAltitude: 1.5)],
            floorSummary: FloorSummary(floorsAscended: 2, floorsDescended: 1)
        )
        let data = try JSONEncoder().encode(session)
        let obj = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertEqual(obj["user_id"] as? String, "Goofy")
        XCTAssertEqual(obj["chore_label"] as? String, "Mop")
        XCTAssertEqual(obj["sample_count"] as? Int, 1)   // derived
        XCTAssertNotNil(obj["motion_samples"])
        XCTAssertNotNil(obj["floor_summary"])
    }

    func test_roundTripsThroughDiskCodable() throws {
        let s = Session(userId: "A", choreLabel: "Cook",
                        startTime: Date(), endTime: Date(),
                        sampleRate: 50, notes: nil,
                        motionSamples: [], altitudeSamples: [],
                        floorSummary: FloorSummary(floorsAscended: 0, floorsDescended: 0))
        let data = try JSONEncoder().encode(s)
        let decoded = try JSONDecoder().decode(Session.self, from: data)
        XCTAssertEqual(decoded.choreLabel, "Cook")
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

⌘U. Expected: FAIL — types not defined.

- [ ] **Step 3: Write minimal implementation**

```swift
import Foundation

struct MotionSample: Codable {
    let t: Int            // ms offset from start
    let ax, ay, az: Double
    let gx, gy, gz: Double
    let mx, my, mz: Double?
}

struct AltitudeSample: Codable {
    let t: Int
    let relativeAltitude: Double
    enum CodingKeys: String, CodingKey {
        case t
        case relativeAltitude = "relative_altitude"
    }
}

struct FloorSummary: Codable {
    let floorsAscended: Int
    let floorsDescended: Int
    enum CodingKeys: String, CodingKey {
        case floorsAscended = "floors_ascended"
        case floorsDescended = "floors_descended"
    }
}

struct Session: Codable {
    let userId: String
    let choreLabel: String
    let startTime: Date
    let endTime: Date
    let sampleRate: Int
    let notes: String?
    let motionSamples: [MotionSample]
    let altitudeSamples: [AltitudeSample]
    let floorSummary: FloorSummary

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case choreLabel = "chore_label"
        case startTime = "start_time"
        case endTime = "end_time"
        case sampleRate = "sample_rate"
        case sampleCount = "sample_count"
        case notes
        case motionSamples = "motion_samples"
        case altitudeSamples = "altitude_samples"
        case floorSummary = "floor_summary"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(userId, forKey: .userId)
        try c.encode(choreLabel, forKey: .choreLabel)
        try c.encode(iso(startTime), forKey: .startTime)
        try c.encode(iso(endTime), forKey: .endTime)
        try c.encode(sampleRate, forKey: .sampleRate)
        try c.encode(motionSamples.count, forKey: .sampleCount)
        try c.encodeIfPresent(notes, forKey: .notes)
        try c.encode(motionSamples, forKey: .motionSamples)
        try c.encode(altitudeSamples, forKey: .altitudeSamples)
        try c.encode(floorSummary, forKey: .floorSummary)
    }

    init(userId: String, choreLabel: String, startTime: Date, endTime: Date,
         sampleRate: Int, notes: String?, motionSamples: [MotionSample],
         altitudeSamples: [AltitudeSample], floorSummary: FloorSummary) {
        self.userId = userId; self.choreLabel = choreLabel
        self.startTime = startTime; self.endTime = endTime
        self.sampleRate = sampleRate; self.notes = notes
        self.motionSamples = motionSamples; self.altitudeSamples = altitudeSamples
        self.floorSummary = floorSummary
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        userId = try c.decode(String.self, forKey: .userId)
        choreLabel = try c.decode(String.self, forKey: .choreLabel)
        startTime = isoDate(try c.decode(String.self, forKey: .startTime))
        endTime = isoDate(try c.decode(String.self, forKey: .endTime))
        sampleRate = try c.decode(Int.self, forKey: .sampleRate)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        motionSamples = try c.decode([MotionSample].self, forKey: .motionSamples)
        altitudeSamples = try c.decode([AltitudeSample].self, forKey: .altitudeSamples)
        floorSummary = try c.decode(FloorSummary.self, forKey: .floorSummary)
    }
}

private let isoFormatter: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()
private func iso(_ d: Date) -> String { isoFormatter.string(from: d) }
private func isoDate(_ s: String) -> Date { isoFormatter.date(from: s) ?? Date() }
```

- [ ] **Step 4: Run test to verify it passes**

⌘U. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "ChoresLog Watch App/Models/Session.swift" ChoresLogTests/SessionTests.swift
git commit -m "feat: add Session payload model with derived sample_count"
```

---

## Task 5: Character names + identity

**Files:**
- Create: `Identity/CharacterNames.swift`
- Create: `Identity/UserIdentity.swift`
- Test: `ChoresLogTests/IdentityTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import ChoresLog_Watch_App

final class IdentityTests: XCTestCase {
    func test_randomFourAreUniqueAndFromPool() {
        let four = CharacterNames.randomFour()
        XCTAssertEqual(four.count, 4)
        XCTAssertEqual(Set(four).count, 4)                       // unique
        XCTAssertTrue(four.allSatisfy { CharacterNames.pool.contains($0) })
    }

    func test_saveAndLoadLocksName() {
        let id = UserIdentity(defaults: UserDefaults(suiteName: #function)!)
        XCTAssertNil(id.name)
        id.save("Wobble")
        XCTAssertEqual(id.name, "Wobble")
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

⌘U. Expected: FAIL — types not defined.

- [ ] **Step 3: Write minimal implementation**

`Identity/CharacterNames.swift`:

```swift
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
```

`Identity/UserIdentity.swift`:

```swift
import Foundation

final class UserIdentity: ObservableObject {
    private let key = "character_name"
    private let defaults: UserDefaults
    @Published private(set) var name: String?

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.name = defaults.string(forKey: key)
    }
    func save(_ value: String) {
        defaults.set(value, forKey: key)
        name = value
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

⌘U. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "ChoresLog Watch App/Identity" ChoresLogTests/IdentityTests.swift
git commit -m "feat: add character name pool and locked identity store"
```

---

## Task 6: SupabaseClient

**Files:**
- Create: `Network/SupabaseClient.swift`

Note: networking is verified on-device in Task 12; no unit test here (avoids hitting the live API in CI).

- [ ] **Step 1: Write the implementation**

```swift
import Foundation

enum SupabaseError: Error { case badStatus(Int) }

struct SupabaseClient {
    let baseURL = Config.supabaseURL
    let key = Config.supabaseKey

    private func request(_ path: String, method: String) -> URLRequest {
        var req = URLRequest(url: baseURL.appendingPathComponent("rest/v1").appendingPathComponent(path))
        req.httpMethod = method
        req.setValue(key, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return req
    }

    func fetchChores() async throws -> [Chore] {
        var req = request("chores", method: "GET")
        req.url = URL(string: req.url!.absoluteString + "?select=id,label,sort_order&order=sort_order")
        let (data, resp) = try await URLSession.shared.data(for: req)
        try check(resp)
        return try JSONDecoder().decode([Chore].self, from: data)
    }

    func addChore(label: String) async throws {
        var req = request("chores", method: "POST")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONEncoder().encode(Chore(id: nil, label: label, sortOrder: 100))
        let (_, resp) = try await URLSession.shared.data(for: req)
        try check(resp)
    }

    func postSession(_ session: Session) async throws {
        var req = request("sessions", method: "POST")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONEncoder().encode(session)
        let (_, resp) = try await URLSession.shared.data(for: req)
        try check(resp)
    }

    private func check(_ resp: URLResponse) throws {
        guard let http = resp as? HTTPURLResponse else { return }
        guard (200...299).contains(http.statusCode) else {
            throw SupabaseError.badStatus(http.statusCode)
        }
    }
}
```

- [ ] **Step 2: Build to verify it compiles**

In Xcode: Product → Build (⌘B). Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add "ChoresLog Watch App/Network/SupabaseClient.swift"
git commit -m "feat: add SupabaseClient for chores and sessions"
```

---

## Task 7: SessionStore (disk retry queue)

**Files:**
- Create: `Storage/SessionStore.swift`
- Test: `ChoresLogTests/SessionStoreTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import ChoresLog_Watch_App

final class SessionStoreTests: XCTestCase {
    var dir: URL!
    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    func test_savesAndLoadsPending() throws {
        let store = SessionStore(directory: dir)
        let s = Session(userId: "A", choreLabel: "Mop", startTime: Date(), endTime: Date(),
                        sampleRate: 50, notes: nil, motionSamples: [],
                        altitudeSamples: [], floorSummary: .init(floorsAscended: 0, floorsDescended: 0))
        try store.save(s)
        XCTAssertEqual(store.loadPending().count, 1)
    }

    func test_removeDeletesFromDisk() throws {
        let store = SessionStore(directory: dir)
        let s = Session(userId: "A", choreLabel: "Mop", startTime: Date(), endTime: Date(),
                        sampleRate: 50, notes: nil, motionSamples: [],
                        altitudeSamples: [], floorSummary: .init(floorsAscended: 0, floorsDescended: 0))
        let id = try store.save(s)
        store.remove(id)
        XCTAssertEqual(store.loadPending().count, 0)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

⌘U. Expected: FAIL — `SessionStore` not defined.

- [ ] **Step 3: Write minimal implementation**

```swift
import Foundation

struct PendingSession: Codable {
    let id: String
    let session: Session
}

final class SessionStore {
    private let directory: URL
    private let fm = FileManager.default

    init(directory: URL? = nil) {
        if let directory {
            self.directory = directory
        } else {
            let base = fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
            self.directory = base.appendingPathComponent("pending_sessions")
        }
        try? fm.createDirectory(at: self.directory, withIntermediateDirectories: true)
    }

    @discardableResult
    func save(_ session: Session) throws -> String {
        let id = UUID().uuidString
        let url = directory.appendingPathComponent("\(id).json")
        try JSONEncoder().encode(PendingSession(id: id, session: session)).write(to: url)
        return id
    }

    func loadPending() -> [PendingSession] {
        let files = (try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return files.compactMap { try? JSONDecoder().decode(PendingSession.self, from: Data(contentsOf: $0)) }
    }

    func remove(_ id: String) {
        try? fm.removeItem(at: directory.appendingPathComponent("\(id).json"))
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

⌘U. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "ChoresLog Watch App/Storage/SessionStore.swift" ChoresLogTests/SessionStoreTests.swift
git commit -m "feat: add SessionStore disk retry queue"
```

---

## Task 8: ChoreStore (fetch, cache, add)

**Files:**
- Create: `Storage/ChoreStore.swift`
- Test: `ChoresLogTests/ChoreStoreTests.swift`

- [ ] **Step 1: Write the failing test** (cache logic only — network is injected)

```swift
import XCTest
@testable import ChoresLog_Watch_App

final class ChoreStoreTests: XCTestCase {
    func test_cachesAndReloadsLabels() {
        let d = UserDefaults(suiteName: #function)!
        d.removePersistentDomain(forName: #function)
        let store = ChoreStore(defaults: d)
        store.cache([Chore(id: "1", label: "Mop", sortOrder: 10),
                     Chore(id: "2", label: "Dust", sortOrder: 40)])
        let reloaded = ChoreStore(defaults: d)
        XCTAssertEqual(reloaded.chores.map(\.label), ["Mop", "Dust"])
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

⌘U. Expected: FAIL — `ChoreStore` not defined.

- [ ] **Step 3: Write minimal implementation**

```swift
import Foundation

@MainActor
final class ChoreStore: ObservableObject {
    @Published private(set) var chores: [Chore] = []
    private let defaults: UserDefaults
    private let key = "cached_chores"
    private let client = SupabaseClient()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: key),
           let cached = try? JSONDecoder().decode([Chore].self, from: data) {
            chores = cached
        }
    }

    func cache(_ list: [Chore]) {
        chores = list
        if let data = try? JSONEncoder().encode(list) {
            defaults.set(data, forKey: key)
        }
    }

    func refresh() async {
        if let fresh = try? await client.fetchChores() { cache(fresh) }
    }

    func addChore(_ label: String) async {
        let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        try? await client.addChore(label: trimmed)
        await refresh()
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

⌘U. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "ChoresLog Watch App/Storage/ChoreStore.swift" ChoresLogTests/ChoreStoreTests.swift
git commit -m "feat: add ChoreStore with local cache and refresh"
```

---

## Task 9: SensorRecorder

**Files:**
- Create: `Sensors/SensorRecorder.swift`

Note: CoreMotion cannot run on the simulator or in unit tests — verified on-device in Task 12.

- [ ] **Step 1: Write the implementation**

```swift
import Foundation
import CoreMotion

@MainActor
final class SensorRecorder: ObservableObject {
    private let motion = CMMotionManager()
    private let altimeter = CMAltimeter()
    private let pedometer = CMPedometer()
    private let queue = OperationQueue()

    private var startDate = Date()
    private var motionSamples: [MotionSample] = []
    private var altitudeSamples: [AltitudeSample] = []

    func start() {
        startDate = Date()
        motionSamples.removeAll(); altitudeSamples.removeAll()

        motion.deviceMotionUpdateInterval = 1.0 / Double(Config.sampleRate)
        if motion.isDeviceMotionAvailable {
            motion.startDeviceMotionUpdates(to: queue) { [weak self] dm, _ in
                guard let self, let dm else { return }
                let t = Int(Date().timeIntervalSince(self.startDate) * 1000)
                let f = dm.magneticField.field
                let hasMag = dm.magneticField.accuracy != .uncalibrated
                let sample = MotionSample(
                    t: t,
                    ax: dm.userAcceleration.x, ay: dm.userAcceleration.y, az: dm.userAcceleration.z,
                    gx: dm.rotationRate.x, gy: dm.rotationRate.y, gz: dm.rotationRate.z,
                    mx: hasMag ? f.x : nil, my: hasMag ? f.y : nil, mz: hasMag ? f.z : nil)
                Task { @MainActor in self.motionSamples.append(sample) }
            }
        }

        if CMAltimeter.isRelativeAltitudeAvailable() {
            altimeter.startRelativeAltitudeUpdates(to: queue) { [weak self] alt, _ in
                guard let self, let alt else { return }
                let t = Int(Date().timeIntervalSince(self.startDate) * 1000)
                let sample = AltitudeSample(t: t, relativeAltitude: alt.relativeAltitude.doubleValue)
                Task { @MainActor in self.altitudeSamples.append(sample) }
            }
        }
    }

    /// Stops sensors and returns the collected data plus a floor summary.
    func stop() async -> (motion: [MotionSample], altitude: [AltitudeSample], floors: FloorSummary) {
        motion.stopDeviceMotionUpdates()
        altimeter.stopRelativeAltitudeUpdates()
        let floors = await fetchFloors(from: startDate)
        return (motionSamples, altitudeSamples, floors)
    }

    private func fetchFloors(from start: Date) async -> FloorSummary {
        guard CMPedometer.isFloorCountingAvailable() else {
            return FloorSummary(floorsAscended: 0, floorsDescended: 0)
        }
        return await withCheckedContinuation { cont in
            pedometer.queryPedometerData(from: start, to: Date()) { data, _ in
                cont.resume(returning: FloorSummary(
                    floorsAscended: data?.floorsAscended?.intValue ?? 0,
                    floorsDescended: data?.floorsDescended?.intValue ?? 0))
            }
        }
    }
}
```

- [ ] **Step 2: Build to verify it compiles**

⌘B. Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add "ChoresLog Watch App/Sensors/SensorRecorder.swift"
git commit -m "feat: add SensorRecorder for 50Hz motion, altitude, floors"
```

---

## Task 10: Views — NamePicker, Home, AddChore

**Files:**
- Create: `Views/NamePickerView.swift`
- Create: `Views/HomeView.swift`
- Create: `Views/AddChoreView.swift`

- [ ] **Step 1: Write NamePickerView**

```swift
import SwiftUI

struct NamePickerView: View {
    @EnvironmentObject var identity: UserIdentity
    @State private var options = CharacterNames.randomFour()

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text("Who are you?").font(.headline)
                ForEach(options, id: \.self) { name in
                    Button(name) { identity.save(name) }
                        .buttonStyle(.borderedProminent)
                        .frame(maxWidth: .infinity)
                }
                Button("Shuffle") { options = CharacterNames.randomFour() }
                    .font(.footnote)
            }
            .padding()
        }
    }
}
```

- [ ] **Step 2: Write AddChoreView**

```swift
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
                Task { await choreStore.addChore(label); dismiss() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding()
    }
}
```

- [ ] **Step 3: Write HomeView**

```swift
import SwiftUI

struct HomeView: View {
    @EnvironmentObject var identity: UserIdentity
    @EnvironmentObject var choreStore: ChoreStore
    @State private var showAdd = false
    @State private var selectedChore: String?

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(choreStore.chores) { chore in
                        Button(chore.label) { selectedChore = chore.label }
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
            .navigationTitle(identity.name ?? "ChoresLog")
            .sheet(isPresented: $showAdd) { AddChoreView() }
            .navigationDestination(item: $selectedChore) { chore in
                CountdownView(choreLabel: chore)
            }
            .task { await choreStore.refresh() }
        }
    }
}

extension String: Identifiable { public var id: String { self } }
```

- [ ] **Step 4: Build to verify it compiles**

⌘B. Expected: Build succeeds (CountdownView is added in Task 11; if building before Task 11, temporarily stub it).

- [ ] **Step 5: Commit**

```bash
git add "ChoresLog Watch App/Views/NamePickerView.swift" \
        "ChoresLog Watch App/Views/HomeView.swift" \
        "ChoresLog Watch App/Views/AddChoreView.swift"
git commit -m "feat: add name picker, home grid, and add-chore views"
```

---

## Task 11: Views — Countdown + Recording + upload

**Files:**
- Create: `Views/CountdownView.swift`
- Create: `Views/RecordingView.swift`

- [ ] **Step 1: Write CountdownView**

```swift
import SwiftUI

struct CountdownView: View {
    let choreLabel: String
    @State private var count = 3
    @State private var go = false
    let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack {
            Text("\(count)").font(.system(size: 60, weight: .bold))
        }
        .onReceive(timer) { _ in
            if count > 1 { count -= 1 } else { go = true }
        }
        .navigationDestination(isPresented: $go) {
            RecordingView(choreLabel: choreLabel)
        }
    }
}
```

- [ ] **Step 2: Write RecordingView**

```swift
import SwiftUI

struct RecordingView: View {
    let choreLabel: String
    @EnvironmentObject var identity: UserIdentity
    @Environment(\.dismiss) private var dismiss

    @StateObject private var recorder = SensorRecorder()
    @State private var startTime = Date()
    @State private var elapsed = 0
    @State private var status: Status = .recording
    private let store = SessionStore()
    private let client = SupabaseClient()
    let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    enum Status { case recording, uploading, done, failed }

    var body: some View {
        VStack(spacing: 12) {
            Text(choreLabel).font(.headline)
            switch status {
            case .recording:
                Text(timeString(elapsed)).font(.system(size: 34, weight: .semibold).monospacedDigit())
                Text("Hold to stop").font(.footnote).foregroundStyle(.secondary)
                    .padding(8)
                    .background(Capsule().fill(.red.opacity(0.3)))
                    .onLongPressGesture(minimumDuration: 1.0) { stopAndUpload() }
            case .uploading:
                ProgressView("Uploading…")
            case .done:
                Label("Saved", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
            case .failed:
                Label("Saved locally — will retry", systemImage: "arrow.clockwise")
            }
        }
        .onAppear { startTime = Date(); recorder.start() }
        .onReceive(timer) { _ in if status == .recording { elapsed += 1 } }
    }

    private func stopAndUpload() {
        status = .uploading
        Task {
            let result = await recorder.stop()
            let session = Session(
                userId: identity.name ?? "unknown",
                choreLabel: choreLabel,
                startTime: startTime, endTime: Date(),
                sampleRate: Config.sampleRate, notes: nil,
                motionSamples: result.motion,
                altitudeSamples: result.altitude,
                floorSummary: result.floors)
            do {
                try await client.postSession(session)
                status = .done
            } catch {
                try? store.save(session)
                status = .failed
            }
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            dismiss()
        }
    }

    private func timeString(_ s: Int) -> String {
        String(format: "%02d:%02d", s / 60, s % 60)
    }
}
```

- [ ] **Step 3: Build to verify it compiles**

⌘B. Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "ChoresLog Watch App/Views/CountdownView.swift" \
        "ChoresLog Watch App/Views/RecordingView.swift"
git commit -m "feat: add countdown and recording views with hold-to-stop upload"
```

---

## Task 12: App entry + retry-on-launch + on-device verification

**Files:**
- Modify: `ChoresLogApp.swift` (Xcode-generated entry point)

- [ ] **Step 1: Replace the generated app entry**

```swift
import SwiftUI

@main
struct ChoresLogApp: App {
    @StateObject private var identity = UserIdentity()
    @StateObject private var choreStore = ChoreStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if identity.name == nil {
                    NamePickerView()
                } else {
                    HomeView()
                }
            }
            .environmentObject(identity)
            .environmentObject(choreStore)
            .task { await retryPending() }
        }
    }

    private func retryPending() async {
        let store = SessionStore()
        let client = SupabaseClient()
        for pending in store.loadPending() {
            do {
                try await client.postSession(pending.session)
                store.remove(pending.id)
            } catch { /* keep on disk, retry next launch */ }
        }
    }
}
```

- [ ] **Step 2: Run the full unit test suite**

⌘U. Expected: all tests from Tasks 3, 4, 5, 7, 8 PASS.

- [ ] **Step 3: On-device verification (real Apple Watch — sensors don't work in simulator)**

  1. Select your Watch as the run destination, Run (⌘R).
  2. First launch shows the name picker → tap a name → lands on Home.
  3. Home shows the 10 preset chore tiles + an "Add" tile.
  4. Tap "Add", dictate a name (e.g. "Test Chore"), tap Add → it appears as a new tile, and appears in Supabase Table Editor → `chores`.
  5. Tap a chore → 3-2-1 countdown → recording timer counts up.
  6. Hold "Hold to stop" for 1 second → "Uploading…" → "Saved".
  7. In Supabase Table Editor → `sessions`: a new row exists with non-empty `motion_samples`, correct `chore_label`, your character name as `user_id`, and `sample_count` > 0.
  8. Relaunch the app — it goes straight to Home (name is locked, no picker).

- [ ] **Step 4: Offline retry verification**

  1. Put the Watch in Airplane Mode.
  2. Record a short session and hold to stop → expect "Saved locally — will retry".
  3. Turn Airplane Mode off, force-quit and relaunch the app.
  4. Confirm a new row appears in Supabase `sessions` (the retry flushed on launch).

- [ ] **Step 5: Commit**

```bash
git add "ChoresLog Watch App/ChoresLogApp.swift"
git commit -m "feat: wire app entry, name-gate routing, and retry-on-launch"
```

---

## Self-Review Notes

- **Spec coverage:** name picker (T5,T10), locked name (T5,T12), shared chore list + add (T1,T8,T10), 50 Hz motion + altimeter + floors (T9), tap-and-hold stop (T11), direct POST (T6,T11), disk retry on failure + on-launch flush (T7,T12), sessions/chores tables + indexes (T1), optional notes field (model supports it; UI entry deferred — see note below).
- **Notes field:** the `Session` model and DB column support `notes`, but the recording UI currently posts `notes: nil`. A one-line dictation entry on the stop screen can be added later; flagged here so it isn't mistaken for missing. Confirm with user whether to include in v1.
- **Module name:** tests use `@testable import ChoresLog_Watch_App` — adjust to the actual generated module name if Xcode differs.
