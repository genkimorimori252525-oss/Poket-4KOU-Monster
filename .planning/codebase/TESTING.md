# Testing Patterns

**Analysis Date:** 2026-08-17

> This project has **no test runner and no assertion library.** "Testing" means three standalone
> Node scripts under `tools/` that drive the built `dist/*.html` files with Playwright as a
> browser-automation library (not `@playwright/test`). Read this whole document before assuming
> `npm test` or a `*.test.js` convention exists here — neither does.

## Test Framework

**Runner:** none. No Jest/Vitest/Mocha/`@playwright/test`. `package.json`'s only `devDependency` is
`playwright` (`^1.62.1`), used directly via `require('playwright')` inside plain Node scripts.

**Assertion library:** none. No chai/expect/assert-style library anywhere. "Assertions" are ad hoc:
plain `if`/ternary checks, booleans computed inline and written into a results object for a human to
read, and occasional `throw new Error(...)` for hard preconditions (e.g. a missing DOM element).

**Config:** none — no `playwright.config.js`, no `jest.config.*`. Each script is a self-contained
`(async () => { ... })()` IIFE that launches its own browser instance.

**Run commands** (from `package.json:6-11`):
```bash
node build.js                    # MUST run first — verify scripts test dist/, not src/
npm run verify                   # chains all 3 below with &&
npm run verify:creator           # just verify_creator.js
node tools/verify_audio.js       # 4 screens: load, audio-decode counts, JS errors
node tools/verify_ui.js          # UI interaction + battle determinism check
node tools/verify_creator.js     # full creator-tool walkthrough (the closest thing to a real suite)
node tools/serve.js              # dist/ on localhost:8765 — fallback when file:// blocks WebAudio/fetch
PW_CHROMIUM=/path/to/chrome node tools/verify_audio.js   # override when bundled Chromium is missing
```

**Critical prerequisite:** all three `verify_*.js` scripts navigate to `file://.../dist/*.html`, never
`src/*.tpl.html`. Editing `src/` and re-running verify **without rebuilding tests stale output.** This
exact mistake is logged as a real past incident in `HANDOFF.md`'s pitfall table: fixing a bug in `src/`
while the person testing was still looking at an old `dist/` build. Always `node build.js` before
`node tools/verify_*.js` when `src/` changed.

## Test File Organization

- **Location:** `tools/verify_<surface>.js` — one file per screen/surface, not per source module.
- **Naming:** `verify_audio.js`, `verify_ui.js`, `verify_creator.js`.
- **No 1:1 src-to-test mapping and no colocated `*.test.js`/`*.spec.js` files anywhere in the repo.**
- **No unit tests for pure logic** — `costOf()`, `stabOf()`, `resolveClash()`/`resolveBeamStruggle()`,
  `scoreMove()`/`tryDodge()`'s term math, `RNG`/`hash3` — none of these are exercised in isolation.
  Correctness is only implied by (a) the full page not crashing and (b) the battle-determinism
  signature staying stable across code changes.

## Harness Mechanics (shared shape across all 3 scripts)

```js
const { chromium } = require('playwright');
const LAUNCH = { args:['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;
const b = await chromium.launch(LAUNCH);
const pg = await b.newPage({ viewport: { width: 420, height: <900|1000|1100|1400> } });
const errs = [];
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await pg.goto('file://' + path.join(__dirname,'..','dist') + '/' + file);
```
- Narrow portrait viewports (420px wide) emulate the phone-first target audience.
- `--autoplay-policy=no-user-gesture-required` lets WebAudio play without a synthetic user gesture,
  since two of the three screens under test are audio-heavy.
- Errors are collected via page/console event listeners for the whole script run, not scoped
  try/catch per navigation — one array accumulates everything until the script decides what to do
  with it (see "Exit-code blind spot" below — this differs per script).
- Screenshots are written to `.shots/` (gitignored — `.gitignore:2`) via a shared `shot(name)` path
  helper repeated verbatim in each script.

## What Each Script Actually Checks

### `tools/verify_audio.js` (51 lines)
- Loops over all 4 `dist/*.html` files.
- Calls `SND.resume()` in-page to unlock WebAudio and trigger decode of the sound bank.
- Reads back `{bank: Object.keys(SFX_SRC).length, decoded: Object.keys(SND.buf).length, cfgMoves, cfgSys, ctx}`.
- One full-page screenshot per screen → `.shots/v_<file>.png`.
- Prints one JSON blob (`results`) to stdout via `console.log`.
- **Does not call `process.exit`.** The script always exits 0, regardless of what accumulated in
  `errs` or how many sounds failed to decode — see coverage-gap note below.

### `tools/verify_ui.js` (91 lines)
Three inline blocks, each opening its own page:
- **音ラボ (sound lab):** clicks `#play`, opens the sound picker (`.aui-add`), switches a category
  tab, picks an entry, reads the saved `localStorage['shioumon_audio_cfg_v1']` back to confirm the
  pick persisted.
- **技ラボ (move lab):** enables sound (`#sndOn`), fires a move (`#mFire`), counts sound-timeline rows.
- **戦闘 (battle):** enables sound, waits 6s of *real* time (letting the live rAF-driven battle run),
  then calls `determinismTest()` in-page (see next section) and reads back `AUDIO_CFG`.
- Each block ends with one `console.log('■ <name>', JSON.stringify({...}))` line.
- **Also does not call `process.exit`.** Same always-exits-0 characteristic as `verify_audio.js`.

### `tools/verify_creator.js` (808 lines) — the closest thing to a real test suite
A single long sequential walkthrough of the creator tool, internally numbered into ~30 sections
(0 through 15, with sub-letters) that mirror the feature list in `CLAUDE.md` §5's creator-tool
subsection: shadow controls, photo auto-copy-to-empty-slots, self-side-always-back-image rule,
idle-motion toggle, summon style + cry-delay timing, landing-frame choreography (view vs. overwrite
distinction), low-HP idle-speed reduction, the built-in move creator (generator switch, parameter
edit, fire-and-observe), editing a built-in move in place (and reverting), per-move body motions
(`fx.motions[]`) and `timeScale`, move duplication, `fx.shatter`→`fx.parts` migration, part
add/reposition/delete, move deletion from the list, preview-pin + auto-fire, move-library save/load,
starter-move shelf import, playback-speed scaling, cry upload via file picker, cry upload via
drag-and-drop (plus a wrong-file-type negative case), cost/autosave, named-slot save with
overwrite-collision numbering, bound-slot overwrite (double-press), opponent preview swap, wild-pool
release, reset (double-press), and reload-restore.

Distinctive mechanics:
- **All native dialogs are force-dismissed globally**, deliberately simulating a browser with
  "don't show dialogs for this page" enabled:
  ```js
  const dialogs = [];
  pg.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  ```
  (`tools/verify_creator.js:53-54`) — this directly tests the rationale behind the `mlArmDelete()`
  double-press convention (see CONVENTIONS.md §6): if any destructive action still secretly depended
  on `confirm()`, it would silently no-op here and the corresponding `out[...]` check would show the
  action didn't take effect. The final report tallies `ダイアログに頼っとらんか: {出たダイアログ: dialogs.length, ...}`.
- **File upload, two ways:** `pg.setInputFiles(...)` for the normal `<input type=file>` picker, and a
  synthesized `File`+`DataTransfer` dispatched as `DragEvent('dragenter'/'drop')` on `document` for
  the drag-and-drop path:
  ```js
  const file = new File([u8], 'nakigoe.wav', { type: 'audio/wav' });
  const dt = new DataTransfer(); dt.items.add(file);
  document.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
  document.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
  ```
  (`tools/verify_creator.js:607-614`), including a negative case — dropping a `.txt` file — to check
  the failure message renders instead of failing silently (`:620-628`).
- **`<input type=range>` sliders are driven by value + synthetic event**, not simulated dragging,
  via a small helper:
  ```js
  async function setRange(pg, sel, n, v) {
    await pg.evaluate(([sel, n, v]) => {
      const r = document.querySelectorAll(sel)[n];
      if (!r) throw new Error('range が無い: ' + sel + '[' + n + ']');
      r.value = v;
      r.dispatchEvent(new Event('input', { bubbles: true }));
    }, [sel, n, v]);
  }
  ```
  (`tools/verify_creator.js:36-43`) — this is the one place a hard `throw` acts as a real assertion
  (missing element aborts the whole script with a non-zero exit via the unhandled rejection).
- **A synthetic WAV fixture is generated on the fly** for cry-upload tests:
  `function makeWav(sec, hz)` (`tools/verify_creator.js:19-33`) writes a minimal RIFF/WAVE header plus
  a decaying sine tone directly into a `Buffer` — no binary fixture files are committed for this.
  Image fixtures, by contrast, are real files: `assets/sprites/palkia_front.png` / `palkia_back.png`.
- **Ends with a real pass/fail exit code:**
  ```js
  console.log(JSON.stringify(out, null, 2));
  await b.close();
  process.exit(errs.length ? 1 : 0);
  ```
  (`tools/verify_creator.js:805-807`) — this is the **only** one of the three scripts whose exit
  code reflects captured page/console errors.

## The Determinism Check (the one correctness gate that matters most)

Defined in-page at `src/battle.tpl.html:1524-1542`, invoked from `verify_ui.js`'s battle block:

```js
function determinismTest(){
  const wasPaused=AILog.paused; AILog.paused=true;
  const run=()=>{
    resetBattle(90210);
    const sig=[];
    for(let i=0;i<60*40;i++){                                   // 2400 fixed steps
      stepBattle(1/60); ally.update(1/60); enemy.update(1/60);
      if(i%30===0) sig.push(ally.hp.toFixed(5)+':'+enemy.hp.toFixed(5));  // sample every 0.5s
    }
    return sig.join('|');
  };
  const a=run(), b=run();
  AILog.paused=wasPaused;
  resetBattle(4242);
  if(a===b) return {ok:true, len:a.length};
  const A=a.split('|'), B=b.split('|');
  let i=0; while(i<A.length && A[i]===B[i]) i++;
  return {ok:false, len:a.length, at:i, sampleA:A[i], sampleB:B[i]};
}
```

- Fixed seed `90210`. Both runs are driven **synchronously** by calling `stepBattle(1/60)` directly in
  a tight loop 2400 times — this simulates 40 seconds of *battle time*, not 40 seconds of *wall-clock
  time*; both runs together finish in a fraction of a real second.
- Signature = both fighters' HP to 5 decimal places, sampled every 30 steps (every 0.5 simulated
  seconds), joined into one `|`-delimited string. Byte-equality between run A and run B is the pass
  condition — any divergence, however small, fails it.
- On mismatch, the function walks the two split signatures to find the index of the first differing
  sample and returns both values there, localizing a regression to roughly a 0.5s window of the match.
- `verify_ui.js` reads `{ok, len, at}` and includes it in its printed JSON, but **nothing checks
  `det.ok` and fails the process on `false`** — a determinism regression is visible only if a human
  (or an external grep) reads the printed output; it does not turn `npm run verify` red by itself.
- Documented root cause of past regressions (`HANDOFF.md`'s 地雷 table): forgetting to clear a piece
  of per-fighter mutable state inside `resetBattle()` when adding new state elsewhere (`f.lastMove`
  originally, later `durOv`/`pendMo` for per-move body motions). **Standing rule: any new mutable
  `Fighter` field must be reset in `resetBattle()` in the same change that introduces it**, and
  ideally verified by re-running `node tools/verify_ui.js` and checking `det.ok===true` before
  committing.

## Mocking

**None.** No mocking framework, no network/API stubbing — there's nothing to mock since this is a
fully client-side, offline app with no backend. All three scripts drive the real built HTML in a real
Chromium instance with real WebAudio, real `localStorage`, and real Canvas 2D.

The closest things to fixtures:
- `makeWav(sec,hz)` (`tools/verify_creator.js:19-33`) — synthesized audio fixture, generated at test
  time, not committed to the repo.
- `assets/sprites/palkia_front.png` / `palkia_back.png` — real committed image fixtures, reused as
  upload targets for photo-slot tests.
- `localStorage` is explicitly reset once per script run (`localStorage.clear()` then `pg.reload()`,
  `tools/verify_creator.js:58-59`) so the run starts from `DEFAULT_MON()`, but **state is not isolated
  between the ~30 numbered sections within one run** — later sections depend on earlier sections'
  mutations (e.g. section 15 "復元" checks that section 14's name change survived a reload). This is
  a single long linear scenario, not a suite of independent test cases — a failure partway through
  can cascade into unrelated-looking failures later in the same `out` dump.

## Coverage — What's Actually Exercised vs. Not (be honest here)

**Covered, at the page/UI level:**
- All 4 `dist/*.html` screens load without throwing.
- Audio bank decode count (expected ~79; one sound, `ui_tick`, is documented as failing to decode in
  Chromium specifically — `HANDOFF.md:235-236` — so "78/79" is the known-good baseline, not 79/79).
- Battle determinism, structurally (see above) — but not gated on CI, since none exists.
- The creator tool's full UI-facing feature surface as enumerated in `CLAUDE.md` §5.

**Not covered by anything in this repo:**
- **Pure-logic unit coverage.** `costOf()`, `stabOf()`, `resolveClash()`/`resolveBeamStruggle()`,
  the `scoreMove()`/`tryDodge()` term math, `RNG`/`hash3` output distribution — none are tested in
  isolation. Correctness is only implied indirectly (no crash + stable determinism signature).
- **AI decision *quality*.** Nothing asserts that a high-`int` mon actually behaves differently from
  a low-`int` one, or that a given `TACTIC_BIAS` nudges behavior in the expected direction — `AILog`
  content itself is never asserted on, only its absence-of-crash.
- **`lab.tpl.html` (技ラボ) as a standalone screen** gets only light touch in `verify_ui.js` (sound
  timeline count). Its FX-authoring UI (generator switching, part add/reposition, motion scheduling)
  is exercised in `verify_creator.js`, but only through the **creator tool's** embedded move editor
  (`movelab.js` shared component) — the standalone lab screen's own chrome is not walked the same way.
- **Cross-browser and device coverage.** Chromium only (`chromium.launch`); no Firefox/WebKit; no
  real mobile-device emulation beyond a narrow desktop-Chromium viewport.
- **`tools/gen_sfx.py`** (Python; regenerates `src/sfx_bank.js` from CC0 source audio in `assets/`)
  has zero automated verification of its own. Correctness of the regenerated bank is entirely manual
  (listen to it).
- **Performance/regression budgets.** No frame-time, GC-pause, or memory-growth checks despite the
  game running a persistent real-time `requestAnimationFrame` loop.
- **Exit-code blind spot (the most important gap to know about):** only `verify_creator.js` fails the
  process on captured errors. `verify_audio.js` and `verify_ui.js` never call `process.exit`, so they
  always return 0 no matter what landed in their `errs` arrays or what `determinismTest()` returned.
  `npm run verify`'s red/green signal is therefore driven almost entirely by `verify_creator.js`
  (chained last via `&&`, but `&&` also means an early script's non-zero exit — which can currently
  only come from an uncaught exception crashing Node, e.g. `chromium.launch` failing — would still
  short-circuit the rest). **A determinism regression or an audio-decode regression will print
  visibly in the console output but will not fail `npm run verify`.** Treat the printed JSON as
  required reading after every run, not as something CI would catch for you — there is no CI.

## Common Patterns

**Polling in-page state instead of awaiting a specific event**, because the render loop runs in real
time (rAF-driven UI) even though the underlying battle sim is fixed-step:
```js
const 見た = new Set();
for (let i = 0; i < 45; i++) {
  const r = await pg.evaluate(() => ({ anim: sideA.anim, dur: sideA.durOv }));
  見た.add(r.anim);
  await pg.waitForTimeout(80);
}
```
(`tools/verify_creator.js:316-323`)

**Source-code introspection as a stand-in for a behavioral assertion** — used sparingly, for cases
where directly observing the visual effect would be much more expensive to set up than checking the
code path exists:
```js
制作ツールも残像を描く: /st\.trail\.push/.test(drawMon.toString())
```
(`tools/verify_creator.js:341`)

**Double-press UI actions are tested by clicking twice with a wait between, asserting nothing changed
after the first click:**
```js
await pg.click('#btnReset'); await pg.waitForTimeout(150);   // armed only — must NOT have applied
const 初期化一度目 = await pg.evaluate(() => ({ name: mon.name, ... }));
await pg.click('#btnReset'); await pg.waitForTimeout(600);   // now it actually applies
out['14_初期化'].一度押しでは戻らん = (初期化一度目.name === 初期化前の名前 && 初期化前の名前 !== 'なまえ');
```
(`tools/verify_creator.js:778-793`) — mirrors the `mlArmDelete()` implementation in
`src/movelab.js:119-133` from the caller's side.

## Adding a New Test / Extending Coverage

- **New battle-affecting logic:** manually re-run `node tools/verify_ui.js` after the change and
  read `det.ok` in the printed JSON — nothing will do this for you automatically. If the new state
  is per-fighter and mutable, make sure `resetBattle()` clears it (see determinism section above).
- **New creator-tool feature:** add a new numbered section to `tools/verify_creator.js` following the
  existing `out['N_ラベル'] = await pg.evaluate(() => ({...}))` shape, in the same relative position
  in the file as the corresponding feature in `CLAUDE.md` §5. Remember dialogs are dismissed globally
  in this script — any `confirm()`-gated action you add will silently no-op under this harness (and
  for real users with dialogs disabled); use `mlArmDelete()` instead (see CONVENTIONS.md §6).
- **No watch mode, no coverage report, no CI exists.** `npm run verify` (or the three scripts
  individually) must be run manually after any change touching files that get spliced into `dist/`.
  Always `node build.js` first.

---
*Testing analysis: 2026-08-17*
