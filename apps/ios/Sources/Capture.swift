import ARKit
import CoreImage
import SceneKit
import SwiftUI
import simd

struct SitePoint: Codable, Equatable {
    let x: Float
    let y: Float
    let z: Float

    init(_ position: SIMD3<Float>) {
        (x, y, z) = (position.x, position.y, position.z)
    }

    var vector: SIMD3<Float> { SIMD3(x, y, z) }
}

struct Survey: Codable {
    var observed: [SitePoint] = []
    var proposed: [SitePoint] = []
    var room: [SitePoint] = []
    var evidence: [TraceEvidence] = []
    var tags: [SiteTag] = []
    var pipe = PartEntry(name: "Drain pipe")
    var parts: [PartEntry] = []
    var identification: PipeIdentification?
}

struct SiteTag: Codable, Identifiable {
    var id = UUID()
    let point: SitePoint
    let name: String
}

struct TraceEvidence: Codable {
    let runId: String
    let frame: Data
    let points: [SitePoint]
    var mask: [CGPoint]?
}

private struct DepthFrame {
    let jpeg: Data
    let points: [SitePoint?]
    let width: Int
    let height: Int

    init?(frame: ARFrame, encodeImage: Bool) {
        guard case .normal = frame.camera.trackingState, let depth = frame.sceneDepth,
              let confidence = depth.confidenceMap else { return nil }
        let map = depth.depthMap
        let columns = CVPixelBufferGetWidth(map)
        let rows = CVPixelBufferGetHeight(map)
        CVPixelBufferLockBaseAddress(map, .readOnly)
        CVPixelBufferLockBaseAddress(confidence, .readOnly)
        defer {
            CVPixelBufferUnlockBaseAddress(map, .readOnly)
            CVPixelBufferUnlockBaseAddress(confidence, .readOnly)
        }
        guard let depths = CVPixelBufferGetBaseAddress(map),
              let confidenceValues = CVPixelBufferGetBaseAddress(confidence) else { return nil }
        let resolution = frame.camera.imageResolution
        let camera = frame.camera.intrinsics
        let scaleX = Float(resolution.width) / Float(columns)
        let scaleY = Float(resolution.height) / Float(rows)
        var samples: [SitePoint?] = []
        samples.reserveCapacity(columns * rows)
        for row in 0..<rows {
            let distance = depths.advanced(by: row * CVPixelBufferGetBytesPerRow(map))
                .assumingMemoryBound(to: Float32.self)
            let certainty = confidenceValues.advanced(by: row * CVPixelBufferGetBytesPerRow(confidence))
                .assumingMemoryBound(to: UInt8.self)
            for column in 0..<columns {
                let d = distance[column]
                guard certainty[column] >= 2, d.isFinite, d > 0, d < 8 else {
                    samples.append(nil)
                    continue
                }
                let px = (Float(column) + 0.5) * scaleX
                let py = (Float(row) + 0.5) * scaleY
                let cameraPoint = SIMD4((px - camera[2].x) * d / camera[0].x,
                                        -(py - camera[2].y) * d / camera[1].y, -d, 1)
                let world = frame.camera.transform * cameraPoint
                samples.append(SitePoint(SIMD3(world.x, world.y, world.z)))
            }
        }
        if encodeImage {
            let source = CIImage(cvPixelBuffer: frame.capturedImage)
            let scale = min(1, 1000 / source.extent.width)
            let image = source.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
            guard let data = CIContext().jpegRepresentation(
                of: image, colorSpace: CGColorSpaceCreateDeviceRGB(), options: [:]
            ) else { return nil }
            jpeg = data
        } else {
            jpeg = Data()
        }
        points = samples
        width = columns
        height = rows
    }

    func point(_ uv: CGPoint) -> SitePoint? {
        guard uv.x >= 0, uv.x < 1, uv.y >= 0, uv.y < 1 else { return nil }
        return points[Int(uv.y * CGFloat(height)) * width + Int(uv.x * CGFloat(width))]
    }
}

private struct MaskResponse: Decodable {
    let width: Int
    let height: Int
    let masks: [[[Double]]]
    let runId: String
}

@MainActor
final class Capture: NSObject, ObservableObject, ARSessionDelegate {
    enum Mode: String, CaseIterable {
        case observed = "Existing", proposed = "Proposed"
    }

    @Published var mode = Mode.observed
    @Published var survey = Survey()
    @Published var status = "Start a new scan or open the saved survey."
    @Published var active = false
    @Published var working = false
    @Published var suggestion: TraceEvidence?
    @Published var assist = false
    var bridgeURL = ""
    var bridgeToken = ""
    private var generation = UUID()
    private let overlay = SCNNode()
    let view = ARSCNView(frame: .zero, options: nil)

    private var file: URL {
        URL.applicationSupportDirectory.appending(path: "drain-survey.json")
    }

    override init() {
        super.init()
        view.scene.rootNode.addChildNode(overlay)
        view.session.delegateQueue = .main
        view.session.delegate = self
        view.automaticallyUpdatesLighting = true
        view.debugOptions = [.showFeaturePoints]
        view.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapped(_:))))
        if FileManager.default.fileExists(atPath: file.path) {
            do {
                survey = try JSONDecoder().decode(Survey.self, from: Data(contentsOf: file))
                status = "Saved survey loaded."
            } catch {
                status = "The saved survey could not be opened."
            }
        }
    }

    var supported: Bool {
        ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) &&
        ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
    }

    func start() {
        guard supported else { status = "Basement scanning requires an iPhone with LiDAR."; return }
        let config = ARWorldTrackingConfiguration()
        config.frameSemantics = .sceneDepth
        config.sceneReconstruction = .mesh
        generation = UUID()
        survey = Survey()
        suggestion = nil
        mode = .observed
        render()
        active = true
        view.session.run(config, options: [.resetTracking, .removeExistingAnchors, .resetSceneReconstruction])
        status = "Sweep the room slowly, then tap a visible point on the drain."
    }

    func finish() {
        guard active else { return }
        if let frame = view.session.currentFrame {
            survey.room = roomSamples(frame)
        }
        view.session.pause()
        active = false
        generation = UUID()
        suggestion = nil
        save()
    }

    func save() {
        do {
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(),
                                                    withIntermediateDirectories: true)
            try JSONEncoder().encode(survey).write(to: file, options: [.atomic, .completeFileProtection])
            status = "Survey saved on this iPhone."
        } catch {
            status = "Survey could not be saved. Keep the app open and retry."
        }
    }

    func tag(_ name: String) {
        guard let point = survey.observed.last, !name.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        survey.tags.append(SiteTag(point: point, name: String(name.prefix(120))))
    }

    func undo() {
        if mode == .observed {
            let removed = survey.observed.popLast()
            survey.tags.removeAll { $0.point == removed }
        } else {
            _ = survey.proposed.popLast()
        }
        suggestion = nil
        render()
    }

    func acceptSuggestion() {
        guard active, let suggestion else { return }
        survey.observed = suggestion.points
        survey.evidence.append(suggestion)
        self.suggestion = nil
        render()
        status = "Suggested segment added. Tap to extend the visible route."
    }

    func dismissSuggestion() {
        suggestion = nil
        render()
    }

    @objc private func tapped(_ recognizer: UITapGestureRecognizer) {
        guard active, !working, suggestion == nil, let frame = view.session.currentFrame,
              let orientation = view.window?.windowScene?.interfaceOrientation,
              view.bounds.width > 0, view.bounds.height > 0 else { return }
        let tap = recognizer.location(in: view)
        let uv = CGPoint(x: tap.x / view.bounds.width, y: tap.y / view.bounds.height)
            .applying(frame.displayTransform(for: orientation, viewportSize: view.bounds.size).inverted())
        let useSAM = assist && mode == .observed && survey.observed.isEmpty
        guard let snapshot = DepthFrame(frame: frame, encodeImage: useSAM),
              let point = snapshot.point(uv) else {
            status = "Depth is uncertain here. Move closer or try another angle."
            return
        }
        if useSAM {
            Task { await trace(snapshot, near: uv, anchor: point) }
            return
        }
        if mode == .observed {
            guard survey.observed.count < 100 else { return }
            survey.observed.append(point)
        } else {
            guard survey.proposed.count < 100 else { return }
            survey.proposed.append(point)
        }
        render()
    }

    private func trace(_ snapshot: DepthFrame, near tap: CGPoint, anchor: SitePoint) async {
        let address = bridgeURL.trimmingCharacters(in: .whitespacesAndNewlines)
        let token = bridgeToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let base = URL(string: address), let host = base.host, !host.isEmpty,
              ["http", "https"].contains(base.scheme ?? ""), !token.isEmpty else {
            status = "Enter the Mac bridge address and token."
            return
        }
        let id = generation
        working = true
        defer { working = false }
        status = "Sending one camera frame to SAM…"
        do {
            var request = URLRequest(url: base.appending(path: "trace"), timeoutInterval: 75)
            request.httpMethod = "POST"
            request.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.httpBody = snapshot.jpeg
            let (data, response) = try await URLSession.shared.data(for: request)
            guard generation == id, active else { return }
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                struct BridgeError: Decodable { let error: String }
                status = (try? JSONDecoder().decode(BridgeError.self, from: data).error) ?? "Trace unavailable."
                return
            }
            let result = try JSONDecoder().decode(MaskResponse.self, from: data)
            guard result.width > 0, result.height > 0 else {
                status = "SAM returned no pipe outline."
                return
            }
            let masks = result.masks.map { mask in
                mask.filter { $0.count == 2 }.map {
                    CGPoint(x: $0[0] / Double(result.width), y: $0[1] / Double(result.height))
                }
            }.filter { !$0.isEmpty }
            func distance(_ p: CGPoint) -> Double { hypot(p.x - tap.x, p.y - tap.y) }
            guard let nearest = masks.min(by: {
                $0.map(distance).min()! < $1.map(distance).min()!
            }), let gap = nearest.map(distance).min(), gap < 0.025 else {
                status = "No SAM outline near your tap. Try a closer view or trace manually."
                return
            }
            let samples = nearest.compactMap { snapshot.point($0)?.vector }.filter {
                simd_distance($0, anchor.vector) < 1.5
            }
            guard samples.count >= 8, let start = samples.max(by: {
                simd_distance($0, anchor.vector) < simd_distance($1, anchor.vector)
            }), let end = samples.max(by: { simd_distance($0, start) < simd_distance($1, start) }),
                  simd_distance(start, end) > 0.08 else {
                status = "SAM found a pipe, but depth was insufficient. Trace it manually."
                return
            }
            suggestion = TraceEvidence(runId: result.runId, frame: snapshot.jpeg,
                                       points: [SitePoint(start), SitePoint(end)], mask: nearest)
            render()
            status = "Check the highlighted straight segment before adding it."
        } catch {
            if generation == id { status = "Trace failed. Check the bridge or trace manually." }
        }
    }

    private func roomSamples(_ frame: ARFrame) -> [SitePoint] {
        let meshes = frame.anchors.compactMap { $0 as? ARMeshAnchor }
        let total = meshes.reduce(0) { $0 + $1.geometry.vertices.count }
        let stride = max(1, (total + 3499) / 3500)
        var samples: [SitePoint] = []
        for mesh in meshes {
            let vertices = mesh.geometry.vertices
            for index in Swift.stride(from: 0, to: vertices.count, by: stride) {
                let address = vertices.buffer.contents().advanced(by: vertices.offset + index * vertices.stride)
                let p = address.assumingMemoryBound(to: Float.self)
                let world = mesh.transform * SIMD4(p[0], p[1], p[2], 1)
                samples.append(SitePoint(SIMD3(world.x, world.y, world.z)))
            }
        }
        return samples
    }

    private func render() {
        overlay.childNodes.forEach { $0.removeFromParentNode() }
        draw(survey.observed, color: .systemBlue)
        draw(survey.proposed, color: .systemRed)
        if let suggestion { draw(suggestion.points, color: .systemYellow) }
    }

    private func draw(_ points: [SitePoint], color: UIColor) {
        for (index, point) in points.enumerated() {
            let marker = SCNSphere(radius: 0.025)
            marker.firstMaterial?.diffuse.contents = color
            let node = SCNNode(geometry: marker)
            node.simdPosition = point.vector
            overlay.addChildNode(node)
            guard index > 0 else { continue }
            let start = points[index - 1].vector
            let direction = point.vector - start
            let length = simd_length(direction)
            guard length > 0.0001 else { continue }
            let tube = SCNCylinder(radius: 0.013, height: CGFloat(length))
            tube.firstMaterial?.diffuse.contents = color
            let segment = SCNNode(geometry: tube)
            segment.simdPosition = (point.vector + start) / 2
            segment.simdOrientation = simd_quatf(from: SIMD3(0, 1, 0), to: direction / length)
            overlay.addChildNode(segment)
        }
    }

    nonisolated func sessionWasInterrupted(_ session: ARSession) {
        Task { @MainActor in self.finish() }
    }

    nonisolated func session(_ session: ARSession, didFailWithError error: Error) {
        Task { @MainActor in
            self.finish()
            self.status = "AR capture stopped. Check camera permission and try again."
        }
    }
}

struct CameraView: UIViewRepresentable {
    let capture: Capture
    func makeUIView(context: Context) -> ARSCNView { capture.view }
    func updateUIView(_ uiView: ARSCNView, context: Context) {}
}
