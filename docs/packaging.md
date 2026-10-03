# Packaging (Windows x64, NSIS) — PLAN.md#9.3

ReelForge ships as an unsigned (by default) per-user NSIS installer built with
[electron-builder](https://www.electron.build/) 26.17.0. Config: `apps/desktop/electron-builder.config.ts`;
build steps: `apps/desktop/scripts/packaging.ts`.

## Commands

| Command | Output | Notes |
|---|---|---|
| `pnpm package` | `apps/desktop/release/win-unpacked/ReelForge.exe` | Builds the app + CLI bundle, then the unpacked app (`--dir` target). |
| `pnpm dist` | `apps/desktop/release/ReelForge-Setup-<version>-x64.exe` | Same, plus the NSIS installer. |
| `pnpm test:packaged` | screenshots, frames and logs in `apps/desktop/out/test-packaged/` | Smoke test of the packaged app (below). Not part of CI. |
| `pnpm --filter @reelforge/desktop icon` | `apps/desktop/build-resources/icon.{png,ico}` | Regenerates the app icon (only after changing `scripts/icon-art.ts`; the files are committed). |

`apps/desktop/release/` is git-ignored. CI does not build installers (`pnpm build` stays fast). The
first `pnpm dist` downloads the NSIS toolset (~2 MB) into electron-builder's cache
(`%LOCALAPPDATA%\electron-builder\Cache`). Electron itself is taken from `node_modules/electron/dist`
(`electronDist`), never downloaded by the build.

## What is in the package

```
ReelForge.exe, *.dll, *.pak, locales/{en-US,pl}.pak, LICENSES.chromium.html   Electron 44 runtime
resources/app.asar        package.json + out/{main,preload,renderer,demo} (bundled code, no node_modules, no source maps)
resources/hooks/          bash-guard.mjs  — Claude Code's PreToolUse hook (run by Claude, real file)
resources/cli/            reelforge.mjs   — the `reelforge` CLI bundle (run by Claude via the PATH shims, real file)
resources/template/       project/{CLAUDE.md,.gitignore,project.json}, styles/<id>/STYLE.md
Uninstall ReelForge.exe   (installed app only)
```

- **Staged app.** `scripts/packaging.ts` copies the built `out/{main,preload,renderer,demo}` and a
  dependency-free `package.json` into `out/package/app` (`directories.app`), so sources, tests,
  spikes, caches, `out/test-app` and `node_modules` cannot end up in the package. Everything the app
  needs at runtime is bundled by esbuild/Vite; there are no native modules.
- **No rebuild / no node_modules.** `beforeBuild` resolves `false`: electron-builder neither rebuilds
  nor collects node_modules. (`npmRebuild: false` is deliberately not set: it skips the
  `beforeBuild` hook, and electron-builder then packs `apps/desktop`'s own dependencies — ~56 MB.)
- **External files are real files**, not inside `app.asar`: Claude Code runs the hook and the CLI
  with the app binary as Node (`ELECTRON_RUN_AS_NODE=1`), and new projects copy the template and the
  style bibles. They are `extraResources`; nothing in `app.asar` is run by another process, so no
  `asarUnpack` is needed. `AppLayout` (`src/main/app-paths.ts`) resolves them under
  `process.resourcesPath` when packaged and under `apps/desktop/out/` in dev.
- **Not included:** fake-claude, Playwright, esbuild, ffmpeg, whisper.cpp, Whisper models. ffmpeg is
  an external binary the user points to (GPL builds must not be bundled, `docs/licenses.md`);
  whisper.cpp and its models are downloaded on demand into the user's data folder
  (`%LOCALAPPDATA%\ReelForge\whisper`, ≈ 600 MB, hash-checked; `docs/whisper.md`). The `ffmpeg.dll`
  next to the exe is Chromium's own media library that ships with Electron, not the pipeline's ffmpeg.
- `default_app.asar` (Electron's sample app) is removed in `afterPack`; Chromium locales are trimmed
  to `en-US` and `pl` (`electronLanguages`).
- **Electron fuses** keep their defaults. `RunAsNode` must stay enabled: the bash guard and the
  `reelforge` launchers run on `ReelForge.exe` with `ELECTRON_RUN_AS_NODE=1`.

### Sizes (0.0.0, Electron 44.4.5, 2026-10-02)

| | Size |
|---|---|
| Installer `ReelForge-Setup-0.0.0-x64.exe` | 97.9 MB |
| Unpacked / installed app | 330 MB |
| — `ReelForge.exe` (Electron/Chromium) | 234.6 MB |
| — `dxcompiler.dll` + `dxil.dll` (Chromium WebGPU shader compiler) | 26.0 MB |
| — `LICENSES.chromium.html` (required notices) | 19.5 MB |
| — `resources.pak`, `icudtl.dat`, `*.pak`, snapshots | ~25 MB |
| — `vk_swiftshader.dll`, `d3dcompiler_47.dll`, `vulkan-1.dll`, `ffmpeg.dll` | ~13.7 MB |
| — `resources/app.asar` (main + preload + renderer incl. three.js + engine frame + demo) | 8.1 MB |
| — `resources/cli` + `hooks` + `template` | 1.6 MB |

The Electron runtime is ~97 % of the size; our code is ~10 MB. Trimmed: node_modules (~56 MB that
electron-builder would otherwise pack), source maps (9.5 MB), unused locales (49 MB → 1.3 MB),
`default_app.asar`. Left alone on purpose: the DirectX/WebGPU and SwiftShader DLLs (GPU fallbacks),
the Chromium license file.

## Installer behaviour

- Assisted (not one-click) NSIS installer, **per-user** (no admin rights), default folder
  `%LOCALAPPDATA%\Programs\ReelForge`; the user can choose another folder.
- Desktop and Start-menu shortcuts named "ReelForge". Shortcut AppUserModelID = `appId`
  `com.reelforge.app` = `APP_USER_MODEL_ID` of the app (taskbar grouping).
- Silent install / uninstall (used by `pnpm test:packaged`):
  `ReelForge-Setup-<v>-x64.exe /S /D=C:\Some Folder\ReelForge` (`/D=` last, unquoted) and
  `"<folder>\Uninstall ReelForge.exe" /S`. A silent install does not start the app.
- Uninstall removes the program folder, the shortcuts and the
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\<guid>` entry. User data
  (`%APPDATA%\ReelForge`: settings, logs, Whisper models) and video projects are **kept**.
- Windows itself may leave a Start-menu tile cache key
  (`HKCU\...\CurrentVersion\Start\TileProperties\W~com.reelforge.app`) after uninstall; harmless.

## No auto-update

v1 is for personal use (PLAN.md §8 risks, ToS). There is no update channel: `electron-updater` is
not a dependency, `publish: null`, no `latest.yml`/blockmaps (`differentialPackage: false`), no
`elevate.exe` helper. A new version is installed by running a newer installer over the old one
(same `appId`, same per-user folder).

## Code signing

Builds are **unsigned** by default. Windows SmartScreen then shows "Windows protected your PC" on
the first run of the installer (More info → Run anyway), and some antivirus tools are stricter with
unsigned binaries. That is acceptable for personal use. To sign a release build:

**Never commit certificates, `.pfx` files, passwords or Azure secrets.** Pass them through the
environment of the build machine (or CI secrets) only.

### OV/EV certificate (`.pfx` / `.p12`)

```sh
# Git Bash; the certificate stays outside the repo
export CSC_LINK="C:/secure/reelforge-codesign.pfx"   # or a base64 string / https URL
export CSC_KEY_PASSWORD="…"
pnpm dist
```

electron-builder signs `ReelForge.exe`, the uninstaller and the installer with `signtool` (SHA-256,
timestamped). `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` take precedence over `CSC_*` if both are set.
EV certificates usually live on a hardware token / cloud HSM; use the vendor's signing tool through
`win.signtoolOptions.sign` (a custom sign function) or `win.signtoolOptions.certificateSubjectName` /
`certificateSha1` for a certificate in the Windows store. SmartScreen reputation is built up over
downloads of signed files, so a freshly signed release may still show the warning for a while.

### Azure Trusted Signing

Add to `win` in `electron-builder.config.ts` (values from the Azure portal):

```ts
azureSignOptions: {
  endpoint: 'https://<region>.codesigning.azure.net',
  codeSigningAccountName: '<account>',
  certificateProfileName: '<profile>',
  publisherName: '<subject CN of the certificate>',
},
```

and provide the service principal through the environment (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`,
`AZURE_CLIENT_SECRET`, read by Azure.Identity's EnvironmentCredential). electron-builder installs
the `TrustedSigning` PowerShell module for the current user on first use and signs with
`Invoke-TrustedSigning`. `azureSignOptions` and `signtoolOptions` are mutually exclusive.

Verify a signed build: `Get-AuthenticodeSignature .\ReelForge-Setup-<v>-x64.exe` (PowerShell) or
`signtool verify /pa /v <file>`.

## Packaged smoke test (`pnpm test:packaged`)

`apps/desktop/test/packaged/`:

- `unpacked.packaged.test.ts` (needs `pnpm package`) and `installer.packaged.test.ts` (needs
  `pnpm dist`; skipped without an installer) run the same checks (`packaged-checks.ts`) on
  `ReelForge.exe` through Playwright:
  window + non-blank demo preview; `isPackaged` and the temporary profile; bash guard (allows
  `reelforge …`, blocks others) and `reelforge kit-docs` on the app binary; the PATH launchers
  (`reelforge.cmd`, and the sh launcher through Git Bash if installed) pointing at the packaged CLI;
  the Claude Code detection in the status bar and Settings (`claude --version` / `claude auth status`
  only, never a model call); a new project gets `CLAUDE.md` and `styles/<id>/STYLE.md`; `reelforge
  frames` through the cmd launcher renders a non-blank frame of that project via the app's render
  service.
- The installer test installs silently into a temp folder with a space and a Polish letter, checks
  the shortcuts and the HKCU uninstall entry, runs the checks on the installed exe, uninstalls
  silently and checks that folder, shortcuts and uninstall entry are gone. It refuses to run if
  ReelForge is already installed (shortcuts exist) or running.
- The app runs with `--user-data-dir=<temp>` (honoured in packaged builds too), so the real
  `%APPDATA%\ReelForge` is never touched, and with `REELFORGE_TEST_HOOKS=1`, which in a packaged
  build only exposes the render service env (what the app gives Claude's processes anyway) to code
  already running in the main process.

Not covered automatically: a clean VM without Node/git/Claude (PLAN.md#9.3 AC). On such a machine
the app runs (Electron is self-contained), but creating projects needs git and the pipeline needs
the external tools (Settings → Tools).
