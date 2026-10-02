# @reelforge/project

Video project folders (PLAN.md §3.1, #6.2), Electron-free (used by the desktop main process; usable
by the CLI and orchestration). Every failure is a typed `Result` (`ProjectError.kind`).

| Area    | Exports                                                                                   |
| ------- | ----------------------------------------------------------------------------------------- |
| Folders | `createProject`, `openProject` (zod + `PROJECT_MIGRATIONS` hook), `projectFolderName`     |
| Recent  | `listRecentProjects`, `rememberRecentProject`, `forgetRecentProject`, `findRecentProject` |
| History | `autocommit`, `history`, `diffSummary`, `revertTo`, `revertFile`                          |
| Git     | `runGit`, `ensureIdentity`, `initRepository`, `clearIndexLock`                            |

- **New project** = `templates/project/` (`CLAUDE.md` and `.gitignore` copied verbatim,
  `project.json` merged with title/language/style/seed) + `scenes/ audio/ timing/ out/`,
  `git init --initial-branch=main`, first commit.
- **Tracked**: everything authored (`project.json`, `brief.json`, `research.md`, `script.txt`,
  `beats.md`, `timing/`, `storyboard.json`, `cues.json`, `scenes/`, `CLAUDE.md`). **Ignored**:
  `audio/**` (except `.keep`), `out/`, `.reelforge/` (sessions, pipeline queue, usage, caches,
  frames, debug dumps), `*.tmp`.
- **Commits** carry trailers `ReelForge-Step: <id>` and `ReelForge-Kind: <kind>` (`create`,
  `pipeline-step`, `claude-turn`, `manual`, `revert`; + `ReelForge-Revert-Of: <hash>`); commits
  made outside the app show as `external`. Nothing changed → `nothing-to-commit`, no empty commits.
- **Revert** never rewrites history: uncommitted changes are committed first (`auto-save`), then the
  tree of the target commit is restored (`git restore --source`) and committed as a new commit; on
  failure the index and working tree are put back to HEAD.
- **Git**: spawned without a shell, `-C <project>`, repo-location env vars (`GIT_DIR`, …) removed,
  per-command `core.autocrlf=false` (byte-exact restores), `commit.gpgsign=false`. If git has no
  identity, `ReelForge <reelforge@local>` is set in the project repo's local config only.
- **Concurrency**: operations on one project are serialized in-process; a `.git/index.lock` older
  than 30 s is treated as stale and removed, a fresh one is waited for (3 s) → `locked`.
