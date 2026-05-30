import Foundation
import Combine
import CoreMotion

@MainActor
final class SensorRecorder: ObservableObject {
    private let motion = CMMotionManager()
    private let altimeter = CMAltimeter()
    private let pedometer = CMPedometer()
    private let queue = OperationQueue()
    private let keepAlive = WorkoutKeepAlive()

    private var startDate = Date()
    private var motionSamples: [MotionSample] = []
    private var altitudeSamples: [AltitudeSample] = []

    /// Request workout permission once (call at app launch).
    func requestAuthorization() async {
        await keepAlive.requestAuthorization()
    }

    func start() {
        startDate = Date()
        motionSamples.removeAll()
        altitudeSamples.removeAll()

        // Hold a workout session so watchOS keeps delivering 50 Hz with the
        // screen off / wrist down.
        keepAlive.start()

        motion.deviceMotionUpdateInterval = 1.0 / Double(Config.sampleRate)
        if motion.isDeviceMotionAvailable {
            // Use a magnetic-north reference frame so the calibrated magnetometer
            // is populated; fall back gracefully if it isn't available.
            let available = CMMotionManager.availableAttitudeReferenceFrames()
            let frame: CMAttitudeReferenceFrame = available.contains(.xMagneticNorthZVertical)
                ? .xMagneticNorthZVertical
                : .xArbitraryZVertical
            motion.startDeviceMotionUpdates(using: frame, to: queue) { [weak self] dm, _ in
                guard let self, let dm else { return }
                let t = Int(Date().timeIntervalSince(self.startDate) * 1000)
                let att = dm.attitude
                let q = att.quaternion
                let field = dm.magneticField.field
                let acc = dm.magneticField.accuracy
                let hasMag = acc != .uncalibrated
                let sample = MotionSample(
                    t: t,
                    ax: dm.userAcceleration.x, ay: dm.userAcceleration.y, az: dm.userAcceleration.z,
                    gravx: dm.gravity.x, gravy: dm.gravity.y, gravz: dm.gravity.z,
                    gx: dm.rotationRate.x, gy: dm.rotationRate.y, gz: dm.rotationRate.z,
                    roll: att.roll, pitch: att.pitch, yaw: att.yaw,
                    qw: q.w, qx: q.x, qy: q.y, qz: q.z,
                    mx: hasMag ? field.x : nil,
                    my: hasMag ? field.y : nil,
                    mz: hasMag ? field.z : nil,
                    magacc: Int(acc.rawValue),
                    heading: dm.heading >= 0 ? dm.heading : nil)
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
