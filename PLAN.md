# ReelForge — PLAN.md

Legenda ról przy taskach: **[S]** Sonnet 5.5 (manager) · **[O]** Opus 5.5 (coder) · **[H]** Haiku (scout/runner). Format taska: `- [ ] **id** [rola] opis — AC: kryterium`.
Manager hakuje checkboxy dopiero po spełnieniu AC i zielonej weryfikacji (patrz `CLAUDE.md` §2).

**Bieżąca faza: 2**

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
- [ ] **4.8** [H] Odpal pipeline na fixture'ach, zraportuj czasy i wąskie gardła. — AC: `docs/perf.md`.

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
- [ ] **6.6** [O] Panel czatu: zakresy Selection/Shot/Whole video, **klik w podglądzie → wybór obiektu** (raycast → id/kontekst do Claude'a), kolejka, Stop, chipsy sugestii, log kroków z miniaturami klatek. — AC: zmiana "zrób ten element większy" na zaznaczonym obiekcie działa end-to-end.
- [x] **6.7** [O] Settings: Połącz Claude (§2.1), model per etap, tryb Economy, styl, język, wydajność (workery/GPU), ścieżki ffmpeg/whisper. — AC: zmiany zapisują się i działają.
- [ ] **6.8** [O] Sidebar pipeline'u: statusy etapów + przyciski Open/Replace/Run/Redo, blokady zależności (nie zbudujesz scen bez storyboardu). — AC: kolejność etapów wymuszona.

### Faza 7 — Orkiestracja etapów
- [ ] **7.1** [O+S] **Brief → scenariusz**: formularz (temat, długość, ton, odbiorca, język, uwagi) → research (źródła) → beat sheet → `script.txt`; licznik słów i szacunek czasu (150 wpm); edytor ze zmianami; bramka akceptacji. — AC: z 3-zdaniowego briefu powstaje skrypt ze źródłami.
- [ ] **7.2** [O] Voiceover: import (wav/mp3/m4a) i nagrywanie w aplikacji; Replace; raport rozbieżności VO↔skrypt. — AC: wymiana VO → `Words timed` do ponownego uruchomienia, sceny zachowują anchory.
- [ ] **7.3** [S] **Storyboard**: skrypt + words + styl + katalog kitu → `storyboard.json` (shoty na anchorach, treatment, intent, propsy, kamera, paleta, cues; zmiana wzorca wizualnego co ≤ 6–8 s; lista "brakujących propsów"). — AC: walidacja zod + brak 3× tego samego treatmentu z rzędu.
- [ ] **7.4** [O] **Budowa scen**: pakiet per shot (współbieżność 2, dostosowana do limitów), każdy kończy lint + smoke-frames + Haiku-krytyk; retry ≤ 2; brakujący prop → najpierw dobudowanie do kitu (z testem). — AC: 8-shotowy film buduje się bez ręcznej interwencji.
- [ ] **7.5** [O+H] Krytycy klatek: sprawdzenia programowe + Haiku JSON (§4.4). — AC: wykrywa celowo zepsute fixture'y (pusta klatka, ucięty tekst, nakładające się karty).
- [ ] **7.6** [S] **Review całego filmu**: contact sheety (3 klatki/shot) → Haiku triage → Sonnet plan poprawek → Opus naprawy. Chipsy: "Review the whole video and fix what looks wrong", "Make all on-screen text easier to read on a phone", "Check every visual lands on its spoken word". — AC: akcje działają z zakresu Whole video.
- [ ] **7.7** [O] Raport synchronizacji (anchory ±150 ms). — AC: raport per shot w UI.

### Faza 8 — Sound design
- [ ] **8.1** [S] Generowanie `cues.json` ze storyboardu (hity na anchorach, whoosh na przejściach, ambient per scena, muzyka per akt). — AC: walidacja zod.
- [ ] **8.2** [O] UI: biblioteka SFX (synth + własne pliki), ścieżki Cues/Ambience/Audio na timeline, suwaki ducking/głośności, odsłuch miksu w podglądzie. — AC: edycja cue'a słyszalna w podglądzie.
- [ ] **8.3** [O] Etap "Sound design mixed": render `mix.wav`, kontrola LUFS/true peak. — AC: −14 LUFS ±1, TP ≤ −1 dB.

### Faza 9 — Eksport i paczka
- [ ] **9.1** [O] Dialog eksportu: preset (1080p30/1440p/4K), kodek/enkoder, kolejka, postęp, wznawianie. — AC: eksport 10-min filmu < 20 min na laptopie z GPU (cel; zmierzony wynik w `docs/perf.md`).
- [ ] **9.2** [S+O] Wyjścia dodatkowe: `chapters.txt` ze storyboardu (format YouTube), miniatura, sugestie tytułu/opisu/tagów. — AC: pliki w `out/`.
- [ ] **9.3** [O] `electron-builder` (NSIS, Windows x64), brak auto-update, instrukcja podpisywania kodu. — AC: instalator działa na czystej maszynie/VM.
- [ ] **9.4** [H] Audyt licencji (fonty, assety, ffmpeg, whisper, zależności npm) → `docs/licenses.md`. — AC: brak nieznanych/niekompatybilnych.

### Faza 10 — Hartowanie i v1.0
- [ ] **10.1** [O] E2E (Playwright-Electron) happy path na `fake-claude` + fixture VO: brief → … → MP4. — AC: przechodzi w CI.
- [ ] **10.2** [O] Odporność: crash Electrona w trakcie renderu → wznowienie; zabity proces `claude` → wznowienie tury; uszkodzony JSON → komunikat + restore z gita. — AC: testy scenariuszowe.
- [ ] **10.3** [S] Onboarding: projekt przykładowy (krótki film "Doom na kalkulatorze"-style), pierwszy start prowadzi przez Połącz Claude → brief. — AC: nowy użytkownik dochodzi do MP4 bez czytania dokumentacji.
- [ ] **10.4** [S] Test prawdziwy: Papi robi jeden film end-to-end na realnej subskrypcji; lista poprawek → backlog. — AC: raport z zużycia limitu na film.
- [ ] **10.5** [S] Tag `v1.0.0`, release notes, README.

---

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
macOS/Linux · opcjonalny lokalny TTS (Piper/Kokoro) · import muzyki z Suno z auto-dopasowaniem do aktów · szablony serii (cały kanał = jeden styl + biblia) · eksport Shorts 9:16 z tego samego storyboardu · współdzielenie kitu między projektami · rozszerzanie kitu przez społeczność.

Odłożone z v1 (TODO w kodzie): ścieżka **Cards** na timeline (6.5) — karty tekstowe rejestruje scena w runtime (`shot.cards()` w silniku); podgląd musi je raportować do renderera (albo dry-run jak w CLI), dziś ścieżka pokazuje tylko opis.

## 10. Otwarte pytania do Papiego (zaszyte domyślne założenia)
3. Język filmów — domyślnie **EN** (jak w referencji), PL wspierany (skrypt i whisper).
5. Pierwszy realny film testowy (temat) do zadania 10.4.
