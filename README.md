# Before You Install

A Chrome extension that helps people investigate another Chrome Web Store extension before installing it. It shows requested permissions, a short isolated browser test, relevant outside sources, and an AI explanation with links and limitations.

The report now gives a plain **Should I use it?** assessment. It says **Cannot tell yet** when installation fails, **Pause before installing** when the extension requests sensitive permissions or access to many sites, and **No clear warning signs in this check; use with caution** otherwise. This assessment is computed from the evidence already collected, so it does not make another sponsor API or model call. It is a limited screening result, not a security guarantee.

Built for Tokyo Agent Forge, 14 November 2026.

Recorded public demo: https://before-you-install-demo.caesarlang505.chatgpt.site

## Demo

1. Open a Chrome Web Store listing and click **Before You Install**.
2. Click **Check extension**. A local service starts the check and saves its progress.
3. Daytona starts a disposable Chrome browser. Tavily searches for sources mentioning the extension. Two CodeAF sessions independently explain the browser evidence and review the sources.
4. The popup and full report show what happened and what was not tested.

In a real Google Translate test, the full report took about 63 seconds. Daytona could not connect directly to the Store, so the app downloaded the official Store package, verified its extension ID from its public key, and loaded it unpacked in Chrome inside Daytona. The browser used a synthetic page. This differs from normal Store installation and does not verify the package's cryptographic signature independently. See the report limitations before interpreting a result.

For that recorded test, the assessment says **Pause before installing. Review the access it asks for.** Its content script matches all URLs. That is broad access, not evidence that Google Translate misused it. The test ran for 20 seconds on a synthetic page, so the assessment is a prompt to review the scope rather than a malware verdict.

**This is an investigation aid, not proof of safety.** The short test does not cover every website, logins, delayed behavior, future updates, or all background network traffic. A Chrome warning about the unpacked source is not itself a malware finding.

## Run locally

Requirements: Node.js 20 or newer, Google Chrome, a Daytona account with a default region and credits, a Tavily API key, and CodeAF v0.8.2 with a connected supported model. Sandbox tests consume Daytona and Tavily credits. CodeAF model use is subject to the account's limits or provider charges.

```sh
npm --prefix server install
mkdir -p server/bin
```

Install the [official CodeAF v0.8.2 release](https://github.com/Agent-Field/CodeAF/releases/tag/v0.8.2) for your operating system as `server/bin/codeaf`. Verify it against the release checksums and make it executable. This project pins v0.8.2 because its tool-denial policy was reviewed for that version. See [CodeAF setup](server/CODEAF_SETUP.md).

For the Codex provider, connect a separate local project profile:

```sh
CODEAF_HOME="$PWD/server/.codeaf-state" CODEAF_PROFILE_DIR="$PWD/server/.codeaf-state" server/bin/codeaf connect codex
CODEAF_MODEL=codex/gpt-5.6-luna npm --prefix server start
```

Select a model your connected account supports if that model is unavailable. Open `http://127.0.0.1:8787`, enter the Daytona and Tavily API keys in **Sponsor setup**, and save them locally. Never commit `.env` or `.codeaf-state`. Daytona's default region must be set in its dashboard; the app targets `us` unless `DAYTONA_TARGET` is set.

In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `chrome-extension-checker/`. Then open a Store listing and click the extension icon. Keep the local server running while checking.

## How it works

- `chrome-extension-checker/`: Chrome Manifest V3 popup and job polling.
- `server/server.mjs`: loopback-only API, setup page, and report storage. Keys are kept on the user's machine.
- `server/scanner.mjs` and `server/sandbox-probe.py`: Daytona sandbox creation, Store package handling, isolated Chrome and browser observations.
- `server/codeaf.mjs`: bounded CodeAF calls with tool use denied, output validation, and source-link checks.
- `server/report.mjs`: permissions, source filtering, and limitations.

Tests: `npm --prefix server test`.

## Limits

The demo can fall back to loading the Store package unpacked when Daytona cannot reach the Web Store. Public-key-derived ID matching is not cryptographic signature verification. Browser-session domain observations are not proof that the extension sent a request, and background-worker requests may be missed. External pages can contain claims about an extension; inclusion is not independent verification. Keys and analysis remain on the machine running the local server; the Chrome extension itself is not hosted on the Chrome Web Store.
