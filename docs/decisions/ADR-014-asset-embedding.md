# ADR-014: Assets as scene elements (PLAN 12.11)

Status: accepted (2026-10-04). Code: manifest schema `packages/shared/src/render-manifest.ts`
(`assets`); decoding `packages/pipeline/src/assets/` (`decode.ts`, `pixels.ts`, `refs.ts`,
`manifest-assets.ts`); stylisation and `ctx.assets` `packages/engine/src/assets/` (`stylize.ts`,
`library.ts`, `api.ts`); kit handle and props `packages/kit/src/assets/` (`handle.ts`,
`picture.ts`, `frames.ts`, `screens.ts`), retro-ui `photo.ts` (+ browser, document, crt), diorama
`pictures.ts` (+ city, office). Guide: `docs/assets.md` → "In scenes". Tests: engine
`src/assets/*.test.ts`, `src/lint/lint-assets.test.ts`; pipeline `src/assets/*.test.ts`,
`src/export/cache-key-assets.test.ts`, `src/export/asset-parity.integration.test.ts`; kit render
`test/render/kit-assets.test.ts` (goldens `asset-*`).

## Context

Photos and video stills from the asset store (12.9/12.10, the user's own in 12.12) must appear
inside a look's world - on a laptop, in a frame, on a billboard, in a newspaper - and still look
like the film: pixelised, in the style palette, dithered. Scenes are pure functions of t in a
sandbox without network or files (ADR-004), preview must equal export (§3.3) and the same input
must give the same bytes on every machine.

## Decisions

- **Decode outside the sandbox, with ffmpeg, once.** The manifest builders (app
  `project-manifest.ts`, CLI `withManifestAssets`) ship only the refs a scene or project prop names
  as a string literal (`'nasa-apollo'`, video still `'nasa-launch@12.5'`, no `@` = middle frame).
  ffmpeg (already required; no new dependency) decodes with bit-exact flags (`-flags:v +bitexact
  -idct simple`, `-sws_flags bitexact+accurate_rnd+full_chroma_int`) into PAM; the demuxer is
  forced from the verified MIME and `-protocol_whitelist file` keeps ffmpeg on local files.
  `normalizeRaster` (integer area average, alpha over black) bounds the picture to 640 px. The
  result is cached as `.reelforge/assets/decoded/<sha256>[-at<ms>]-640-v1.pam` (git-ignored),
  so every later render reads the same bytes without ffmpeg. The manifest carries base64 RGB
  (`assets[]`: ref, id, file, mime, sha256, at, width, height, rgb); without references the
  manifest is unchanged.
- **Stylise inside the engine, as pure integer code.** `ctx.assets.image(ref, { crop, contrast,
  dither, tones })` (build only) returns a handle; props ask it for pixels at their slot size:
  crop (`cover`, `center` = letterbox, `{ focus, zoom }`, no ML) → area-average resample →
  contrast stretch (2-98 % luma) → Bayer offsets (style matrix size) → palette snap through the
  post-fx LUT (`palette.ts`). Results are memoised per runtime (picture, options, size, colours).
  Looks can ask for any colour list (retro-ui maps onto its roles) or for luminance only (newsprint
  halftone and dossier mugshots dither it onto their own ramps).
- **Disk cache = decoded source, not stylised pixels.** The packet asked for stylised files under
  `.reelforge/assets/stylized/`; the sandboxed engine cannot write files and the stylisation
  depends on sizes props choose at build time, while the expensive, platform-sensitive step is
  the decode. Stylising a slot takes milliseconds and is cached in memory.
- **Props show pixels, not images.** `createPicturePlane` uploads palette bytes to a nearest
  DataTexture (unlit for screens/billboards, Lambert for prints); screen effects (scanlines,
  flicker, scan-in, polaroid develop) step pixels to a darker colour of the same list, so the vibe
  guard passes by construction. Voxel props: `photoFrame`, `polaroid`, `billboard`,
  `assetScreen` (the kit's monitor/laptop). Retro-ui: `asset` on `retroBrowser`,
  `retroDocument`, `retroCrt`. Diorama: `dioramaCity({ billboard })`, `dioramaOffice({ screen
  })`. Without an asset every template renders exactly as before (goldens unchanged).
- **Scenes cannot decode on their own.** The lint rejects `Image`, `createImageBitmap`,
  `ImageDecoder`, `VideoDecoder`, `OffscreenCanvas`, `FileReader`, `Blob`, `Response` and Three.js
  loaders (`ctx.three.TextureLoader`...), with a fix pointing at `ctx.assets.image`; the frame's CSP
  blocks images and network anyway.
- **Export cache.** A segment key includes, for the refs its scene (or the project props it calls)
  names: ref, sha256, still time, decoded size and the decoder version; stylisation options are
  in the scene source, the stylising code in the engine/kit versions (kit 0.4.0).

## Consequences

- Real video playback is out of scope: a video is one still per ref (`id@seconds`).
- The app's manifest builder uses the default ffmpeg lookup (REELFORGE_FFMPEG, PATH, common
  dirs), not the path configured in Settings (follow-up); once decoded, no ffmpeg is needed.
- JPEG/WebP decoding is pinned by the ffmpeg flags and then by the cache; two machines with
  different ffmpeg builds could decode a lossy file differently the first time (lossless PNG
  cannot differ).
