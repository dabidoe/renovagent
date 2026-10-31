// Extract text from PDFs with macOS PDFKit (no extra installs): writes
// <file>.txt next to each <file>.pdf given on the command line.
//
//   swift scripts/pdf-to-text.swift a.pdf b.pdf
import Foundation
import PDFKit

for path in CommandLine.arguments.dropFirst() {
    guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else {
        FileHandle.standardError.write("cannot open \(path)\n".data(using: .utf8)!)
        continue
    }
    var text = ""
    for i in 0..<doc.pageCount {
        if let page = doc.page(at: i), let s = page.string { text += s + "\n" }
    }
    let out = path.replacingOccurrences(of: ".pdf", with: ".txt")
    try text.write(toFile: out, atomically: true, encoding: .utf8)
    print("\(out) \(doc.pageCount) pages \(text.count) chars")
}
