> The CodeAF binary and account state are not included in this public repository. Download the official v0.8.2 release and connect your own provider as described in the main README.

# CodeAF evidence summary

`codeaf.mjs` exports `summarizeEvidence(evidence, options = {})`. It returns
`{summary, findings, limitation, provider}`. Each finding has `title`, `evidence`,
and optional `sourceUrl`. Source URLs must exactly match HTTP(S) URL fields
in the input evidence; the adapter refuses invented source URLs. `provider: "codeaf"` means the real
CodeAF CLI returned valid structured output. On missing setup, timeout, CLI
failure, or invalid output, it returns `summary: null`, empty findings and
`provider: "codeaf-unavailable"`. It never substitutes a made-up AI answer.

## Current state

The official **v0.8.2 Darwin arm64** binary is installed at `server/bin/codeaf`.
Its SHA256 matches the checksum published in the same official release:

```
e61adac060bf2345c08a3e23ae83239871c3050eadac046879f5f3176270c4f1
```

The executable reports `codeaf v0.8.2 built 2026-10-24 00:39`.
The user connected the project profile to the Codex provider. A real request
with `codex/gpt-5.6-luna` at low reasoning returned a valid summary, two
findings and an explicit limitation on 2026-11-14. This was synthetic smoke-test
evidence, not an assessment of a real extension. No credential contents were
read or copied during diagnosis.

The guide's older `codex/gpt-5.5` example is not available on this account. It
failed with status 1 and the generic message `the request could not be sent as
it was`. The connected profile's non-secret model cache lists
`gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`. Selecting the listed Luna
model resolved the failure without changing authentication or policy.

## Connect a ChatGPT account

Run these commands from the project root in your own terminal:

```sh
CODEAF_HOME="$PWD/server/.codeaf-state" CODEAF_PROFILE_DIR="$PWD/server/.codeaf-state" server/bin/codeaf connect codex
```

Finish the browser sign-in. CodeAF supports a ChatGPT plan through its Codex
provider. An existing `codex` CLI executable or its login is not automatically a
CodeAF connection. This command keeps CodeAF state in this project's profile;
it does not change the default `~/.codeaf` profile. Do not commit that state.

Start the server with a model listed by the connected account. This model
was verified with a real response in the current project profile:

```sh
CODEAF_MODEL=codex/gpt-5.6-luna npm --prefix server start
```

Model access depends on the account. Check the non-secret
`server/.codeaf-state/codex-models.json` cache for the models returned at
connection. Use a listed model with the full `codex/<model>` name; documentation
examples may be stale for the connected account.
The adapter does not fall back to the Codex CLI or borrow its credentials.

For another provider, connect it using the same project `CODEAF_HOME`, then
set `CODEAF_MODEL` to a model supplied by that provider. OpenRouter and custom
OpenAI-compatible endpoint credentials can also be supplied through the
standard `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, and `CODEAF_BASE_URL` variables.
The selected binary must remain v0.8.2 until its policy is reviewed again.

## Invocation and bounds

The adapter calls the official CLI with an argument array, without a shell:

```text
codeaf chat --no-host --one-model --model <configured-model> --reasoning low --once <prompt>
```

This is one conversational turn. It is deliberately not `codeaf do` (which
plans and runs work), or `codeaf exec` (which runs its own tool loop).

Every call gets a new temporary workspace. Its `.codeaf/config.json` sets
`tools.approvalMode` to `deny`, overrides **every built-in allowed tool in
v0.8.2** with an explicit deny, and sets `tools.bashPatterns` to `deny *`.
The project's tool exception map replaces profile exceptions. This prevents
profile approvals from allowing actions. No `--yolo` flag is used.
`--no-host` keeps this policy in the local process. The process's `HOME` is
also temporary, so the user's global agent folders are not the workspace.
CodeAF may write its own conversation and usage records in the project state;
that is separate from a model being allowed to run tools.

Untrusted extension, search and runtime text is JSON evidence in the prompt.
The prompt instructs the model to treat it as data. Tool denial is enforced by
CodeAF's policy, not by that instruction alone. The adapter only interprets the
result; it does not execute anything in a finding or follow returned URLs.
The HTTP/UI caller must render all result strings as text.

Bounds: input at most 48 KB; combined CLI output at most 256 KB; 60-second
analysis deadline by default, capped at 90 seconds. A separate three-second
version check refuses unreviewed versions. Timeout or output overflow kills the
process group on macOS/Linux, and temporary work is removed. CLI errors are
reported without copying model or provider error output into the result.
A time limit is not an exact token or spending cap; ChatGPT account limits or
provider charges still apply. `--once` does not provide `exec`'s token flag.

Options for trusted server code: `binary`, `model`, `home`, `timeoutMs`.
Environment: `CODEAF_BIN` (default `server/bin/codeaf`), `CODEAF_MODEL`
(required), `CODEAF_HOME` (default `server/.codeaf-state`). The adapter uses
that app home as its profile, regardless of a global `CODEAF_PROFILE_DIR`.
Keep these options under server control, not extension or webpage input.

## Official sources checked

- [Release v0.8.2 and checksums](https://github.com/Agent-Field/CodeAF/releases/tag/v0.8.2)
- [v0.8.2 guide: chat flags, state location, providers](https://github.com/Agent-Field/CodeAF/blob/v0.8.2/docs/GUIDE.md)
- [v0.8.2 headless contract: chat once and consent behavior](https://github.com/Agent-Field/CodeAF/blob/v0.8.2/docs/HEADLESS.md)
- [v0.8.2 built-in approvals and policy construction](https://github.com/Agent-Field/CodeAF/blob/v0.8.2/cmd/codeaf/chatv3.go)
- [v0.8.2 project policy precedence](https://github.com/Agent-Field/CodeAF/blob/v0.8.2/internal/config/projectconfig.go)
- [Current dev guide](https://github.com/Agent-Field/CodeAF/blob/dev/docs/GUIDE.md)

The installed binary's `connect --help` confirms that `connect codex` opens a
browser sign-in. No credential file contents were read or copied.
