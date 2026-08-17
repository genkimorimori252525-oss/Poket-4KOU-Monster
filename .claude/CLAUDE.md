<!-- GSD:project-start source:PROJECT.md -->

## Project

**ポケット四皇モンスター**

鴨川周平（にーくら）の友人グループ「四皇」をテーマにした、**収集 → 育成 → 編成 → AI自動戦闘** の
モンスターゲーム。HTML/JS 製、個人プロジェクトで配布しない。理想はゲーム版ポケモンではなく
**アニメ版ポケモンの戦い方** ——プレイヤーは技を直接選ばず、采配だけで勝敗を動かす。

ゲーム本体（`docs/開発計画_v6.md` が正典、Phase 0〜14 完了）とは別に、それを作るための
**補助ツール群**（戦闘テスト・技ラボ・音ラボ・四皇モン制作ツール）が `dist/` に4画面ある。
**この GSD マイルストーンが扱うのは、後者の開発基盤だけ。** ゲーム本編には触らない。

**Core Value:** **にーくらが作ったもの（四皇モン・技・音）が、容量を気にせず保存でき、実際の戦闘に出てくること。**

今はこの両方が成立していない。保存は 5MB の壁と消失リスクを抱え、制作ツールで作った個体は
戦闘画面から一度も参照されていない。ここが直れば、他は全部おまけ。

### Constraints

- **設計の掟**: `docs/開発計画_v6.md` 末尾の禁止事項26個が正典（`CLAUDE.md` §4 に要約）。
  特に効く： 決定論を壊さない／可変dtを戦闘計算に使わない／技ごとのアニメコードを書かない／
  画像ファイルを増やさない／音IDをベタ書きしない／`confirm()` を分かれ道に置かない。

- **`dist/` は単体で開ける**: 外部ファイル参照ゼロを維持する。軽量化は別モードで達成する。
- **`src/sfx_bank.js` は不可触**: 自動生成物だが元素材が無く復元不可。手で編集しない。
- **音の決定権は100%にーくら**: 圧縮も割り当ても自動で決めない（掟8）。
- **戦闘で `Math.random()` を使わない**: 演出の揺らぎも `battleRng` を消費せず種から決める。
- **配布しない**: 個人プロジェクト。認証・課金・マルチユーザーの考慮は一切不要。
- **Windows 11 / Node v26 / Deno 2.9 / Bun 1.3 / Python 3.13** が導入済み。追加インストール不要。

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript (vanilla ES2020+, no TypeScript) — all game logic and UI. Lives in `src/*.js` (shared modules) and inline `<script>` blocks in `src/*.tpl.html` (per-screen logic). No transpilation, no bundler — the code that runs in the browser is exactly the code checked into `src/`.
- HTML5 + CSS3 — `src/*.tpl.html` (4 files), inline `<style>` blocks per template. No CSS framework, no preprocessor (no Sass/Less/PostCSS).
- Python 3 — `tools/gen_sfx.py` only. Build-time/asset-time tool, never shipped to the browser. Not version-pinned (no `.python-version`, no `pyproject.toml`); dev environment observed running Python 3.13.14.
- Node.js (CommonJS) — `build.js`, `tools/serve.js`, `tools/verify_*.js`. Dev/build tooling only, never shipped to the browser.

## Runtime

- **Shipped product runtime = the browser.** `dist/*.html` are self-contained single-file artifacts (all images/audio embedded as base64 `data:` URIs) meant to be opened directly via `file://` or served statically. There is no Node.js, no server, and no runtime dependency of any kind once a `dist/*.html` file exists.
- **Dev/build runtime = Node.js.** No `engines` field in `package.json`. The sole npm dependency, `playwright@^1.62.1`, declares `"engines": {"node": ">=20"}` in its own manifest (`package-lock.json`), which is the closest thing to a stated minimum. Dev environment observed running Node v26.1.0.
- Target browser capability (inferred from API usage, not stated anywhere): ES2020 `class` syntax, `Web Audio API`, `Canvas 2D`, `requestAnimationFrame`, `FileReader`, HTML5 drag-and-drop, `localStorage`. Verification is explicitly against Chromium only (via Playwright) — no cross-browser test matrix.
- npm
- Lockfile: `package-lock.json` present (`lockfileVersion: 3`)

## Frameworks

- None. No frontend framework (no React/Vue/Svelte/etc.), no state-management library, no router. All 4 screens are plain global-scope scripts operating directly on the DOM and a `<canvas>`.
- `playwright` `^1.62.1` (the project's only npm dependency, declared as a `devDependency` in `package.json`) — used as a **browser automation / verification harness**, not a conventional test framework. There is no test runner (no Jest/Vitest/Mocha), no `describe`/`it` blocks, and no assertion library. `tools/verify_audio.js`, `tools/verify_ui.js`, `tools/verify_creator.js` are plain async Node scripts that drive `chromium.launch()` directly and `console.log(JSON.stringify(results))` for a human to read. See `TESTING.md` (quality focus) for details if present.
- `build.js` (project root, ~56 lines) — a hand-rolled templater. It reads each `src/*.js` module into memory and does literal token replacement (e.g. `/*__FX_CORE__*/` → contents of `src/fx_core.js`) inside each `src/*.tpl.html`, then writes the result to `dist/`. No AST parsing, no minification, no source maps, no watch mode.
- `tools/serve.js` (~19 lines) — zero-dependency static file server built directly on Node's `http` module (no Express/Koa/etc.). Serves `dist/` on `http://localhost:8765`. Exists only because some browsers restrict JS features (e.g. audio autoplay, fetch) under `file://`.
- `tools/gen_sfx.py` — regenerates `src/sfx_bank.js` from raw CC0 audio files in `assets/` (not committed — see Configuration below). Shells out to `ffmpeg` (via `subprocess.run`) to downmix/recompress each clip to mono 22.05kHz Ogg Vorbis before base64-embedding it, to minimize the size of the generated JS file.

## Key Dependencies

- `playwright` `^1.62.1` — the **only** entry in `package.json` (`devDependencies`). Not used by the shipped app at all; used exclusively by `tools/verify_*.js` to drive headless/headed Chromium for manual-style verification runs (screenshots to `.shots/`, console/page-error capture, in-page evaluation of app state like `determinismTest()`).
- `playwright-core` `1.62.1` and `fsevents` `2.3.2` (macOS-only, optional) — transitive, pulled in automatically by `playwright`.
- None. Zero runtime npm packages are bundled into `dist/*.html` — the shipped product has no dependency graph at all, by design (see `CLAUDE.md` rule 4: no image-gen AI, no added image files; everything is hand-written procedural code).

## Configuration

- No `.env` files exist in the project (confirmed by directory listing).
- No required environment variables for the app itself (it's static HTML/JS with no server).
- One optional dev-only env var: `PW_CHROMIUM` — path to a Chromium executable, read by all three `tools/verify_*.js` scripts when Playwright's bundled Chromium can't be found/launched in the current environment.
- `.gitignore` excludes `node_modules/`, `.shots/` (Playwright screenshot output), `*.log`, and two large asset-source directories (`assets/webgameattacksfxcc0/`, `assets/webgamesfxcc0kenney/` — the raw CC0 sound packs, ~29MB combined, only needed when re-running `tools/gen_sfx.py`; not required for normal build/dev since `src/sfx_bank.js` already has everything baked in).
- No `tsconfig.json`, no `.eslintrc*`, no `.prettierrc*`, no `webpack`/`vite`/`rollup`/`esbuild` config, no `.babelrc`, no `.editorconfig`, no `.nvmrc`. Zero tooling-config files exist in this repo beyond `package.json` itself and `build.js`.
- `build.js` token map (source module → template placeholder), all in `src/`: `fx_core.js`→`/*__FX_CORE__*/`, `sfx_bank.js`→`/*__SFX_BANK__*/`, `moves.js`→`/*__MOVES__*/`, `anims.js`→`/*__ANIMS__*/`, `audio_ui.js`→`/*__AUDIO_UI__*/`, `movelab.js`→`/*__MOVELAB__*/`, `starter_moves.js`→`/*__STARTER__*/`, `fx_audio.js`→`/*__FX_AUDIO__*/` (legacy, unused, marked for deletion in `CLAUDE.md`).
- Build targets (`src/*.tpl.html` → `dist/*.html`): `lab.tpl.html`→`shioumon_effect_lab.html`, `battle.tpl.html`→`shioumon_field_test.html`, `audiolab.tpl.html`→`shioumon_audio_lab.html`, `creator.tpl.html`→`shioumon_creator.html`.
- `src/sfx_bank.js` (630,813 bytes / ~616KB) is machine-generated by `tools/gen_sfx.py` and must never be hand-edited (enforced only by convention/comment, not tooling) — it embeds 79 CC0 sound effects as base64 `data:` URIs plus the `SoundBank` class and the default `AUDIO_CFG` sound-assignment table.

## Platform Requirements

- Node.js (>=20 recommended, per Playwright's own engine constraint) + npm, for `npm install` (pulls in Playwright + its bundled Chromium) and running `build.js`/`tools/*.js`.
- Python 3 + `ffmpeg` on `PATH` — **only** needed to regenerate `src/sfx_bank.js` via `python3 tools/gen_sfx.py`, and only if the two raw CC0 asset packs are present under `assets/` (gitignored, ~29MB, not part of a fresh checkout). Not required for `npm install && node build.js`.
- A Chromium binary reachable by Playwright (bundled by default; override via `PW_CHROMIUM` env var if unavailable) — needed only to run `tools/verify_*.js`, not to build.
- None — there is no production deployment. `dist/*.html` are meant to be opened locally (`file://`) or shared as standalone files; `tools/serve.js` exists purely as a local dev convenience for environments where `file://` blocks certain JS behavior, not as a hosting solution.
- Target consumer is a single developer/tester on desktop or mobile browser (`README.md`: internal render resolution 384×288 upscaled nearest-neighbor, "スマホ片手で触る前提のUI" — designed for one-handed phone use, viewport meta locks zoom).
- Explicitly not distributed: `README.md` states this is a personal project that will not be published, in part because `assets/sprites/` contains copyrighted Pokémon sprite reference art used only for internal prototyping.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## 0. The 26 Design Rules — Verified Against Code

| # | Rule (abridged) | Status | Enforced at |
|---|---|---|---|
| 9 | No direct `Math.random()`; all randomness through seeded PRNG | **Verified** | `Math.random()` does not appear anywhere in `src/`, `dist/`, or `tools/` except inside Japanese comments *describing* the rule. Seeded generator: `class RNG` at `src/fx_core.js:6-14` (mulberry32-style). Battle instance: `let battleRng=new RNG(4242)` at `src/battle.tpl.html:916`, reseeded per match in `resetBattle(seed)` at `src/battle.tpl.html:1507`. |
| 10 | No variable delta-time in battle calculations; fixed timestep | **Verified** | `const STEP=1/60;` at `src/battle.tpl.html:1548`. Real elapsed time only drives an accumulator (`acc+=dt`); the sim advances in fixed `STEP` chunks inside `while(acc>=STEP){...}` at `src/battle.tpl.html:1558`. Battle/FX speed multiplier `SPEED={battle:0.75}` scales the *step size fed into the accumulator*, not `dt` itself: `battleAcc += STEP*SPEED.battle;` (`src/battle.tpl.html:1568`) — UI (drawer, message box) still advances on real `dt`. |
| 4 (design doc) / CLAUDE §4.3 | No per-move animation code; moves are JSON spec + seed, rendered by shared generators | **Verified** | Move data is plain objects (`MOVES` in `src/moves.js:86-99`, `STARTER_MOVES` array in `src/starter_moves.js`). All rendering goes through 6 shared `BaseFX` subclasses in `src/fx_core.js`: `ProjectileFX`(:350) `BeamFX`(:403) `SlashFX`(:456) `LightningFX`(:485) `AuraFX`(:541) `ShatterFX`(:580). The same `fx_core.js` is spliced into **all four** `.tpl.html` templates via the `/*__FX_CORE__*/` build token (confirmed present in `battle.tpl.html`, `creator.tpl.html`, `lab.tpl.html`, `audiolab.tpl.html`) — one `EffectSystem`, not four. |
| " | `fx.parts[]` sub-effects must go through `spawnSubFX()`, never hand-rolled per call site | **Verified** | Single entry point: `spawnSubFX(sp, phase, pts)` at `src/fx_core.js:767-777`. All 3 call sites (battle, move lab, creator) use it — this was a real historical bug (亜空切断's glass-shatter effect only appeared in battle, not in the labs, because battle alone spawned `fx.shatter` directly) fixed by centralizing into this function. |
| " | Delay for `off` must use fixed-timestep counting, never `setTimeout` | **Verified** | `class DelayFX` at `src/fx_core.js:718-734` counts down `this.delay -= dt` inside its own `update(dt)`, only constructing the real effect once `delay<=0`. No `setTimeout` appears anywhere in `spawnPart`/`spawnSubFX`/`DelayFX`. **Contrast with audio** — see rule 25/26 below; the two systems intentionally use different delay mechanisms. |
| 4 (design) | No external image-gen AI; no growing the image-file count | **Verified** | All FX/backgrounds are Canvas-drawn primitives (`pxLine`/`pxDisc`/`pxRing`/`pxArc`/`fillPolyPx`, `src/fx_core.js:25-60`+). Only real raster images are the per-monster static photos (normal/attack/hurt/back/summon) and 2 reference sprites in `assets/sprites/`. |
| " | Self side (手前) always renders the **back** sprite; front/attack/hurt art only for the far side | **Verified, but duplicated logic — see §6 below** | `Fighter.resolve(key)` method, `src/battle.tpl.html:474-480` (keyed on `this.useBack`). Independently reimplemented as standalone `function resolve(key,back,st,S)` in `src/creator.tpl.html:464-480` (keyed on `previewKey`). Same intent, different code — both must be edited together when this rule changes; missing this exact sync caused a real regression per `HANDOFF.md`. |
| 14 (dup of §4.item 5) | No type-effectiveness matrix; only same-type bonus | **Verified** | `src/moves.js:5-14`: `TYPES` is just `id → hex color` for UI chips; `const STAB={value:1.25}`; `stabOf(f,m)` returns `1.25` or `1.0`. No NxN lookup table anywhere in the repo. |
| 15 | Speed and evasion must stay separate stats | **Verified** | `spd` and `eva` are distinct keys everywhere stats are enumerated, e.g. `STAT_JP` at `src/creator.tpl.html:350` and `src/battle.tpl.html:1701`. |
| 13 | Never more than 6 stats | **Verified** | Every stat table (`STAT_JP`, `COST_W` in `src/moves.js:105`, `Fighter.stats`) has exactly `{atk,def,hp,spd,eva,int}` — 6 keys, consistently. |
| 17 | Cost must never gate party composition (it's in-match team HP, not a deck-build budget) | **Not yet wired — rule trivially holds** | `costOf()` exists in `src/moves.js:106-114` marked "仮式・Phase15で本採用" (provisional formula, adopted in Phase 15). No code anywhere blocks team assembly by cost total — the restriction the rule forbids simply hasn't been built. Confirm this stays true when Phase 15 lands: cost should only ever subtract from a *match-time* pool, never gate roster selection. |
| 18 | No grinding/leveling growth system | **Verified** | No `exp`, `level`, `levelUp`, or `経験値` identifiers anywhere under `src/`. |
| 19, 20, 21 | Last-stand bonuses only via traits (not global rules); trait hooks capped at 9; traits must do more than tweak numbers | **Not yet applicable** | Trait system (特性, Phase 17) is unimplemented — `docs/開発計画_v6.md:151-163` already lists the fixed 9-hook contract (`onBattleStart`, `onQuarterStart`, `modifyStat`, `modifyMoveScore`, `onOrder`, `onDamaged`, `onClash`, `onDodge`, `onFaint`) for when it's built. Nothing to violate yet — but this hook list is the contract to honor. |
| 12 | No one-shot kills / crit-death mechanics | **Verified** | No crit/instakill terms in `scoreMove`/damage code; damage is pure `atk`-derived with STAB, no instant-death branch. |
| 8, 25 | No sound IDs hardcoded into battle logic; only `playSys()` / `playMovePhase()`; sound config is 100% the designer's call | **Verified, 2 documented exceptions** | `playMovePhase(moveId,phase,speed)` / `playSys(ev)` at `src/sfx_bank.js:237-245`, both reading from `AUDIO_CFG` (itself hydrated from `localStorage['shioumon_audio_cfg_v1']` via `audioLoadSaved()`, shared by battle + both labs). Battle triggers all move/system sound only through these two, e.g. `src/battle.tpl.html:1222,1236,1242`. **Exception 1:** `audio_ui.js`'s `SoundPicker` calls `SND.play(id)` directly (`src/audio_ui.js:94,177,191,215,219`) — this *is* the assignment UI itself (auditioning bank sounds while building `AUDIO_CFG`), not battle logic. **Exception 2:** monster cry playback calls `SND.play(c.id,...)` directly (`src/battle.tpl.html:484`, `src/creator.tpl.html:799/817/820`) because a cry is a per-individual data field (`mon.cry={id,vol,rate}`), not a system/move event keyed through `AUDIO_CFG`. |
| 26 | Sound playback must never influence battle logic (RNG/state) | **Verified** | `playAt/playSys/playMovePhase` (`src/sfx_bank.js:231-245`) are fire-and-forget — no caller inspects a return value to change state. `cryJitter()`/`cryDelayWith()` (`src/fx_core.js:784-791`) derive the ±0.15s cry-timing jitter from a **hash of the seed**, explicitly *not* from `battleRng.next()` — comment states outright "battleRng は消費せん" (battleRng is deliberately not consumed), because letting cosmetic timing draw from the battle RNG would desync the determinism check. |
| 8, 25 (delay) | Audio's own `off` delay *is* allowed to use `setTimeout` | **Verified, and correct** | `playAt(e,speed)` at `src/sfx_bank.js:231-236` uses `setTimeout(...)` for its offset. This is intentionally different from the FX-parts rule above: audio is a one-way, fire-and-forget side effect (rule 26) that never feeds back into sim state, so browser timer jitter can't desync the sim. FX-parts (`DelayFX`) *can* eventually spawn things that participate in hit/clash resolution, so those must stay on the fixed-step clock. |
| 11, 9(design)/24 | AI log must not be an afterthought; must show a breakdown, not just a total | **Verified** | `AILog` object at `src/battle.tpl.html:959-1011` logs every decision to both `console.log` (formatted) and an on-screen panel (`renderLog()`). Every scored candidate carries a `terms[]` array, never a bare total. |
| 16, 23 | 賢さ(int) must not just be "bigger is better"; the 3 documented downsides and the "read" scoring term must both exist | **Verified** | Downsides (a) predictability and (b) reduced order-obedience fall out automatically from one formula: `tempOf(f)` (`src/battle.tpl.html:1167-1171`) feeds `softmax(cands,T)` (`:1173-1178`) — higher `int` → lower temperature `T` → sharper distribution around the top choice. Downside (c) "plays it safe" and the read-term mechanic: `readOf(f)` at `src/battle.tpl.html:1083-1086` computes `read = stats.int/100` (boosted further if an active order raises obedience), consumed by the `R(name,v)` term helper (`src/battle.tpl.html:1107`, duplicated verbatim in `tryDodge()` at `:1418`) which scales a "read-only" bonus by `read` before adding it to the score. |
| 22 | Move lab and battle must share one `EffectSystem`, never diverge | **Verified** | See "per-move animation" row above — same `fx_core.js` token spliced into all 4 templates. |
| 1-3 (CLAUDE §4 preamble), 3 (数値直書き禁止) | Don't scatter magic numbers through logic; centralize tunables | **Verified as a pattern, not a hard gate** | Named constant tables carry the tunable numbers instead of inline literals: `COST_W` (`src/moves.js:105`), `STAB` (`src/moves.js:13`), `CLASH` (`src/battle.tpl.html:1301`), `QUARTER` (`src/battle.tpl.html:918`), `TACTIC_BIAS`/`TACTIC_TEMP` (`src/battle.tpl.html:1043,1057`), `AUDIO_CFG_DEFAULT` (`src/sfx_bank.js:190`). `docs/開発計画_v6.md`'s 未決事項 table separately tracks which of these still need to become fully external config (e.g. `stat_tradeoff_config`, not yet built). |

## 1. Naming Patterns

- `snake_case.js` for shared modules: `fx_core.js`, `sfx_bank.js`, `audio_ui.js`, `starter_moves.js`, `movelab.js`.
- `name.tpl.html` for the 4 page templates in `src/` (`battle.tpl.html`, `creator.tpl.html`, `lab.tpl.html`, `audiolab.tpl.html`); `build.js` maps each to a `dist/shioumon_<name>.html` output (see `build.js:33-38`).
- Docs are Japanese-titled: `docs/開発計画_v6.md`, `docs/技ネタ_タイプ別.md`.

## 2. Code Style

## 3. Language Mixing (Japanese / English)

- **Identifiers (functions, variables, classes, CSS classes, object keys):** English, `camelCase`/`PascalCase`/`CONSTANT_CASE` as above. Even Japanese-only concepts get English names (`readOf`, `tempOf`, `stabOf`).
- **Comments:** Japanese prose, written in the author's own voice (Hakata/Kyushu dialect verb endings: `〜けん`, `〜とる`, `〜せん`, `〜んくなる`). Comments explain **why**, often citing a past bug or the design doc section number, e.g. `/* 二度押しで消す。confirm() はブラウザに「このページのダイアログを表示しない」を効かされると黙って false を返す。*/` (`src/movelab.js:116-118`). Section-header comments use a banner style:
- **In-game data values (move names, type names, UI labels, tags):** Japanese strings, e.g. `name:'灼熱弾'`, `tags:['遠距離向き','連発向き']`, `TACTIC_TABS=[{id:'atk',label:'攻撃'}...]`.
- **Object keys used as internal lookups (`atk`,`def`,`hp`,`spd`,`eva`,`int`,`cast`,`cooldown`,`power`, generator names like `projectile`/`beam`/`slash`) stay English/romanized** even though everything they represent is Japanese-facing; separate `_JP` lookup tables (`STAT_JP`, `PER_JP`, `TACTIC_JP`, `GEN_JP`) translate the English key to a Japanese display label for the UI. When adding a new stat/tag/enum-like value, add the English key to the data structure and its Japanese label to the matching `_JP` table rather than using the Japanese string as the key itself.

## 4. Module Design — No ES Modules (by design, for now)

- Each `src/*.js` file is a plain script defining globals (functions, classes, `const` data tables) with no `import`/`export` statements.
- `build.js` performs literal token substitution: each `.tpl.html` contains marker comments like `/*__FX_CORE__*/`, and `build.js:22-31` maps each marker to the full text of the corresponding `src/*.js` file, splicing it in verbatim (`build.js:47-49`) to produce `dist/*.html`.
- This means **script load order inside one HTML file is whatever order the markers appear in the template**, and every module shares one global scope once spliced together — there is no per-module isolation. Two modules must not declare the same top-level identifier.
- `src/fx_audio.js` is included in the `MODULES` map (`build.js:30`) but not referenced by any current template — it's dead code kept for reference, marked "旧・手続き型音源（現在は未使用）" (old procedural audio, currently unused) both in `CLAUDE.md:64` and inline.
- **`src/sfx_bank.js` is generated, not hand-edited.** It's produced by `tools/gen_sfx.py` from CC0 source audio in `assets/`; the file itself says as much in its data section. Modify `tools/gen_sfx.py`'s `PICKS` and regenerate rather than hand-editing the output — hand edits will be silently discarded on the next `python3 tools/gen_sfx.py` run and are much harder to review as a diff (much of the file is base64 audio data).

## 5. State Management and the TDZ Hazard

## 6. Error Handling

## 7. Logging

- `console.error(...)` — draw-loop exceptions, effect-build failures (`buildEffect` throwing) — things that indicate a real bug.
- `console.warn(...)` — recoverable data problems, e.g. failing to load an opponent preview (`console.warn('相手が読めん',e)`, `src/creator.tpl.html:2155`).
- `console.log(...)` — the AI decision log (`AILog.add`, `src/battle.tpl.html:973-989`), formatted per entry kind (`相殺`/clash, `回避判断`/dodge, decision), always paired with the same data rendered on-screen via `renderLog()`. This is the primary debugging surface for the game's core "AI must be transparent" requirement (rule 11/24 above) — don't reduce it to a summary line; keep emitting the full `terms` breakdown.

## 8. Function Design

- Small, single-purpose helper closures are preferred over branching monoliths — e.g. the `T`/`R`/`P`
- Functions that build derived/cached data memoize with a `Map`/`WeakMap` keyed on the source object
- Return shapes for calculated values are small plain objects carrying both the result and its

## 9. Module/Component Sharing Pattern

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Build & Shared-Module Composition

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
| Template | Output (`dist/`) | FX_CORE | SFX_BANK | MOVES | ANIMS | AUDIO_UI | MOVELAB | STARTER |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `lab.tpl.html` (技ラボ) | `shioumon_effect_lab.html` | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| `battle.tpl.html` (戦闘) | `shioumon_field_test.html` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `audiolab.tpl.html` (音ラボ) | `shioumon_audio_lab.html` | ✓ | ✓ | ✓ | ✓* | ✓ | — | — |
| `creator.tpl.html` (制作ツール) | `shioumon_creator.html` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

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

- Zero build tooling beyond `build.js`'s ~50-line find/replace — deliberately "素朴な" (naive) per its own header comment.
- Cross-file references work only because concatenation puts every module's declarations in the same script scope; there is no dependency graph to resolve, only an ordered list of injection points per template.
- Data-driven content: moves/effects are plain spec objects (`generator`, palette, params, `parts[]`, `motions[]`) consumed by generic code — CLAUDE.md rule 3 explicitly forbids per-move bespoke animation code.
- Canvas immediate-mode redraw every real animation frame; no virtual DOM, no diffing, no component tree.
- All persistence is client-side `localStorage`; there is no backend and no network I/O at runtime.
- Build output is fully self-contained (sprites and all audio are base64-embedded), so `dist/*.html` works from `file://` with no server.

## Layers

- Purpose: turn shared source + templates into 4 deployable HTML files
- Location: `build.js`
- Contains: token→file map, template→output list, a synchronous read/replace/write loop
- Depends on: `src/*.js`, `src/*.tpl.html`
- Used by: `npm run build` / `node build.js`; consumed by `tools/serve.js` and all `tools/verify_*.js`, which operate on `dist/`
- Purpose: game rules and generic rendering primitives with zero UI concerns
- Location: `src/fx_core.js`, `src/moves.js`, `src/anims.js`, `src/sfx_bank.js`
- Contains: FX generator classes, type/move/cost tables, animation keyframes, sound bank + playback API
- Depends on: nothing else in the codebase (leaf modules)
- Used by: all 4 templates (per the composition matrix above)
- Purpose: reusable editor controls that would otherwise be duplicated between the effect lab, audio lab, and creator
- Location: `src/audio_ui.js`, `src/movelab.js`
- Contains: sound picker/timeline components; FX-spec slider/control builders; their own `localStorage` read/write wrappers for shared shelves
- Depends on: the engine layer (`sfx_bank.js` globals for audio_ui.js; `fx_core.js` globals for movelab.js)
- Used by: `lab.tpl.html`, `audiolab.tpl.html`, `creator.tpl.html` (never `battle.tpl.html`)
- Purpose: static pre-authored game content, not code
- Location: `src/starter_moves.js`
- Contains: `STARTER_MOVES` — 28 move specs matching the move-library record shape
- Depends on: nothing (data literal)
- Used by: `creator.tpl.html` only
- Purpose: the 4 actual screens — each owns its DOM/canvas setup, its own state, its own event wiring, and its own render loop, then calls into the shared layers above
- Location: `src/lab.tpl.html`, `src/battle.tpl.html`, `src/audiolab.tpl.html`, `src/creator.tpl.html`
- Contains: per-screen state, per-screen UI panels, (battle only) the deterministic simulation core
- Depends on: engine layer always; UI-widget layer for 3 of 4; content-data layer for creator only
- Used by: end user, directly, as `dist/*.html`
- Purpose: the only channel by which the 4 independently-loaded documents share data
- Location: `localStorage`, written from `src/sfx_bank.js`, `src/movelab.js`, `src/creator.tpl.html`
- See dedicated **Persistence Layer** section below
- Purpose: automated smoke-testing of the built output; offline asset regeneration
- Location: `tools/verify_audio.js`, `tools/verify_ui.js`, `tools/verify_creator.js`, `tools/serve.js`, `tools/gen_sfx.py`
- Contains: Playwright drivers that load `dist/*.html` and click through flows; a static HTTP server for environments where `file://` scripts are blocked; a Python script that re-encodes CC0 audio into `src/sfx_bank.js`
- Depends on: `dist/` output (verify scripts, serve.js) or `assets/` raw audio (gen_sfx.py); outside the runtime app entirely

## Data Flow

### Build-time flow

### Battle runtime flow (primary simulation path)

### Creator authoring flow (persistence-heavy path)

## Persistence Layer (localStorage)

| Key | Owner module (read/write functions) | Written by | Read by | Shape / purpose |
|---|---|---|---|---|
| `shioumon_audio_cfg_v1` | `src/sfx_bank.js` — `audioLoadSaved()` / `audioSave(cfg)` (`sfx_bank.js:247-256`) | `audio_ui.js` `SoundPicker` edits (via all 3 UI-bearing templates); `battle.tpl.html`'s own volume/reset controls (`battle.tpl.html:1793-1811`) | **All 4 entry points**, unconditionally at boot | `{master, moves:{moveId:[{id,at,off,vol,rate}]}, system:{eventId:{id,off,vol,rate}}}` — "who plays what, when." Falls back to `AUDIO_CFG_DEFAULT` if absent. Sole source of truth for `playMovePhase()`/`playSys()`. |
| `shioumon_move_lib_v1` | `src/movelab.js` — `mlLibAll()` / `mlLibPut(name,rec)` / `mlLibDel(name)` (`movelab.js:589-602`) | `lab.tpl.html` (effect lab save), `creator.tpl.html` (technique creator save) | `lab.tpl.html`, `creator.tpl.html` | `{名前: {name, fx, battle, audio}}` — the shared "shelf" of user-authored moves. `battle` is `null` when saved from the effect lab (no combat numbers available there). **Not read by `battle.tpl.html`/`audiolab.tpl.html`.** |
| `shioumon_wild_pool_v1` | `src/creator.tpl.html` — `loadWild()` / `saveWild(a)` / `pushWild()` (`creator.tpl.html:955-978`) | `creator.tpl.html` only (release-to-wild action) | `creator.tpl.html` only (list UI, dedup-by-id check) | `[{uid, at:ISOtimestamp, cost, mon:<full snapshot>}]` — monsters "released to the grass." Named as the intended Phase 19 (草むら) starting point. |
| `shioumon_scene_sfx_v1` | `src/creator.tpl.html` — `loadSceneSfx()` (`creator.tpl.html:1407-1411`), inline write at `creator.tpl.html:1425` | `creator.tpl.html` only | `creator.tpl.html` only | `{appear:{id,vol,rate}, grass:{id,vol,rate}}` — ambient scene SFX for the release animation. Deliberately kept separate from `AUDIO_CFG`/`sfx_bank.js` because that file is auto-generated and must not be hand-edited. |
| `shioumon_creator_auto` | `src/creator.tpl.html` — inline in `autoSave()` / boot IIFE (`creator.tpl.html:1969`, `:2031-2045`, `:2268-2269`) | `creator.tpl.html`, debounced 350ms after any edit | `creator.tpl.html`, once, at boot (restore-in-progress-work) | Full `snapshot()` JSON of the monster currently being edited, incl. inline (non-derived) image data URIs. Cleared by "初期化" (`creator.tpl.html:2245`). |
| `shioumon_creator_slots` | `src/creator.tpl.html` — `loadSlots()` (`creator.tpl.html:2046-2048`), writes at `:2065`, `:2103`, `:2119` | `creator.tpl.html`, only on explicit save/overwrite/delete | `creator.tpl.html` only | `{slotName: <snapshot JSON string>}` — named, permanent monster saves. Overwrite is a deliberate two-press confirm (`creator.tpl.html:2088-2107`); "save as" always dedups the name rather than clobbering. |
| `shioumon_crydelay_050` | `src/creator.tpl.html`, inline (`creator.tpl.html:2273-2280`) | `creator.tpl.html`, once ever | `creator.tpl.html`, once at boot | Not real data — a one-shot migration marker (`'1'`). Its presence means "the one-time cry-delay-default migration (0.8→0.5) already ran"; prevents re-migrating a value the user may have deliberately restored to 0.8. |

- All 7 keys share the `shioumon_` prefix; 4 of them additionally carry a `_v1` version suffix (the ones with a defined schema that might need future migration); the creator's own save/autosave keys and the migration flag do not.
- Storage is scoped per browser **origin** — `file://.../shioumon_creator.html` opened directly, the same file served via `tools/serve.js` (`http://localhost:8765`), and a different browser are each a *separate* storage bucket. This is called out explicitly in `CLAUDE.md` as the first thing to check when a user reports "my save disappeared."
- No key is ever read by more than the templates listed above — `battle.tpl.html` only ever touches `shioumon_audio_cfg_v1`; everything creator-specific stays entirely within `creator.tpl.html`.
- Every write path is guarded (`try{...}catch(e){...}`) and every read path defaults to a safe empty value — this is a deliberate, repeated pattern (see `movelab.js:590-602` and `creator.tpl.html:958-964` for the canonical shape to copy when adding a new key).

## Key Abstractions

- Purpose: fully describes a move's visual behavior as plain data — `{generator, seed, palette, <per-generator shape params>, parts:[], motions:[], screen:{}, timeScale}`
- Examples: `src/moves.js` (built-in `MOVE_*` constants), `src/starter_moves.js`, `mon.customMoves[].fx` in `creator.tpl.html`
- Pattern: `makeSpec()`/`buildEffect()` (`fx_core.js`) turn a spec into cached drawable frames; `spawnFX(sp,...)` (`fx_core.js:690-699`) dispatches on `sp.generator` to instantiate the right class (`ProjectileFX` default, or `BeamFX`/`SlashFX`/`LightningFX`/`AuraFX`/`ShatterFX`)
- Purpose: secondary decoration attached to a phase (`cast`/`fire`/`impact`), an anchor (`from`/`to`/`center`), a `dx,dy` offset, and an `off` delay in seconds
- Examples: `MOVE_AKUU.shatter` (legacy single-part form, still auto-upgraded), any `parts:[]` entry in a custom move's fx spec
- Pattern: **must** be routed through `spawnSubFX(sp, phase, pts)` (`fx_core.js:767-777`) — CLAUDE.md rule 3 forbids any call site constructing these ad hoc; historically, not doing so made the 亜空切断 glass-shatter effect appear only in battle and not in the lab/creator previews
- Purpose: defers constructing its wrapped FX until `delay` seconds of *simulated* `dt` have elapsed, so delayed sub-effects still advance on the fixed-timestep clock
- Examples: `src/fx_core.js:718-734`; produced by `spawnPart()` whenever a part's `off > 0`
- Pattern: used instead of `setTimeout` specifically to preserve battle determinism (see Architectural Constraints)
- Purpose: the runtime combat unit — stat block (`atk/def/hp/spd/eva/int`), personality (`per.{aggr,caut,loyal,self}`), derived getters (`maxHP`, `cdScale`, `castScale`, `shotScale`, `flinchRate`) computed from stats, plus animation/motion-scheduling state (`anim`, `t`, `pendMo`, `seqT` for landing sequences)
- Examples: `src/battle.tpl.html:382-539` (`class Fighter`)
- Pattern: `creator.tpl.html` maintains a parallel but *separate* `mon`/preview object — not the same class — and must be kept behaviorally consistent by convention (CLAUDE.md rule 4: `resolve()` in both templates "must make the same decision")
- Purpose: single source of truth for "what sound plays when" — keyed by move-id→phase and by system-event-id
- Examples: `src/sfx_bank.js:166-222`
- Pattern: mutated only through `audioApply()`/`audioSave()`, read only through `playMovePhase()`/`playSys()` — this indirection is what lets battle, both labs, and the creator honor the same sound choices without duplicating playback logic
- Purpose: the shared shape for a saved move, `{name, fx, battle, audio}`
- Examples: `shioumon_move_lib_v1` entries
- Pattern: `battle` is `null` when authored from the effect lab (no combat numbers available there); populated when authored/edited from the creator
- Purpose: lets a player override a built-in move's numbers/FX/audio per-monster without mutating the shared built-in table for everyone else
- Examples: `creator.tpl.html:355` (`const BUILTIN_MOVES=JSON.parse(JSON.stringify(MOVES))`), `creator.tpl.html:1576-1579` (`syncCustom()`)
- Pattern: deep-clone `MOVES` once at boot; `syncCustom()` rebuilds the live `MOVES` table every time by replaying "restore from `BUILTIN_MOVES`, then layer `mon.customMoves[]` on top" — cost calculation and audio lookup always go through the same `MOVES` table regardless of stock-vs-overridden

## Entry Points

- Triggers: opened directly by the user; primary/most-developed screen ("本体")
- Responsibilities: deterministic AI-vs-AI battle simulation, quarter/phase state machine, strategy+order UI ("采配"), determinism self-test button, AI decision log
- Boot: IIFE near end of file calls `audioLoadSaved()`, `resetBattle(4242)`, then `requestAnimationFrame(loop)`
- Triggers: opened directly by the user for move-FX authoring
- Responsibilities: build/edit an FX spec via `movelab.js` controls, live-preview via `fx_core.js`, save to/load from the shared move library
- Boot: `audioLoadSaved()` near end of file
- Triggers: opened directly by the user for sound-assignment authoring
- Responsibilities: assign sounds to move phases and system events via `audio_ui.js`, persist to `shioumon_audio_cfg_v1`
- Boot: `audioLoadSaved()` near end of file
- Triggers: opened directly by the user to author one monster end to end
- Responsibilities: stats/types/sprite-slot/shadow/cry/summon-style/idle-motion authoring, built-in technique creator, save-slot management, autosave, release-to-wild
- Boot: `auiInjectCSS()`/`mlInjectCSS()` → `audioLoadSaved()`/`loadSceneSfx()`/`refreshWildIds()` → restore-from-autosave-or-placeholder → one-shot cry-delay migration → `registerMonCry()`/build UI/`refresh()` (`creator.tpl.html:2261-2284`)
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

### Using `setTimeout` for anything battle-relevant

### Forgetting to clear new transient `Fighter` fields in `resetBattle()`

### Drawing the opponent preview from the wrong state object

### Declaring render-loop-read variables outside the "0. 状態" block

## Error Handling

- Read helpers: `try{ return JSON.parse(localStorage.getItem(KEY)||'<empty>'); }catch(e){ return <empty>; }` (canonical form at `movelab.js:590-593`, `creator.tpl.html:958-961`)
- Write helpers: `try{ localStorage.setItem(...); return {ok:true}; }catch(e){ return {ok:false,msg:...}; }`, with the failure message surfaced directly in the UI rather than only logged (e.g. `creator.tpl.html:962-965`, `:2041-2044`)
- Input parsing (dropped files, pasted JSON): always reports success/failure as visible on-screen text — CLAUDE.md is explicit that silent failure is the worst outcome ("黙って失敗するのが一番たちが悪い")
- Loaded/pasted monster data is always passed through `normalizeMon()` (`creator.tpl.html`) to clamp/coerce every field to a safe range/shape before use, defending against malformed or old-format JSON

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
