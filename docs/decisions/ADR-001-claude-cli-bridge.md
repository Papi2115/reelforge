# ADR-001: Drive Claude through the local `claude` CLI (D5)

Status: accepted (2026-10-02). Evidence: `docs/spikes/01-claude-cli.md`.

**Decision:** GO. The app spawns the real `claude` binary headlessly (`-p`, `--output-format stream-json --verbose`, prompt over stdin) on the user's subscription. No API keys, no token handling.

**Consequences (binding for tasks 5.1–5.4, 5.9):**
- Spawn the native `claude.exe` directly with `shell:false`; `.cmd` wrappers fail (EINVAL) or are unsafe to quote.
- Sanitize the child env (all `ANTHROPIC_*`, `CLAUDE_CODE_*`, `CLAUDE_AGENT_SDK_*`, `CLAUDECODE`, `CLAUDE_PID`, `CLAUDE_EFFORT`; keep `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_GIT_BASH_PATH`). Abort a turn if `init.apiKeySource !== "none"`.
- Connection check via `claude auth status` (no model call), not a `-p` probe.
- Kill process trees with `taskkill /PID <pid> /T /F`.
- `--max-turns` does not exist in 2.1.287: implement our own watchdog/timeouts. Never use `--bare` (disables OAuth and CLAUDE.md).
- `-p` errors surface as `is_error:true` with `subtype:"success"` — detect via `is_error`.
- The usage-limit stream shape is UNKNOWN (not observed); 5.4 must treat unknown error results conservatively and stay testable via fake-claude.
- Recorded streams in `spikes/01-cli-bridge/fixtures/` seed `tools/fake-claude`.
