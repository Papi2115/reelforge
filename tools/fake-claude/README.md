# fake-claude

Stand-in for the `claude` CLI (Claude Code) used by tests and CI (PLAN.md#5.9). It **never calls a
model and never reads credentials**: it replays recorded `stream-json` from Claude Code 2.1.287
(`fixtures/`, seeded from `spikes/01-cli-bridge/fixtures`, redacted) or synthesizes streams built from
those recordings.

## Launching

```ts
import { fakeClaudeLauncher, fakeClaudeEnv } from '@reelforge/fake-claude';
// { command: process.execPath, args: ['<repo>/tools/fake-claude/bin/fake-claude.mjs'] }
const launcher = fakeClaudeLauncher();
const env = { ...process.env, ...fakeClaudeEnv({ scenario: 'tools-edit', probe: true }) };
```

The bridge accepts the same `{ command, args }` launcher, so tests exercise the production spawn path
(`shell:false`, sanitized env, no `.cmd`). Plain CLI: `node tools/fake-claude/bin/fake-claude.mjs ...`.

## CLI surface

| Invocation                                   | Behaviour                                                                                                                                                                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--version`                                  | `2.1.287 (Claude Code)` (override: `FAKE_CLAUDE_VERSION`)                                                                                                                                                                              |
| `auth status [--json\|--text]`               | logged in: exit 0, JSON incl. fake `email`/`orgId`/`orgName` (to prove the bridge drops them); logged out: exit 1 `{"loggedIn":false,"authMethod":"none",…}`. `apiKeySource` appears when `ANTHROPIC_API_KEY` is set (as the real CLI) |
| `-p --output-format stream-json --verbose …` | prompt from stdin (or positional), plays the selected scenario                                                                                                                                                                         |

Accepted flags (validated with `parseArgs` strict mode, unknown flags exit 1 like commander):
`-p/--print`, `--input-format text`, `--output-format stream-json`, `--verbose`, `--model`,
`-r/--resume`, `--session-id`, `--fork-session`, `--tools`, `--allowedTools/--allowed-tools`,
`--disallowedTools/--disallowed-tools`, `--permission-mode` (real choices), `--append-system-prompt`,
`--add-dir` (repeatable), `--setting-sources`, `--settings` (accepted, not acted on: no hooks run),
`--strict-mcp-config`, `--no-session-persistence`,
`--include-partial-messages`. `stream-json` without `--verbose` fails with the real error text.
`--bare` exits 2 (forbidden in ReelForge, ADR-001); `--max-turns` exits 1 (does not exist in 2.1.287).

Every replayed event is rewritten for the current call: `session_id` (new UUID, `--session-id`, or the
`--resume` id), `init.cwd` (process cwd), `init.model`/assistant `model`/`modelUsage` key (from
`--model`: haiku/sonnet/opus -> recorded ids), `init.permissionMode`, `init.tools` (from `--tools`),
`init.apiKeySource` (`none`, or `ANTHROPIC_API_KEY` when that var reaches the process).

## Scenarios (`FAKE_CLAUDE_SCENARIO`, default `ok`)

| Scenario           | Stream                                                                                                                                                                                  | Exit |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `ok`               | recorded `<model>-ok`: init, (thinking), text `ok`, rate_limit_event, result                                                                                                            | 0    |
| `tools-read-png`   | recorded: Read PNG (image tool_result), Write denied in `dontAsk` (`permission_denied`)                                                                                                 | 0    |
| `tools-edit`       | synthetic: Read -> Edit -> Write on `<cwd>/scenes/s01.js` / `notes.txt`, each with a successful tool_result                                                                             | 0    |
| `tools-escape`     | synthetic, as verified live under `dontAsk`: Write to `<cwd>/../outside.txt` denied, unguarded `echo pwned` ran                                                                         | 0    |
| `tools-write`      | synthetic: one Write tool_use + successful tool_result per sidecar `writes` entry (the files are really written, paths must stay inside the cwd), then text = `reply` (default `Done.`) | 0    |
| `resume`           | recorded `resume-1-remember` (no `--resume`) / `resume-2-recall` (with `--resume`, answers `PELICAN-42`)                                                                                | 0    |
| `slow`             | `ok` with N `thinking_tokens` ticks (`FAKE_CLAUDE_SLOW_TICKS`, 40), `FAKE_CLAUDE_DELAY_MS` (250) between lines                                                                          | 0    |
| `hang`             | init, then silence until killed (idle watchdog / cancel tests)                                                                                                                          | —    |
| `crash`            | init + assistant, then a truncated JSON line without newline, stderr `simulated crash`, no result                                                                                       | 1    |
| `garbage`          | `ok` with `this is not json`, `[1,2,3]` and an unknown `brand_new_event` after init                                                                                                     | 0    |
| `not-logged-in`    | recorded: synthetic assistant `error:"authentication_failed"`, result `is_error:true` + `subtype:"success"`                                                                             | 1    |
| `rate-limit`       | **assumed** usage-limit shape, see below                                                                                                                                                | 1    |
| `limit-warning`    | `ok` with `rate_limit_event.status:"allowed_warning"` (utilization 0.92)                                                                                                                | 0    |
| `api-key`          | `ok` with `init.apiKeySource:"ANTHROPIC_API_KEY"` and 200 ms pacing (billing-guard tests)                                                                                               | 0    |
| `resume-not-found` | with `--resume`: recorded `resume-not-found` (one `result`, `errors:["No conversation found…"]`); else `ok`                                                                             | 1/0  |

### Usage limit (ASSUMED — never observed live, ADR-001 / spike §8)

Built from the zod enums embedded in `claude.exe` 2.1.287. `FAKE_CLAUDE_LIMIT_SHAPE` picks the variant
so the bridge's heuristics are tested against each plausible signal on its own:

| Shape            | Events                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full` (default) | `rate_limit_event{status:"rejected", rateLimitType:"five_hour", resetsAt}` + synthetic assistant `error:"rate_limit"` text `You've hit your usage limit · resets 5am (UTC)` + `is_error` result |
| `event-only`     | rejected `rate_limit_event` + `is_error` result `API Error: request rejected`                                                                                                                   |
| `error-only`     | assistant `error:"rate_limit"` text `API Error: Rate limit reached` + `is_error` result                                                                                                         |
| `text-only`      | no event, no `error` field: only limit wording in the assistant text / result                                                                                                                   |

`resetsAt` defaults to `1790902800` (deterministic); override with `FAKE_CLAUDE_RESETS_AT`. When a real
limit is hit, capture the stream as a fixture and replace these assumptions.

## Knobs (env)

| Variable                                                                   | Effect                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FAKE_CLAUDE_SCENARIO`                                                     | scenario name (above)                                                                                                                                                                                                                                         |
| `FAKE_CLAUDE_SCRIPT`                                                       | sidecar JSON (below); wins over `FAKE_CLAUDE_SCENARIO`                                                                                                                                                                                                        |
| `FAKE_CLAUDE_REPLY`                                                        | replaces the last assistant text and `result.result`                                                                                                                                                                                                          |
| `FAKE_CLAUDE_DELAY_MS` / `FAKE_CLAUDE_SLOW_TICKS`                          | pacing between lines / tick count for `slow`                                                                                                                                                                                                                  |
| `FAKE_CLAUDE_LIMIT_SHAPE` / `FAKE_CLAUDE_RESETS_AT`                        | usage-limit variant / reset epoch seconds                                                                                                                                                                                                                     |
| `FAKE_CLAUDE_EXIT_CODE` / `FAKE_CLAUDE_EXIT_DELAY_MS`                      | override exit code / delay exit after the last line (real CLI: ~0.7 s)                                                                                                                                                                                        |
| `FAKE_CLAUDE_VERSION`                                                      | `--version` output                                                                                                                                                                                                                                            |
| `FAKE_CLAUDE_AUTH` (`logged-in`\|`logged-out`), `FAKE_CLAUDE_SUBSCRIPTION` | `auth status` result (default: logged out only for scenario `not-logged-in`)                                                                                                                                                                                  |
| `FAKE_CLAUDE_PROBE=1`                                                      | prepend `{"type":"fake_probe", argv, stdin, cwd, scenario, claudeEnvKeys}`; `claudeEnvKeys` lists the _names_ of `ANTHROPIC_*`/`CLAUDE_CODE_*`/`CLAUDE_AGENT_SDK_*`/`CLAUDECODE`/`CLAUDE_PID`/`CLAUDE_EFFORT` vars the process received (env-sanitizer tests) |
| `FAKE_CLAUDE_STATE_DIR`                                                    | remember session ids; `--resume <unknown id>` then fails like the real CLI (verified 2.1.287, no model call): one `result` line with `errors`, stderr `No conversation found with session ID: <id>`, exit 1                                                   |
| `FAKE_CLAUDE_CHILD_PID_FILE`                                               | spawn a long-lived grandchild and write its pid (kill-tree tests)                                                                                                                                                                                             |

## Sidecar script (`FAKE_CLAUDE_SCRIPT=<file.json>`)

```json
{
  "version": 1,
  "sequence": ["crash", { "scenario": "ok", "reply": "done" }],
  "rules": [{ "promptIncludes": "LIMIT", "scenario": "rate-limit", "limitShape": "text-only" }],
  "default": "ok"
}
```

- `sequence`: step N for the N-th call (counter in `<file>.json.state`; sticks on the last step).
  Sequential use only.
- `rules`: first rule whose `promptIncludes` occurs in the prompt; else `default` (else `ok`).
- A step is a scenario name or
  `{ scenario, reply?, delayMs?, ticks?, limitShape?, resetsAt?, exitCode?, writes? }`; its fields
  override the env knobs. `writes: [{ "path": "storyboard.json", "content": "..." }]` (relative to the
  cwd) feeds `tools-write` — used by the prompt evals (`packages/prompts`) to emit canned stage output.
  Typed as `FakeClaudeScript` / `FakeClaudeStep` in `src/index.ts`.
