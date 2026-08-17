# Codebase Structure

**Analysis Date:** 2026-08-17

## Directory Layout

```
pocket-shiou-monster/
├── build.js                    # Build step: token substitution, src/ → dist/ (~55 lines)
├── package.json                # scripts: build / serve / verify / verify:creator / sfx
├── package-lock.json
├── CLAUDE.md                   # AI работа guide — 266 lines, read FIRST, 26 design rules
├── HANDOFF.md                  # Handoff notes: history, past incidents, next steps
├── README.md                   # Human-facing overview (Japanese)
├── .gitignore                  # excludes node_modules/, .shots/, raw CC0 asset packs
│
├── src/                        # All hand-written source (build INPUT)
│   ├── fx_core.js               # EffectSystem: RNG, dot-draw primitives, 6 FX generators, ScreenFX
│   ├── sfx_bank.js              # ★auto-generated★ 79 CC0 SFX (data URI) + SoundBank + AUDIO_CFG
│   ├── moves.js                 # TYPES table, built-in MOVES registry, CostCalculator
│   ├── anims.js                 # Squash/stretch animation keyframes (idle/attack/hurt/dodge/appear/…)
│   ├── audio_ui.js              # Shared sound-assignment widgets (SoundPicker, timeline, sys-map)
│   ├── movelab.js               # Shared FX-spec editor widgets + move-library persistence
│   ├── starter_moves.js         # 28 pre-authored move specs ("ネタ帳"), audio left empty
│   ├── fx_audio.js              # LEGACY procedural audio engine — unused by any template, safe to delete
│   ├── lab.tpl.html             # Template → shioumon_effect_lab.html   (技ラボ)
│   ├── battle.tpl.html          # Template → shioumon_field_test.html  (戦闘テスト, main screen)
│   ├── audiolab.tpl.html        # Template → shioumon_audio_lab.html   (音ラボ)
│   └── creator.tpl.html         # Template → shioumon_creator.html     (四皇モン制作ツール)
│
├── dist/                        # Build OUTPUT — 4 self-contained HTML files (committed to repo)
│   ├── shioumon_field_test.html   # ~764KB, open directly in a browser
│   ├── shioumon_effect_lab.html   # ~720KB
│   ├── shioumon_audio_lab.html    # ~696KB
│   └── shioumon_creator.html      # ~868KB
│
├── docs/                        # Design documents
│   ├── 開発計画_v6.md            # CANONICAL spec — 20 phases, 26 prohibited-patterns list, 1073 lines
│   ├── 開発計画_v5.md            # Superseded prior version, kept for history
│   ├── 技ネタ_タイプ別.md          # Move-idea notebook, 18 types × ~10 — source material for starter_moves.js
│   ├── SFX_MAP.md                # Human-readable list of the 79 baked-in sound effects
│   └── CREDITS.md                # CC0 asset attribution
│
├── tools/                       # Node/Python scripts outside the runtime app
│   ├── gen_sfx.py                # Rebuilds src/sfx_bank.js's SFX_SRC from raw assets/ CC0 packs
│   ├── serve.js                  # Static HTTP server for dist/ (file:// fallback), localhost:8765
│   ├── verify_audio.js           # Playwright: all 4 screens load, sounds decode, no JS errors
│   ├── verify_ui.js              # Playwright: UI interaction flows + determinism check
│   └── verify_creator.js         # Playwright: creator tool flows (shadow/photo/moves/cry/release/reset)
│
├── assets/
│   ├── sprites/                  # Committed reference sprites — DO NOT redistribute (see License note)
│   │   ├── palkia_front.png / .b64, palkia_back.png / .b64
│   │   ├── akuu_setsudan.json    # exported move spec sample
│   │   └── compare.png
│   ├── webgameattacksfxcc0/      # gitignored — raw CC0 pack, only needed to run gen_sfx.py
│   └── webgamesfxcc0kenney/      # gitignored — raw CC0 pack, only needed to run gen_sfx.py
│
├── archive/                     # First-ever generated individual ("テストモン"), kept as a memento
│   ├── maboroshi_testmon.json
│   └── maboroshi_testmon_{normal,attack,hurt,card}.png
│
├── .shots/                      # gitignored — Playwright screenshots written by tools/verify_*.js
│
└── .planning/                   # GSD planning directory
    └── codebase/                 # generated codebase-map docs (this file lives here)
```

## Directory Purposes

**`src/`:**
- Purpose: single source of truth for all hand-written code; nothing under `dist/` is ever hand-edited
- Contains: 8 shared `.js` modules (no `import`/`export` — plain global-scope scripts) + 4 `.tpl.html` templates with `/*__TOKEN__*/` injection markers
- Key files: `fx_core.js` (effect engine), `moves.js` (game data), `sfx_bank.js` (auto-generated, see below), `battle.tpl.html` (largest and most-developed template)

**`dist/`:**
- Purpose: the actual deliverable — 4 standalone HTML files a user double-clicks to play/use
- Contains: build output only; regenerated in full by `node build.js` every time
- Key files: all 4 are equally "real" outputs; `shioumon_field_test.html` is the primary/most-current one per `CLAUDE.md`

**`docs/`:**
- Purpose: design authority and reference material, not code
- Contains: the canonical development plan (`開発計画_v6.md`, which lists all 26 binding "禁止事項"/prohibited patterns), a superseded prior plan, move-idea source notes, and asset documentation
- Key files: `開発計画_v6.md` — read alongside `CLAUDE.md` before any nontrivial change per the project's own stated policy

**`tools/`:**
- Purpose: everything that operates on the build output or regenerates source data, but is not itself part of any `dist/*.html`
- Contains: 3 Playwright-based verification scripts, a static file server, and the Python CC0-audio-to-`sfx_bank.js` pipeline
- Key files: `verify_ui.js` drives the determinism-check button; `gen_sfx.py` is the only supported way to change `src/sfx_bank.js`'s embedded sounds

**`assets/`:**
- Purpose: binary source material — either committed reference sprites or transient raw-audio packs
- Contains: `sprites/` (committed, small, licensing-restricted); two raw CC0 audio-pack directories (gitignored, ~29MB combined, absent unless someone is actively regenerating the sound bank)
- Key files: none required for normal `build.js`/`dist/` use — only `gen_sfx.py` touches this directory

**`archive/`:**
- Purpose: historical preservation of the first-ever generated monster individual, explicitly kept as a memento rather than as sample code
- Contains: one JSON + 4 PNGs, frozen from an early build
- Key files: none of these should be used as a current-pattern reference — they predate several of the 26 design rules

## Key File Locations

**Entry Points:**
- `dist/shioumon_field_test.html`: battle/AI-combat screen — built from `src/battle.tpl.html`
- `dist/shioumon_effect_lab.html`: move-FX authoring — built from `src/lab.tpl.html`
- `dist/shioumon_audio_lab.html`: sound-assignment authoring — built from `src/audiolab.tpl.html`
- `dist/shioumon_creator.html`: full monster authoring — built from `src/creator.tpl.html`
- `build.js`: the only entry point that produces the above from source

**Configuration:**
- `package.json`: npm scripts (`build`, `serve`, `verify`, `verify:creator`, `sfx`); only `devDependency` is `playwright`
- `build.js`: the `MODULES` token→file map and `TARGETS` template→output list — this **is** the project's "config" for what gets built and how

**Core Logic:**
- `src/fx_core.js`: effect engine — RNG, pixel-draw primitives, `ProjectileFX`/`BeamFX`/`SlashFX`/`LightningFX`/`AuraFX`/`ShatterFX`, `spawnSubFX`/`DelayFX`
- `src/moves.js`: `TYPES`, built-in `MOVES`, `costOf()` (CostCalculator)
- `src/sfx_bank.js`: `SoundBank` class, `AUDIO_CFG`, `playSys`/`playMovePhase`, persistence — **do not hand-edit the SFX_SRC data block**, regenerate via `tools/gen_sfx.py`
- `src/battle.tpl.html`: `Fighter` class, fixed-timestep `loop()`, Battle AI scoring, quarter/phase state machine, `determinismTest()`
- `src/creator.tpl.html`: monster authoring state machine, save-slot/autosave/wild-pool persistence, built-in-move override system

**Testing:**
- `tools/verify_audio.js`, `tools/verify_ui.js`, `tools/verify_creator.js`: Playwright end-to-end checks against `dist/`, run via `npm run verify` (or individually)
- No unit-test framework is present anywhere in the repo — all automated verification is browser-driven, end-to-end, against the built output

## Naming Conventions

**Files:**
- Shared modules: `snake_case.js` (`fx_core.js`, `sfx_bank.js`, `audio_ui.js`, `starter_moves.js`)
- Build-time templates: `<name>.tpl.html` — **the template's base name does NOT necessarily match its output name.** The mapping is an explicit lookup table in `build.js`'s `TARGETS`, not a suffix-strip convention:
  | Template | Output |
  |---|---|
  | `lab.tpl.html` | `shioumon_effect_lab.html` |
  | `battle.tpl.html` | `shioumon_field_test.html` |
  | `audiolab.tpl.html` | `shioumon_audio_lab.html` |
  | `creator.tpl.html` | `shioumon_creator.html` |

**localStorage keys:**
- Pattern: `shioumon_<subsystem>_v<N>` for anything with a defined, potentially-migratable schema — `shioumon_audio_cfg_v1`, `shioumon_move_lib_v1`, `shioumon_wild_pool_v1`, `shioumon_scene_sfx_v1`
- Exceptions: the creator's own save/autosave keys carry no version suffix (`shioumon_creator_auto`, `shioumon_creator_slots`), and one-shot migration flags are named for what they mark, not versioned (`shioumon_crydelay_050`)
- See `ARCHITECTURE.md`'s Persistence Layer section for the full key-by-key read/write map

**JS identifiers:**
- Functions/variables: `lowerCamelCase` (`stepBattle`, `spawnSubFX`, `audioLoadSaved`, `resetBattle`)
- Constant tables/config objects: `UPPER_SNAKE_CASE` (`AUDIO_CFG`, `MOVES`, `ANIMS`, `TYPES`, `QUARTER`, `SPEED`)
- Classes: `PascalCase` (`Fighter`, `SoundBank`, `RNG`, `ProjectileFX`, `BeamFX`)
- **Module-scope prefixing to avoid collisions:** because `build.js` concatenates every injected module into one flat global scope per output file, shared-widget modules prefix their exports to avoid clashing with whatever else lands in the same document — `movelab.js` uses `ml*` (`mlLibAll`, `mlLibrary`, `mlInjectCSS`, `mlArmDelete`), `audio_ui.js` uses `aui*`/`AUI*` (`auiInjectCSS`, `auiLabel`, `AUDIO_UI_CSS`). **Any new shared-widget module should adopt the same short-prefix convention.**

**Comments & UI strings:**
- Japanese throughout, casual Hakata-dialect register in developer-facing comments (matches the intended AI-collaborator voice specified in `CLAUDE.md` section 7); all player-facing UI text is also Japanese

## Where to Add New Code

**New built-in move:**
- Add a `MOVE_XXX = makeSpec(...)` spec plus a `MOVES.xxx = {...}` entry in `src/moves.js`
- Only add a default entry to `AUDIO_CFG_DEFAULT.moves` in `src/sfx_bank.js` if the sound has actually been decided — sound assignment is otherwise left to the audio lab (rule: "音の決定権は100%鴨川にある")

**New starter/content-pack move:**
- Append to the `STARTER_MOVES` array in `src/starter_moves.js`, matching the `{name, fx, battle, audio}` shape; leave `audio: []`

**New FX generator "shape":**
- Add a `class XxxFX extends BaseFX` in `src/fx_core.js` and register it in `spawnFX()`'s switch (`fx_core.js:690-699`)
- Add its labels/schema to `movelab.js`'s `GEN_JP`/`GEN_DESC`/`LABEL` tables so the effect lab and creator UIs can edit it

**New character animation state:**
- Add a keyframe entry to `ANIMS` in `src/anims.js`; trigger it via `Fighter.play(name, dur)` or a move's `fx.motions[]` entry — never hand-roll a one-off tween elsewhere

**New system sound event:**
- Add to `SYS_EVENTS` in `src/sfx_bank.js`, call `playSys('your_id')` from the triggering code — never inline a raw sound id at the call site

**New localStorage-backed feature:**
- Pick a `shioumon_<name>_v1` key; write matching `load*()`/`save*()` wrappers with `try/catch` around `JSON.parse`/`stringify`, following the exact shape in `movelab.js:590-602` or `creator.tpl.html:958-965`
- If the data must be visible across templates, add the owning module's `/*__TOKEN__*/` line to every `.tpl.html` that needs it, and update `build.js`'s `MODULES` map if it's a new module

**New entry-point screen (a 5th HTML file):**
- Create `src/<name>.tpl.html`, add whichever `/*__TOKEN__*/` lines it needs for shared modules
- Register the `[tpl, out]` pair in `build.js`'s `TARGETS` array — this is the only place output naming is decided

**New verification script:**
- Add `tools/verify_<name>.js` following the existing Playwright pattern (Chromium launch with `--autoplay-policy=no-user-gesture-required`, screenshots into `.shots/`, `pageerror`/`console`-error collection against `dist/`)
- Wire it into `package.json`'s `verify` script chain

## Special Directories

**`dist/`:**
- Purpose: build output, the actual shippable artifact
- Generated: Yes, by `node build.js`
- Committed: Yes (not listed in `.gitignore`) — the built HTML is checked into the repo, so a fresh clone is playable without a build step, but this also means `dist/*.html` diffs appear in every commit that touches `src/` and re-runs the build

**`.shots/`:**
- Purpose: screenshots written by `tools/verify_*.js` during Playwright runs, for visual sanity-checking
- Generated: Yes, on every verify run
- Committed: No (gitignored)

**`assets/webgameattacksfxcc0/`, `assets/webgamesfxcc0kenney/`:**
- Purpose: raw CC0 audio source packs, consumed only by `tools/gen_sfx.py`
- Generated: No (manually downloaded/extracted by the developer when regenerating sounds)
- Committed: No (gitignored, ~29MB, not present in a normal checkout)

**`assets/sprites/`:**
- Purpose: reference sprite images (e.g. Palkia front/back) used as example art
- Generated: No
- Committed: Yes — but licensing-restricted: `README.md` states these are derived from copyrighted franchise material and must not be distributed or published

**`archive/`:**
- Purpose: memento of the first-ever generated monster individual
- Generated: No (frozen historical snapshot)
- Committed: Yes — not a pattern reference; predates several current design rules

**`node_modules/`:**
- Purpose: npm dependencies (Playwright only, `devDependencies`)
- Generated: Yes, by `npm install`
- Committed: No (gitignored) — always excluded from any exploration/search of this codebase

---

*Structure analysis: 2026-08-17*
