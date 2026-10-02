/**
 * argv for one headless turn. Every flag here was verified against `claude --help` / live runs on
 * CLI 2.1.287 (docs/spikes/01-claude-cli.md "Flags ReelForge needs"). The prompt never goes into
 * argv (it is written to stdin). `--bare` (disables OAuth) and `--max-turns` (absent) are not used.
 */

export const MODEL_ALIASES = ['opus', 'sonnet', 'haiku'] as const;
export type ModelAlias = (typeof MODEL_ALIASES)[number];

/**
 * Headless-safe subset of `--permission-mode` choices: `dontAsk` auto-denies anything not
 * allowlisted (no hang). `manual`/`auto`/`bypassPermissions` are deliberately not offered.
 */
export const PERMISSION_MODES = ['dontAsk', 'acceptEdits', 'plan'] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];

export interface TurnFlags {
  readonly model: ModelAlias;
  /** Session id to continue (`--resume`). */
  readonly resume?: string | undefined;
  /** Built-in tools that exist at all (`--tools`). */
  readonly tools?: readonly string[] | undefined;
  /** Tools that run without asking (`--allowedTools`). */
  readonly allowedTools?: readonly string[] | undefined;
  readonly disallowedTools?: readonly string[] | undefined;
  /** Default `dontAsk`. */
  readonly permissionMode?: PermissionMode | undefined;
  readonly appendSystemPrompt?: string | undefined;
  readonly addDirs?: readonly string[] | undefined;
  /** Default `project`: skips user hooks/skills; project CLAUDE.md still loads. */
  readonly settingSources?: string | undefined;
  /** Extra settings JSON (`--settings`), e.g. the PreToolUse bash guard of PLAN.md#5.7. */
  readonly settings?: string | undefined;
}

export function buildTurnArgs(flags: TurnFlags): string[] {
  const args = ['-p', '--input-format', 'text', '--output-format', 'stream-json', '--verbose'];
  args.push('--model', flags.model);
  if (flags.resume !== undefined) args.push('--resume', flags.resume);
  if (flags.tools !== undefined) args.push('--tools', flags.tools.join(','));
  if (flags.allowedTools !== undefined) args.push('--allowedTools', flags.allowedTools.join(','));
  if (flags.disallowedTools !== undefined) {
    args.push('--disallowedTools', flags.disallowedTools.join(','));
  }
  args.push('--permission-mode', flags.permissionMode ?? 'dontAsk');
  if (flags.appendSystemPrompt !== undefined) {
    args.push('--append-system-prompt', flags.appendSystemPrompt);
  }
  for (const dir of flags.addDirs ?? []) args.push('--add-dir', dir);
  args.push('--setting-sources', flags.settingSources ?? 'project');
  if (flags.settings !== undefined) args.push('--settings', flags.settings);
  args.push('--strict-mcp-config');
  return args;
}
