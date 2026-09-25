// Native macOS WebKit test host. Uses public WKWebView APIs and synthetic Muxy
// data; it never inspects or signals the user's services. Build outside dist/.
import AppKit
import WebKit

final class SoakHost: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    var watchdog: Timer?
    var activity: NSObjectProtocol?
    var heartbeat: Timer?
    let url: URL
    let seconds: Double

    init(url: URL, seconds: Double) { self.url = url; self.seconds = seconds }

    func emit(_ value: Any) {
        guard var record = value as? [String: Any] else { return }
        record["timestamp"] = ISO8601DateFormatter().string(from: Date())
        guard let data = try? JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]),
              let line = String(data: data, encoding: .utf8) else { return }
        print(line)
        fflush(stdout)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiatedAllowingIdleSystemSleep], reason: "Run Deck bounded memory measurement")
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.add(self, name: "soak")
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 420, height: 900), configuration: configuration)
        webView.navigationDelegate = self
        window = NSWindow(contentRect: webView.frame, styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        window.title = "Run Deck — isolated WebKit memory check"
        window.contentView = webView
        window.collectionBehavior = [.canJoinAllSpaces]
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
        emit(["type": "host", "pid": ProcessInfo.processInfo.processIdentifier,
              "url": url.absoluteString, "seconds": seconds])
        watchdog = Timer.scheduledTimer(withTimeInterval: seconds + 90, repeats: false) { [weak self] _ in
            self?.fail("Workload exceeded its deadline")
        }
        heartbeat = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.webView.evaluateJavaScript("({hidden:document.hidden, focused:document.hasFocus(), ready:document.readyState, cards:document.querySelectorAll('.service').length, refreshDisabled:document.querySelector('.refresh')?.disabled})") { result, error in
                self.emit(["type": "heartbeat", "page": result ?? [:], "windowVisible": self.window.isVisible,
                           "windowOcclusion": self.window.occlusionState.rawValue, "windowKey": self.window.isKeyWindow,
                           "appActive": NSApplication.shared.isActive, "error": error?.localizedDescription ?? ""])
            }
        }
        webView.load(URLRequest(url: url))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.callAsyncJavaScript("""
            const checks = await import('/tests/webkit-soak.mjs');
            checks.startSoak(seconds);
            return true;
            """, arguments: ["seconds": seconds], in: nil, in: .page) { [weak self] result in
            if case .failure(let error) = result { self?.fail(error.localizedDescription) }
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        fail(error.localizedDescription)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        fail("WebContent process terminated unexpectedly")
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        emit(message.body)
        guard let body = message.body as? [String: Any] else { return }
        if body["type"] as? String == "error" { exit(1) }
        if body["type"] as? String == "finished" {
            watchdog?.invalidate()
            heartbeat?.invalidate()
            if let activity { ProcessInfo.processInfo.endActivity(activity) }
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "soak")
            NSApplication.shared.terminate(nil)
        }
    }

    func fail(_ message: String) {
        emit(["type": "error", "message": message])
        exit(1)
    }
}

let config = Bundle.main.object(forInfoDictionaryKey: "RunDeckMemoryTest") as? [String: String]
if let path = config?["output"] { freopen(path, "w", stdout) }
let args = CommandLine.arguments.count == 1 && config != nil
    ? [CommandLine.arguments[0], config!["url"] ?? "", config!["seconds"] ?? ""] : CommandLine.arguments
guard args.count == 3, let url = URL(string: args[1]),
      url.host == "127.0.0.1", let seconds = Double(args[2]), seconds >= 30 else {
    fputs("Usage: RunDeckWebKitMemory http://127.0.0.1:PORT/tests/preview.html?build=1 SECONDS\n", stderr)
    exit(2)
}
let application = NSApplication.shared
let delegate = SoakHost(url: url, seconds: seconds)
application.setActivationPolicy(.regular)
application.delegate = delegate
application.run()
