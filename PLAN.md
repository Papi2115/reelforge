# ReelForge — PLAN.md

Legenda ról przy taskach: **[S]** Sonnet 5.5 (manager) · **[O]** Opus 5.5 (coder) · **[H]** Haiku (scout/runner). Format taska: `- [ ] **id** [rola] opis — AC: kryterium`.
Manager hakuje checkboxy dopiero po spełnieniu AC i zielonej weryfikacji (patrz `CLAUDE.md` §2).

**Bieżąca faza: 13 (wersja 3.0 „Światy”) — wydane 2.0–2.3.7; fundamenty światów zatwierdzone 2026-10-06 (docs/worlds/DECISIONS.md); implementacja do startu po decyzjach Papiego**

---

## 1. Cel i zakres

**Cel:** Papi wpisuje 2–5 zdań o czym ma być film → dostaje scenariusz → dodaje własny voiceover → aplikacja czyści audio, timestampuje słowa, układa storyboard i **buduje całą animację 3D** (unikatowy styl voxel/pixel-art jak w referencjach: kalkulator na ławce, grid neonowy, latające kostki, bohater-voxel, chunky typografia) → miks dźwięku → eksport MP4 1080p (opcjonalnie 4K) gotowy na YouTube.

**Mapa funkcji z referencji → fazy**

| Funkcja (screeny) | Faza |
|---|---|
| Lista etapów: Script written / Voiceover added / Audio cleaned / Words timed / Storyboard / Scenes built / Sound design / Video exported (+ Open / Replace / Run / Redo) | 6.8, 7 |
| Panel Shots (tekst + czas + plik sceny), podgląd, odtwarzacz 0.5×–2×, snapshot klatki | 6.3, 6.4 |
| Timeline: Shots / Narration / Cues / Audio / Cards / Ambience, scrub z dźwiękiem, zoom | 6.5 |
| Czat Claude: Chat/History, kroki narzędzi, miniatury klatek ("Rendering frames at 4.8s…"), kolejka, Stop | 5.3, 6.6 |
| Zakres zmiany: Selection / Shot / Whole video + chipsy sugestii | 6.6, 7.6 |
| Preset stylu "Pixel art · Crisp 640" | 2.3, 3.5 |
| "Saved locally · git history" | 6.2 |
| Eksport | 4.7, 9 |

**Poza zakresem v1 (non-goals):** generowanie głosu (TTS) — tylko własny VO; modele wideo AI (Kling itp.); publikacja na YouTube; edycja wielościeżkowa jak w Premiere; macOS/Linux (po v1); jakiekolwiek API płatne per token.

---

## 2. Kluczowe decyzje architektoniczne

| # | Decyzja | Dlaczego |
|---|---|---|
| D1 | **Electron + React + TS + Vite**, pnpm monorepo | Chromium w pakiecie (WebGL do renderu), Node do ffmpeg/whisper/CLI, jeden język. Tauri odrzucony: brak gwarantowanego Chromium/WebGL na Windows i trudniejszy render offscreen. |
| D2 | **Three.js** w sandboxowanym iframe, sceny = moduły ES (JS) generowane przez Claude'a | LLM pisze Three.js najlepiej; sceny to zwykłe pliki → diff/git/hot-reload. |
| D3 | **Render w niskiej rozdzielczości (640×360) → upscale `neighbor` ×3 do 1080p (×6 = 4K)** | Autentyczny pixel-art "Crisp 640", ~9× mniej pikseli = szybki render i podgląd 30 fps; całkowite skalowanie = zero rozmycia. |
| D4 | **Deterministyczny silnik** (`seek(t)` → klatka) | Podgląd = eksport, równoległy render po shotach, cache klatek, golden testy. |
| D5 | **Claude przez lokalny `claude` CLI** (`-p`, `stream-json`, `--resume`, `--model`) | Jedyna dozwolona droga na subskrypcji: uruchamiamy prawdziwe binarium; żadnych tokenów/API (CLAUDE.md §3.1). |
| D6 | **whisper.cpp** lokalnie + alignment do skryptu | Słowa z timestampami bez API; alignment daje tekst wierny skryptowi. |
| D7 | **ffmpeg** (zewnętrzne/LGPL binarium) do audio i mux | Standard; pełna kontrola filtrów (`afftdn`, `loudnorm`, `sidechaincompress`). |
| D8 | **Projekt wideo = folder + git** | Historia/undo za darmo ("git history"), diffy scen, bezpieczne eksperymenty Claude'a. |
| D9 | **Kit (biblioteka propsów/efektów/kamer) zamiast surowego Three.js w scenach** | Spójny styl, mniej tokenów, mniej błędów; Claude komponuje, a gdy brakuje propsa → zlecenie dobudowania go do kitu. |
| D10 | **Sceny referują słowa przez *anchory*** (`ctx.anchor("spec sheet")`) | Animacja trafia w wypowiedziane słowo; zmiana VO nie rozwala synchronizacji. |

### 2.1 Podłączenie subskrypcji ("proste podlaczenie")
Wizard w Settings → **Połącz Claude**:
1. Wykryj `claude` (PATH + typowe katalogi instalacji Windows), sprawdź wersję ≥ min.
2. Brak → pokaż jedną komendę instalacji i przycisk "Sprawdź ponownie".
3. Sonda auth (minimalne `claude -p` z krótkim promptem, bez kosztownego modelu). Niezalogowany → przycisk otwierający terminal z `claude` (login robi sam Claude Code).
4. Status "Połączono" + wersja. **Aplikacja nigdy nie dotyka poświadczeń.** Env potomnych procesów oczyszczone z zmiennych API (CLAUDE.md §3.1).
5. Dystrybucja innym użytkownikom to szara strefa ToS → v1 = użytek własny; przed publicznym wydaniem decyzja Papiego (patrz §10).

### 2.2 Modele w aplikacji (domyślne, konfigurowalne per etap)
Skrypt/research: Sonnet · Storyboard: Sonnet · **Kod scen i propsów: Opus** · Krytyk klatek / triage: Haiku · Czat edycyjny: Sonnet (przełącznik na Opus dla "zrób to ładniej / napraw trudne").
Tryb **Economy**: wszystko Sonnet, krótsze storyboardy, 1 iteracja QA. Aplikacja pokazuje zużycie per projekt/etap i obsługuje limity (5.4).

---

## 3. Pipeline (etapy → pliki)

| Etap | Model/narzędzie | Wejście → wyjście |
|---|---|---|
| Script | Sonnet (+WebSearch/WebFetch) | `brief.json` → `research.md` (źródło przy każdym fakcie), `script.txt` (tylko tekst mówiony), `beats.md` |
| Voiceover | użytkownik (import/nagranie) | `audio/vo.original.*` |
| Audio cleaned | ffmpeg | → `audio/vo.clean.wav` (48 kHz, raport LUFS przed/po) |
| Words timed | whisper.cpp + alignment | `vo.clean.wav` + `script.txt` → `timing/words.json` |
| Storyboard | Sonnet | script + words + styl + katalog kitu → `storyboard.json` |
| Scenes built | Opus (+Haiku QA) | storyboard → `scenes/sNN_slug.js` (+ nowe propsy w kicie) |
| Sound design mixed | Sonnet (cues) + ffmpeg | `cues.json` + SFX/ambient/muzyka → `audio/mix.wav` |
| Video exported | engine + ffmpeg | wszystko → `out/<title>.mp4`, `out/chapters.txt`, `out/thumb.png` |

### 3.1 Struktura projektu wideo
```
<project>/
  project.json            # wersja, tytuł, język, styl, modele per etap, fps
  brief.json  research.md  script.txt  beats.md
  audio/ vo.original.* vo.clean.wav mix.wav music/ sfx/
  timing/ words.raw.json words.json
  storyboard.json         # shots: id, t0,t1 (z anchorów), treatment, intent, props, camera, palette, cues
  cues.json               # SFX/ambience/music + ducking
  scenes/ s01_intro.js …  # moduły scen (edytowane przez Claude'a)
  CLAUDE.md               # kontekst runtime'owego Claude'a (z templates/project)
  .reelforge/ cache/ sessions.json usage.json
  out/
  .git/
```

### 3.2 Kontrakt sceny (runtime Claude pisze TYLKO to)
```js
// scenes/s03_calc_desk.js
export const meta = { id: "s03", title: "Calculator on exam desk", treatment: "metaphor-object" };

export function build(ctx) {          // raz: złóż graf sceny z kitu
  const { kit, palette, anchor, sfx, rng } = ctx;
  const desk = kit.env.desk({ wood: palette.wood });
  const calc = kit.props.calculator({ screen: "doom" }).on(desk);
  const hit = anchor("61 KB");        // { t, tEnd } z words.json
  sfx.at(hit.t, "hit");               // cue trafia do cues.json
  return { desk, calc, hit };
}

export function update(t, s, ctx) {   // czysta funkcja czasu lokalnego t
  ctx.camera.pushIn({ from: 0, to: s.hit.t, dist: [6, 3.5] })(t);
  s.calc.screen.glitch(t > s.hit.t ? 1 : 0);
}
```
Harness: `window.__reelforge = { load(manifest), seek(t) → Promise<void>, duration, frame() }`.

### 3.3 Anchory i synchronizacja
`anchor(phrase, nth=1)` → fuzzy-match po `words.json` → `{t, tEnd}`. Zmiana VO → ponowne `words timed` → sceny same się przesuwają. Raport "Check every visual lands on its spoken word": dla każdego shotu sprawdza, czy kluczowe zdarzenia animacji mieszczą się ±150 ms od anchora.

---

## 4. Silnik 3D i styl

### 4.1 Pipeline obrazu ("Crisp 640")
Scena → `WebGLRenderTarget` 640×360 (`NearestFilter`, bez AA) → post-fx: kwantyzacja do palety (LUT), dithering Bayer 4×4/8×8, opcjonalny outline/AO-fake, scanlines, vignette → `readPixels` → (podgląd: canvas z `image-rendering: pixelated`) / (eksport: raw RGBA → ffmpeg `scale=1920:1080:flags=neighbor`).
Tekst/karty: fonty pixelowe rysowane do tego samego bufora (spójny wygląd), opcjonalna warstwa overlay w natywnej rozdzielczości (napisy).

### 4.2 Preset stylu domyślny: **Voxel Pixel · Crisp 640**
Z referencji: voxelowe propsy z płaskim cieniowaniem, neonowy grid na horyzoncie (fiolet/magenta; teal/zieleń; granat), dithered gradient nieba, pływające kostki/odłamki, bohater-voxel (pomarańczowa bluza), grube kroje tytułowe + mono do podtytułów, akcent pomarańcz/krem/slate.
Kolejne presety (3.5): **Noir Voxel** (true-crime: low-key, czerwień/bursztyn, deszcz/dym), **Soft 480** (cieplejszy, większy pixel).
**`styles/<id>/STYLE.md`** = biblia stylu czytana przez runtime Claude'a: kompozycja (reguła trójpodziału, głębia), kamera (płynne ruchy, nie statyczne >3 s), kolor (max 5 kolorów na shot z palety), typografia (safe area, max 2 poziomy tekstu), tempo (zmiana wzorca wizualnego co ≤ 6–8 s), czego unikać.

### 4.3 Taksonomia treatmentów (storyboard → sceny)
`title-card` · `metaphor-object` · `3d-reconstruction` · `map` · `node-graph/timeline` · `data-chart-3d` · `counter/odometer` · `ui-mockup` · `character-scene` · `kinetic-text` · `montage/transition`. Storyboard nie powtarza tego samego treatmentu >2× z rzędu.

### 4.4 Pętla QA sceny (zbudowana w 7.4–7.5)
`lint determinizmu` → `smoke render` w 5 punktach (bez błędów konsoli) → **sprawdzenia programowe** (klatka nie pusta/nie jednolita, tekst w safe area, brak nakładania kart — z API pomiaru tekstu) → **Haiku krytyk** (JSON: `blank | clipped | overlap | off-intent | ok`, +uwaga) → naprawa przez Opusa (≤2 iteracje) → shot oznaczony ✓/⚠.

---

## 5. Struktura repo
```
reelforge/
  CLAUDE.md  PLAN.md  README.md
  .claude/ settings.json agents/{coder,scout}.md
  apps/desktop/ src/{main,preload,renderer}
  packages/{engine,kit,pipeline,claude-bridge,prompts,shared}/
  styles/voxel-pixel-crisp640/ {style.json, STYLE.md}
  templates/project/ {CLAUDE.md, project.json, …}
  tools/fake-claude/
  docs/ {spikes,decisions,kit-catalog.md,licenses.md}
  .github/workflows/ci.yml
```

---

## 6. Fazy i taski

### Faza 0 — Bootstrap repo
- [x] **0.1** [S] Zapytaj Papiego (AskUserQuestion): nazwa repo (domyślnie `reelforge`), widoczność (domyślnie **private**), konto/org GitHub. — AC: decyzja w CLAUDE.md §8.
- [x] **0.2** [O] `git init -b main`, `.gitignore` (node_modules, out, cache, modele whisper, projekty wideo), pnpm workspace, TS base (`strict`), ESLint + Prettier, Vitest, `.editorconfig`, skrypty z CLAUDE.md §5 (stuby), README. — AC: `pnpm install && pnpm typecheck && pnpm lint && pnpm test` zielone na Windows.
- [x] **0.3** [O] GitHub Actions: typecheck+lint+test na `windows-latest` i `ubuntu-latest`. — AC: workflow przechodzi lokalnie (`act`) lub składniowo, plik w repo.
- [x] **0.4** [S] Sprawdź `gh auth status`; `gh repo create <nazwa> --private --source=. --remote=origin --push`; pierwszy commit `chore: bootstrap`; branch `phase-1/spikes`. Brak `gh` → podaj Papiemu 3 komendy do ręcznego wykonania. — AC: `git remote -v` pokazuje origin, push OK.
- [x] **0.5** [H] Odpal pełny toolchain i zraportuj wersje (node, pnpm, ffmpeg?, git, gh, claude) oraz czego brakuje na maszynie Papiego. — AC: digest w `docs/environment.md`.

### Faza 1 — Spike'i (go/no-go; wyniki w `docs/spikes/`)
- [x] **1.0** [H] Zrzuć `claude --help`, `claude -p --help` i docs headless/CLI do `docs/spikes/00-claude-help.md` (fakty do weryfikacji flag). — AC: plik istnieje, flagi z CLAUDE.md §3.1 potwierdzone/zaprzeczone.
- [x] **1.1** [O] **Spike CLI-bridge**: spawn `claude -p` ze `stream-json`; `--resume`; `--model` (opus/sonnet/haiku); `--allowedTools`, `--permission-mode`, `--append-system-prompt`; cwd = folder projektu; czytanie PNG z folderu projektu przez narzędzie Read; oczyszczone env; Windows (`.cmd`/`.exe`, kill tree); kształt błędów: niezalogowany i limit użycia; czas zimnego startu. — AC: `docs/spikes/01-claude-cli.md` z werdyktem + działający minimalny skrypt demonstracyjny.
- [x] **1.2** [O] **Spike render**: scena Three.js 640×360 `Nearest` + dithering; `seek(t)` dwukrotnie → identyczny hash klatki; `readPixels` → ffmpeg `rawvideo` → MP4 1080p (`neighbor`); porównanie: ukryte okno Electron vs Playwright Chromium; GPU vs SwiftShader; pomiar fps. — AC: `docs/spikes/02-render.md` + MP4 10 s; cel ≥ 100 fps renderu na laptopie Papiego (lub raport ile).
- [x] **1.3** [O] **Spike audio**: łańcuch ffmpeg (highpass, `afftdn`, opcj. `arnndn`, `loudnorm`) na 3 próbkach VO; whisper.cpp word timestamps (PL i EN, modele small/medium); alignment do skryptu; WER i czasy. — AC: `docs/spikes/03-audio.md` + rekomendacja modelu.
- [x] **1.4** [S] Przegląd spike'ów → ADR w `docs/decisions/`; popraw `PLAN.md` jeśli któraś decyzja D1–D10 upadła; jeśli spike padł → zapytaj Papiego. — AC: ADR-001…003, faza 2 odblokowana.

### Faza 2 — Silnik (`packages/engine`)
- [x] **2.1** [O] Kontrakt sceny + loader modułów (iframe sandbox, bez dostępu do Node), typy w `shared`. — AC: przykładowa scena ładuje się i renderuje.
- [x] **2.2** [O] Zegar/`seek`, seeded RNG (mulberry32), mapowanie t globalny→lokalny shotu, przejścia (cut, crossfade, glitch, wipe). — AC: testy determinizmu (hash klatki stabilny).
- [x] **2.3** [O] Post-fx pixel-art: low-res RT, paleta LUT, Bayer dithering, outline, scanlines; presety JSON. — AC: golden frames dla 3 presetów.
- [x] **2.4** [O] Rigi kamery: dolly, orbit, push-in, crane, shake (seeded), look-at. — AC: test ruchu (pozycje w t=0/0.5/1).
- [x] **2.5** [O] System tekstu: pixel fonty (OFL), title/lower-third/kinetic, API pomiaru + safe area + wykrywanie kolizji kart. — AC: test: nakładające się karty zgłoszone.
- [x] **2.6** [O] **Lint determinizmu** (AST): zakazane API z CLAUDE.md §3.2. — AC: testy pozytywne/negatywne, komunikaty zrozumiałe dla LLM.
- [x] **2.7** [O] Harness golden-frame: `pnpm render:frames`, `pnpm test:render` (tolerancja per-pixel konfigurowalna). — AC: dokumentacja w `docs/`.
- [x] **2.8** [H] Przejdź wszystkie golden-framy i oceń wizualnie (puste/ucięte/artefakty). — AC: digest bez blockerów.

### Faza 3 — Kit i styl (`packages/kit`)
- [x] **3.1** [O] Narzędzia voxel: `voxelFromGrid`, instancing/greedy meshing, indeks palety per voxel, fałszywe AO. — AC: test wydajności (100k voxeli ≥ 60 fps podgląd).
- [x] **3.2** [O] Środowiska: neon grid (fiolet/teal), dithered niebo, ławka/biurko, pustka-scena, miasto z bloków, pokój. — AC: contact sheet środowisk.
- [x] **3.3** [O] Propsy v1 (~30): kalkulator, ławka, kartka, laptop, monitor, serwer, telefon, folder, gotówka/monety, walizka, stół z mapą, globus, zegar, kłódka, klucz, auto, budynek, magazyn, kontener, ciężarówka, **postać-voxel** (stand/walk/sit/point), tłum itd. Każdy z turntable testem. — AC: auto-generowany `docs/kit-catalog.md` z miniaturami.
- [x] **3.4** [O] Efekty i infografiki 3D: pływające kostki, eksplozja odłamków, glitch/dissolve, flicker, licznik/odometr, słupki 3D, graf węzłów, animowana mapa, oś czasu. — AC: każdy efekt ma scenę-przykład + golden.
- [x] **3.5** [O] Presety stylu: Voxel Pixel · Crisp 640 (domyślny), Noir Voxel, Soft 480; tokeny palet. — AC: ta sama scena w 3 stylach.
- [x] **3.6** [S] `STYLE.md` (biblia stylu, §4.2) dla każdego presetu; spot-check wizualny względem referencji Papiego. — AC: Papi akceptuje wygląd na 3 klatkach.
- [x] **3.7** [H] QA katalogu kitu (contact sheet → lista defektów). — AC: digest.

### Faza 4 — Pipeline audio/czas/eksport (`packages/pipeline`)
- [x] **4.1** [O] Menedżer ffmpeg: wykrywanie/wskazanie binarium, parser postępu, anulowanie. — AC: testy na fixture.
- [x] **4.2** [O] **Audio clean**: presety light/standard/heavy (highpass, `afftdn`, opcj. `arnndn`, opcj. skracanie długich ciszy z limitem, `loudnorm`), raport LUFS przed/po → `vo.clean.wav`. — AC: test na 3 próbkach, LUFS w tolerancji.
- [x] **4.3** [O] whisper.cpp: pobranie modelu na żądanie (checksum), uruchomienie, word timestamps, wybór języka. — AC: `words.raw.json` zgodny ze schematem.
- [x] **4.4** [O] Alignment (Needleman–Wunsch) skrypt↔ASR → `words.json` wierny skryptowi; confidence; obszary rozbieżności. — AC: test WER na fixture < próg ze spike'a.
- [x] **4.5** [O] `resolveAnchor(phrase, nth)` fuzzy + testy (powtórzenia, interpunkcja, liczby "61 KB").
- [x] **4.6** [O] Mikser: schemat `cues.json`; SFX z syntezy `OfflineAudioContext` (receptury: whoosh/click/hit/typewriter) + sample użytkownika; ambient loops; muzyka z **sidechain ducking**; loudnorm finalny −14 LUFS; eksport stemów. — AC: render miksu 60 s deterministyczny.
- [x] **4.7** [O] **Eksport**: render równoległy po shotach (workers = rdzenie/2), cache klatek (hash: kod sceny + wersja kitu + styl + użyte anchory), concat + mux, presety 1080p30 (domyślny) / 1440p / 4K (×6), autodetekcja NVENC/QSV/AMF z fallbackiem `libx264`, wznawianie, miniatura. — AC: 2-min film eksportuje się; zmiana jednego shotu renderuje tylko ten shot.
- [x] **4.8** [H] Odpal pipeline na fixture'ach, zraportuj czasy i wąskie gardła. — AC: `docs/perf.md`.

### Faza 5 — Most do Claude (`packages/claude-bridge`, `packages/prompts`, `templates/project`)
- [x] **5.1** [O] Detekcja i wizard połączenia (§2.1). — AC: stany: brak CLI / niezalogowany / OK, testowane na `fake-claude`.
- [x] **5.2** [O] Menedżer sesji: sesja per projekt + sesje boczne (script/QA), `--resume`, model per etap, kolejka, anulowanie (kill tree), timeouty, odzyskiwanie po crashu. — AC: testy na `fake-claude`.
- [x] **5.3** [O] Parser `stream-json` → typowane zdarzenia (tekst, tool_use, tool_result, result, usage) → "kroki" jak w UI referencji. — AC: testy na nagranych strumieniach.
- [x] **5.4** [O] **Limity**: wykrycie limitu użycia/rate-limit, parsowanie czasu resetu jeśli dostępny, pauza i trwały stan pipeline'u, wznowienie; licznik zużycia per projekt/etap; budżety miękkie; tryb Economy. — AC: scenariusz "limit w połowie budowy scen" wznawia się bez utraty pracy.
- [x] **5.5** [S] **Szablon `templates/project/CLAUDE.md`** dla runtime'owego Claude'a: kontrakt sceny, auto-generowane API kitu, wskaźnik do `STYLE.md`, zakazane API, jak robić self-QA (`reelforge frames/lint/anchors`), co wolno edytować (`scenes/`, `storyboard.json`, `script.txt`, `cues.json`), czego nie (`project.json`, audio, engine). — AC: Papi przegląda treść.
- [x] **5.6** [O] CLI **`reelforge`** (dla runtime Claude'a przez allowlistę Bash): `frames --at`, `contact-sheet`, `lint`, `validate`, `anchors`, `render-shot`, `kit-docs`, `status`. — AC: każda komenda ma testy i czytelne błędy.
- [x] **5.7** [O] Uprawnienia per etap: `--allowedTools "Read,Edit,Write,Glob,Grep,Bash(reelforge:*)"` (+`WebSearch,WebFetch` tylko w Script), blokada wyjścia poza folder projektu, `--add-dir` kitu read-only. — AC: test: próba edycji poza projektem odrzucona.
- [x] **5.8** [S] Biblioteka promptów etapów (script, research, storyboard, scene-build, scene-fix, critic, sound-cues) w `packages/prompts` + **evale** (briefy fixture → wyjście zgodne ze schematem). — AC: evale odpalane na `fake-claude` w CI, na prawdziwym ręcznie.
- [x] **5.9** [O] **`tools/fake-claude`**: atrapa CLI odtwarzająca nagrane `stream-json` (w tym limit i błędy). — AC: testy bridge'a i e2e nie wołają prawdziwego Claude'a.

### Faza 6 — Aplikacja desktop (`apps/desktop`)
- [x] **6.1** [O] Szkielet Electron (`contextIsolation`, brak `nodeIntegration` w rendererze, bezpieczne IPC, sceny w sandboxowanym iframe). — AC: `pnpm dev` otwiera okno.
- [x] **6.2** [O] Menedżer projektów: nowy/otwórz, `git init`, autocommit po kroku pipeline'u i turze Claude'a, panel historii + revert ("Saved locally · git history"). — AC: revert przywraca scenę.
- [x] **6.3** [O] Layout: lewy panel (pipeline + shoty), środek (podgląd), prawy (czat Claude), dół (timeline). Ciemny motyw jak w referencji. — AC: responsywny od 1280 px.
- [x] **6.4** [O] Odtwarzacz: zegar nadrzędny = element audio, scrub z dźwiękiem, 0.5×–2×, snapshot klatki, **hot-reload sceny** po zmianie pliku (przebudowa tylko zmienionego shotu). — AC: edycja sceny widoczna w podglądzie < 1 s.
- [x] **6.5** [O] Timeline (Shots/Narration/Cues/Audio/Cards/Ambience): zoom, zaznaczanie, przesuwanie granic shotów z przyciąganiem do słów, edycja cue'ów, waveform. — AC: przesunięcie granicy aktualizuje `storyboard.json`.
- [x] **6.6** [O] Panel czatu: zakresy Selection/Shot/Whole video, **klik w podglądzie → wybór obiektu** (raycast → id/kontekst do Claude'a), kolejka, Stop, chipsy sugestii, log kroków z miniaturami klatek. — AC: zmiana "zrób ten element większy" na zaznaczonym obiekcie działa end-to-end.
- [x] **6.7** [O] Settings: Połącz Claude (§2.1), model per etap, tryb Economy, styl, język, wydajność (workery/GPU), ścieżki ffmpeg/whisper. — AC: zmiany zapisują się i działają.
- [x] **6.8** [O] Sidebar pipeline'u: statusy etapów + przyciski Open/Replace/Run/Redo, blokady zależności (nie zbudujesz scen bez storyboardu). — AC: kolejność etapów wymuszona.

### Faza 7 — Orkiestracja etapów
- [x] **7.1** [O+S] **Brief → scenariusz**: formularz (temat, długość, ton, odbiorca, język, uwagi) → research (źródła) → beat sheet → `script.txt`; licznik słów i szacunek czasu (150 wpm); edytor ze zmianami; bramka akceptacji. — AC: z 3-zdaniowego briefu powstaje skrypt ze źródłami.
- [x] **7.2** [O] Voiceover: import (wav/mp3/m4a) i nagrywanie w aplikacji; Replace; raport rozbieżności VO↔skrypt. — AC: wymiana VO → `Words timed` do ponownego uruchomienia, sceny zachowują anchory.
- [x] **7.3** [S] **Storyboard**: skrypt + words + styl + katalog kitu → `storyboard.json` (shoty na anchorach, treatment, intent, propsy, kamera, paleta, cues; zmiana wzorca wizualnego co ≤ 6–8 s; lista "brakujących propsów"). — AC: walidacja zod + brak 3× tego samego treatmentu z rzędu.
- [x] **7.4** [O] **Budowa scen**: pakiet per shot (współbieżność 2, dostosowana do limitów), każdy kończy lint + smoke-frames + Haiku-krytyk; retry ≤ 2; brakujący prop → najpierw dobudowanie do kitu (z testem). — AC: 8-shotowy film buduje się bez ręcznej interwencji.
- [x] **7.5** [O+H] Krytycy klatek: sprawdzenia programowe + Haiku JSON (§4.4). — AC: wykrywa celowo zepsute fixture'y (pusta klatka, ucięty tekst, nakładające się karty).
- [x] **7.6** [S] **Review całego filmu**: contact sheety (3 klatki/shot) → Haiku triage → Sonnet plan poprawek → Opus naprawy. Chipsy: "Review the whole video and fix what looks wrong", "Make all on-screen text easier to read on a phone", "Check every visual lands on its spoken word". — AC: akcje działają z zakresu Whole video.
- [x] **7.7** [O] Raport synchronizacji (anchory ±150 ms). — AC: raport per shot w UI.

### Faza 8 — Sound design
- [x] **8.1** [S] Generowanie `cues.json` ze storyboardu (hity na anchorach, whoosh na przejściach, ambient per scena, muzyka per akt). — AC: walidacja zod.
- [x] **8.2** [O] UI: biblioteka SFX (synth + własne pliki), ścieżki Cues/Ambience/Audio na timeline, suwaki ducking/głośności, odsłuch miksu w podglądzie. — AC: edycja cue'a słyszalna w podglądzie.
- [x] **8.3** [O] Etap "Sound design mixed": render `mix.wav`, kontrola LUFS/true peak. — AC: −14 LUFS ±1, TP ≤ −1 dB.

### Faza 9 — Eksport i paczka
- [x] **9.1** [O] Dialog eksportu: preset (1080p30/1440p/4K), kodek/enkoder, kolejka, postęp, wznawianie. — AC: eksport 10-min filmu < 20 min na laptopie z GPU (cel; zmierzony wynik w `docs/perf.md`).
- [x] **9.2** [S+O] Wyjścia dodatkowe: `chapters.txt` ze storyboardu (format YouTube), miniatura, sugestie tytułu/opisu/tagów. — AC: pliki w `out/`.
- [x] **9.3** [O] `electron-builder` (NSIS, Windows x64), brak auto-update, instrukcja podpisywania kodu. — AC: instalator działa na czystej maszynie/VM.
- [x] **9.4** [H] Audyt licencji (fonty, assety, ffmpeg, whisper, zależności npm) → `docs/licenses.md`. — AC: brak nieznanych/niekompatybilnych.

### Faza 10 — Hartowanie i v1.0
- [x] **10.1** [O] E2E (Playwright-Electron) happy path na `fake-claude` + fixture VO: brief → … → MP4. — AC: przechodzi w CI.
- [x] **10.2** [O] Odporność: crash Electrona w trakcie renderu → wznowienie; zabity proces `claude` → wznowienie tury; uszkodzony JSON → komunikat + restore z gita. — AC: testy scenariuszowe.
- [x] **10.3** [S] Onboarding: projekt przykładowy (krótki film "Doom na kalkulatorze"-style), pierwszy start prowadzi przez Połącz Claude → brief. — AC: nowy użytkownik dochodzi do MP4 bez czytania dokumentacji.
- [x] **10.4** [S] Test prawdziwy: Papi robi jeden film end-to-end na realnej subskrypcji; lista poprawek → backlog. — AC: raport z zużycia limitu na film.
- [x] **10.5** [S] Tag `v1.0.0`, release notes, README.

---

### Faza 11 — Wersja 1.2 (plan zatwierdzony przez Papiego 2026-10-03)
Kolejność: najpierw błąd P0, potem czytelność UI, potem funkcje. Zasada dla wszystkich zmian wizualnych/pipeline'u: **nie psuć obecnego wyglądu** — nowe tryby za przełącznikiem, test „bez szkody" (klatka w klatkę) na projekcie wzorcowym (film o Nokii, 16 shotów).
- [x] **11.1** [O] **BŁĄD P0: podgląd traci dźwięk po zbudowaniu całego filmu** — gra do ok. 20–30 s, potem cisza (ani VO, ani efekty); w eksporcie dźwięk jest poprawny. Zdiagnozować (podejrzenia: źródło audio w podglądzie `mix.wav` vs `vo.clean.wav`, zakresy HTTP `reelforge-media://` (limit 4 MB na odpowiedź), przeładowanie źródła po hot-reloadzie/zmianie projektu, bufor/seek elementu audio, zegar master → audio), odtworzyć testem (długi plik ≥ 90 s, odtwarzanie w czasie rzeczywistym, asercja `audio.currentTime`/`paused`/`error`), naprawić, dodać test regresyjny w `pnpm test:app`. — AC: 90-s film gra z dźwiękiem od 0 do końca w podglądzie; test regresyjny przechodzi.
- [x] **11.2** [O] **UI/UX: czytelność i intuicyjność** (styl zostaje): audyt ekranów (pipeline, kształt panelu shotów, timeline, czat, ustawienia, eksport), większe kontrasty/typografia/odstępy, jasne nazwy przycisków, stany puste z następnym krokiem, podpowiedzi, spójne ikony, skróty klawiszowe widoczne w UI, lepsze rozmieszczenie panelu pipeline vs shoty przy 1280×720, naprawa nakładającego się tekstu w panelu „Scenes built". — AC: przegląd zrzutów 1280×720 i 1920×1080 + lista zmian; test nowego użytkownika (Papi) bez dokumentacji.
- [x] **11.3** [O] **Wersje shotu do wyboru**: „Przebuduj ten shot" daje 2–3 warianty obok siebie (miniatury/odtwarzanie w podglądzie), wybór jednego zapisuje scenę i resztę odrzuca (historia w git). — AC: wybór wariantu działa end-to-end na fake-claude i na realnym przebiegu.
- [x] **11.4** [O] **Blokowanie shotów (zamek)**: zatwierdzony shot nie jest przebudowywany ani zmieniany przez kolejne przebiegi/„fix what looks wrong"/chat bez jawnego odblokowania; stan w `.reelforge/` + widoczny w Shots/timeline. — AC: testy: etap scen i review pomijają zablokowane shoty.
- [x] **11.5** [O+S] **Automatyczny przegląd końcowy w cichym przebiegu**: po „Scenes built" automatycznie `fix what looks wrong` + `phone legibility` + `sync check`, bez interakcji, z raportem ✓/⚠ per shot przed eksportem (eksport wyświetla ostrzeżenie, gdy zostały ⚠). — AC: przegląd uruchamia się sam, szanuje zamki (11.4), raport widoczny w UI.
- [ ] **11.6** [S+O] **Podpisany instalator + auto-aktualizacje** (gdy zapadnie decyzja o dystrybucji/ToS): certyfikat/Azure Trusted Signing, `electron-updater` z kanałem wydań, test instalacji/aktualizacji na **czystej maszynie/VM** (to samo domyka AC zadania 9.3). — AC: instalator podpisany, aktualizacja 1.2→1.2.1 działa, czysta VM.
- [ ] **11.7** [O] **ODŁOŻONE (Papi 2026-10-03: obecna szybkość wystarcza — realnie film 8 min w ok. 20 min). Ścieżka szybkości**: shoty z szablonów sterowanych słowami (sekwencja obiektów, liczniki, ramki, strzałki, duże napisy 3D, podpisy), biblioteka sprite'ów obiektów, preprodukcja i animatik przed VO, tryb „Szybki" obok obecnego (domyślny zostaje do akceptacji Papiego). Cel: film 15 min w ok. 30 min od wgrania VO. — AC: prototyp 1–2 min oceniony przez Papiego; test „bez szkody".

---

### Faza 12 — Wersje 2.0–2.3 (kierunek uzgodniony z Papim 2026-10-03; start dopiero po zamknięciu fazy 11; szczegóły tasków do doprecyzowania przy starcie wersji)
Zasady: (a) **jeden styl, wiele looków** — *Styl* = post-fx Crisp 640 + paleta + pixel-fonty + paleta dźwięków (spoiwo retro vibe'u); *Look* = rodzina rendererów + szablony + kit, zawsze przechodzi przez ten sam post-fx. Nowe looki nie zastępują Voxel Pixel, tylko go uzupełniają. (b) nie psuć obecnego wyglądu — test „bez szkody" jak w fazie 11. (c) każdy nowy look przechodzi „vibe guard": klatka w palecie stylu, te same fonty, ten sam dithering — sprawdzane programowo + przez Haiku-krytyka.

**Role rolek (A/B/C)** — przypisywane przez storyboard (Sonnet), definicje do weryfikacji po pierwszym teście: **A** = główna opowieść wizualna (voxel 3D: postać, miejsca, rekonstrukcje; kotwica, wraca co 3–6 s), **B** = dowód i ilustracja (retro-UI, dokumenty, mapy, wykresy, blueprint, diorama, zdjęcia wbudowane w scenę), **C** = atmosfera i rytm (glitch, pixel-sort, pętle, kinetyczny tekst, title cardy, metafory, przejścia). Reguły rytmu: nie >N shotów pod rząd w tym samym looku, zmiana wzorca co ≤ 6–8 s (jak 4.2), C przy zmianie aktu.

**Tryby researchu assetów** (ustawienie projektu, 4 opcje):
1. **Pytaj o każdą paczkę** *(domyślny)* — Claude proponuje listę (miniatura, źródło, licencja), Papi zatwierdza w UI.
2. **Auto dla wybranych źródeł** — z allowlisty, np. tylko Wikimedia i NASA.
3. **Pełne auto ⚠ RISKY** — dowolne źródła z szerokiego wyszukiwania, także licencje niezweryfikowane; asset dostaje `license: unverified`, raport „Credits" i eksport oznaczają ryzyko (ostrzeżenie jak 11.5). Nadal **zakaz** yt-dlp/pobierania z YouTube'a, treści za logowaniem/paywallem; limity bezpieczeństwa z 12.9 zostają. Odpowiedzialność prawna po stronie użytkownika.
4. **Wyłączone** — zero sieci; Claude buduje całą animację od A do Z z kitu i **własnych assetów** użytkownika (głównie B-rolle).


#### Wersja 2.0 — Looki
Fundament wizualny: architektura looków, trzy pierwsze nowe looki, zmienność otoczenia, przejścia i dźwięk per look. Nic w 2.1+ nie działa bez tego. Kolejność: 12.1 → looki → 12.8 → 12.15 → 12.24.
Branch: `phase-12/v2.0-looks`. Wydanie: tag, release notes, film testowy oceniony przez Papiego, test „bez szkody" na projekcie wzorcowym (Nokia, 16 shotów).
- [x] **12.1** [O] **Architektura looków**: rejestr looków (`packages/kit`), kontrakt `Look` (renderer + szablony + kit + sound palette) niezależny od `Styl`; tag rolki A/B/C w storyboardzie i w schemacie zod; storyboard i walidator rytmu (4.3 rozszerzone). — AC: Voxel Pixel działa jako look „voxel" bez zmian klatka w klatkę; storyboard na fake-claude przypisuje rolki i looki.
- [x] **12.2** [O] **Look retro-UI/CRT**: okna retro-OS, terminal, przeglądarka, dokument/gazeta/akta z ditheringiem, ekrany CRT ze scanlines. — AC: 5 szablonów + golden frames + vibe guard.
- [x] **12.3** [O] **Look izometryczna diorama**: kafelkowe środowiska (biuro, serwerownia, miasto, pokój), obiekty izometryczne w palecie stylu. — AC: 3 diorama + golden frames + vibe guard.
- [x] **12.4** [O] **Look blueprint/dane**: schematy techniczne, node-graph/timeline, wykresy i mapy (otwarte dane geo), liczniki. — AC: szablony + golden frames; scena z CSV-a (wklejone liczby) synchronizowana z narracją.
- [x] **12.8** [O] **Subtelna zmienność otoczenia (ambient variation)**: w obrębie A/B/C otoczenie dryfuje deterministycznie (seed z `ctx.rng` + id shotu/aktu) — kolor i gęstość siatki, wysokość horyzontu, gradient nieba, zestaw pływających odłamków, kierunek światła, drobne propsy tła, dryf kamery — w **budżecie zmienności** z `STYLE.md` (odcienie w obrębie rodziny palety). — AC: film testowy ≥ 8 min: żadne dwa sąsiednie shoty nie mają identycznego tła (hash), a wszystkie mieszczą się w progu odległości od palety stylu; test „bez szkody" z wyłączonym przełącznikiem.
- [x] **12.15** [O] **Transition kit**: pixelowe wipe'y, dither-dissolve, glitch-cuty i przejścia między looki (A→B→C) jako szablony w kit; storyboard dobiera przejście do pary looków; wszystko w palecie stylu i deterministyczne. Po 12.1–12.4. — AC: macierz przejść między looki z golden frames, brak nagłego „skoku stylu" w teście na filmie ≥ 8 min.
- [x] **12.24** [O] **Palety dźwięku per look**: każdy look ma własny zestaw SFX i ambientu (retro-UI: klikanie, dysk, modem; diorama: dźwięki otoczenia; blueprint: tykanie, bipy; voxel: obecny), wspólny bit-crush i poziomy zachowują spójność; wybór SFX respektuje 12.23 (bez powtórek). Rozszerza syntezę SFX w czystym Node z 4.6. — AC: miks deterministyczny bajt-w-bajt; test, że każdy look używa własnej palety; „bez szkody" dla looku voxel.

#### Wersja 2.1 — Assety i research
Pobieranie i osadzanie assetów w scenach. 12.11 wymaga propsów z looków (laptop/ramka z 2.0); 12.17 i 12.18 korzystają z metadanych źródeł z 12.9. Kolejność: 12.9 → 12.10 → 12.11 → 12.12 → 12.19 → 12.17 → 12.18.
Branch: `phase-12/v2.1-assets`. Wydanie: tag, release notes, film testowy oceniony przez Papiego, test „bez szkody" na projekcie wzorcowym (Nokia, 16 shotów).
- [x] **12.9** [O] **`reelforge fetch-asset` + bezpieczeństwo**: komenda CLI dla runtime'owego Claude'a (bridge nadal blokuje curl/WebFetch/Bash poza `reelforge`); allowlista źródeł o otwartych licencjach (Wikimedia Commons, Openverse, Internet Archive – domena publiczna, NASA, Library of Congress; opcjonalnie Pexels/Pixabay z darmowym kluczem), metadane licencji per plik (źródło, autor, licencja, URL), limit rozmiaru, kontrola MIME, zakaz wykonywania, zapis tylko do folderu projektu (poza gitem), pobrane treści traktowane jako niezaufane dane (prompt-injection), generator sekcji „Credits" do opisu filmu. — AC: testy na serwerze lokalnym; test, że poza allowlistą (tryby 1–2) komenda odmawia; env/ToS §3.1 nietknięte.
- [x] **12.10** [O] **Cztery tryby researchu w UI i bridge'u**: ustawienie projektu, ekran zatwierdzania paczki (tryb 1), wybór źródeł (tryb 2), oznaczenie ⚠ i ostrzeżenie przy eksporcie (tryb 3), tryb 4 = brak sieci (test: zero żądań). — AC: testy e2e na fake-claude dla każdego trybu.
- [x] **12.11** [O] **Asset jako element sceny**: pobrane i własne zdjęcia/footage wbudowane w świat looku (zdjęcie na ekranie laptopa, w ramce na ścianie, polaroid, gazeta, billboard, monitor CRT), przechodzą przez pixelizację + paletę (oryginał w cache, wersja stylizowana w scenie); propsy w kit (`photoFrame`, `assetScreen`…) z deterministycznym kadrowaniem. — AC: scena z 3 różnymi osadzeniami + golden frames; ten sam asset w dwóch looków wygląda spójnie ze stylem.
- [x] **12.12** [O] **Tryb „własne assety od A do Z"**: import własnych plików (obrazy, wideo, logo) do projektu, katalog assetów dla runtime'owego Claude'a (`reelforge assets list`), storyboard buduje B-rolle wyłącznie z nich i z kitu. — AC: film testowy w trybie 4 bez żadnego żądania sieciowego.
- [x] **12.19** [O] **Globalna biblioteka assetów**: wspólny cache zatwierdzonych assetów między projektami (poza gitem), ulubione, licencja i źródło przy każdym, wyszukiwanie; tryb researchu „wyłączone" (12.10) czyta tylko z własnych i z biblioteki. Po 12.9. — AC: asset z projektu A dostępny w B bez ponownego pobrania; test braku sieci.
- [x] **12.17** [O] **Publish kit**: rozdziały ze storyboardu, opis, tagi i sekcja „Credits" (12.9) jako pliki do wklejenia; bez uploadu przez API; ostrzeżenie o assetach `unverified`. — AC: plik opisu z poprawnymi timestampami rozdziałów, test na projekcie wzorcowym.
- [x] **12.18** [O] **Źródła i fact-check**: twierdzenia ze skryptu mogą mieć przypięte źródła (URL/dokument), panel „Sources" w UI, opcjonalny chip źródła na ekranie przy B-rollu z researchu, raport twierdzeń bez źródła. — AC: raport na projekcie wzorcowym; chip renderowany w stylu i deterministycznie.

#### Wersja 2.2 — Reżyseria i dramaturgia
Film dostaje dramaturgię: krzywa napięcia steruje resztą. Wymaga looków i przejść (2.0). Kolejność: 12.22 → 12.28 → 12.21 → 12.23 → 12.25 → 12.26 → 12.27 (12.25 i 12.27 potrzebują kamery 12.28, 12.27 mapy napięcia, 12.23 palet dźwięku z 2.0).
Branch: `phase-12/v2.2-direction`. Wydanie: tag, release notes, film testowy oceniony przez Papiego, test „bez szkody" na projekcie wzorcowym (Nokia, 16 shotów).
- [x] **12.22** [O+S] **Mapa napięcia**: krzywa napięcia (spokój → eskalacja → zwrot → rozwiązanie) proponowana przez Claude'a ze skryptu albo rysowana/oznaczana przez Papiego; zapisana w projekcie (zod) i czytana przez storyboard i miks. Steruje: tempem cięć, wyborem looku/rolki, muzyką (nastrój per akt), ciemnością tła, gęstością efektów i budżetem ambient variation (12.8); współpracuje z beat-sync (12.21). — AC: ten sam skrypt z dwiema różnymi krzywymi daje mierzalnie różne tempo cięć i jasność tła; krzywa edytowalna w UI; zamki (11.4) respektowane.
- [x] **12.28** [O] **Kamera filmowa w pixelu**: rack focus (zmiana ostrości z dithering-bokeh), dolly zoom, orbita i parallax warstwowy jako deterministyczne ruchy kamery w `packages/engine` z API dla scen, wpisem do kit-docs i `STYLE.md`; wszystko w Crisp 640. — AC: 4 ruchy z golden frames, test determinizmu, podgląd ≥ 30 fps.
- [x] **12.21** [O] **Beat-synced editing**: muzyka podąża za tempem mowy, cięcia, whoosh'e i akcenty zatrzaskują się na siatce beatów i na akcentowanych słowach (budowane na SFX/muzyce z v1.1 i ścieżce szybkości 11.7). — AC: raport synchronizacji: ≥ 90% cięć w oknie ±1 klatka od beatu/akcentu na projekcie wzorcowym; test „bez szkody" z wyłączonym przełącznikiem.
- [x] **12.23** [O+S] **Kontrola powtórzeń na poziomie filmu**: wykrywa powtarzające się obrazy/szablony, przejścia, SFX i frazy narracji w całym filmie (np. ten sam wykres lub whoosh 3× na minutę), raportuje z progami i proponuje wymianę (wariant szablonu, inny SFX, inne przejście); dopełnia 12.8. — AC: film z celowo wstrzykniętymi powtórkami → raport łapie ≥ 90%; zaakceptowana wymiana nie rusza zamków.
- [x] **12.25** [O+S] **Pattern interrupts z planu**: Claude planuje w skrypcie i storyboardzie 1–2 „niespodzianki" na minutę (nagła zmiana looku, skali lub perspektywy, np. diorama zoomuje do ekranu CRT i „wchodzimy" w ekran w innym looku); plan zapisany w storyboardzie jako znaczniki, realizowany przez przejścia (12.15) i kamerę (12.28), częstość zależy od mapy napięcia (12.22). — AC: film testowy ≥ 3 min ma 1–2 interrupty/min w planie i w klatkach (raport); zamki (11.4) respektowane; test „bez szkody" z wyłączonym przełącznikiem.
- [x] **12.26** [O+S] **Open loops**: scenariusz i storyboard świadomie otwierają pytania („pokażę to za chwilę") i domykają je w zaplanowanych miejscach; stan pętli (otwarta/domknięta) śledzony w projekcie, ostrzeżenie gdy pętla nigdy nie została domknięta albo domknięcie nie miało zapowiedzi; opcjonalny wizualny znacznik (zasłonięty/zamazany obiekt odsłaniany przy domknięciu — szablon w kit). — AC: skrypt z celowo niedomkniętą pętlą → raport ⚠; odsłonięcie renderuje się deterministycznie (golden frames).
- [x] **12.27** [O+S] **Reveal momentów kulminacyjnych**: dla największych punktów mapy napięcia (12.22) apka proponuje „moment wow" jako zatwierdzalny preset (cisza przed uderzeniem w miksie, nagła zmiana palety, slow-motion na kluczowym obiekcie — remap czasu shotu zachowujący anchory) z użyciem kamery (12.28); Papi akceptuje/odrzuca w UI. — AC: 1 moment na film testowy, deterministyczny, anchory i synchronizacja VO bez zmian; zamki respektowane.

#### Wersja 2.3 — Personalizacja i rozszerzenia
Dopełnienie: pozostałe looki, uczenie gustu, praca na żywo. 12.13 i 12.16 korzystają z wariantów/zamków (11.3, 11.4) i z większej liczby looków; 12.14 wymaga 11.7. Kolejność: 12.5 → 12.6 → 12.7 → 12.16 → 12.13 → 12.14.
Branch: `phase-12/v2.3-personal`. Wydanie: tag, release notes, film testowy oceniony przez Papiego, test „bez szkody" na projekcie wzorcowym (Nokia, 16 shotów).
- [x] **12.5** [O] **Look flat 2D motion graphics**. — AC: j.w.
- [x] **12.6** [O] **Look paper cut-out** (warstwy, cienie, parallax w palecie stylu). — AC: j.w.
- [x] **12.7** [O] **Look whiteboard** (rysowanie linii w czasie, pixelowa kreska). — AC: j.w.
- [x] **12.16** [O] **Hook lab**: 3 warianty otwarcia (cold open, pytanie, szokujący fakt) generowane z tego samego skryptu, porównanie obok siebie, wybór zapisuje otwarcie (mechanika z 11.3). — AC: end-to-end na fake-claude; wybór wariantu respektuje zamki (11.4).
- [x] **12.13** [O] **Taste learning**: warianty (11.3) i zamki (11.4) zapisują lokalny sygnał preferencji (look, szablon, kolor, tempo, rolka), prompty storyboardu/scen dostają skondensowany „profil gustu"; wszystko lokalnie, możliwy reset i podgląd profilu. — AC: po serii wyborów na fake-claude profil zmienia propozycje storyboardu; reset przywraca stan wyjściowy.
- [x] **12.14** [O] **Live co-direction**: komendy tekstowe (opcjonalnie głosowe) podczas odtwarzania — „wolniej", „ciemniej", „strzałka na słowie X", „zrób to jako terminal" — modyfikują parametry szablonu shotu; przebudowa <1 s dzięki szablonom i cache. Zależy od 11.7. — AC: 10 poleceń na projekcie wzorcowym, mediana przebudowy <1 s, zamki respektowane.

#### Wersja 2.3.5 — Serie i postacie
Osobna wersja, bo opiera się na **gotowej paczce pakietów z postaciami i maskotką przygotowanej przez Papiego** — format i zawartość paczki trzeba poznać przed startem (zadanie wstępne: Papi dostarcza paczkę, scout robi jej inwentarz), a nie projektować postaci od zera. Po 2.3. **Wejście:** koncepty postaci Papiego w `docs/concepts/characters.html` (plik lokalny, nieśledzony w git do czasu startu 2.3.5; wcześniej nie ruszać).
Branch: `phase-12/v2.3.5-series`. Wydanie: tag, release notes, film testowy oceniony przez Papiego, test „bez szkody" na projekcie wzorcowym (Nokia, 16 shotów).
- [x] **12.20** [O] **Series memory**: kanał/seria jako obiekt: import paczki postaci i maskotki od Papiego (bez przeprojektowywania — dopasowanie do looków i palety stylu tylko tam, gdzie konieczne, za zgodą), powracające propsy, intro/outro, ciągłość między odcinkami; projekty dziedziczą z serii. — AC: dwa projekty tej samej serii dzielą bohatera i intro; zmiana w serii propaguje się do projektów bez ruszania zamków (11.4); paczka Papiego renderuje się w co najmniej 2 looki z vibe guardem.

- [x] **11.8** [O] **Słownik adnotacji (zatwierdzony przez Papiego 2026-10-03)**: ramki/callouty, strzałki, obwódki (pulsujące), nawiasy, etykiety przypięte do obiektów 3D z linią prowadzącą, podkreślenia/zaznaczenia słów, odznaki z numerem, stemple, linie wymiarowe, ptaszki/krzyżyki, spotlight; wszystko w palecie stylu, deterministyczne, świadome safe area i kolizji; **otagowanie skryptu znaczeniem** (nazwa, liczba, definicja, miejsce/wskazanie, porównanie, lista, twierdzenie, akcent) i dobór formy z regułami różnorodności; plan adnotacji w storyboardzie. — AC: golden frames każdej adnotacji, storyboard na fake-claude zawiera plan adnotacji z różnorodnością, scena z realnego przebiegu używa ich sensownie, obecne sceny bez zmian klatka w klatkę.
- (nie dodane, odłożone przez Papiego) **11.9 biblioteka propsów**: za wcześnie — styl modeli produkcyjnych jeszcze się rozwija, nie mieszać starego z nowym.

---

### Faza 13 — Wersja 2.5 „Światy" (kierunek zatwierdzony przez Papiego 2026-10-06; fundamenty w `docs/worlds/DECISIONS.md`)
**Świat = Styl (paleta, filtr, rozdzielczość, fonty, dźwięk) + własne looki A/B/C + rzadkie „przebijające" sceny.** Cztery zatwierdzone światy: **Komiks (panele)**, **Gra B1 (Atari, boss-montage)**, **Gra B2 (RPG z pierwszej osoby, Doom-vibe)**, **Zeszyt z bazgrołami**. Referencje: standalone HTML w `docs/worlds/*-v2/` (+ wytyczne jakości `docs/worlds/QUALITY.md`, briefy `docs/worlds/briefs/`). Zasada nadrzędna: **ciągłość między ujęciami** (match-cut / wspólny obiekt, nie wipe) + ludzki charakter + zero „AI slopu". Nie psuć obecnych looków (voxel itd.); nowe światy wchodzą jako style-scoped looks za przełącznikiem projektu.
**Podział na wersje (szczegóły i zależności: `docs/roadmap-3.0.md`):** **3.0** = 13.1 + 13.2 (równolegle) → 13.6 Zeszyt; równolegle 13.12 (UI/UX) i 13.7 (strażnicy anty-slop). **3.1** = 13.3 Komiks; równolegle 13.13 (Kanały) + 13.14 (głos ElevenLabs, ≥ 3 kanały z własnym kluczem i głosem); testy długometrażowe. **3.2** = 13.4 Gra B2; równolegle 13.9 (taśma produkcyjna) + 13.11 (publikacja) + szkielet 13.8. **3.3** = 13.5 Gra B1; 13.8 (finalne mapowanie gatunków); końcowe 13.10 + hartowanie. **3.5** = Shorts factory.
- [x] **13.1** [O] **Architektura światów**: `Look.styles?: string[]` (look widoczny tylko w danym Stylu) i `experimental?: boolean` w kontrakcie Look (packages/kit), rejestr Stylów/presetów silnika (nowe id, 16 tokenów palety), katalog/prompty/kit-docs nie zmieniają się dla istniejących stylów (fixtures), szablon dodawania świata (`docs/worlds/README`), pomocnik renderu showcase z flagą experimental. — AC: istniejące prompty/katalog bajt w bajt; nowy testowy świat widoczny tylko w swoim stylu.
- [x] **13.2** [O+S] **Łącza ciągłości między ujęciami** (sygnatura światów): pole storyboardu (np. `shot.continuity { object, anchor, kind }` + walidator), wsparcie w transition kicie i silniku (zoom-through-object, wspólny obiekt przechodzący przez cięcie, kamera niosąca otoczenie), zasady w prompcie storyboardu i scene-build (kiedy łączyć ujęcia). Wzorce z showcase'ów: B1 ujęcie 2→3 (zbliżenie na kalendarz zmienia otoczenie), B1 5 i 7 (kartridż wkładany/wyciągany przy zachowaniu otoczenia), B2 mapa/rzut kartridżem. — AC: scena testowa z łączem renderuje się deterministycznie, preview = eksport; raport „continuity" w final review.
- [x] **13.3** [O] **Świat Komiks**: kompozytor wielu paneli w silniku (kilka scen naraz, maski paneli, kamera = ruchy paneli), Styl (druk: paleta atramentów + papier, halftone z przesunięciem rejestracji, fonty ręczne), looki A (panele fabularne) / B (strony informacyjne, cutaway, wykres) / C (napięcie, onomatopeje, pusty panel), sceny przebijające: **retrospekcja w sepii**, **rozkładówka**; paleta dźwięku. — AC: golden frames, vibe guard, scena z realnego przebiegu, „bez szkody" dla looków istniejących.
- [x] **13.4** [O] **Świat Gra B2 (pierwsza osoba)**: look z raycasterem w kicie (320×180 ×2, HUD natywny), format opisu poziomu + walidator dla runtime'owego Claude'a (`reelforge validate level`), HUD (kompas z licznikiem roku, pasek „rynek", questlog, ekwipunek, dialogi z maszynopisem), sprite'y/NPC, animacja rzutu/podnoszenia przedmiotu, sceny przebijające: **automapa**, **ekran podsumowania poziomu**; mgła jako przejście. Koszt wg showcase: ≈ 1 tydzień (renderer jako look) / 4–6 tyg. (natywny Three.js). — AC: golden frames + perf ≥ 30 fps, determinizm, level z fakt-checkiem.
- [x] **13.5** [O] **Świat Gra B1 (Atari/boss-montage)**: dwa światy (wnętrze TV z regułami 2600: szerokie piksele, kolor na linię sprite'a, migotanie + salon w kwadratowych pikselach), karty bossów, przejścia game-native (level select, scanline wipe, wkładanie/wyciąganie kartridża, „continue?"), sceny przebijające: **tablica wyników**, **instrukcja do gry**. — AC: j.w.
- [x] **13.6** [O] **Świat Zeszyt**: renderer „line boil" 8–12 fps, widoczna dłoń z pisakiem (reguła „gdzie dłoń odpoczywa"), trzy fonty odręczne (CC0 — wpis w docs/licenses.md), strony A (pisak+kredki) / B (długopis, kratka, koperta) / C (głośne momenty papieru), przejścia page-native, sceny przebijające: **pop-up**, **harmonijka z osią czasu**. — AC: j.w.
- [x] **13.7** [O+S] **Strażnicy anty-slop** (`docs/worlds/QUALITY.md` §8): proweniencja tekstu na ekranie (słowa ze skryptu/researchu/whitelisty), budżet elementów i udział koloru akcentu, symetria/centrowanie, jednolitość odstępów i czasów, licznik „ludzkich śladów" w źródle sceny (≥ 3), detektor tej samej kompozycji w kolejnych ujęciach; krytyk Haiku z checklistą świata i klatkami referencyjnymi (zbitka ≤ 1,5 KB w promptach scene-build). — AC: testy na scenach z celowymi błędami łapią ≥ 90%.
- [ ] **13.8** [O+S] **Presety gatunków**: true crime / tech / historia / finanse / nauka → wybór świata, miks looków, rytm, muzyka, przejścia (jeden wybór przy tworzeniu projektu). Mapowanie ustalić z Papim po portach. — STATUS 2026-10-07: framework, efekty (nastroje/looki/wow), UI i domyślne wartości gotowe (docs/genre-presets.md); ZOSTAJE końcowe mapowanie po próbach Papiego.
- [x] **13.9** [O+S] **Taśma produkcyjna** (3.2; zatwierdzony kierunek; głos = API ElevenLabs, 13.13/13.14): lista tematów → briefy i szkielety skryptów do zatwierdzenia → kolejka projektów budowana po kolei (noc, pauza na limicie, wznowienie) aż do eksportu i pakietu publikacji; głos: **API ElevenLabs (decyzja Papiego 2026-10-06; ≥ 3 kanały z własnym kluczem i głosem)**, skrzynka na pliki zostaje jako zapas; bezpieczniki: raport ✓/⚠ per film, „needs you", prognoza zużycia limitu, jeden film naraz.
- [ ] **13.10** [S] **Test długometrażowy**: po jednym filmie 3–5 min w każdym świecie na realnej subskrypcji (jakość/koszt/czas), raport + poprawki promptów. Zasada Papiego (2026-10-06): testowe filmy ok. 2,5 min po ukończeniu każdego świata puszczać na LOSOWYCH, różnych tematach (nie tych z showcase'ów), żeby sprawdzić, jak silniki radzą sobie na czymś innym. — STATUS 2026-10-07: runda 1 (50 s) zrobiona dla Zeszytu ×3, Komiksu, B2, B1 (docs/real-run-*.md); ZOSTAJĄ filmy po otwartym słownictwie (faza 3 z 13.15) i końcowe 3–5 min na świat.
- [ ] **13.11** [O] **Publikacja (do decyzji)**: studio miniatur składane z klatek filmu w stylu (bez AI-obrazów) i/lub pomocnik wrzucania na YouTube (API = zwykle prywatny upload z nieweryfikowanego projektu; do zweryfikowania).
- [ ] **13.12** [O] **Przebudowa UI/UX 2.4** wg `docs/ux/redesign-2.4.md` — decyzje Papiego 2026-10-06 (docs/ux/redesign-2.4.md, „Answers”): zostaje vibe starego Premiere Pro, przebudowa lekka; klik w dowolny element (np. Sound) otwiera wszystkie jego opcje; Director = zakładka przy Czacie; Gust i Postacie NIE do globalnej Biblioteki (zależą od świata/kanału); poprawki w 3.0; pikselowa czcionka na końcu do oceny; pomocnik publikacji odłożony; liczba kanałów dynamiczna. — STATUS 2026-10-07: zrobione U1–U5, U7, U9, U11, U12, U13 + „All options” + klik otwiera panel; U6 (pasek kroków) pominięty świadomie (lekka przebudowa), U8 (dock) i U10 (Biblioteka) zmienione/odłożone; wiersz „Look assets” dla nowego etapu czeka.
- [x] **13.13** [O] **Kanały** (3.1): obiekt kanału (nazwa, własny klucz API ElevenLabs szyfrowany przez Electron safeStorage — nigdy w repo/gicie, głos + ustawienia głosu, domyślny świat/preset gatunku, domyślne ustawienia publikacji, profil gustu, marka/intro/outro w przyszłości, folder projektów); projekty należą do kanału; min. 3 kanały naraz (Papi produkuje na ≥ 3 kanały z różnymi głosami). — AC: dwa kanały z różnymi kluczami/głosami działają niezależnie, klucze nie wyciekają do logów ani commitów (test), migracja istniejących projektów do „domyślnego kanału”.
- [x] **13.14** [O] **Generowanie głosu ElevenLabs** (3.1): etap Voiceover „Generate” (akapit po akapicie, kontrolowane pauzy, sklejanie; poprawka pojedynczego zdania; szacunek kosztu/znaków przed generowaniem; opcjonalne wyrównanie z API do skrócenia „Words timed” — zweryfikować w dokumentacji dostawcy), import ręczny zostaje; wyjątek sieciowy w CLAUDE.md §3.4 (tylko app → ElevenLabs, klucze użytkownika); testy na lokalnym serwerze udającym API. — AC: film z wygenerowanego głosu przechodzi do eksportu bez ręcznego kroku; zmiana jednego zdania przebudowuje tylko dotknięte sceny.
- [ ] **13.15** [O+S] **Otwarte słownictwo światów** (zasada Papiego 2026-10-07: świat = gramatyka stylu, nie katalog assetów; film o lesie w stylu B2 ma dostać drzewa, zwierzęta, podszycie i poziom leśny wygenerowane pod ten film): (a) per świat DSL + generatory parametryczne w kicie (B2: ASCII-sprite/tekstury, generatory roślin/zwierząt/budynków/postaci/ikon, poziomy plenerowe z niebem; B1: sprite'y 2600 i rekwizyty pokoju; Komiks: biblioteka postaci/rekwizytów/teł w gramatyce komiksu; Zeszyt: generatory figur i doodli), (b) prompty uczą GRAMATYKI stylu i procesu projektowania (rzeczowniki narracji → wygląd w stylu → definicja assetu), bez uprzedzenia do tematów z showcase'ów, (c) etap „world asset builder” (jak props/builder) z plikami assetów w projekcie + krytyk czytelności w miniaturze, (d) walidacja filmami na odległych tematach (las, ocean, stacja kosmiczna, średniowieczna wieś, pustynia, miasto). Szczegóły: docs/worlds/DECISIONS.md „PRINCIPLE: a world is a style GRAMMAR”. — STATUS 2026-10-07: faza 1 (słownictwo w kicie, 4 światy) i faza 2 (prompty gramatyki stylu, world-assets, ctx.worldAssets, sprzątanie kitu) zrobione; ZOSTAJE faza 3: prawdziwe filmy na odległych tematach + wiersz „Look assets” w UI + usunięcie z kitu/CLI resztek treści showcase (docs/status-2026-10-07.md). — STATUS 2026-10-07 (wieczór): fazy 1–2 oraz 3 ZROBIONE (4 filmy testowe, docs/real-run-*-2.md / sketchbook-4), poprawki z filmów wdrożone: B1 przebudowa gramatyki (gra 2D jako treść, limit przejść pokój↔ekran, nowe przełomowe sceny), B2 tryb scenariusza „explained as a game” (7. preset) + szlif, Comic panelBreak/flow/thread + przejścia i budżet, Zeszyt lint/guardy, QA czytelności assetów. Papi: BRAK kolejnych filmów testowych (komp laguje); dalsze próby robi sam, poprawki po jego feedbacku. Zostaje: pełny test B1 po przebudowie (u Papiego), końcowe mapowanie presetów, test ElevenLabs z jego kluczem.
- [ ] **13.16** [O+S] **Ekran startowy, karty projektów, kreator, przegląd projektu** (decyzje Papiego 2026-10-09): pełnoekranowy ekran główny BEZ podglądu sceny; lewe menu (Projekty, Kanały, Taśma produkcyjna, Shorty, Ustawienia, Pomoc); siatka kart projektów segregowana po KANAŁACH (nazwę kanału można wpisać przy tworzeniu projektu i to sortuje/zakłada kanał), filtry, szukajka, rząd „Kontynuuj”; kreator nowego projektu (kroki: temat → kanał i gatunek → styl z obrazkowym podglądem → głos) zamiast długiego formularza; po kliknięciu długiego filmu pełnoekranowy PRZEGLĄD PROJEKTU przed edytorem: faza filmu, shorty (jeśli są), miniatura (wgrywana), tagi, timestampy; edytor bez zmian. Shorty pod kartą filmu-rodzica.
- [ ] **13.17** [O+S] **Publish kit v2 (SEO)**: tagi tworzone przez program (≥ 15: 5 jednosłowych, 5 dwusłowych, 5 trzysłowych; odnoszą się do filmu ORAZ do całego kanału, np. „history explained”, „science explained”), timestampy: 5–8 rozdziałów z tytułami pod SEO; zapis `publish/seo.json`, widoczne w przeglądzie projektu z przyciskami kopiuj.
- [ ] **13.18** [O+S] **Shorts (zalążek 3.5)**: osobna opcja w menu głównym „Nowy short z filmu” (nie w ekranie projektu). Z folderu długiego filmu (skrypt, beats, research, słowa, styl) powstają 2 shorty: 30 s i 60 s. To NIE skrót historii, tylko zajawka z luką ciekawości (hook/pytanie, stawka, wstrzymana odpowiedź, bez zdradzania puenty, fakty zgodne z prawdą), maksymalnie pod retencję: cięcia co 1,5–3 s, dynamiczny montaż, format pionowy 9:16 1080×1920, KAŻDA scena nowa (zakaz użycia scen z długiego filmu; propsy i postacie można), ten sam głos i styl co film, ostatnie 2 s: „Full video on YT: <nazwa kanału>”, napisy słowo po słowie OPCJONALNE. Short = osobny projekt `kind: 'short'` z odnośnikiem do rodzica (pod kartą filmu).
- [ ] **13.19** [O] **Bugfix: ASR w folderach z nie-ASCII** („Déjà Vu”): whisper.cpp na Windows nie otwiera ścieżek spoza strony kodowej ANSI → VAD/whisper-cli uruchamiane w folderze roboczym ASCII (`packages/pipeline/src/asr/ascii-scratch.ts`, modele hard-link/kopia, wyniki kopiowane z powrotem, sprzątanie także po anulowaniu), komunikat błędu wskazuje przyczynę.
Kolejność światów (decyzja Papiego 2026-10-06): **Zeszyt → Komiks → Gra B2 → Gra B1** (B1 najmniej pilny); światy mają WŁASNYCH bohaterów (nie maskotki); kolejność zadań: 13.1 → 13.2 → 13.6 → 13.3 → 13.4 → 13.5, 13.7 równolegle od 13.3, 13.8, 13.10; 13.12 (UX) i 13.9 (taśma, głos przez API ElevenLabs — do omówienia) w ramach 3.0; poprawki UI „2.3.8” wstrzymane („czekaj”) i wejdą do 3.0. Shorts factory przesunięte na **3.5**.

## 7. Budżety i cele jakości
- Podgląd ≥ 30 fps przy 640×360 na laptopie Papiego; scrub < 100 ms do klatki.
- Eksport 10-min filmu 1080p30 ≲ 20 min (GPU) / ≲ 45 min (CPU).
- Zero wywołań API; zero odczytu poświadczeń; env potomnych oczyszczone (test).
- Kodowane w jednym przebiegu: film ~10 min ≈ 25–40 shotów; limit subskrypcji → budowa wznawialna, bez utraty pracy.

## 8. Ryzyka
| Ryzyko | Skutek | Mitigacja |
|---|---|---|
| **ToS: dystrybucja aplikacji opartej o subskrypcję użytkowników** | blokada/zakaz | v1 = użytek własny, tylko spawn prawdziwego `claude`, zero tokenów; decyzja przed publicznym wydaniem (§10) |
| Limity subskrypcji przy budowie scen (Opus) | przerwany film | wznawialne etapy, kolejka, Economy, miniatury zamiast pełnych obrazów, cache |
| Flagi/format `stream-json` zmienią się w nowej wersji CLI | zepsuty bridge | spike 1.1 + testy kontraktowe na nagraniach + sprawdzanie wersji min/max |
| Jakość 3D generowanego przez LLM niestabilna | brzydkie sceny | kit zamiast surowego Three.js, biblia stylu, pętla QA, golden frames, Opus tylko do kodu |
| WebGL na słabym GPU / SwiftShader wolny | wolny render | render 640×360, spike 1.2, cache + równoległość |
| Rozjazd podglądu i eksportu | niespodzianki | jeden silnik, determinizm, test hash klatek preview vs export |
| Licencje ffmpeg (GPL) przy dystrybucji | problem prawny | LGPL build lub zewnętrzne binarium wskazane przez użytkownika; audyt 9.4 |
| Whisper słabo na PL / szumie | złe timestampy | czyszczenie przed ASR, alignment do skryptu, większy model, ręczne korekty |
| Windows: spawn, ścieżki ze spacjami, kill tree | flaky | CLAUDE.md §3.6 + testy na `windows-latest` |

## 9. Backlog (po v1)
macOS/Linux · opcjonalny lokalny TTS (Piper/Kokoro) · import muzyki z Suno z auto-dopasowaniem do aktów · szablony serii (cały kanał = jeden styl + biblia; część w 12.20) · **3.0: Shorts factory** (osobny generator krótkiej treści, działa na innej zasadzie niż film długi) · retention coach (2.x; import CSV z YT Analytics) · współdzielenie kitu między projektami · rozszerzanie kitu przez społeczność.

Odłożone z v1 (TODO w kodzie): ścieżka **Cards** na timeline (6.5) — karty tekstowe rejestruje scena w runtime (`shot.cards()` w silniku); podgląd musi je raportować do renderera (albo dry-run jak w CLI), dziś ścieżka pokazuje tylko opis.

## 10. Otwarte pytania do Papiego (zaszyte domyślne założenia)
3. Język filmów — domyślnie **EN** (jak w referencji), PL wspierany (skrypt i whisper).
5. Pierwszy realny film testowy (temat) do zadania 10.4.

## Faza 14 — Świat C-CAM („Grim Ink”: styl C + kamera) — wersja 3.6 (decyzja Papiego 2026-10-10)
Źródło i analiza: `docs/concepts/c-cam-style/` (README, docs/01–09, 3 filmy 60 s), plan portu: `docs/concepts/c-cam-style/docs/07-REELFORGE_INTEGRATION.md`. Decyzje Papiego: nazwa „Grim Ink” (id `c-cam`); PEŁNE KOLORY (flaga presetu bez kwantyzacji, istniejące style i goldeny bajt w bajt); 24 fps domyślnie dla świata; TRZY looki A/B/C `ink-scene` / `ink-insert` / `ink-poster` z możliwością wyłączenia (ustawienie projektu); zawsze nowi ludzie w każdym filmie (bez generatora, ręcznie budowani pod narrację); walidatory z c-plus portowane OD RAZU (nie na później); zostajemy przy silniku C — c-plus odrzucony; świat za „Experimental worlds”; napisy: brak w filmach (głos), słowo-po-słowie tylko w shortach (opcjonalne). Poprawki względem doc 07 po weryfikacji w kodzie: kwantyzacja do ≤32 kolorów jest dziś obowiązkowa dla każdego stylu bez opt-outu (`post-shader.ts:208`, `style.ts:158`); sandbox ADR-004 nie ma `document`/`OffscreenCanvas` w scenach (lint), a żaden świat nie używa Canvas 2D (Komiks/Zeszyt: bufor indeksowy → `DataTexture`), więc płótno 2D musi żyć w kicie (kod zaufany), co rozstrzyga 14.0; dozwolone fonty tylko `display`/`mono` (tablice glifów), brak FontFace/@font-face (CSP) → liternictwo kreską tuszu; światy nie mają STYLE.md (odpowiednik = prompty świata + kit-docs); eksport: tylko całkowite skalowanie → natywne 1920×1080 daje 1080p ×1 i 4K ×2, 1440p niedostępne dla tego świata; `WorldProjectDefaults` nie ma `fps` (do dodania).
- [x] **14.0** [O] **Spike: Canvas 2D w silniku** — GO 2026-10-10 (docs/spikes/ccam-canvas.md: deterministyczny hash w SwiftShader, ukrytym i widocznym oknie Electrona; ~42 ms/klatkę 1920×1080 w eksporcie, ~24 fps; addendum ADR-004; kit `ink-stage` gotowy do 14.2): kit fx z płótnem CPU (`willReadFrequently`) w iframe silnika; pomiar determinizmu (ten sam t w różnej kolejności, świeże płótno; okno podglądu vs ukryte okno eksportu vs Playwright SwiftShader) i czasu klatki 1920×1080 (malowanie + upload + post + readback). AC: `docs/spikes/ccam-canvas.md` z liczbami, GO/NO-GO, addendum do ADR-004. NIE blokuje reszty: jeśli NO-GO, plan B = rasteryzer ścieżek do bufora indeksowego.
- [ ] **14.1** [O] **Silnik: preset bez kwantyzacji** (`quantize: false`) w `stylePresetSchema`, `post-shader.ts`, `style.ts` i referencji CPU. AC: wszystkie istniejące goldeny i presety bajt w bajt; test presetu truecolor.
- [ ] **14.2** [O] **Szkielet świata `c-cam`** (eksperymentalny, niepodpięty): `style.ts` (1920×1080, 24 fps), `defineWorld`, `kit.fx.inkStage`, jedna scena przykładowa; `fps` w `WorldProjectDefaults`; presety eksportu 1080p ×1 / 4K ×2.
- [ ] **14.3** [O] **Port core + pędzle** do TS bez globali. AC: testy jednostkowe, golden „próbnik pędzli”.
- [ ] **14.4** [O] **Port twarzy, brudu i póz.** AC: testy, golden arkusza twarzy.
- [ ] **14.5** [O] **Port rigu + kontakt** (schemat zod `D`). AC: testy IK/guard/warstw; dłoń na punkcie ≤ 2 px.
- [ ] **14.6** [O] **Kamera**: jedna tabela cięć, fg w ekranie i w świecie, sprawdzenie pokrycia planu. AC: testy; golden ujęcia z 3 cięciami.
- [ ] **14.7** [O] **Liternictwo CC0 — OBOWIĄZKOWE przed jakimkolwiek wydaniem** (filmy używają Impact/Arial Black/Arial/Georgia/Courier New/Times New Roman: niedozwolone; zamiennik = szkielety kresek tuszem: ręczne z Zeszytu + nowe kapitaliki plakatowe). AC: wpis w `docs/licenses.md`, golden tytułu, strażnik pochodzenia tekstu widzi wywołania.
- [ ] **14.8** [O] **Moduły projektu `kit-ext/people` i `kit-ext/places`** + `reelforge people-preview`. AC: testy lint/loader; podgląd CLI = aplikacja.
- [ ] **14.9** [O] **Film-fixture**: port Apollo 11 (5 postaci, 7 miejsc, 13 ujęć); goldeny looków A/B/C. AC: ≤ 250 linii na scenę, lint zielony.
- [ ] **14.10** [S] **Prompty i dokumenty świata**: `WORLD_PROMPTS['c-cam']`, kit-docs (< 28 000 znaków), craft brief ≤ 1,5 KB. AC: testy promptów, „bez szkody”.
- [ ] **14.11** [O+S] **Etap budowy postaci i miejsc** (prop-build-like, ≤ 1 poprawka). AC: test na fake-claude.
- [ ] **14.12** [O] **Domyślne ustawienia świata + strażnicy**; ustawienie „looki świata” z możliwością wyłączenia A/B/C; `wired: true`. AC: 0 fałszywych alarmów na fixture.
- [ ] **14.13** [O] **Walidatory z c-plus** (kotwice ramion vs podbródek, głowa vs otwarta szczęka, splątanie, kontakt) — ZROBIĆ OD RAZU po 14.5 (decyzja Papiego). AC: 0 błędów na fixture; celowo zepsute postacie wykryte.
- [ ] **14.14** [S] **Test na dłuższym filmie** — robi Papi (koniec testowych filmów z naszej strony); poprawki po jego feedbacku.
