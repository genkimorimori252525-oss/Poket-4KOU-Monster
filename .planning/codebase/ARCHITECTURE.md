<!-- refreshed: 2026-08-17 -->
# Architecture

**Analysis Date:** 2026-08-17

## System Overview

```text
                              BUILD TIME — `node build.js`
┌───────────────────────────────────────────────────────────────────────────┐
│  src/*.js  (8 shared modules, plain <script> globals, no import/export)   │
│  fx_core.js · sfx_bank.js · moves.js · anims.js · audio_ui.js ·           │
│  movelab.js · starter_moves.js · (fx_audio.js — orphaned, unused)         │
│                                                                             │
│  src/*.tpl.html (4 templates, each with /*__TOKEN__*/ markers)            │
│  lab.tpl.html · battle.tpl.html · audiolab.tpl.html · creator.tpl.html    │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │ `build.js`: literal string-replace of each
                                 │ `/*__TOKEN__*/` with the matching module's
                                 │ full source text (no bundler, no minifier)
                                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                 dist/  — 4 independent, self-contained HTML files         │
├───────────────────┬───────────────────┬───────────────────┬───────────────┤
│ shioumon_field_    │ shioumon_effect_  │ shioumon_audio_   │ shioumon_     │
│ test.html          │ lab.html          │ lab.html          │ creator.html  │
│ 戦闘テスト（本体）    │ 技ラボ             │ 音ラボ             │ 四皇モン制作    │
│ from                │ from              │ from               │ from          │
│ `battle.tpl.html`   │ `lab.tpl.html`    │ `audiolab.tpl.html`│`creator.tpl.  │
│                     │                   │                    │html`          │
└─────────┬───────────┴─────────┬─────────┴─────────┬──────────┴──────┬──────┘
          │              RUNTIME (browser tab, zero network calls, zero bundler)
          ▼                     ▼                    ▼                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│           Shared engine/domain layer (injected per-template, see below)   │
│  EffectSystem (fx_core.js) · MOVES/TYPES/CostCalculator (moves.js) ·      │
│  ANIMS keyframes (anims.js) · SoundBank + AUDIO_CFG (sfx_bank.js)         │
└───────────────────────────────────┬───────────────────────────────────────┘
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│         localStorage — per-browser-origin, the ONLY cross-app channel     │
│  shioumon_audio_cfg_v1 · shioumon_move_lib_v1 · shioumon_wild_pool_v1 ·   │
│  shioumon_scene_sfx_v1 · shioumon_creator_auto · shioumon_creator_slots   │
└───────────────────────────────────────────────────────────────────────────┘
```

There is no server, no framework, no module bundler. Each `dist/*.html` is a
single document; `build.js` produces it by textually splicing shared module
source into a template's `<script>` block. Everything a browser needs
(sprites, all 79 sound effects, fonts fallback) is embedded — the 4 files
open directly via `file://` with zero external file references.

## Build & Shared-Module Composition

**Token → source module** (`build.js` `MODULES` map):

| Token | Source file | Contains |
|---|---|---|
| `/*__FX_CORE__*/` | `src/fx_core.js` | Seeded RNG, pixel-draw primitives, the 6 FX generator classes, `ScreenFX`, `spawnSubFX`/`DelayFX` sub-effect scheduler |
| `/*__SFX_BANK__*/` | `src/sfx_bank.js` | 79 CC0 sounds as data URIs (auto-generated), `SoundBank` playback class, `AUDIO_CFG` + `playSys`/`playMovePhase` |
| `/*__MOVES__*/` | `src/moves.js` | `TYPES` table, built-in `MOVES` registry, `CostCalculator` (`costOf`) |
| `/*__ANIMS__*/` | `src/anims.js` | Squash-and-stretch keyframe defs per animation state (`idle`/`attack`/`hurt`/`dodge`/`appear`/…) |
| `/*__AUDIO_UI__*/` | `src/audio_ui.js` | `SoundPicker`, `renderTimeline`, `renderSysMap` — sound-assignment widgets |
| `/*__MOVELAB__*/` | `src/movelab.js` | Move/FX-spec editor controls, move-library persistence (`mlLibAll`/`mlLibPut`/`mlLibDel`) |
| `/*__STARTER__*/` | `src/starter_moves.js` | 28 pre-authored move specs ("ネタ帳", data only, `audio:[]`) |
| `/*__FX_AUDIO__*/` | `src/fx_audio.js` | Legacy procedural-audio engine. **Not referenced by any template — dead code kept only for reference.** |

**Template → output, and which modules each one gets** (`build.js` `TARGETS`):

| Template | Output (`dist/`) | FX_CORE | SFX_BANK | MOVES | ANIMS | AUDIO_UI | MOVELAB | STARTER |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `lab.tpl.html` (技ラボ) | `shioumon_effect_lab.html` | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| `battle.tpl.html` (戦闘) | `shioumon_field_test.html` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `audiolab.tpl.html` (音ラボ) | `shioumon_audio_lab.html` | ✓ | ✓ | ✓ | ✓* | ✓ | — | — |
| `creator.tpl.html` (制作ツール) | `shioumon_creator.html` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

`*` `audiolab.tpl.html` injects the `ANIMS` token but never reads `ANIMS[...]`
anywhere in its own script — it is dead weight in that one output file (confirmed
by search; not a bug, just unused inclusion, worth removing if editing that template).

Reading the matrix as *why*: `battle.tpl.html` never gets `AUDIO_UI`/`MOVELAB`
because the field-test screen only *plays* sound/moves, it never lets the user
*assign* them. `lab.tpl.html` never gets `ANIMS`/`STARTER` because the effect
lab previews FX in isolation, not on an animated character, and has no need
for pre-authored move content. Only `creator.tpl.html` needs all seven live
tokens because it is the one screen that authors a complete monster (stats +
sprite + animation + FX + audio + starter-move import) end to end.

Because `build.js` does **literal text concatenation** (not `import`/module
wrapping), every top-level `const`/`function`/`class` from every injected
module lands in one shared global scope per output HTML file. Name
collisions across shared-widget modules are avoided by convention, not by the
language: `movelab.js` prefixes everything `ml*` (`mlLibAll`, `mlLibrary`,
`mlInjectCSS`), `audio_ui.js` prefixes `aui*`/`AUI*` (`auiInjectCSS`,
`auiLabel`, `AUDIO_UI_CSS`).

## Component Responsibilities

| Component | Responsibility | File |
|---|---|---|
| Build step | Token substitution, src → dist | `build.js` |
| Effect engine | Seeded RNG, dot-draw primitives, 6 FX generator classes, sub-effect (`parts[]`) scheduling shared by all 3 authoring/battle surfaces | `src/fx_core.js` |
| Move & type data | `TYPES` table (no compatibility matrix), built-in `MOVES`, `CostCalculator` | `src/moves.js` |
| Animation data | Per-state squash/stretch keyframes consumed by `Fighter`/creator preview | `src/anims.js` |
| Sound bank | 79 embedded CC0 SFX, `SoundBank` (Web Audio playback), `AUDIO_CFG` assignment table, `shioumon_audio_cfg_v1` persistence | `src/sfx_bank.js` |
| Audio assignment UI | Reusable sound-picker/timeline widgets used by 3 of the 4 templates | `src/audio_ui.js` |
| Move-builder UI | FX-spec editor controls + move-library persistence, shared by effect lab & creator | `src/movelab.js` |
| Starter move content | 28 pre-authored move specs (no audio) for the creator's "ネタ帳を棚に入れる" import | `src/starter_moves.js` |
| Battle simulation & AI | `Fighter`, fixed-timestep loop, quarter/phase state machine, Battle AI scoring (T/R/P), clash/dodge resolution, determinism self-test | `src/battle.tpl.html` |
| Effect lab | Standalone FX-spec editor/previewer (no character, no combat numbers) | `src/lab.tpl.html` |
| Audio lab | Standalone sound-to-move-phase / sound-to-system-event assignment tool | `src/audiolab.tpl.html` |
| Monster creator | Single-screen monster authoring: stats/types/sprites/shadow/cry/summon/moves/save-slots/wild-release | `src/creator.tpl.html` |
| Verification tooling | Playwright smoke tests against `dist/` (load, audio-decode counts, UI flows, determinism) | `tools/verify_audio.js`, `tools/verify_ui.js`, `tools/verify_creator.js` |
| Asset pipeline | Regenerates `src/sfx_bank.js`'s embedded SFX data URIs from raw CC0 packs | `tools/gen_sfx.py` |

## Pattern Overview

**Overall:** Shared-module monolith, assembled by textual token substitution
into 4 self-contained single-file HTML applications. No frontend framework
(no React/Vue/etc.), no module bundler, no `import`/`export` — everything is
vanilla JS in global `<script>` scope, rendered to `<canvas>` with a
hand-rolled fixed-timestep loop for the one screen (battle) that needs
simulation determinism.

**Key Characteristics:**
- Zero build tooling beyond `build.js`'s ~50-line find/replace — deliberately "素朴な" (naive) per its own header comment.
- Cross-file references work only because concatenation puts every module's declarations in the same script scope; there is no dependency graph to resolve, only an ordered list of injection points per template.
- Data-driven content: moves/effects are plain spec objects (`generator`, palette, params, `parts[]`, `motions[]`) consumed by generic code — CLAUDE.md rule 3 explicitly forbids per-move bespoke animation code.
- Canvas immediate-mode redraw every real animation frame; no virtual DOM, no diffing, no component tree.
- All persistence is client-side `localStorage`; there is no backend and no network I/O at runtime.
- Build output is fully self-contained (sprites and all audio are base64-embedded), so `dist/*.html` works from `file://` with no server.

## Layers

**Build/Assembly layer:**
- Purpose: turn shared source + templates into 4 deployable HTML files
- Location: `build.js`
- Contains: token→file map, template→output list, a synchronous read/replace/write loop
- Depends on: `src/*.js`, `src/*.tpl.html`
- Used by: `npm run build` / `node build.js`; consumed by `tools/serve.js` and all `tools/verify_*.js`, which operate on `dist/`

**Shared engine/domain layer:**
- Purpose: game rules and generic rendering primitives with zero UI concerns
- Location: `src/fx_core.js`, `src/moves.js`, `src/anims.js`, `src/sfx_bank.js`
- Contains: FX generator classes, type/move/cost tables, animation keyframes, sound bank + playback API
- Depends on: nothing else in the codebase (leaf modules)
- Used by: all 4 templates (per the composition matrix above)

**Shared UI-widget layer:**
- Purpose: reusable editor controls that would otherwise be duplicated between the effect lab, audio lab, and creator
- Location: `src/audio_ui.js`, `src/movelab.js`
- Contains: sound picker/timeline components; FX-spec slider/control builders; their own `localStorage` read/write wrappers for shared shelves
- Depends on: the engine layer (`sfx_bank.js` globals for audio_ui.js; `fx_core.js` globals for movelab.js)
- Used by: `lab.tpl.html`, `audiolab.tpl.html`, `creator.tpl.html` (never `battle.tpl.html`)

**Content-data layer:**
- Purpose: static pre-authored game content, not code
- Location: `src/starter_moves.js`
- Contains: `STARTER_MOVES` — 28 move specs matching the move-library record shape
- Depends on: nothing (data literal)
- Used by: `creator.tpl.html` only

**Application/template layer:**
- Purpose: the 4 actual screens — each owns its DOM/canvas setup, its own state, its own event wiring, and its own render loop, then calls into the shared layers above
- Location: `src/lab.tpl.html`, `src/battle.tpl.html`, `src/audiolab.tpl.html`, `src/creator.tpl.html`
- Contains: per-screen state, per-screen UI panels, (battle only) the deterministic simulation core
- Depends on: engine layer always; UI-widget layer for 3 of 4; content-data layer for creator only
- Used by: end user, directly, as `dist/*.html`

**Persistence layer:**
- Purpose: the only channel by which the 4 independently-loaded documents share data
- Location: `localStorage`, written from `src/sfx_bank.js`, `src/movelab.js`, `src/creator.tpl.html`
- See dedicated **Persistence Layer** section below

**Tooling/verification layer:**
- Purpose: automated smoke-testing of the built output; offline asset regeneration
- Location: `tools/verify_audio.js`, `tools/verify_ui.js`, `tools/verify_creator.js`, `tools/serve.js`, `tools/gen_sfx.py`
- Contains: Playwright drivers that load `dist/*.html` and click through flows; a static HTTP server for environments where `file://` scripts are blocked; a Python script that re-encodes CC0 audio into `src/sfx_bank.js`
- Depends on: `dist/` output (verify scripts, serve.js) or `assets/` raw audio (gen_sfx.py); outside the runtime app entirely

## Data Flow

### Build-time flow

1. `node build.js` reads every file in `MODULES` into memory as raw text (`build.js:16-31`)
2. For each `[tpl, out]` pair in `TARGETS`, reads the template, and for every token present in it, replaces the literal `/*__TOKEN__*/` marker with the module's source (`build.js:43-49`)
3. Writes the result to `dist/<out>`; logs size in KB per file (`build.js:50-53`)

### Battle runtime flow (primary simulation path)

1. Boot IIFE: `audioLoadSaved()` reads `shioumon_audio_cfg_v1` and applies it to `AUDIO_CFG`; `resetBattle(4242)` seeds `battleRng` and clears all `Fighter` transient state (`battle.tpl.html:1505-1521`, invoked near `battle.tpl.html:1811`)
2. `requestAnimationFrame(loop)` starts the render loop (`battle.tpl.html:1552`, `:1903`)
3. `loop(now)`: computes real `dt` from `performance.now()`, clamps it to ≤0.25s, accumulates into `acc`, and drains it in fixed `STEP=1/60` increments — this outer tick drives only UI-timed things (message box typing, instruction-drawer slide easing) (`battle.tpl.html:1552-1565`)
4. Inside each outer `STEP` tick, a **second, nested accumulator** (`battleAcc`) advances by `STEP*SPEED.battle` and drains itself in its own fixed-`STEP` sub-loop that calls `enemy.update(STEP)`, `ally.update(STEP)`, `stepBattle(STEP)`, `SCREEN.update(STEP)` — this inner loop is the actual combat simulation, always advanced in fixed `STEP` units regardless of the outer scaling (`battle.tpl.html:1566-1574`)
5. `stepBattle()` drives `stepQuarter()` (phase/quarter state machine), Battle AI scoring per candidate move/order (T/R/P terms, softmax temperature `T=1.2+(100-int)*0.34`), `resolveClash`/`resolveBeamStruggle`, dodge checks, and `damageOf()` (deterministic formula, no RNG)
6. A chosen move calls `spawnFX()`/`spawnSubFX()` (from `fx_core.js`) to create on-screen effect instances from the move's `fx` spec, and `playMovePhase(moveId, phase, SPEED.battle)` (from `sfx_bank.js`) to trigger the matching sounds at `cast`/`fire`/`impact`
7. `AILog` records every candidate's full T/R/P breakdown for the on-screen decision log (`battle.tpl.html:956-1013`) — described in `CLAUDE.md` as foundational, not optional
8. Every real animation frame (not gated by `STEP`), the canvas draw pass paints background, both `Fighter`s (via `anims.js` keyframes), live FX instances, and DOM/canvas UI panels

### Creator authoring flow (persistence-heavy path)

1. Boot IIFE: `audioLoadSaved()`, `loadSceneSfx()`, `refreshWildIds()`, then attempts to restore from `shioumon_creator_auto`; falls back to a freshly generated placeholder monster if no autosave exists (`creator.tpl.html:2261-2284`)
2. User edits (sliders, text fields, dropped image/audio files) mutate the in-memory `mon` object; `refresh()` repaints the 384×288 preview canvas and schedules a **350ms-debounced** `autoSave()` write to `shioumon_creator_auto` (`creator.tpl.html:1950`, `:2031-2045`)
3. Explicit "名前を付けて保存" / "上書き保存" write into `shioumon_creator_slots`; new names are always de-duplicated (`◯◯2`, `◯◯3`, …) rather than silently overwritten, and the collision is surfaced in the UI (`creator.tpl.html:2109-2120`)
4. "草むらへ放つ" (release to wild) pushes a `{uid, at, cost, mon}` snapshot via `pushWild()` into `shioumon_wild_pool_v1` (`creator.tpl.html:966-978`)
5. Move authoring inside the creator's built-in "技クリエーター" reuses `movelab.js`'s `mlLibrary()` against the shared `shioumon_move_lib_v1` shelf (`creator.tpl.html:1718-1732`)

**State Management:** All state is plain mutable module-scope JS (objects/arrays/primitives) — no reactive framework, no store/selector library, no signals. Each template owns an independent state graph; the *only* way state crosses from one `dist/*.html` document to another is through the `localStorage` keys documented below (each output file is a separately loaded, separately scoped document — there is no in-memory IPC between them).

## Persistence Layer (localStorage)

This is the sole cross-app communication channel. All reads/writes go through
small `try/catch`-wrapped `load*()`/`save*()` helper pairs that default to an
empty value on any failure (quota exceeded, JSON corruption, storage
disabled) — persistence code never throws into the caller.

| Key | Owner module (read/write functions) | Written by | Read by | Shape / purpose |
|---|---|---|---|---|
| `shioumon_audio_cfg_v1` | `src/sfx_bank.js` — `audioLoadSaved()` / `audioSave(cfg)` (`sfx_bank.js:247-256`) | `audio_ui.js` `SoundPicker` edits (via all 3 UI-bearing templates); `battle.tpl.html`'s own volume/reset controls (`battle.tpl.html:1793-1811`) | **All 4 entry points**, unconditionally at boot | `{master, moves:{moveId:[{id,at,off,vol,rate}]}, system:{eventId:{id,off,vol,rate}}}` — "who plays what, when." Falls back to `AUDIO_CFG_DEFAULT` if absent. Sole source of truth for `playMovePhase()`/`playSys()`. |
| `shioumon_move_lib_v1` | `src/movelab.js` — `mlLibAll()` / `mlLibPut(name,rec)` / `mlLibDel(name)` (`movelab.js:589-602`) | `lab.tpl.html` (effect lab save), `creator.tpl.html` (technique creator save) | `lab.tpl.html`, `creator.tpl.html` | `{名前: {name, fx, battle, audio}}` — the shared "shelf" of user-authored moves. `battle` is `null` when saved from the effect lab (no combat numbers available there). **Not read by `battle.tpl.html`/`audiolab.tpl.html`.** |
| `shioumon_wild_pool_v1` | `src/creator.tpl.html` — `loadWild()` / `saveWild(a)` / `pushWild()` (`creator.tpl.html:955-978`) | `creator.tpl.html` only (release-to-wild action) | `creator.tpl.html` only (list UI, dedup-by-id check) | `[{uid, at:ISOtimestamp, cost, mon:<full snapshot>}]` — monsters "released to the grass." Named as the intended Phase 19 (草むら) starting point. |
| `shioumon_scene_sfx_v1` | `src/creator.tpl.html` — `loadSceneSfx()` (`creator.tpl.html:1407-1411`), inline write at `creator.tpl.html:1425` | `creator.tpl.html` only | `creator.tpl.html` only | `{appear:{id,vol,rate}, grass:{id,vol,rate}}` — ambient scene SFX for the release animation. Deliberately kept separate from `AUDIO_CFG`/`sfx_bank.js` because that file is auto-generated and must not be hand-edited. |
| `shioumon_creator_auto` | `src/creator.tpl.html` — inline in `autoSave()` / boot IIFE (`creator.tpl.html:1969`, `:2031-2045`, `:2268-2269`) | `creator.tpl.html`, debounced 350ms after any edit | `creator.tpl.html`, once, at boot (restore-in-progress-work) | Full `snapshot()` JSON of the monster currently being edited, incl. inline (non-derived) image data URIs. Cleared by "初期化" (`creator.tpl.html:2245`). |
| `shioumon_creator_slots` | `src/creator.tpl.html` — `loadSlots()` (`creator.tpl.html:2046-2048`), writes at `:2065`, `:2103`, `:2119` | `creator.tpl.html`, only on explicit save/overwrite/delete | `creator.tpl.html` only | `{slotName: <snapshot JSON string>}` — named, permanent monster saves. Overwrite is a deliberate two-press confirm (`creator.tpl.html:2088-2107`); "save as" always dedups the name rather than clobbering. |
| `shioumon_crydelay_050` | `src/creator.tpl.html`, inline (`creator.tpl.html:2273-2280`) | `creator.tpl.html`, once ever | `creator.tpl.html`, once at boot | Not real data — a one-shot migration marker (`'1'`). Its presence means "the one-time cry-delay-default migration (0.8→0.5) already ran"; prevents re-migrating a value the user may have deliberately restored to 0.8. |

**Cross-cutting persistence facts:**
- All 7 keys share the `shioumon_` prefix; 4 of them additionally carry a `_v1` version suffix (the ones with a defined schema that might need future migration); the creator's own save/autosave keys and the migration flag do not.
- Storage is scoped per browser **origin** — `file://.../shioumon_creator.html` opened directly, the same file served via `tools/serve.js` (`http://localhost:8765`), and a different browser are each a *separate* storage bucket. This is called out explicitly in `CLAUDE.md` as the first thing to check when a user reports "my save disappeared."
- No key is ever read by more than the templates listed above — `battle.tpl.html` only ever touches `shioumon_audio_cfg_v1`; everything creator-specific stays entirely within `creator.tpl.html`.
- Every write path is guarded (`try{...}catch(e){...}`) and every read path defaults to a safe empty value — this is a deliberate, repeated pattern (see `movelab.js:590-602` and `creator.tpl.html:958-964` for the canonical shape to copy when adding a new key).

## Key Abstractions

**FX Spec (technical effect specification):**
- Purpose: fully describes a move's visual behavior as plain data — `{generator, seed, palette, <per-generator shape params>, parts:[], motions:[], screen:{}, timeScale}`
- Examples: `src/moves.js` (built-in `MOVE_*` constants), `src/starter_moves.js`, `mon.customMoves[].fx` in `creator.tpl.html`
- Pattern: `makeSpec()`/`buildEffect()` (`fx_core.js`) turn a spec into cached drawable frames; `spawnFX(sp,...)` (`fx_core.js:690-699`) dispatches on `sp.generator` to instantiate the right class (`ProjectileFX` default, or `BeamFX`/`SlashFX`/`LightningFX`/`AuraFX`/`ShatterFX`)

**Sub-effect parts (`fx.parts[]`):**
- Purpose: secondary decoration attached to a phase (`cast`/`fire`/`impact`), an anchor (`from`/`to`/`center`), a `dx,dy` offset, and an `off` delay in seconds
- Examples: `MOVE_AKUU.shatter` (legacy single-part form, still auto-upgraded), any `parts:[]` entry in a custom move's fx spec
- Pattern: **must** be routed through `spawnSubFX(sp, phase, pts)` (`fx_core.js:767-777`) — CLAUDE.md rule 3 forbids any call site constructing these ad hoc; historically, not doing so made the 亜空切断 glass-shatter effect appear only in battle and not in the lab/creator previews

**DelayFX:**
- Purpose: defers constructing its wrapped FX until `delay` seconds of *simulated* `dt` have elapsed, so delayed sub-effects still advance on the fixed-timestep clock
- Examples: `src/fx_core.js:718-734`; produced by `spawnPart()` whenever a part's `off > 0`
- Pattern: used instead of `setTimeout` specifically to preserve battle determinism (see Architectural Constraints)

**Fighter:**
- Purpose: the runtime combat unit — stat block (`atk/def/hp/spd/eva/int`), personality (`per.{aggr,caut,loyal,self}`), derived getters (`maxHP`, `cdScale`, `castScale`, `shotScale`, `flinchRate`) computed from stats, plus animation/motion-scheduling state (`anim`, `t`, `pendMo`, `seqT` for landing sequences)
- Examples: `src/battle.tpl.html:382-539` (`class Fighter`)
- Pattern: `creator.tpl.html` maintains a parallel but *separate* `mon`/preview object — not the same class — and must be kept behaviorally consistent by convention (CLAUDE.md rule 4: `resolve()` in both templates "must make the same decision")

**AUDIO_CFG / MOVE_PHASES / SYS_EVENTS:**
- Purpose: single source of truth for "what sound plays when" — keyed by move-id→phase and by system-event-id
- Examples: `src/sfx_bank.js:166-222`
- Pattern: mutated only through `audioApply()`/`audioSave()`, read only through `playMovePhase()`/`playSys()` — this indirection is what lets battle, both labs, and the creator honor the same sound choices without duplicating playback logic

**Move Library record:**
- Purpose: the shared shape for a saved move, `{name, fx, battle, audio}`
- Examples: `shioumon_move_lib_v1` entries
- Pattern: `battle` is `null` when authored from the effect lab (no combat numbers available there); populated when authored/edited from the creator

**BUILTIN_MOVES snapshot + `syncCustom()`:**
- Purpose: lets a player override a built-in move's numbers/FX/audio per-monster without mutating the shared built-in table for everyone else
- Examples: `creator.tpl.html:355` (`const BUILTIN_MOVES=JSON.parse(JSON.stringify(MOVES))`), `creator.tpl.html:1576-1579` (`syncCustom()`)
- Pattern: deep-clone `MOVES` once at boot; `syncCustom()` rebuilds the live `MOVES` table every time by replaying "restore from `BUILTIN_MOVES`, then layer `mon.customMoves[]` on top" — cost calculation and audio lookup always go through the same `MOVES` table regardless of stock-vs-overridden

## Entry Points

**`dist/shioumon_field_test.html`** (from `src/battle.tpl.html`):
- Triggers: opened directly by the user; primary/most-developed screen ("本体")
- Responsibilities: deterministic AI-vs-AI battle simulation, quarter/phase state machine, strategy+order UI ("采配"), determinism self-test button, AI decision log
- Boot: IIFE near end of file calls `audioLoadSaved()`, `resetBattle(4242)`, then `requestAnimationFrame(loop)`

**`dist/shioumon_effect_lab.html`** (from `src/lab.tpl.html`):
- Triggers: opened directly by the user for move-FX authoring
- Responsibilities: build/edit an FX spec via `movelab.js` controls, live-preview via `fx_core.js`, save to/load from the shared move library
- Boot: `audioLoadSaved()` near end of file

**`dist/shioumon_audio_lab.html`** (from `src/audiolab.tpl.html`):
- Triggers: opened directly by the user for sound-assignment authoring
- Responsibilities: assign sounds to move phases and system events via `audio_ui.js`, persist to `shioumon_audio_cfg_v1`
- Boot: `audioLoadSaved()` near end of file

**`dist/shioumon_creator.html`** (from `src/creator.tpl.html`):
- Triggers: opened directly by the user to author one monster end to end
- Responsibilities: stats/types/sprite-slot/shadow/cry/summon-style/idle-motion authoring, built-in technique creator, save-slot management, autosave, release-to-wild
- Boot: `auiInjectCSS()`/`mlInjectCSS()` → `audioLoadSaved()`/`loadSceneSfx()`/`refreshWildIds()` → restore-from-autosave-or-placeholder → one-shot cry-delay migration → `registerMonCry()`/build UI/`refresh()` (`creator.tpl.html:2261-2284`)

**`node build.js`** (not a runtime entry point, but the only way `dist/` is produced):
- Triggers: `npm run build` or direct invocation, whenever any `src/*.js` or `src/*.tpl.html` changes
- Responsibilities: token substitution, described in full above

## Architectural Constraints

- **Threading:** single-threaded, browser main thread only. No Web Workers. `SoundBank.load()`/`decodeOne()` are `async` (awaiting `AudioContext.decodeAudioData`) but this only affects when sounds become playable, never the simulation clock.
- **Global state:** because `build.js` concatenates raw text rather than wrapping modules, every top-level declaration in an injected module becomes an implicit global of that specific output document (`AUDIO_CFG`, `MOVES`, `ANIMS`, `SND`, `battleRng`, etc.). The set of available globals differs per output file exactly per the composition matrix above — code in `battle.tpl.html` must never assume `mlLibAll`/`SoundPicker` exist, and code shared via `audio_ui.js`/`movelab.js` must never assume `ANIMS`/`STARTER_MOVES` exist.
- **No import graph:** there are no circular-import risks because there is no `import` statement anywhere in `src/`; ordering is fixed by each template's literal token placement, not by dependency resolution.
- **Determinism boundary (battle simulation only):** nothing reachable from `stepBattle()`, `Fighter.update()` during the `battleAcc` sub-loop, `damageOf()`, Battle AI scoring, or clash/dodge resolution may call `Math.random()` or use wall-clock timers (`setTimeout`/`setInterval`) for anything that affects simulated outcome or timing. The only permitted source of randomness is `battleRng.next()` — a seeded PRNG (`class RNG` in `fx_core.js`), reseeded every `resetBattle(seed)`. Deterministic "randomness" that must vary without consuming `battleRng` (e.g. cry-bark jitter) instead derives from `hash3(seed, ...)`, a pure deterministic hash — see `CRY_JITTER`/`cryJitter()` in `fx_core.js:779-789`. `DelayFX` exists specifically so effects can "wait N seconds" without `setTimeout`.
- **Fixed-timestep vs. real-time separation:** exactly two clocks coexist in `battle.tpl.html`'s `loop()`. Real `dt` (from `performance.now()`, clamped ≤0.25s) drives only cosmetic/UI timing (message-box typing, instruction-drawer slide easing). Everything gameplay-relevant advances exclusively in fixed `STEP=1/60` increments, additionally sub-scaled by `SPEED.battle` (0.75× by default) through the nested `battleAcc` accumulator — **never** by the raw per-frame `dt`. Any new gameplay-affecting code must be driven by this `STEP`-accumulator path, not by `requestAnimationFrame`'s frame `dt` directly.
- **Self-verifying invariant:** the determinism constraint is not just documented but mechanically checked — `determinismTest()` (`battle.tpl.html:1523-1542`) runs a full 40 simulated seconds twice from the same seed (`90210`) and diffs an HP signature sampled every 30 steps; exposed as the "決定論チェック" button. A regression here has a known historical root cause (an unreset `f.lastMove` field), which is why `resetBattle()` carries an explicit comment warning future edits not to add a new Fighter field without also clearing it there.

## Anti-Patterns

### Per-move bespoke animation/effect code

**What happens:** writing a custom draw/animate function tailored to one specific move instead of expressing it as spec data for the shared generators.
**Why it's wrong:** breaks the "JSON spec + seed" contract (CLAUDE.md rule 3), triples the implementation (lab/creator/battle each need their own copy), and has concretely caused visual drift: the 亜空切断 (Akuu Setsudan) glass-shatter effect once appeared only in battle and not in the effect lab or creator preview, because its sub-effect wasn't routed through the shared function.
**Do this instead:** extend one of the 6 `fx_core.js` generator classes, or add entries to `fx.parts[]` consumed uniformly via `spawnSubFX(fx, phase, pts)` (`fx_core.js:767`) — the same call is used by the effect lab, the creator, and battle; never write a third call site.

### Using `setTimeout` for anything battle-relevant

**What happens:** scheduling part of a move's effect timing, sound timing, or any other battle-affecting delay with `setTimeout`.
**Why it's wrong:** `setTimeout` runs on wall-clock time, silently decoupling from the `STEP`/`SPEED.battle` fixed-timestep clock and breaking the determinism self-test (explicit rule in `CLAUDE.md` item 3 and reiterated as a code comment at `fx_core.js:711`).
**Do this instead:** use `DelayFX` for visuals (`fx_core.js:718`) or the `off`-field `dt`-counted delay already built into `playAt()` (`sfx_bank.js:231-236`) for audio — both advance strictly on the fixed-timestep loop.

### Forgetting to clear new transient `Fighter` fields in `resetBattle()`

**What happens:** adding a new mutable field to `Fighter` (e.g. a new animation-scheduling flag) without also resetting it inside `resetBattle()`.
**Why it's wrong:** the field carries a stale value over from the previous match, so two runs seeded identically diverge — this concretely happened with `f.lastMove` not being cleared, and is called out by name in both `CLAUDE.md` and an inline code comment.
**Do this instead:** whenever a new mutable `Fighter` field is introduced, add its reset line to the existing block in `resetBattle()` (`battle.tpl.html:1505-1521`) and re-run the 決定論チェック button before considering the change done.

### Drawing the opponent preview from the wrong state object

**What happens:** preview-drawing code in `creator.tpl.html` reaches into the module-level `mon`/`imgs` globals instead of using the `S={mon,imgs}` parameter it was passed.
**Why it's wrong:** the opponent-side preview must render an arbitrary *saved* individual, not the monster currently being edited; reaching for the globals makes the "enemy" silently mirror the player's own in-progress edits.
**Do this instead:** every preview-drawing helper accepts and reads exclusively from its `S` parameter (CLAUDE.md, "触るときの勘どころ" section).

### Declaring render-loop-read variables outside the "0. 状態" block

**What happens:** a variable the draw loop/`tick()` reads gets declared later in `creator.tpl.html`, after the loop-scheduling code.
**Why it's wrong:** `let`/`const` hoist into the temporal dead zone; calling into code that reads the variable before its declaration line executes throws a `ReferenceError` immediately on load — this concretely happened with `previewKey`.
**Do this instead:** declare every variable the render loop touches inside `creator.tpl.html`'s leading "0. 状態" section (`creator.tpl.html:338`), and always schedule the loop body via `requestAnimationFrame(tick)`, never call it synchronously.

## Error Handling

**Strategy:** defensive, localized `try/catch` at every `localStorage` read/write and every `JSON.parse`/`stringify` call. Every persistence helper swallows exceptions and returns a safe default (`{}`, `[]`, `false`) rather than propagating — storage-disabled and quota-exceeded are treated as expected, not exceptional, conditions.

**Patterns:**
- Read helpers: `try{ return JSON.parse(localStorage.getItem(KEY)||'<empty>'); }catch(e){ return <empty>; }` (canonical form at `movelab.js:590-593`, `creator.tpl.html:958-961`)
- Write helpers: `try{ localStorage.setItem(...); return {ok:true}; }catch(e){ return {ok:false,msg:...}; }`, with the failure message surfaced directly in the UI rather than only logged (e.g. `creator.tpl.html:962-965`, `:2041-2044`)
- Input parsing (dropped files, pasted JSON): always reports success/failure as visible on-screen text — CLAUDE.md is explicit that silent failure is the worst outcome ("黙って失敗するのが一番たちが悪い")
- Loaded/pasted monster data is always passed through `normalizeMon()` (`creator.tpl.html`) to clamp/coerce every field to a safe range/shape before use, defending against malformed or old-format JSON

## Cross-Cutting Concerns

**Logging:** `AILog` (`battle.tpl.html:956-1013`) is a structured, purpose-built decision log — every AI move/order choice is recorded with its complete T(basic)/R(read)/P(personality) score breakdown per candidate. CLAUDE.md frames this as foundational ("開発の根底はデバッグだ" / "AIログを後回しにしない") — there is no generic app-wide logger; this is the primary observability mechanism for the one subsystem that needs it.

**Validation:** `normalizeMon()` in `creator.tpl.html` clamps/coerces every field of a loaded/pasted monster object (stats, types, moves, `customMoves[]`, `summon.land[]`, `summon.cryDelay`, etc.) to safe ranges and shapes before it's used anywhere else — this is the main input-validation boundary in the codebase.

**Authentication:** none. Single-player, fully client-local, no accounts, no network calls at runtime.

---

*Architecture analysis: 2026-08-17*
