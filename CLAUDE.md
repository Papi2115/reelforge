# ReelForge — CLAUDE.md

> Nazwa robocza: **ReelForge**. Desktopowa aplikacja (Windows first): krótki opis filmu → scenariusz → voiceover → timestampy → animacja 3D (voxel/pixel-art, deterministyczna) → MP4 na YouTube.
> Całość działa na **subskrypcji Claude użytkownika** przez lokalnie zainstalowany Claude Code CLI. Zero kluczy API.

## 0. Zanim cokolwiek zrobisz
1. Przeczytaj ten plik (zawsze, w całości).
2. Otwórz `PLAN.md` → znajdź **bieżącą fazę** i **pierwszy nieodhaczony task** (`- [ ]`). Pracujesz nad nim, nie nad czymś "przy okazji".
3. Dopiero potem kod. Do czytania kodu używaj `scout` (patrz §1), nie własnego kontekstu.

Użytkownik: **Papi**. Pisze po polsku, luźno i konkretnie. Odpowiadaj **po polsku, zwięźle, gęsto** (konkret > tłumaczenie). Kod, komentarze, nazwy, commity, docs w repo: **angielski**.

---

## 1. Role modeli (twarde reguły)

Sesję główną odpalamy na Sonnecie: `claude --model claude-sonnet-5-5` (domyślnie ustawia to `.claude/settings.json`).

| Rola | Model | Jak wywoływany | Robi | NIE robi |
|---|---|---|---|---|
| **Manager** | Sonnet 5.5 (`claude-sonnet-5-5`) | sesja główna | rozmowa z userem, wybór taska z `PLAN.md`, pisanie *work packetów*, delegowanie, review diffów, uruchamianie weryfikacji, commity, aktualizacja `PLAN.md`/decyzji, prompty i storyboardy aplikacji | pisania nietrywialnego kodu, masowego czytania plików |
| **Coder** | Opus 5.5 (`claude-opus-5-5`) | subagent `coder` | cała implementacja: kod, testy, refactory, debugowanie, spike'i, sceny/propsy 3D, kod pipeline'u | szukania plików po repo, przeglądania logów, decyzji o zakresie, commitów, `git push` |
| **Scout** | Haiku (`haiku`) | subagent `scout` | read-only: znajdowanie plików/symboli, czytanie i streszczanie, odpalanie `typecheck/lint/test/build` i **kondensowanie logów**, ocena klatek (czy render nie jest pusty/ucięty tekst), zbieranie fixture'ów, dump `--help`/docsów | edycji plików, decyzji architektonicznych, zgadywania (brak danych → "nie znalazłem") |

Wyjątek dla Managera: trywialne zmiany ≤ ~15 linii (config, literówka, checkbox w `PLAN.md`, treść docsów) może zrobić sam. Wszystko inne → `coder`.

### Zasady oszczędzania limitu subskrypcji
- Opus jest najdroższy → używany **tylko** do pisania/debugowania kodu. Nigdy do "rozejrzyj się po repo".
- Każde czytanie >3 plików albo log >100 linii → najpierw `scout`. Manager dostaje digest (≤40 linii, ścieżki `plik:linia`), nie surowe pliki.
- Jeden work packet = jedna sprawa, diff ≲ 400 LOC. Większe → podziel.
- Równoległe `scout`y są OK i zalecane (niezależne pytania w jednym bloku wywołań). `coder`ów równolegle tylko gdy pakiety dotykają **rozłącznych** katalogów.
- Po dużym tasku: `/compact`. Nie wklejaj dużych plików do kontekstu Managera.

### Work packet (Manager → Coder) — format obowiązkowy
```
GOAL: <1–2 zdania, co ma działać po zmianie>
TASK: PLAN.md#<id>            # np. 2.3
CONTEXT: <ścieżki do przeczytania + wnioski scouta, które mają znaczenie>
CONSTRAINTS: <API/ścieżki/zasady z §3, czego nie ruszać>
ACCEPTANCE: <sprawdzalne kryteria: komendy, testy, oczekiwane wyjście>
OUT OF SCOPE: <czego NIE robić>
```

### Raport (Coder → Manager)
```
STATUS: done | partial | blocked
CHANGED: <lista plików>
VERIFIED: <komendy + wynik; czego nie dało się sprawdzić>
DECISIONS: <odstępstwa/wybory, ≤10 linii>
FOLLOW-UPS: <rzeczy poza zakresem, które zauważył>
```
Raport Scouta: `ANSWER` (3–10 linii) → `EVIDENCE` (`plik:linia`) → `UNKNOWN` (czego nie znalazł). Max 40 linii.

### Eskalacja
- Scout nie wie / niejednoznaczne → raportuje `UNKNOWN`, **nie zgaduje**.
- Coder zablokowany lub widzi problem w pakiecie → zwraca `blocked` z konkretem; nie rozszerza zakresu sam.
- Manager decyduje o wszystkim w granicach `PLAN.md`. **Pyta Papiego (AskUserQuestion) tylko gdy:** zmienia się zakres/architektura z `PLAN.md`, dotyka to modelu auth/ToS (§3.1), kompromis koszt-limit-jakość, nazwa/licencja/widoczność repo, operacje nieodwracalne (force push, kasowanie, rewrite historii).

---

## 2. Pętla pracy Managera
1. `PLAN.md` → bieżący task → (opcjonalnie) `scout` po kontekst.
2. Napisz work packet → `coder`.
3. Weryfikacja: `scout` odpala `pnpm typecheck && pnpm lint && pnpm test` (+ render klatek dla zmian wizualnych) i zwraca digest. Manager robi przegląd `git diff --stat` + wybranych fragmentów.
4. Nie przechodzi → nowy, węższy packet z konkretem błędu (max 2 iteracje, potem eskalacja do Papiego z opisem).
5. Przechodzi → Manager hakuje checkbox w `PLAN.md`, commit, ew. wpis do §8 (dziennik decyzji).
6. Krótki raport dla Papiego: co działa, co dalej. Bez recapu każdego kroku.

**Definition of Done (każdy task):** typecheck + lint + testy zielone · kryteria ACCEPTANCE spełnione · dla zmian wizualnych: klatki wyrenderowane i obejrzane (scout + spot-check Managera) · brak martwego kodu/`console.log`/TODO bez wpisu w backlogu `PLAN.md` · checkbox odhaczony · commit.

---

## 3. Niepodlegające negocjacji zasady produktu

### 3.1 Subskrypcja, nie API
- Aplikacja **wyłącznie uruchamia lokalne binarium `claude`** (headless: `claude -p ... --output-format stream-json`). Użytkownik loguje się raz w samym Claude Code.
- **ZAKAZ:** `@anthropic-ai/sdk`, Agent SDK z auth API, kluczy API, czytania/kopiowania/przechowywania/przesyłania tokenów OAuth i plików poświadczeń Claude Code, podszywania się pod Claude Code, `claude setup-token`. Anthropic zakazuje używania tokenów OAuth z kont Free/Pro/Max w innych produktach — wywoływanie prawdziwego CLI jest OK, wyciąganie tokenów nie.
- Procesy potomne dostają **oczyszczone env**: usuń `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX` — żeby nic po cichu nie rozliczyło się z API zamiast subskrypcji.
- Flagi CLI **zawsze weryfikuj** (`claude --help`, docs) zanim je zakodujesz — nie polegaj na pamięci. Wynik spike'a: `docs/spikes/01-claude-cli.md`.
- Testy i CI **nie mogą spalać subskrypcji** → używamy `fake-claude` (nagrane strumienie), patrz `PLAN.md#5.9`.

### 3.2 Determinizm
Scena to **czysta funkcja czasu** `t`. Zakazane w scenach: `Date`, `Math.random` (używaj `ctx.rng`), `performance.now`, `requestAnimationFrame`, `setTimeout/Interval`, animacje/transitions CSS, `fetch`, API Node. Wymusza to lint (`PLAN.md#2.6`). Ten sam `t` → ten sam obraz, bit w bit.

### 3.3 Podgląd = eksport
Jeden silnik (`packages/engine`) dla podglądu i renderu. Żadnych "specjalnych" ścieżek eksportu, które wyglądają inaczej niż preview.

### 3.4 Local-first
Projekt = folder na dysku + repo git (autocommit po każdym kroku pipeline'u i turze Claude). Zero telemetrii, zero chmury poza samym Claude CLI.

### 3.5 Dane na dysku
Każdy plik JSON ma wersję + schemat **zod** w `packages/shared`. Zapis atomowy (tmp + rename). Brak "ręcznego" parsowania.

### 3.6 Windows traktowany poważnie
Dev i target: Windows (Git Bash). `path.join`, brak skryptów tylko-bash (używaj Node), spawn `claude` z obsługą `.cmd/.exe`, zabijanie drzewa procesów (`taskkill /T`), brak założeń o `/tmp`, spacje w ścieżkach (`Creatorize Suite`).

---

## 4. Architektura (skrót — pełna wersja w `PLAN.md` §2–§6)
```
apps/desktop        Electron (main/preload/renderer, React+TS) — UI, projekty, okna
packages/engine     Three.js: kontrakt sceny, zegar/seek, post-fx pixel-art, kamery, tekst, lint
packages/kit        voxel propsy, środowiska, efekty, style (Voxel Pixel — Crisp 640)
packages/pipeline   ffmpeg (clean/mix/export), whisper.cpp (słowa), alignment, anchors, cache
packages/claude-bridge   spawn `claude`, sesje, stream-json → zdarzenia, limity, kolejka
packages/prompts    prompty etapów (wersjonowane) + evale
packages/shared     typy + schematy zod
packages/stages     orkiestracja etapów (script…mix, sceny + QA, review, sync report)
packages/project    foldery projektów, git (autocommit/historia/revert), odzyskiwanie
packages/cli        CLI `reelforge` dla runtime'owego Claude'a (frames, lint, anchors, kit-docs…)
styles/ templates/  style + STYLE.md, szablon projektu i projekt przykładowy
templates/project   szablon projektu wideo (w tym CLAUDE.md dla runtime'owego Claude'a)
tools/fake-claude   atrapa CLI do testów
```
Etapy pipeline'u (jak w referencji): `Script → Voiceover → Audio cleaned → Words timed → Storyboard → Scenes built → Sound design mixed → Video exported`.
Modele **w aplikacji** (konfigurowalne): scenariusz/storyboard = Sonnet, kod scen = Opus, szybkie QA klatek = Haiku.

---

## 5. Komendy (kontrakt — tworzone w fazie 0, po niej uzupełnij realnymi)
```
pnpm install
pnpm dev                 # Electron + HMR
pnpm typecheck           # tsc -b
pnpm lint                # eslint + prettier --check
pnpm test                # vitest (unit) 
pnpm test:render         # golden frames (engine/kit)
pnpm render:frames -- --scene <file> --at 0,2.5,5   # PNG-i do oceny wizualnej
pnpm build               # produkcyjny build
pnpm test:app            # e2e w prawdziwym Electronie (fake-claude)
pnpm test:app:ci         # to samo z tolerancjami dla runnera bez GPU/audio (CI)
pnpm kit:catalog         # regeneruje docs/kit-catalog.md
pnpm package / pnpm dist # app rozpakowana / instalator NSIS
pnpm test:packaged       # smoke spakowanej aplikacji + instalatora
```

## 6. Konwencje kodu
- TypeScript `strict`, zakaz `any` (użyj `unknown` + zod), brak `// @ts-ignore` bez komentarza z powodem.
- Plik ≲ 400 linii, funkcje małe, nazwy pełne. Brak martwego kodu.
- Błędy jawne (typed Result/Error), nigdy puste `catch`.
- Każda nowa funkcjonalność: test jednostkowy; wizualna: test golden-frame.
- Zależności: dodawaj ostrożnie, uzasadnij w raporcie (licencja! ffmpeg: preferuj LGPL build / zewnętrzne binarium, patrz ryzyka w `PLAN.md`).
- Fonty/assety tylko na licencjach OFL/CC0 — wpis w `docs/licenses.md`.

## 7. Git
- `main` zawsze zielony. Branch per faza/feature: `phase-<N>/<slug>`. PR per faza przez `gh`.
- Conventional Commits (`feat(engine): ...`, `fix(pipeline): ...`, `chore: ...`). Commity robi **tylko Manager**, po weryfikacji.
- Nigdy: `--force` na `main`, `--no-verify`, commit sekretów/plików projektów wideo/modeli whisper (są w `.gitignore`).

## 8. Dziennik decyzji (Manager dopisuje, 1 linia = 1 decyzja)
<!-- YYYY-MM-DD · decyzja · powód · task -->
- 2026-10-02 · Repo: nazwa `reelforge`, widoczność **private**, konto osobiste (zalogowane w `gh`) · domyślne z PLAN.md, v1 = użytek własny (ToS) · 0.1
- 2026-10-02 · Domyślny język filmów: EN (PL wspierany) · jak w referencji · PLAN §10 pkt 3
- 2026-10-02 · TypeScript 6.0.3 (nie 7) · typescript-eslint 8.71 wspiera tylko TS <6.1; pnpm 12 odrzuca świeże wydania (<~1 dzień) — pinować starsze zamiast dodawać wyjątki · 0.2
- 2026-10-02 · CI: node 24 tylko, akcje checkout@v7 / pnpm/action-setup@v6 / setup-node@v7 · zgodnie z maszyną dev; dodanie node 20/22 do matrixu do decyzji później · 0.3
- 2026-10-02 · Pliki agentów przeniesione do `.claude/agents/`, `settings.json` do `.claude/` · Claude Code nie widział subagentów w roocie · bootstrap
- 2026-10-02 · Tryb autonomiczny: Papi poszedł spać i kazał dokończyć całość bez pytań; Manager działa na domyślnych założeniach z PLAN.md, bez zmiany zakresu/ToS · polecenie usera
- 2026-10-02 · ADR-001 CLI-bridge GO: spawn natywnego claude.exe (nie .cmd), env sanitize + abort gdy apiKeySource≠none, `claude auth status` zamiast sondy -p, brak --max-turns → własny watchdog · spike 1.1
- 2026-10-02 · ADR-002 render GO: Electron hidden window + IPC, GPU ANGLE D3D11, NVENC/libx264; goldeny per backend · spike 1.2
- 2026-10-02 · ADR-003 audio GO: whisper large-v3-turbo-q5_0 (EN+PL), VAD chunks + DTW offset, gain+alimiter zamiast loudnorm, ASR na oryginale · spike 1.3
- 2026-10-02 · Sandbox scen = iframe `allow-scripts` + blob modules, engine+kit w iframe, postMessage (ADR-004); pixel-fonty własne CC0 (ADR-005); kit: voxel/env/props/fx (ADR-006) · determinizm + licencje · 2.1–3.5
- 2026-10-02 · Miks audio: synteza SFX w czystym Node zamiast OfflineAudioContext · deterministyczne bajt-w-bajt, bez Chromium · 4.6
- 2026-10-02 · Eksport: segmenty per-shot kodowane od razu docelowym kodekiem + concat (copy); klucz cache = scena+kit+styl+anchory; FrameSource wstrzykiwany, w app = ukryte okno Electron · 4.7
- 2026-10-02 · Bridge: tylko `dontAsk`/`acceptEdits`/`plan`; allowlista `Edit(./**)`; CLI auto-zatwierdza `echo` → hook PreToolUse blokuje Bash poza `reelforge` · test na realnym CLI 5.7
- 2026-10-02 · Prompty etapów (markdown) pisze Manager w packages/prompts/prompts; STYLE.md w styles/<id>/; template CLAUDE.md w templates/project · 3.6, 5.5, 5.8
- 2026-10-02 · Electron 44 + plain Vite/esbuild, protokoły `reelforge://` i `reelforge-media://`; zegarem mastera jest <audio> · 6.1–6.4
- 2026-10-02 · `.reelforge/` w całości poza gitem; revert = nowy commit przywracający drzewo (bez reset --hard) · 6.2
