# @reelforge/claude-bridge

Drives the locally installed Claude Code CLI (`claude -p --output-format stream-json`) on the
user's subscription (ADR-001). No API keys, no SDK, no credential access; every child process gets a
sanitized env (`sanitizeEnv`) and a turn whose `init.apiKeySource` is not `"none"` is killed
(`billing-guard`). Tests run against `tools/fake-claude`, never the real CLI.

## Public API

| Area              | Exports                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Connection (5.1)  | `detectClaude`, `checkConnection`, `resolveClaudeExecutable`, `MIN_CLAUDE_VERSION`                                                         |
| One turn          | `startTurn` → `RunningTurn { outcome, exited, cancel }`, `buildTurnArgs`, `parseStreamLine`, `reduceTurn`                                  |
| Sessions (5.2)    | `SessionManager` (`enqueue`, `cancel`, `cancelAll`, `whenIdle`, `listInterrupted`, `resumeInterrupted`), `'turn'` lifecycle events         |
| Limits (5.4)      | `LimitGuard`, `parseResetTime`, `classifyFailure`, `limitSignalOf`                                                                         |
| Work queue (5.4)  | `WorkQueue` (`add`, `run`, `stop`, `list`, `'event'`), `PipelineStateStore`                                                                |
| Usage (5.4)       | `UsageLedger` (`record`, `read`, `'budget'` event), `usageOfOutcome`                                                                       |
| Economy (5.4)     | `SessionManagerOptions.economy`, `ECONOMY_MODEL`, `ECONOMY_HINT`, `resolveModel`                                                           |
| Permissions (5.7) | `permissionsForStage`, `permissionArgs`, `checkToolUse`, `auditToolUses`, `assertInsideProject`, `isInsideDir`, `resolveBashGuardHookPath` |
| Plumbing          | `Clock`/`systemClock`, `JsonFileStore`, `writeAtomic`, `Result`/`ok`/`err`                                                                 |

Wiring (one guard and one ledger per app; the subscription limit is account-wide):

```ts
const guard = new LimitGuard({ maxConcurrency: 2 });
const usage = new UsageLedger({ budgetFor: (dir) => ({ costUsd: 20 }) });
const manager = new SessionManager({
  launcher,
  guard,
  usage,
  economy: false,
  // hookScriptPath: a copy of hooks/bash-guard.mjs shipped with the app (required when bundled).
  permissions: { kitDocsDir, hookRuntime: nodeExe, hookScriptPath },
});
const queue = new WorkQueue({ manager, guard, projectDir, stage: 'scene-build' });
await queue.add(
  shots.map((shot) => ({ id: shot.id, prompt: buildPrompt(shot), newSession: true })),
);
const summary = await queue.run(); // { status, done, failed, pending, message }
```

## States

- **Turn** (`TurnOutcome.status`): `completed` · `failed` (an `is_error` result; `failure`: `auth` |
  `limit` | `session-not-found` | `api` | `unknown`) · `cancelled` · `timeout` · `idle-timeout` ·
  `crashed` · `billing-guard` · `spawn-failed`.
- **Lifecycle events** (`manager.on('turn')`): `queued`, `started` (once per attempt), `stream`,
  `finished`, `warning`, `session-reset` (stored session gone → re-run in a new one), `debug-dump`,
  `policy-violation` (a tool call broke the stage policy and was not blocked).
- **LimitGuard**: running ↔ paused. `paused` (`PauseInfo`: `reason` limit|manual, `until`,
  `untilSource` reset-time|reset-text|backoff, `consecutiveLimits`), `resumed` (`cause`:
  reset-time|manual|restored-expired), `concurrency`. Resume time: CLI `resetsAt` + 60 s > reset
  parsed from the message (`resets 5am (UTC)`, `in 2 hours`, …) + 60 s > backoff 15/30/60/120/240
  min + ≤20 % jitter. A limit halves concurrency; every 3 successful turns add one back.
  While paused the SessionManager starts no turn and WorkQueues dispatch nothing.
- **Work item** (`pipeline.json` queue): `pending` → `running` → `done` | `failed`. Limit hit or
  cancel → back to `pending` (`limitHits` +1, not counted as an attempt). Other failures retry up to
  `maxAttempts` (2). `auth`/`billing-guard`/`spawn-failed` stop the run as `blocked`. After a restart,
  `running` items become `pending`; a persisted pause is restored (or dropped if expired).
- **Stage** (`pipeline.json` stages): `idle` · `running` · `paused` · `done` · `failed` · `blocked`.
- **Run summary**: `done` · `failed` · `blocked` · `stopped`.

## Files written (all under `<project>/.reelforge/`, atomic tmp + rename, zod schemas in `@reelforge/shared`)

| File                         | Content                                                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions.json`              | session id per purpose (main/script/qa) + the in-flight turn (crash recovery)                                                                                                      |
| `pipeline.json`              | stage statuses, work-item queue, limit pause (`pausedUntil`, concurrency)                                                                                                          |
| `usage.json`                 | totals + per stage → per model: turns, failed turns, limit hits, tokens, list-price `costUsd`, API ms; crossed budget thresholds                                                   |
| `debug/<stamp>-<turn>.jsonl` | raw stdout of every `failed`/`crashed` turn (+ `.meta.json`); folder has its own `.gitignore` (`*`) — capture the first real usage-limit stream as a fake-claude fixture from here |

`costUsd` is the CLI's list-price estimate, a relative meter on a subscription. Budgets are soft:
`budget` events at 50/80/100 % (once each, persisted); nothing is stopped.

## Permissions (5.7)

`permissionsForStage(stage, projectDir, { kitDocsDir, hookRuntime, hookScriptPath })` (applied by default by the
SessionManager; request fields override them one by one):

```
--tools Read,Glob,Grep,Edit,Write,Bash[,WebSearch,WebFetch]
--allowedTools Read,Glob,Grep,Edit(./**),Write(./**),Bash(reelforge),Bash(reelforge *)[,WebSearch,WebFetch]
--disallowedTools Edit(./.reelforge/**),Write(./.reelforge/**),Edit(./.git/**),Write(./.git/**),NotebookEdit,
                  [WebSearch,WebFetch],Read(~/.claude/**),Read(~/.claude.json)
--permission-mode dontAsk  --add-dir <kit docs>  --setting-sources project  --strict-mcp-config
[--settings {"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"<node> <hooks/bash-guard.mjs> reelforge"}]}]}}]
```

Web tools only in `research` and `script` (`WEB_STAGES`); `critic` is read-only (no Edit/Write at all).

Hook script: `hookScriptPath` if given, else the package's own `hooks/bash-guard.mjs`
(`defaultBashGuardHookPath()`, resolved on call; it only exists when the package runs unbundled — a
bundled host such as the Electron main process must ship the file and pass its path). With a
`hookRuntime` and no existing script, `new SessionManager(...)` throws instead of running unguarded.

Verified live on Claude Code 2.1.287 (2 haiku turns, `permissions.real.test.ts`, run with
`REELFORGE_REAL_CLAUDE=1`; never in default runs):

- Write outside the project → denied (`permission_denied`, mode `dontAsk`). Write into the
  `--add-dir` kit folder → denied. Write into `./.reelforge/` → denied by the deny rule (error
  `File is in a directory that is denied by your permission settings.`, listed in
  `result.permission_denials` but **without** a `permission_denied` event). Write to
  `./scenes/x.txt` → allowed. Read in the kit folder → allowed.
- `Bash(reelforge *)` inside a comma list works (`reelforge status` ran).
- **`echo pwned` ran despite the allowlist** under `dontAsk`: the CLI auto-approves "read-only"
  shell commands. With the PreToolUse hook (`--settings`, honoured together with
  `--setting-sources project`) `echo pwned` and `reelforge status && echo chained` were blocked
  (`PreToolUse:Bash hook error: … ReelForge bash guard: …`, also in `result.permission_denials`).
  → Pass `hookRuntime` (a Node-compatible executable) in production.
- Unknown `--resume <id>` (free, no model call): exit 1, stderr `No conversation found with
session ID: <id>`, stdout one `result` (`subtype:error_during_execution`, `is_error`, `num_turns:0`,
  `errors:[…]`), no `init` → `failure: 'session-not-found'` → automatic new session.

Bridge-side checks: `checkToolUse` (PreToolUse-style decision; same rules as the hook and flags),
`auditToolUses` (after the turn: violations not blocked by the CLI/hook → `policy-violation` event),
`assertInsideProject` (lexical + symlink/junction-aware containment, case-insensitive on Windows).
