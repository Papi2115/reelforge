# ADR-031: Channels and channel secrets (ReelForge 3.1)

Status: accepted (2026-10-07). Code: `packages/shared/src/channels.ts` (`channelSchema`,
`channelsFileSchema`, `channelInputSchema`, `channelPatchSchema`, `channelForProject`,
`channelTasteProfileFile`, `channelSecretsFileSchema`), `packages/shared/src/{project,recent-projects}.ts`
(`channelId`), `packages/project/src/{channels,channel-projects,create}.ts`,
`apps/desktop/src/main/channels/{channel-secrets,channels-ipc,new-project-channel}.ts`,
`apps/desktop/src/shared/channels-contract.ts`. Task: PLAN.md#13.13 (part B1: data, secrets,
wiring; the UI is a separate packet).

## Context

Papi runs at least three YouTube channels, each with its own voice and its own ElevenLabs account
(docs/roadmap-3.0.md, CLAUDE.md §8 2026-10-06). The number changes, so channels are a dynamic list.
A channel decides what a new project starts with (style/world, genre preset, voice, publish
defaults) and owns a taste profile (docs/ux/redesign-2.4.md, "Answers": taste belongs to the
channel, optionally per world; characters belong to the world, not the channel). Its API key is a
user-provided third-party secret (not an Anthropic credential; §3.1 is unaffected) and must never
end up in a project folder, a commit, a log or the renderer.

## Decision

- **Store.** `<userData>/channels.json` (version 1, zod schema in `@reelforge/shared`, atomic writes,
  one in-process lock per file): `{ defaultChannelId, channels[] }` in the user's order. Ids are
  kebab slugs of the first name (`voxplain`, `voxplain-2`), stable across renames. Fields: name,
  color, avatar, `defaultStyle` (null = app default), `genrePreset` (null; mapping in 13.8),
  `voice { provider: 'elevenlabs', voiceId?, model?, settings? }` (loose ranges until 13.14 checks
  the vendor docs), `publishDefaults`, `tasteProfile`, `tastePerWorld`, `projectsDir`, `notes`,
  `createdAt`. No secret field exists in the schema; create/patch inputs are strict objects.
- **Migration without rewrites.** The first read writes one `Default` channel (`id: default`).
  `project.json#channelId` is optional: absent, or naming a channel that is gone, means the default
  channel (`channelForProject` reports `default` / `missing` / `explicit`). No existing project is
  touched. A broken or newer channels.json is never overwritten: every call reports `corrupt` /
  `unsupported-version` until it is fixed (new projects of the default channel are still created,
  without a `channelId`).
- **Delete.** Refused for the default channel (`default-channel`) and for a channel whose known
  projects (recent list + the open project) name it (`has-projects`, with the folders). Moving a
  project to another channel comes with the UI. Deleting a channel also deletes its secrets.
- **New projects.** `NewProjectRequest.channelId` (omitted = default channel). Style precedence:
  the form's style → the channel's `defaultStyle` (if the app offers it, e.g. a preview world needs
  the experimental switch) → the app's default style. `createProject({ channel })` writes
  `channelId`; the summary and the recent list expose it.
- **Taste.** The default channel keeps the app-wide `taste.json` (what was learned before 3.1 stays
  in use); a new channel gets `tasteProfile = <its id>` → `taste-<id>.json`, with `tastePerWorld`
  `taste-<id>--<style>.json` (a channel without its own profile, i.e. the default one, splits into
  `taste--<style>.json`, leaving `taste.json` as it is). TasteService resolves the file per film from
  `project.json` (channel + style) and channels.json on every use (`main/taste/taste-scope.ts`);
  `tasteLearning` is the channel's on/off switch (absent = the app setting `taste.learning`).
- **Secrets.** `<userData>/channel-secrets.bin.json` (version 1, schema in shared):
  `{ secrets: { <channelId>: { 'elevenlabs-api-key': <base64 of safeStorage ciphertext> } } }`.
  Electron `safeStorage` (DPAPI on Windows) encrypts; if `isEncryptionAvailable()` is false, or on
  Linux the backend is `basic_text`/`unknown`, nothing is stored (`encryption-unavailable`) — there
  is no plain-text fallback. `get` (decrypt) exists for main-process callers only (13.14).
- **IPC.** `channels:list|create|update|delete|reorder` answer with the whole list (each channel
  with `isDefault` and `secrets: { 'elevenlabs-api-key': boolean }`); `channel-secrets:set|has|delete`
  answer `{ status: 'ok', present }` as strict objects, so a value slipped into a response fails the
  preload's validation. Requests are strict; the router's "invalid request" log line carries zod's
  issue text, which does not echo input values. A canary test scans every response, every log line
  and every file written under userData and the project folder.

## Consequences

- The app keeps behaving as before when nothing about channels is used: projects without
  `channelId` resolve to the default channel; new projects now record `channelId: "default"`.
- Secrets survive only on the machine/user profile that encrypted them (DPAPI); a moved profile
  must re-enter keys (the file then reports `corrupt` on decrypt and the key can be set again).
- Network use stays out of this ADR: the store makes no requests. The ElevenLabs exception of
  CLAUDE.md §3.4 is decided with 13.14.
