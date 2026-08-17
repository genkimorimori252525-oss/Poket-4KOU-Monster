# Coding Conventions

**Analysis Date:** 2026-08-17

> Source of truth for this file: `CLAUDE.md` §4 ("絶対に守る設計の掟") points at the 26-item
> "コード生成AIへの禁止事項" list in `docs/開発計画_v6.md:987-1015`. Every rule below was checked
> against the actual source in `src/`, not just restated from the docs. Read this file before
> touching `src/battle.tpl.html`, `src/creator.tpl.html`, or `src/fx_core.js`.

---

## 0. The 26 Design Rules — Verified Against Code

This is the highest-value section of this document. Each rule from `docs/開発計画_v6.md:989-1014`
is listed with its verification status and the exact file/line where it is enforced (or, where a
feature isn't built yet, where the rule is trivially satisfied by absence).

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

**When extending the AI-scoring or dodge-scoring code:** copy the 3-line `T/R/P` closure trio
verbatim into any new scoring function rather than trying to share one instance — `scoreMove()`
(`src/battle.tpl.html:1106-1108`) and `tryDodge()` (`src/battle.tpl.html:1417-1419`) each declare
their own copies bound to their own local `terms`/`read` variables. This is intentional
duplication, not an oversight to "clean up."

---

## 1. Naming Patterns

**Files:**
- `snake_case.js` for shared modules: `fx_core.js`, `sfx_bank.js`, `audio_ui.js`, `starter_moves.js`, `movelab.js`.
- `name.tpl.html` for the 4 page templates in `src/` (`battle.tpl.html`, `creator.tpl.html`, `lab.tpl.html`, `audiolab.tpl.html`); `build.js` maps each to a `dist/shioumon_<name>.html` output (see `build.js:33-38`).
- Docs are Japanese-titled: `docs/開発計画_v6.md`, `docs/技ネタ_タイプ別.md`.

**Functions/variables:** `camelCase` throughout — `stabOf`, `costOf`, `pickMove`, `resolveClash`, `spawnSubFX`, `mlArmDelete`. No `snake_case` function/variable names found anywhere in `src/`.

**Classes:** `PascalCase` — `RNG`, `DelayFX`, `BaseFX` (+ subclasses `ProjectileFX`/`BeamFX`/`SlashFX`/`LightningFX`/`AuraFX`/`ShatterFX`), `Fighter`, `BackgroundRenderer`, `MessageBox`, `CommandPanel`, `SoundBank` (`src/sfx_bank.js:98`).

**Shared/config data objects:** `CONSTANT_CASE` at module scope — `MOVES`, `TYPES`, `STAB`, `COST_W`, `TACTIC_BIAS`, `CLASH`, `QUARTER`, `AUDIO_CFG`/`AUDIO_CFG_DEFAULT`, `STAT_JP`/`PER_JP` (label-lookup tables). Individual move-spec constants use a `MOVE_<NAME>` prefix (`MOVE_SHAKUNETSU`, `MOVE_AKUU`, `src/moves.js:23-44`).

**CSS classes for shared UI components:** namespaced with a short module prefix to avoid collisions once multiple modules' `<style>` blocks land in the same concatenated HTML page — `aui-*` for `audio_ui.js` (`src/audio_ui.js:9-53`, e.g. `.aui-card`, `.aui-ov`), `ml-*` for `movelab.js` (e.g. `.ml-box`, `.ml-frames`). Each injector guards against double-injection: `if(document.getElementById('movelab-css')) return;` (`src/movelab.js:136`).

**Object shorthand keys mix English field names with Japanese string values:** e.g. `{id:'shakunetsu', name:'灼熱弾', type:'ほのお', power:26, cast:0.30, tags:['遠距離向き',...]}` (`src/moves.js:87`) — keys/identifiers are English, in-game-facing content is Japanese.

## 2. Code Style

**No linter or formatter is configured.** No `.eslintrc*`, `eslint.config.*`, `.prettierrc*`, `.editorconfig`, `tsconfig.json`, or `jsconfig.json` exists anywhere in the repo. Style consistency is maintained by hand/convention, not tooling — match the surrounding code exactly rather than reflowing it.

**Indentation:** 2 spaces, consistently.

**Semicolons:** always used — no ASI-reliant style anywhere observed.

**Quotes:** single quotes (`'...'`) for strings; double quotes appear only inside generated HTML-attribute strings inside template literals.

**Declarations:** `let`/`const` only. Zero `var` usage found in `src/`.

**Density:** logic files (`fx_core.js`, `battle.tpl.html`, `creator.tpl.html`) favor tight, multi-statement lines and short-circuit/ternary chains over one-statement-per-line verbosity — e.g. `const T=(n,v)=>{ if(Math.abs(v)>=0.05) terms.push({n,v:+v.toFixed(1)}); };` on one line. Match this density in these files; don't "clean up" into a more verbose multi-line style, since diffs are meant to stay small and the author's own style is intentionally compact. Pure data files (`starter_moves.js`, `anims.js`) are comparatively more spread out for readability of the data itself.

**No TypeScript, no JSDoc type annotations.** One misleading reference exists: `CLAUDE.md` and `HANDOFF.md` both mention "`BaseFX.ts`" when describing the FX time-scale mechanism — the real file is `src/fx_core.js` (`class BaseFX` at line 321), plain JavaScript. Don't create or expect a `.ts` file.

## 3. Language Mixing (Japanese / English)

This codebase deliberately mixes languages by role, not at random:

- **Identifiers (functions, variables, classes, CSS classes, object keys):** English, `camelCase`/`PascalCase`/`CONSTANT_CASE` as above. Even Japanese-only concepts get English names (`readOf`, `tempOf`, `stabOf`).
- **Comments:** Japanese prose, written in the author's own voice (Hakata/Kyushu dialect verb endings: `〜けん`, `〜とる`, `〜せん`, `〜んくなる`). Comments explain **why**, often citing a past bug or the design doc section number, e.g. `/* 二度押しで消す。confirm() はブラウザに「このページのダイアログを表示しない」を効かされると黙って false を返す。*/` (`src/movelab.js:116-118`). Section-header comments use a banner style:
  ```js
  /* =========================================================
     Section Title
     One or two lines of Japanese explanation
     ========================================================= */
  ```
  This banner form is used consistently at the top of every major logical block across `fx_core.js`, `moves.js`, `battle.tpl.html`, etc. — use it when adding a new top-level section.
- **In-game data values (move names, type names, UI labels, tags):** Japanese strings, e.g. `name:'灼熱弾'`, `tags:['遠距離向き','連発向き']`, `TACTIC_TABS=[{id:'atk',label:'攻撃'}...]`.
- **Object keys used as internal lookups (`atk`,`def`,`hp`,`spd`,`eva`,`int`,`cast`,`cooldown`,`power`, generator names like `projectile`/`beam`/`slash`) stay English/romanized** even though everything they represent is Japanese-facing; separate `_JP` lookup tables (`STAT_JP`, `PER_JP`, `TACTIC_JP`, `GEN_JP`) translate the English key to a Japanese display label for the UI. When adding a new stat/tag/enum-like value, add the English key to the data structure and its Japanese label to the matching `_JP` table rather than using the Japanese string as the key itself.

## 4. Module Design — No ES Modules (by design, for now)

`docs/開発計画_v6.md:79` states ES Modules are the intended production approach ("巨大な単一ファイルは禁止"), but the **current, working implementation deliberately does not use them.** Instead:

- Each `src/*.js` file is a plain script defining globals (functions, classes, `const` data tables) with no `import`/`export` statements.
- `build.js` performs literal token substitution: each `.tpl.html` contains marker comments like `/*__FX_CORE__*/`, and `build.js:22-31` maps each marker to the full text of the corresponding `src/*.js` file, splicing it in verbatim (`build.js:47-49`) to produce `dist/*.html`.
- This means **script load order inside one HTML file is whatever order the markers appear in the template**, and every module shares one global scope once spliced together — there is no per-module isolation. Two modules must not declare the same top-level identifier.
- `src/fx_audio.js` is included in the `MODULES` map (`build.js:30`) but not referenced by any current template — it's dead code kept for reference, marked "旧・手続き型音源（現在は未使用）" (old procedural audio, currently unused) both in `CLAUDE.md:64` and inline.
- **`src/sfx_bank.js` is generated, not hand-edited.** It's produced by `tools/gen_sfx.py` from CC0 source audio in `assets/`; the file itself says as much in its data section. Modify `tools/gen_sfx.py`'s `PICKS` and regenerate rather than hand-editing the output — hand edits will be silently discarded on the next `python3 tools/gen_sfx.py` run and are much harder to review as a diff (much of the file is base64 audio data).

## 5. State Management and the TDZ Hazard

`src/creator.tpl.html` carries the strictest, explicitly-labeled version of this convention, born from
a real bug (`previewKey` declared after the draw loop referenced it → `ReferenceError` in the temporal
dead zone):

```js
/* =========================================================
   0. 状態
   描画ループが読む変数は、例外なくここで宣言する。
   （過去に previewKey を後ろで宣言して TDZ エラーを踏んどる）
   ========================================================= */
const $=id=>document.getElementById(id);
const W=384, H=288, FIELD_H=216;
...
let mon=DEFAULT_MON();
let slot='normal', previewKey='normal';
...
```
(`src/creator.tpl.html:338-393`)

**Rule for any file with a render/update loop:** every `let`/`const` that the loop body (or anything
it calls) reads must be declared before the loop function is defined, ideally grouped in one visible
block near the top of the script. `src/battle.tpl.html`, `src/lab.tpl.html`, and
`src/audiolab.tpl.html` do **not** have a formally labeled "0. 状態" heading — their state
(`let battleRng`, `let frame`, `let fxs`, etc.) is simply declared inline near first use throughout
the file — but the same hazard applies to them; when adding new module-level `let` state to any of
these files, declare it before any function that could run before your declaration executes (in
particular before `requestAnimationFrame` is armed).

**The render-loop-registration pattern**, also hardened after a bug (an uncaught exception inside the
draw call killed the whole loop because `requestAnimationFrame` was scheduled *after* the drawing
work): always re-arm the next frame **first**, then wrap the actual draw call in `try/catch`:

```js
let last=performance.now();
function tick(now){
  requestAnimationFrame(tick);                 // re-arm before anything can throw
  const dt=Math.min(0.05,Math.max(0,(now-last)/1000)); last=now;
  try{ if(scene) drawScene(dt); else drawPreview(dt); }
  catch(e){ console.error('draw error',e); }
}
requestAnimationFrame(tick);
```
(`src/creator.tpl.html:700-708`; the equivalent in `src/lab.tpl.html:234` wraps `frame(dt)` the same way). Never call the loop body synchronously once at startup "to initialize" — always go through the scheduled callback (`requestAnimationFrame(tick)`), per the explicit warning in `CLAUDE.md:143`.

## 6. Error Handling

**Draw-loop exceptions are caught and logged, never allowed to kill the loop** — see the `tick()` pattern above. `console.error('draw error', e)` is the standard call for this case.

**`localStorage`/`JSON.parse` access is always wrapped in `try/catch` with a silent, safe fallback** — reads default to `{}`/`[]`/`false`, writes return a boolean success flag instead of throwing:
```js
try{ ...; return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; }
try{ localStorage.setItem(KEY, JSON.stringify(v)); return true; }catch(e){ return false; }
```
(pattern repeated at `src/movelab.js:592,597,601`, `src/creator.tpl.html:960,964,2048`, etc.)

**User-facing failures use `alert()` with the underlying error appended**, but only as a one-way
notification after an action has already failed — never as a yes/no gate blocking the action itself:
`alert('JSONが読めん: '+e.message)`, `alert('保存できん: '+e.name+'\n画像が大きすぎるかも。')`
(`src/creator.tpl.html:1834,2106`). The rule this respects: information may use `alert()`; decisions must not.

**Decisions never use `confirm()`.** Destructive/overwriting actions (delete, reset, overwrite-save)
use a hand-rolled double-press arm/commit pattern instead, because a browser with "don't show dialogs
for this page" enabled makes `confirm()` **silently return `false`** — which would make delete/reset
buttons do nothing with no visible explanation. The pattern:
```js
/* 二度押しで消す。confirm() は…黙って false を返す。そうなると何を押しても消えん。ダイアログに頼らん。 */
function mlArmDelete(btn, onDo, armedText){
  let armed=false, timer=null;
  ...
  btn.onclick=e=>{
    if(armed){ reset(); onDo(); return; }
    armed=true;
    btn.textContent=armedText||'消す？'; btn.title='もう一度押すと決まる';
    btn.style.background='#7a2020';
    timer=setTimeout(reset,3500);        // auto-disarm after 3.5s (UI-only timer, not battle-affecting)
  };
}
```
(`src/movelab.js:116-133`), used for move/part/library deletion (`src/movelab.js:349,486,658`) and for
every destructive action in the creator tool — reset, cry deletion, motion/part deletion, saved-slot
deletion, wild-pool removal, overwrite-save (`src/creator.tpl.html:1361,1482,1650,1822,2064,2191,2235`,
comment at `:2086`: "上書きは前のを消す操作やけん、二度押しにする"). `tools/verify_creator.js` exercises
this by dismissing every dialog it sees (`pg.on('dialog', d=>{dialogs.push(d.message()); d.dismiss();})`)
and checking the action still completes.

**Known inconsistency — don't copy this one:** `src/audiolab.tpl.html:359` still gates a destructive
action on a real `confirm()`:
```js
$('btnReset').onclick=()=>{ if(!confirm('初期設定に戻す？　今の割り当ては消える')) return; ... };
```
This predates or was missed by the `mlArmDelete()` convention. If touching the audio lab's reset flow,
convert it to `mlArmDelete()` for consistency; don't use this line as a precedent for new code.

**Fire-and-forget catches** (`catch(e){}`, no logging) are used only for genuinely optional paths —
preloading/decoding audio ahead of time, best-effort `localStorage` cleanup — where failure is
harmless and a console message would just be noise (`src/creator.tpl.html:1355,1410,1425,2245`).

## 7. Logging

No logging library or level system — plain `console.log`/`console.warn`/`console.error`, chosen by
severity:
- `console.error(...)` — draw-loop exceptions, effect-build failures (`buildEffect` throwing) — things that indicate a real bug.
- `console.warn(...)` — recoverable data problems, e.g. failing to load an opponent preview (`console.warn('相手が読めん',e)`, `src/creator.tpl.html:2155`).
- `console.log(...)` — the AI decision log (`AILog.add`, `src/battle.tpl.html:973-989`), formatted per entry kind (`相殺`/clash, `回避判断`/dodge, decision), always paired with the same data rendered on-screen via `renderLog()`. This is the primary debugging surface for the game's core "AI must be transparent" requirement (rule 11/24 above) — don't reduce it to a summary line; keep emitting the full `terms` breakdown.

**Deferred work is not tracked with `TODO`/`FIXME` comments** — none exist in the codebase (a couple of
false-positive substring hits inside base64 audio data in `sfx_bank.js` are not real markers). Open
items live in `docs/開発計画_v6.md`'s "未決事項" table (`:1018-1033`) and in `HANDOFF.md`'s "次の作業"
/ "未決事項" sections. When leaving something deliberately unfinished, add it there rather than an
inline comment.

## 8. Function Design

- Small, single-purpose helper closures are preferred over branching monoliths — e.g. the `T`/`R`/`P`
  term-recording trio (§0 above) rather than one large scoring function with inline category logic.
- Functions that build derived/cached data memoize with a `Map`/`WeakMap` keyed on the source object
  rather than recomputing every frame: `const BUILT = new Map(); const builtOf = m => { if(!BUILT.has(m.id)) BUILT.set(m.id, buildEffect(m)); return BUILT.get(m.id); };` (`src/moves.js:82-83`); `const PART_BUILT = new WeakMap();` (`src/fx_core.js:737-743`) with an explicit `forgetPart()` invalidation hook for when a part's spec is edited live in the lab.
- Return shapes for calculated values are small plain objects carrying both the result and its
  components for inspection (`{cost, avg, base, mv}` from `costOf`, `{move, total, terms}` from
  `scoreMove`) — never just a bare number — so the caller (and `AILog`) can show the breakdown.

## 9. Module/Component Sharing Pattern

Shared UI-building components (`src/audio_ui.js`, `src/movelab.js`) export a set of `camelCase`
builder functions plus one `xxInjectCSS()` guarded singleton-style CSS injector, and are consumed
identically from more than one template (`movelab.js` backs both the standalone move lab and the
creator tool's built-in move editor; `audio_ui.js` backs both the sound lab and the move lab's sound
timeline). When adding a new cross-screen UI widget, follow this shape: a `<PREFIX>_CSS` template
string, a guarded `<prefix>InjectCSS()`, and builder functions namespaced with the same short prefix
— don't inline component-specific CSS directly into a `.tpl.html`'s own `<style>` block if more than
one screen will use it.

---
*Convention analysis: 2026-08-17*
