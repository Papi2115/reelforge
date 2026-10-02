# Spike 1.1 — Driving the local `claude` CLI headlessly (subscription)

**Date:** 2026-10-02 · **Claude Code:** 2.1.287 (npm global, Windows 11, Node 24.17) · **Auth:** claude.ai subscription (`subscriptionType: max`)
**Code:** `spikes/01-cli-bridge/` · **Fixtures:** `spikes/01-cli-bridge/fixtures/*.jsonl` (real, redacted)
**Real model calls used:** 11 (8× haiku, 1× sonnet, 1× opus, 1× haiku tool run) + free probes (`--version`, `auth status`, not-logged-in).

## Verdict: **GO for D5**

Everything ReelForge needs works through the real binary with zero credential handling:
headless `-p` + `stream-json`, prompt over stdin, `--resume`, model aliases, tool allow/deny lists,
project `CLAUDE.md` pickup from `cwd`, reading a PNG via the Read tool, env sanitizing, tree-kill on Windows,
machine-readable auth/limit state. No blocker found. Two caveats: usage-limit stream shape is known only from
the binary's schema (not observed live), and the CLI surface is large and fast-moving → pin min/max versions and
keep contract tests on recorded streams.

---

## 1. Spawning on Windows

| Method | Result |
|---|---|
| `spawn('claude.cmd', args, {shell:false})` | **EINVAL** (Node ≥18.20 blocks `.cmd`/`.bat` without shell, CVE-2024-27980) |
| `spawn('claude', args, {shell:false})` | **ENOENT** (no PATHEXT resolution) |
| `spawn('claude', args, {shell:true})` | works, but args are concatenated unescaped (Node DEP0190) — unsafe for prompts |
| `cmd.exe /d /s /c "claude.cmd …"` | works, but cmd metachar quoting (`"`, `%`, `^`, `&`, newlines) is a minefield |
| **`spawn(<…>\claude.exe, args, {shell:false})`** | **works — chosen** |

`claude.cmd` (npm cmd-shim) is only `"%dp0%\node_modules\@anthropic-ai\claude-code\bin\claude.exe" %*` — the CLI
is a **native exe**. `resolveClaudeExecutable()` scans PATH for `claude.exe`, else parses the `claude.cmd` shim
to find the exe, else tries `%USERPROFILE%\.local\bin\claude.exe` (native installer location — not verified on
this machine). Then `shell:false`, `windowsHide:true`.

**Prompt via stdin works:** `-p --input-format text` with the prompt written to stdin (all 11 calls used it). This
removes prompt quoting entirely. Remaining argv strings (e.g. `--append-system-prompt`) round-trip intact with
`shell:false` → exe: verified with a value containing `"quotes"`, `&`, `%`, `<>` and a newline (the model echoed
`SIG "…" & 50% <ok>` + the second line; and the fake-CLI test asserts exact argv equality incl. backslashes).
Paths with spaces (`proj with space`) work as `cwd`.

## 2. `stream-json` event shapes (observed)

`--output-format stream-json` under `-p` **requires `--verbose`**: without it the CLI exits 1 with
`Error: When using --print, --output-format=stream-json requires --verbose` (stderr, no model call).

One JSON object per line (LF). Observed sequence (tools fixture):
`system:init → system:thinking_tokens* → assistant(thinking) → assistant(text) → assistant(tool_use) → user(tool_result) → assistant(tool_use) → system:permission_denied → user(tool_result) → rate_limit_event → … → assistant(text) → result:success`

- **`system:init`**: `cwd, session_id, model` (resolved id), `tools[]`, `mcp_servers[]`, `permissionMode`,
  `apiKeySource` (`"none"` = subscription), `claude_code_version`, `slash_commands/skills/agents/plugins`,
  `memory_paths`, `analytics_disabled`, `uuid`. ~3 KB.
- **`assistant`**: `{message:{id, model, role, content:[ONE block], usage, stop_reason}, parent_tool_use_id, session_id, uuid, timestamp, request_id}`.
  **One event per content block** — thinking / text / tool_use of the same API message arrive as separate
  events sharing `message.id`, each repeating the same `usage` (→ never sum per-event usage). Thinking blocks
  come with `thinking: ""` + `signature` (text not exposed). Optional top-level `error` (enum below) and `is_api_error_message`.
- **`system:thinking_tokens`**: `{estimated_tokens, estimated_tokens_delta}` progress ticks — good for a "thinking…" indicator.
- **`user`** (tool results): `message.content[{type:"tool_result", tool_use_id, content}]`; image results carry
  `{type:"image", source:{type:"base64", media_type:"image/png", data}}`; plus a convenience `tool_use_result` object.
- **`system:permission_denied`**: `{tool_name, tool_use_id, decision_reason_type:"mode", message}`.
- **`rate_limit_event`**: `{rate_limit_info:{status:"allowed", resetsAt:<epoch s>, rateLimitType:"five_hour", overageStatus, isUsingOverage, unifiedWindows:{five_hour:{utilization:0.05, resetsAt}, seven_day:{utilization:0.02, resetsAt}}}}` — emitted every turn. Live quota meter for free.
- **`result`**: `subtype` (`success` | `error_during_execution` | `error_max_turns` | `error_max_budget_usd` | `error_max_structured_output_retries`),
  `is_error`, `result` (**only the final assistant text**, not the whole turn), `num_turns`, `duration_ms`,
  `duration_api_ms`, `ttft_ms`, `total_cost_usd` (list-price estimate, `modelUsage[*].costBasis:"list"` — not a bill
  on subscription, but a usable relative meter), `usage{input,output,cache_*}`, `modelUsage{<modelId>:{…, contextWindow, maxOutputTokens}}`,
  `permission_denials[{tool_name, tool_use_id, tool_input}]`, `terminal_reason` (`completed` | `api_error` | …), `stop_reason`, `session_id`.
- Process exit comes **~0.7 s after** the `result` line → treat `result` as turn completion; reap the process asynchronously.

Fixtures (`spikes/01-cli-bridge/fixtures/`): `haiku-ok`, `sonnet-ok`, `opus-ok`, `resume-1-remember`, `resume-2-recall`,
`tools-read-png` (Read PNG + denied Write), `not-logged-in` (+ trailing synthetic `bridge_exit` line, code 1).
Redacted by `redact()`: e-mails → `<redacted-email>`, home dir → `<HOME>`, OS user name → `<USER>`. A test asserts
no e-mail/user name remains. They contain session/message UUIDs, request ids, thinking signatures and a tiny
base64 PNG — nothing secret.

## 3. `--resume` continuity
Call A (haiku): "Remember PELICAN-42" → `session_id=b70a…`. Call B: new process, `--resume b70a…`, "What codeword?" →
`PELICAN-42`. B's `init.session_id` **equals A's** (same session continues; `--fork-session` exists to branch).
Sessions persist under the CLI's own config dir; `--no-session-persistence` disables it for throwaway calls.

## 4. `--model` aliases → reported model id (init + `modelUsage`)
| alias | model id | contextWindow | cost of "ok" (list) | api ms |
|---|---|---|---|---|
| `haiku` | `claude-haiku-4-5-20251001` | 200k (max out 32k) | $0.0175 | 1.1 s |
| `sonnet` | `claude-sonnet-5-5` | 1M (max out 128k) | $0.040 | 1.3 s |
| `opus` | `claude-opus-5-5` | 1M (max out 128k) | $0.077 | 1.5 s |

Even a trivial call carries ~25k cached system-prompt tokens (Claude Code's own prompt) → per-call overhead is real;
batch work into fewer, larger turns. Help also mentions alias `fable` (not tested).

## 5. Tools, permissions, system prompt, project CLAUDE.md
One haiku run, `cwd = "<scratch>\proj with space"` containing `CLAUDE.md` (codeword MARMALADE-7) + `swatch.png`:
`--tools Read,Write --allowedTools Read --permission-mode dontAsk --setting-sources project --strict-mcp-config --append-system-prompt '<sig with quotes/&/%/newline>'`
- `--tools Read,Write` → `init.tools == ["Read","Write"]` (hard limit of what exists).
- `--allowedTools Read` + `--permission-mode dontAsk` → Read ran without prompting; **Write was denied**
  (`system:permission_denied`, `result.permission_denials[0].tool_name=="Write"`), file not created. No hang:
  `dontAsk` auto-denies anything not pre-allowed — exactly what headless needs.
- Project `CLAUDE.md` in `cwd` **was picked up** (model reported MARMALADE-7) even with `--setting-sources project`
  (which dropped user-level skills 33 → 19, i.e. user settings/hooks are skipped).
- `--append-system-prompt` honoured (signature + second line printed).
- `--allowedTools 'Bash(ping *)'` (space pattern syntax from `--help`) allowed `ping` through the Bash tool (Git Bash) in §7.

## 6. Reading a PNG through the Read tool
64×64 PNG made with `node:zlib` (`make-project.mjs`: left half RGB(20,60,230), right half RGB(250,210,0)).
Haiku called `Read {file_path:"…\proj with space\swatch.png"}`, got an `image` tool_result, and answered
"Left side: Bright blue … Right side: Bright yellow … two vertical blocks of equal width". **Works** — frame QA via
Read on rendered PNGs is viable.

## 7. Kill tree on Windows (`probe-killtree.mjs`, 2 haiku calls)
Model ran `ping -n 60 127.0.0.1` via Bash. Descendants of `claude.exe` 3 s later:
`conhost.exe, bash.exe, bash.exe, conhost.exe, bash.exe, PING.EXE`.
- `taskkill /PID <pid> /T /F` → taskkill exit 0, claude exit code 1 (signal null) within **151 ms**, **0 orphans**.
- `ChildProcess.kill()` on the root only → root dies, **5 orphans** (`bash.exe ×3, conhost.exe, PING.EXE`) — cleaned by the probe.
→ Bridge must always kill via `taskkill /T /F` on Windows (process group kill on POSIX: spawn `detached`, `kill(-pid)`).

## 8. Error shapes
**Not logged in** (simulated with `CLAUDE_CONFIG_DIR=<fresh empty temp dir>`; real config never touched):
- `claude auth status` → exit **1**, JSON `{"loggedIn":false,"authMethod":"none","apiProvider":"firstParty",…}` in ~200–280 ms, no model call.
  `--text` → `Not logged in. Run claude auth login to authenticate.`
- Logged in (real config): exit 0, `{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty","subscriptionType":"max", …}`
  — the object also contains `email`, `orgId`, `orgName`, `configDirectory` (the app must not log/persist them).
- `claude -p` not logged in → exit **1**, `system:init` as usual, then an `assistant` with `model:"<synthetic>"`,
  `error:"authentication_failed"`, `is_api_error_message:true`, text `Not logged in · Please run /login`, then
  `result` with **`subtype:"success"` but `is_error:true`**, `terminal_reason:"api_error"`, cost 0. → always check `is_error`, never `subtype` alone.
- Note: `CLAUDE_CONFIG_DIR` **is** honoured (empty dir got populated with `.claude.json`, `projects/`, `sessions/`).

**Usage limit — UNKNOWN live** (cannot trigger on purpose). From the zod schemas embedded in `claude.exe` 2.1.287:
- `rate_limit_event.rate_limit_info.status ∈ {allowed, allowed_warning, rejected}`, `rateLimitType ∈ {five_hour, seven_day, seven_day_opus, seven_day_sonnet, seven_day_overage_included, overage}`, `resetsAt` (int epoch s), `utilization`, `unifiedWindows`.
- `assistant.error ∈ {authentication_failed, oauth_org_not_allowed, account_on_hold, verification_required, billing_error, rate_limit, overloaded, invalid_request, model_not_found, server_error, unknown, max_output_tokens, cloud_credential_error}`.
- User-facing texts start with e.g. `You've hit your …`, `usage limit reached`.
- Expected (unverified): `rate_limit_event{status:"rejected"}` + synthetic assistant `error:"rate_limit"` + `result.is_error:true`.
  Fake-claude must synthesize this and the bridge should dump the raw stream of any `is_error` turn to a debug log, so the first real one gets captured as a fixture.

**Billing guard:** with a fake `ANTHROPIC_API_KEY` in env, `auth status` reports `apiKeySource:"ANTHROPIC_API_KEY"` (CLI would use it);
after `sanitizeEnv` the field is gone. Real runs report `init.apiKeySource:"none"`.
Also: this dev shell (a Claude Code host session) had `ANTHROPIC_BASE_URL`, `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`,
`CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_MESSAGING_TOKEN`, … set — launching ReelForge from a Claude Code terminal
would leak them without sanitizing.

## 9. Cold-start latency (haiku, "Reply with the single word ok", `--no-session-persistence`, `--strict-mcp-config`)
| run | spawn→init | →first assistant | →result | →process exit | api |
|---|---|---|---|---|---|
| 1 | 870 ms | 1803 ms | 1820 ms | 2575 ms | 926 ms |
| 2 | 869 ms | 1965 ms | 1993 ms | 2767 ms | 1102 ms |
| 3 | 983 ms | 2245 ms | 2270 ms | 3032 ms | 1262 ms |

`claude --version`: ~220 ms. So ≈0.9 s CLI boot + ~1 s API for a trivial turn; ~0.75 s shutdown tail after `result`.

## 10. Env knobs (names confirmed as strings in `claude.exe`; behaviour only where tested)
- `CLAUDE_CONFIG_DIR` — tested: relocates config/sessions/credentials lookup.
- `DISABLE_TELEMETRY=1` and `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` — tested: flip `auth status.analyticsDisabled` to `true`.
- `DISABLE_AUTOUPDATER` — present in binary; no observable effect on `auth status`; behaviour **UNKNOWN**.
- `DISABLE_ERROR_REPORTING`, `CLAUDE_CODE_GIT_BASH_PATH`, `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_USE_{BEDROCK,VERTEX,FOUNDRY,GATEWAY,MANTLE,ANTHROPIC_AWS,ANTHROPIC_GOOGLE_CLOUD}` — present; not exercised.
- `--bare` would skip CLAUDE.md discovery **and** OAuth ("auth is strictly ANTHROPIC_API_KEY") → **never use `--bare`**.

---

## Flags ReelForge needs (verified on 2.1.287)
```
claude.exe -p --input-format text --output-format stream-json --verbose
  --model <haiku|sonnet|opus|full-id>
  [--resume <session_id>] | [--session-id <uuid>]   [--fork-session]
  --tools "Read,Edit,Write,Glob,Grep,Bash"           # what exists
  --allowedTools "Read,Edit,Write,Glob,Grep,Bash(reelforge *)"   # what runs without asking
  --permission-mode dontAsk                           # anything else auto-denied, no hang
  --append-system-prompt "<stage prompt>"
  --setting-sources project                           # skip user hooks/skills; project CLAUDE.md still loads
  --strict-mcp-config                                 # no user MCP servers
  [--add-dir <kit dir>] [--no-session-persistence] [--include-partial-messages]
prompt → stdin (UTF-8), cwd = project folder
claude auth status            # JSON, exit 0/1 — connection wizard probe, no model call
```
Not available / not to use: `--max-turns` (absent), `--bare`, `--dangerously-skip-permissions`, `setup-token`, `--max-budget-usd` (API-billing only).
`--add-dir` and `--include-partial-messages` are from `--help`, not exercised here.

## Requirements for `packages/claude-bridge`
**5.1 Detection/wizard**
- Resolve the exe (PATH `claude.exe` → parse `claude.cmd` shim → `%USERPROFILE%\.local\bin\claude.exe`); never spawn `.cmd`, never `shell:true`.
- Version via `claude.exe --version` (`/^(\d+\.\d+\.\d+) \(Claude Code\)/`); enforce min (2.1.287) and warn above a tested max.
- Auth state via `claude auth status` (exit code + `loggedIn`); keep only `loggedIn/authMethod/subscriptionType`; never store email/org.
  Not logged in → open a terminal with `claude` (user runs `/login` / `claude auth login` themselves).
**5.2 Sessions/process**
- Prompt on stdin; `shell:false`, `windowsHide:true`, sanitized env (`sanitizeEnv`: drop all `ANTHROPIC_*`, `CLAUDE_CODE_*`, `CLAUDE_AGENT_SDK_*`, `CLAUDECODE`, `CLAUDE_PID`, `CLAUDE_EFFORT`; allowlist `CLAUDE_CODE_GIT_BASH_PATH`, `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`).
- Fail closed if `init.apiKeySource !== "none"` (kill the turn, surface an error).
- Persist `session_id` from `init` per project/side-session; continue with `--resume`. Cancel = `taskkill /PID /T /F` (Windows) / process-group kill (POSIX). Turn done on `result`, not on exit; timeout watchdog per stage.
**5.3 Parser**
- Line-delimited JSON, tolerate unknown `type`s/fields (zod `.passthrough()`), non-JSON lines → parse-error event.
- Merge per-block `assistant` events by `message.id`; accumulate text across the turn (`result.result` is only the last text).
- Map `tool_use`↔`tool_result` by `tool_use_id` into UI "steps"; surface `system:permission_denied`; use `thinking_tokens` for progress.
- Usage = `result.usage` / `result.modelUsage` (+ `total_cost_usd` as list-price meter); never sum per-event usage.
  **Correction (real run, PLAN.md#10.4):** after `--resume`, `total_cost_usd` and `modelUsage` are the whole
  session's totals (only top-level `usage` is per turn); the bridge books the difference to the previous turn's
  totals (`usageSnapshot` in sessions.json, `turn-usage.ts`).
**5.4 Limits**
- Track every `rate_limit_event` (status, `unifiedWindows.*.utilization`, `resetsAt`): show quota bar; soft-pause new stages above a threshold.
- On `status:"rejected"` or `assistant.error ∈ {rate_limit, overloaded, billing_error}` → persist pipeline state, schedule resume at `resetsAt`.
- `assistant.error:"authentication_failed"` → wizard. Always branch on `is_error`, not `subtype`.
**5.9 fake-claude**
- Replay `fixtures/*.jsonl` (seed: `spikes/01-cli-bridge/fake-claude.mjs`), honour exit code; scenarios: ok, tools, resume, not-logged-in, **synthetic** usage-limit (schema above), mid-stream kill, garbage line.
- Spawned via an injectable executable (`claudePath` + `executableArgs`), same sanitize/arg code path as production.

## Demo
```
node spikes/01-cli-bridge/demo.mjs --model haiku "Reply with the single word ok"
+  1228ms [system:init] model=claude-haiku-4-5-20251001 session=dcde1c70-2f88-4993-91ed-9cff2b3f5d77
+  2298ms [assistant:thinking]
+  2299ms [assistant:text] ok
+  2321ms [rate_limit_event] {"type":"rate_limit_event","rate_limit_info":{"status":"allowed","resetsAt":1790902800,"rateLimitType":"five_hour",…
+  2345ms [result:success] is_error=false turns=1 duration_ms=1136 cost_usd=0.0175496 result="ok"

node spikes/01-cli-bridge/demo.mjs --model haiku --resume dcde1c70-… "What did I ask?"
node spikes/01-cli-bridge/make-project.mjs "<dir with spaces>"
node spikes/01-cli-bridge/demo.mjs --model haiku --cwd "<dir>" --tools Read,Write --allowed-tools Read --permission-mode dontAsk --setting-sources project "Describe swatch.png"
node spikes/01-cli-bridge/probe-killtree.mjs "<dir>" [--plain-kill]
node spikes/01-cli-bridge/probe-coldstart.mjs 3
node --test "spikes/01-cli-bridge/*.test.mjs"       # 15 tests, no model calls
```
Library API (`demo.mjs`): `runClaude(options)` → async iterable of parsed events with `{pid, exit, stderr(), kill()}`;
`killTree(pid)`, `sanitizeEnv(env)`, `buildArgs(options)`, `resolveClaudeExecutable()`, `parseLine()`, `redact()`, `summarize()`.

## Open / UNKNOWN
- Live usage-limit stream (see §8) — capture when it happens.
- Native-installer path (`~/.local/bin/claude.exe`) and non-npm installs — not present on this machine.
- `DISABLE_AUTOUPDATER` effect; whether the CLI self-updates mid-pipeline (pin + version check covers it).
- Whether app-launched Claude Code telemetry should be disabled by default (`DISABLE_TELEMETRY`) — product decision.
