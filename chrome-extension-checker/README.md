# Before You Install — Chrome extension

This is the browser interface for the Chrome Web Store checker. It accepts a Store link, including the current Store tab when Chrome exposes its URL, and sends it to a local scanner service. It never claims to have checked an extension when that service is unavailable.

## Open it in Chrome

1. Open `chrome://extensions` in Google Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `chrome-extension-checker` folder.
4. Open a Chrome Web Store extension listing and click **Before You Install** in the toolbar. If Chrome does not fill the link automatically, paste it into the popup.

Start the local scanner first: run `CODEAF_MODEL=codex/gpt-5.6-luna npm --prefix server start` from the project folder, then open `http://127.0.0.1:8787` and save the Daytona and Tavily API keys on the setup screen. The popup talks only to that local scanner. If it cannot connect, it shows an error.

## Backend contract for event day

The extension sends `POST http://127.0.0.1:8787/check` with `{ "url": "https://chromewebstore.google.com/detail/.../<id>", "extensionId": "<id>" }`.

The service responds with `{ "jobId": "..." }`. The popup polls `GET /checks/<jobId>` for progress and the eventual report. Each finding comes from a test or source. A failed installation is marked incomplete; a report does not prove an extension is safe.

The local service holds the API keys and runs the Daytona, CodeAF, and Tavily work. A sandbox test needs an active Daytona account, a configured region, and a working Chrome installation.
