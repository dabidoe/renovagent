import ImageIO
import JavaScriptCore
import PhotosUI
import Vision
import SwiftUI

@main
struct RenovagentApp: App {
    var body: some Scene {
        WindowGroup { DrainSurveyView() }
    }
}

struct PartEntry: Identifiable, Codable {
    var id = UUID()
    var name = ""
    var quantity = ""
    var pack = ""
    var price = ""
    var source = ""

    func priceMinor() throws -> Any {
        let value = price.trimmingCharacters(in: .whitespaces)
        if value.isEmpty { return NSNull() }
        guard let amount = Decimal(string: value, locale: Locale(identifier: "en_US_POSIX")),
              value.range(of: #"^\d+(\.\d{1,2})?$"#, options: .regularExpression) != nil,
              amount <= 100_000 else {
            throw TakeoffError("Enter the pack price in USD with up to two decimal places.")
        }
        return NSDecimalNumber(decimal: amount * 100).intValue
    }
}

private struct TakeoffError: LocalizedError {
    let errorDescription: String?
    init(_ message: String) { errorDescription = message }
}

private struct Takeoff: Decodable {
    struct Line: Decodable {
        let name: String
        let packs: Int
        let source: String
        let totalMinor: Int?
    }

    let feet: Double
    let lines: [Line]
    let subtotalMinor: Int

    static func calculate(proposed: [SitePoint], pipe: PartEntry, parts: [PartEntry]) throws -> Self {
        guard let script = Bundle.main.url(forResource: "takeoff", withExtension: "js"),
              let context = JSContext() else { throw TakeoffError("The takeoff engine is missing.") }
        context.evaluateScript(try String(contentsOf: script, encoding: .utf8))
        let points = proposed.map { ["x": $0.x, "y": $0.y, "z": $0.z] }
        let input: [String: Any] = [
            "proposed": points,
            "pipe": ["name": pipe.name, "stockFeet": Double(pipe.pack) ?? 0,
                     "priceMinor": try pipe.priceMinor(), "source": pipe.source],
            "parts": try parts.map { part -> [String: Any] in
                ["name": part.name, "quantity": Int(part.quantity) ?? 0, "packQuantity": Int(part.pack) ?? 0,
                 "priceMinor": try part.priceMinor(), "source": part.source]
            }
        ]
        let encoded = try JSONSerialization.data(withJSONObject: input)
        guard let json = String(data: encoded, encoding: .utf8),
              let response = context.objectForKeyedSubscript("drainTakeoff")?
                .call(withArguments: [json])?.toString()?.data(using: .utf8) else {
            throw TakeoffError("The takeoff engine could not calculate quantities.")
        }
        struct Failure: Decodable { let error: String }
        if let failure = try? JSONDecoder().decode(Failure.self, from: response) {
            throw TakeoffError(failure.error)
        }
        return try JSONDecoder().decode(Self.self, from: response)
    }
}

struct PipeIdentification: Codable {
    var kind = "Unknown"
    var markings = ""
    var photo: Data?
}

struct DrainSurveyView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var capture = Capture()
    @State private var tag = ""
    @AppStorage("bridgeURL") private var bridgeURL = ""
    @AppStorage("bridgeToken") private var bridgeToken = ""
    @State private var replace = false
    @State private var page = Page.identify
    @State private var showSettings = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var reading = false
    @State private var readStatus = ""

    private enum Page: String, CaseIterable {
        case identify = "Identify"
        case trace = "Trace"
        case estimate = "Estimate"
    }

    private var accent: Color { Color(red: 0.03, green: 0.42, blue: 0.35) }

    private var identification: Binding<PipeIdentification> {
        Binding {
            capture.survey.identification ?? PipeIdentification()
        } set: {
            capture.survey.identification = $0
            if !capture.active { capture.save() }
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    projectHeader
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                    Picker("Workflow", selection: $page) {
                        ForEach(Page.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
                if page == .identify { identifySection }
                if page == .trace {
                    Section("Basement scan") {
                        if capture.active {
                            CameraView(capture: capture)
                                .frame(height: 310)
                                .accessibilityLabel("Tap the live camera view to place a route point")
                            Picker("Route", selection: $capture.mode) {
                                ForEach(Capture.Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                            }
                            .pickerStyle(.segmented)
                            .disabled(capture.suggestion != nil || capture.working)
                            if capture.suggestion != nil {
                                Button("Accept suggested segment") { capture.acceptSuggestion() }
                                Button("Discard suggestion") { capture.dismissSuggestion() }
                            } else {
                                Button("Undo last point") { capture.undo() }.disabled(capture.working)
                            }
                            Button("Finish and save survey") { capture.finish() }
                        } else {
                            Button {
                                if capture.survey.room.isEmpty && capture.survey.observed.isEmpty
                                    && capture.survey.proposed.isEmpty {
                                    startScan()
                                } else {
                                    replace = true
                                }
                            } label: {
                                Label("Start basement scan", systemImage: "viewfinder")
                            }
                            .disabled(!capture.supported || capture.working || reading)
                            if !capture.supported { Text("Live capture requires a LiDAR iPhone.") }
                        }
                        Text(capture.status).font(.footnote)
                        if capture.active {
                            Text(capture.mode == .observed
                                 ? "Tap along the visible pipe. End the trace where it disappears."
                                 : "Tap the start, bends, and end of the proposed route.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        if !capture.survey.observed.isEmpty {
                            TextField("Label for last existing point", text: $tag)
                            Button("Tag point") {
                                capture.tag(tag)
                                if !capture.active { capture.save() }
                                tag = ""
                            }.disabled(tag.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                        ForEach(capture.survey.tags) { tag in
                            Label(tag.name, systemImage: "mappin")
                        }
                        if !capture.survey.room.isEmpty || !capture.survey.observed.isEmpty
                            || !capture.survey.proposed.isEmpty {
                            SurveyPlan(survey: capture.survey).frame(height: 220)
                            Text("Blue: visible route. Red: proposed route. Gray: scan samples.")
                                .font(.caption)
                        }
                        if let evidence = capture.suggestion ?? capture.survey.evidence.last,
                           let photo = UIImage(data: evidence.frame) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Trace evidence").font(.headline)
                                evidenceImage(photo, mask: evidence.mask ?? [])
                                if evidence.mask != nil {
                                    Text("The dots show the area SAM selected. Check it against the highlighted route in the camera.")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
                if page == .estimate && capture.survey.proposed.count < 2 {
                    Section("Materials estimate") {
                        ContentUnavailableView("Draw a proposed route", systemImage: "point.topleft.down.to.point.bottomright.curvepath",
                                               description: Text("Add at least two points to measure a run and price the materials."))
                        Button("Go to trace") { page = .trace }
                    }
                }
                if page == .estimate && capture.survey.proposed.count >= 2 {
                    Section("Materials estimate") {
                        estimate
                    }
                    Section("Parts and supplier prices") {
                        partFields($capture.survey.pipe, isPipe: true)
                        ForEach($capture.survey.parts) { $part in
                            partFields($part, isPipe: false)
                        }
                        .onDelete { capture.survey.parts.remove(atOffsets: $0) }
                        Button("Add fitting or supply") { capture.survey.parts.append(PartEntry()) }
                            .disabled(capture.survey.parts.count >= 50)
                        if !capture.active { Button("Save estimate inputs") { capture.save() } }
                    }
                }
            }
            .tint(accent)
            .navigationTitle("Plumbing")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Button("Trace settings", systemImage: "gearshape") { showSettings = true }
            }
            .sheet(isPresented: $showSettings) {
                NavigationStack {
                    Form { assistSettings }
                        .navigationTitle("Trace settings")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar { Button("Done") { showSettings = false } }
                }.tint(accent)
            }
            .onChange(of: selectedPhoto) { _, item in
                guard let item else { return }
                Task { await readMarkings(from: item) }
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .background { capture.finish() }
            }
            .confirmationDialog("Start a new survey?", isPresented: $replace) {
                Button("Replace current survey", role: .destructive) { startScan() }
            } message: {
                Text("Finishing the new scan will replace the saved survey on this iPhone.")
            }
            .onAppear {
                capture.bridgeURL = bridgeURL
                capture.bridgeToken = bridgeToken
            }
        }
    }

    private func startScan() {
        let identification = capture.survey.room.isEmpty && capture.survey.observed.isEmpty
            && capture.survey.proposed.isEmpty ? capture.survey.identification : nil
        capture.start()
        if capture.active { capture.survey.identification = identification }
    }

    private var projectHeader: some View {
        VStack(alignment: .leading, spacing: 9) {
            Label("Hutchinson basement", systemImage: "house")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color(red: 0.61, green: 0.89, blue: 0.81))
            Text("Drain survey")
                .font(.system(.largeTitle, design: .rounded, weight: .semibold))
            Text("Record what’s exposed. Measure and price the proposed run.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.83))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .foregroundStyle(.white)
        .background(
            LinearGradient(colors: [Color(red: 0.06, green: 0.18, blue: 0.19), accent],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 22)
        )
        .accessibilityElement(children: .combine)
    }

    private var identifySection: some View {
        Section("What’s visible") {
            Picker("Your identification", selection: identification.kind) {
                ForEach(["Unknown", "Drain pipe", "Supply pipe", "Cleanout", "Valve", "Other"], id: \.self) {
                    Text($0)
                }
            }
            if let bytes = capture.survey.identification?.photo, let photo = UIImage(data: bytes) {
                evidenceImage(photo, mask: [])
                let markings = capture.survey.identification?.markings ?? ""
                Text(markings.isEmpty ? "No legible markings found." : markings)
                    .textSelection(.enabled)
                Text("Text found in the photo. Check it against the original before using it to select a part.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                Label("Read markings from a close-up", systemImage: "text.viewfinder")
            }
            .disabled(reading)
            if reading { ProgressView("Reading on this iPhone…") }
            if !readStatus.isEmpty { Text(readStatus).font(.footnote) }
            Button("Continue to trace") { page = .trace }
        }
    }

    private func readMarkings(from item: PhotosPickerItem) async {
        reading = true
        readStatus = ""
        defer { reading = false }
        do {
            guard let bytes = try await item.loadTransferable(type: Data.self),
                  let result = try await Task.detached(priority: .userInitiated, operation: {
                      try MarkingReader.read(bytes)
                  }).value else {
                readStatus = "The photo could not be opened."
                return
            }
            var current = capture.survey.identification ?? PipeIdentification()
            current.markings = result.text
            current.photo = result.image
            identification.wrappedValue = current
        } catch {
            readStatus = "Could not read the photo. Try a clearer close-up."
        }
    }

    private func evidenceImage(_ photo: UIImage, mask: [CGPoint]) -> some View {
        Image(uiImage: photo)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .overlay {
                Canvas { context, size in
                    for point in mask {
                        let rect = CGRect(x: point.x * size.width - 1.4,
                                          y: point.y * size.height - 1.4, width: 2.8, height: 2.8)
                        context.fill(Path(ellipseIn: rect), with: .color(.yellow.opacity(0.7)))
                    }
                }.allowsHitTesting(false)
            }
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .accessibilityLabel(mask.isEmpty ? "Close-up evidence" : "SAM evidence with selected pixels highlighted")
    }

    private var assistSettings: some View {
        Section("SAM assistance") {
            Toggle("Suggest the first existing segment", isOn: $capture.assist)
            if capture.assist {
                TextField("Mac bridge URL", text: $bridgeURL)
                    .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    .onChange(of: bridgeURL) { _, value in capture.bridgeURL = value }
                SecureField("Bridge token", text: $bridgeToken)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .onChange(of: bridgeToken) { _, value in capture.bridgeToken = value }
                Text("With this on, tapping the first existing point sends one camera frame to SAM.")
                    .font(.caption)
            }
        }
    }

    private func partFields(_ part: Binding<PartEntry>, isPipe: Bool) -> some View {
        VStack(alignment: .leading) {
            TextField(isPipe ? "Pipe spec or SKU" : "Part name or SKU", text: part.name)
            if !isPipe {
                TextField("Quantity needed", text: part.quantity).keyboardType(.numberPad)
            }
            TextField(isPipe ? "Feet per stick" : "Count per pack", text: part.pack)
                .keyboardType(isPipe ? .decimalPad : .numberPad)
            TextField("Price per pack (USD)", text: part.price).keyboardType(.decimalPad)
            TextField("Supplier and date or quote reference", text: part.source)
        }
    }

    @ViewBuilder private var estimate: some View {
        if capture.survey.pipe.pack.isEmpty {
            Text("Enter the pipe spec and stock length. Add fittings, supports, and supplies from your proposed route.")
        } else {
            switch Result(catching: {
                try Takeoff.calculate(proposed: capture.survey.proposed, pipe: capture.survey.pipe, parts: capture.survey.parts)
            }) {
            case .success(let estimate):
                Text("\(estimate.feet.formatted(.number.precision(.fractionLength(1)))) ft drawn")
                ForEach(Array(estimate.lines.enumerated()), id: \.offset) { _, line in
                    LabeledContent("\(line.name) × \(line.packs)") {
                        Text(line.totalMinor.map(money) ?? "Unpriced")
                    }
                    if !line.source.isEmpty { Text(line.source).font(.caption) }
                }
                if estimate.lines.contains(where: { $0.totalMinor == nil }) {
                    Text("Unpriced lines are excluded from the subtotal. Enter a pack price and source to price a line.")
                        .font(.caption)
                }
                LabeledContent("Priced materials subtotal", value: money(estimate.subtotalMinor))
                Text("Draft only. Stock rounded per segment without offcut reuse. Confirm fittings and tie-in on site. Labor, tax, and delivery excluded.")
                    .font(.caption)
            case .failure(let error):
                Text(error.localizedDescription).font(.footnote)
            }
        }
    }

    private func money(_ cents: Int) -> String {
        (Double(cents) / 100).formatted(.currency(code: "USD"))
    }
}

private enum MarkingReader {
    static func read(_ bytes: Data) throws -> (text: String, image: Data)? {
        guard let source = CGImageSourceCreateWithData(bytes as CFData, nil),
              let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                  kCGImageSourceCreateThumbnailFromImageAlways: true,
                  kCGImageSourceCreateThumbnailWithTransform: true,
                  kCGImageSourceThumbnailMaxPixelSize: 1800
              ] as CFDictionary),
              let image = UIImage(cgImage: thumbnail).jpegData(compressionQuality: 0.82) else { return nil }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        try VNImageRequestHandler(cgImage: thumbnail).perform([request])
        let text = (request.results ?? [])
            .compactMap { $0.topCandidates(1).first?.string }
            .joined(separator: "\n")
        return (text, image)
    }
}

private struct SurveyPlan: View {
    let survey: Survey

    var body: some View {
        Canvas { context, size in
            let points = survey.room + survey.observed + survey.proposed
            guard let minX = points.map(\.x).min(), let maxX = points.map(\.x).max(),
                  let minZ = points.map(\.z).min(), let maxZ = points.map(\.z).max() else { return }
            let scale = min(max(1, size.width - 24) / CGFloat(max(0.1, maxX - minX)),
                            max(1, size.height - 24) / CGFloat(max(0.1, maxZ - minZ)))
            func position(_ point: SitePoint) -> CGPoint {
                CGPoint(x: 12 + CGFloat(point.x - minX) * scale,
                        y: 12 + CGFloat(point.z - minZ) * scale)
            }
            for point in survey.room {
                let at = position(point)
                context.fill(Path(ellipseIn: CGRect(x: at.x, y: at.y, width: 2, height: 2)),
                             with: .color(.gray.opacity(0.5)))
            }
            func draw(_ route: [SitePoint], color: Color) {
                guard let first = route.first else { return }
                let path = Path { path in
                    path.move(to: position(first))
                    for point in route.dropFirst() { path.addLine(to: position(point)) }
                }
                context.stroke(path, with: .color(color), lineWidth: 3)
                for point in route {
                    let at = position(point)
                    context.fill(Path(ellipseIn: CGRect(x: at.x - 3, y: at.y - 3, width: 6, height: 6)),
                                 with: .color(color))
                }
            }
            draw(survey.observed, color: .blue)
            draw(survey.proposed, color: .red)
            for tag in survey.tags {
                let at = position(tag.point)
                context.draw(Text(tag.name).font(.caption2), at: CGPoint(x: at.x + 4, y: at.y - 4),
                             anchor: .bottomLeading)
            }
        }
        .accessibilityLabel("Top-down basement scan with existing and proposed routes")
    }
}
