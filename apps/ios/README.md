# Hutchinson drain prototype

Use one LiDAR iPhone to capture the basement and trace one exposed drain. This is a private field prototype. The app saves one survey locally and estimates the materials for a separately drawn proposed route. Quantities use 3D length and Renovagent's existing pack pricing functions. Pipe sticks round up per segment. Offcuts, couplings, fit, and installation remain outside the calculation. Enter the fittings, supports, and consumables you want to price explicitly.

## Build and run

1. Install [Xcode](https://developer.apple.com/xcode/resources/) with iOS platform support. In Xcode, sign in with your Apple Account. A Personal Team is enough to run this app on your own phone.
2. From the repo root, use the existing Node dependencies and run `sh apps/ios/build-resources.sh`. Rerun this when the takeoff source changes.
3. Open `apps/ios/RenovagentPrototype.xcodeproj`. Under Signing & Capabilities select your team for the RenovagentPrototype target. Connect and trust your LiDAR iPhone, enable Developer Mode if prompted, choose that device as the run destination, and press Run.
4. For SAM, run the following on the Mac from the repo root. Use a private LAN shared by your Mac and iPhone. Use the Mac's actual LAN address as the bind address below, then enter its `.local` hostname and the printed session token on the phone. Alternatively place a trusted HTTPS proxy in front of the default loopback bridge.

   ```sh
   RENOVAGENT_IOS_HOST=<mac-lan-ip> node --import tsx scripts/ios-drain-bridge.ts
   ```

   Enter `http://<mac-hostname>.local:8765` in the app, using the local hostname shown in macOS Sharing settings. Allow Local Network access. LAN HTTP is unencrypted. The bridge uses the repo's existing SAM provider configuration (project environment or configured relay), processes one request at a time, and accepts at most 20 SAM attempts per process. An assisted tap sends one selected JPEG through the Mac to the provider. Mac bridge credentials stay on the Mac. The phone keeps the accepted frame and run ID with the survey.

## First field run

Use **Identify** to pick a close-up from Photos and read visible pipe markings with Apple Vision on the phone. Review the extracted text beside the photo and select a type, or leave it Unknown. Switch to **Trace** for scan and route editing, then **Estimate** for quantities and supplier prices. Trace settings are behind the gear icon.

1. Start a scan and sweep the room to gather the ARKit mesh. Keep the same session open for both routes so their points share one coordinate frame.
2. Turn on SAM assistance. Aim at a **straight, exposed** section of the drain and tap it. Check the yellow segment from a second angle before accepting. A weak depth reading or wrong outline is a cue to turn off assistance and tap the visible points manually. Use manual taps to add bends and tag the last visible point. End the existing trace where the pipe disappears.
3. Switch to **Proposed** and tap at least two points on surfaces with valid depth. Tap any visible bends as additional points. This prototype uses surface depth for point placement. A run floating away from a scanned surface requires a later editing tool.
4. Finish and save. Enter pipe stock length and pack prices from a dated supplier quote or cart. Add known fitting quantities and other supplies explicitly. Save estimate inputs, relaunch, and check that the plan, evidence and estimate are still present.
5. Compare the traced endpoints against tape measurements from fixed landmarks and compare the quantities and priced subtotal against a supplier basket for the same proposal. The output is a materials estimate with unpriced lines visible, with labor, tax, and delivery excluded.

The implementation uses ARKit mesh samples as a reference plan and keeps scan points, confirmed tags and proposed route points in the same coordinate frame. It does not import a RoomPlan model, reconstruct a route from ordinary video, or connect to the hosted workspace. The date and supplier are entered manually, and a SAM suggestion requires user acceptance. None of the fields issue a construction approval.

## What to run on the phone

Keep Vision OCR, LiDAR and route editing, the evidence overlay, and materials arithmetic local. A small Core ML classifier on a user-selected crop is the next experiment for visual suggestions such as exposed pipe, cleanout, valve, elbow, tee, or unclear. Start with classification because the user already selects the object. Try a detector when finding objects without a tap becomes necessary. Evaluate across homes and hold out all views from the same home together. Include lookalikes, low light, painted parts, obstructions, and several pipe materials. Compare correction time and false suggestions against the manual picker, then measure latency and memory on the target iPhone. User-confirmed identification and written markings are separate from model guesses about material, diameter, and SKU.

Use the existing SAM bridge only when the user enables assisted tracing. Send one selected frame per attempt. Judge whether that call saves taps and yields usable depth points. Measure spend per accepted trace, including failed attempts. No plumbing classifier is bundled in this build.
