# External Integrations

**Analysis Date:** 2026-08-17

## Overview: no network backend

This project has **no server, no REST/GraphQL API, no database client, and no auth provider**. It is four self-contained static HTML files (`dist/*.html`) that embed all their own assets as base64 `data:` URIs. Because of that, "integrations" here means two different things, both covered below:

1. **The one genuine external network dependency** the shipped HTML actually makes (Google Fonts) — a real gap against the project's own "zero external file references" claim.
2. **Browser-platform APIs** that the app leans on as if they were external services — Web Audio, Canvas 2D, `localStorage`, and file/drag-drop ingestion — since these are the actual integration seams a future contributor needs to know about (e.g. "where does sound come from", "where does a photo go after upload").

Also covered: the Playwright-driven verification harness, which is this project's substitute for both a test framework and CI.

## APIs & External Services

**Fonts (the one real network call in the shipped app):**
- **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`) — loaded live via `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap">`, present in **all four** templates: `src/battle.tpl.html:9`, `src/audiolab.tpl.html:7`, `src/creator.tpl.html:7`, `src/lab.tpl.html:7` (each also has matching `<link rel="preconnect">` hints).
  - SDK/Client: none — plain `<link>` tag, no JS SDK.
  - Auth: none (public stylesheet endpoint).
  - **Note:** this contradicts the "外部ファイル参照ゼロ" (zero external file references) claim in `CLAUDE.md`/`README.md`. The `dist/*.html` files are *not* fully offline-capable as shipped — opening one with no network access will silently fail to load the `DotGothic16` webfont.
  - Graceful degradation: `font-family:"DotGothic16","MS Gothic","Hiragino Kaku Gothic ProN",monospace` (e.g. `src/battle.tpl.html:15`) — if the network request fails, text still renders using a local Gothic/monospace fallback. No JS depends on the font loading; this is a visual-only dependency.

No other external API, SaaS, or third-party JS SDK exists anywhere in `src/`, `tools/`, or `build.js`.

## Data Storage

**Databases:**
- None. No SQL/NoSQL client, no ORM, no query code anywhere in the repo.

**Browser `localStorage` (the only persistence layer):**
- Client: raw `localStorage.getItem`/`setItem`/`removeItem`, always with manual `JSON.stringify`/`JSON.parse` — no wrapper library.
- Scoping caveat (documented in `CLAUDE.md` §5): storage is keyed per browser **origin**, so `file://`, `http://localhost:8765`, and different browsers each see independent, non-shared storage. This is called out as the first thing to check when "saved data disappeared" is reported.
- Keys in use:

  | Key | Defined in | Holds |
  |---|---|---|
  | `shioumon_audio_cfg_v1` | `src/sfx_bank.js:247` | Shared sound-assignment config — `{master, moves:{...}, system:{...}}`. Read/written from audio lab, effect lab, battle, and creator screens alike. |
  | `shioumon_move_lib_v1` | `src/movelab.js:589` | Shared custom-move library, `{name: {name, fx, battle, audio}}`. Shared shelf between the move lab and the creator tool. |
  | `shioumon_wild_pool_v1` | `src/creator.tpl.html:955` | Array of monsters "released to the wild" via the creator tool: `{uid, at, cost, mon}[]`. |
  | `shioumon_creator_auto` | `src/creator.tpl.html:1969` | Creator tool autosave draft (debounced 350ms per `CLAUDE.md`). |
  | `shioumon_creator_slots` | `src/creator.tpl.html:1969` | Creator tool named save slots (explicit "save as" / "overwrite" flows). |
  | `shioumon_scene_sfx_v1` | `src/creator.tpl.html:396` | Scene/ambience sound picks for the creator tool. |
  | `shioumon_crydelay_050` | `src/creator.tpl.html:2274` | One-shot migration flag (marks that a cry-delay default change has already been applied). |

- **Known scaling limit, documented but not yet acted on:** `HANDOFF.md:220` — "次に詰まったら IndexedDB" (next bottleneck triggers a move to IndexedDB), because `localStorage` only holds strings and base64-encoded binary (photos, cries) inflates ~1.33x. `CLAUDE.md` §5 gives the target budget: ~21KB/monster after WebP (160px) + Opus (24kbps, ≤2s) compression, projecting ~2.1MB for 100 monsters — still under typical `localStorage` quotas, so IndexedDB migration is a documented future step, not a current integration.

**File Storage:**
- None (no cloud storage, no server filesystem writes from the shipped app). The only filesystem writes in the whole repo happen at **build/dev time**, outside the shipped product:
  - `build.js` writes `dist/*.html`.
  - `tools/gen_sfx.py` writes `src/sfx_bank.js`.
  - `tools/verify_*.js` write PNG screenshots to `.shots/` (gitignored).

**Caching:**
- None. No service worker, no HTTP cache-control logic (there's no server for the shipped product to control), no in-memory cache library.

## Authentication & Identity

- None. No login, no accounts, no session/cookie handling, no user-identity concept of any kind anywhere in the codebase.

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry/Bugsnag/etc. Errors surface only via the browser console (`console.warn`, e.g. `src/sfx_bank.js:207` on audio decode failure) or are caught by the Playwright harness during verification runs (`page.on('pageerror', ...)`, `page.on('console', ...)` in `tools/verify_audio.js` and `tools/verify_ui.js`).

**Logs:**
- The in-game "AI Log" (battle score breakdown — base/read/personality terms, per `CLAUDE.md` §5) is a **domain feature for player transparency**, not observability infra: it renders to an in-page log panel, nothing is sent off-device.
- Dev-side logging is exclusively `console.log`/`console.warn`, read by a human running the verify scripts or the browser devtools.

## CI/CD & Deployment

**Hosting:**
- None. No deployment target exists or is planned — `README.md` states explicitly this is a personal project that will not be distributed (partly because `assets/sprites/` contains copyrighted reference sprites used only for internal prototyping).

**CI Pipeline:**
- None. No `.github/workflows/`, no other CI config format found anywhere in the repo.

## Environment Configuration

**Required env vars:** none — the shipped app takes no configuration; it's static files.

**Optional dev-only env var:**
- `PW_CHROMIUM` — path to a Chromium executable, checked by `tools/verify_audio.js:10`, `tools/verify_ui.js:10`, and (per `CLAUDE.md`) `tools/verify_creator.js`, used when Playwright's own bundled Chromium can't be launched in the current environment.

**Secrets location:**
- N/A — no secrets exist in this project (no API keys, no credentials, no `.env` files present).

## Webhooks & Callbacks

**Incoming:** None — there is no server to receive anything.

**Outgoing:** None, aside from the passive Google Fonts `<link>` described above (not a callback/webhook — a one-way, fire-and-forget stylesheet fetch with no response handling in JS).

## Browser Platform APIs (the project's real "integration layer")

Since there's no backend, these browser-native APIs function as the effective external integrations — each is a boundary where the app hands off to something it doesn't control.

**1. Web Audio API — `src/sfx_bank.js` (`class SoundBank`, ~line 183 onward)**
- Instantiation: `window.AudioContext || window.webkitAudioContext`, lazily created on first `SND.ensure()` call (autoplay-policy-safe pattern).
- Bank contents: 79 CC0 sound effects, each stored as a base64 `data:audio/ogg;base64,...` string in the generated `SFX_SRC` table; decoded on demand via `ctx.decodeAudioData()` into an `AudioBuffer` cache (`this.buf[id]`).
- Playback graph: one `GainNode` per play (`createBufferSource()` → per-play `GainNode` → shared master `GainNode` → `ctx.destination`), so each sound gets independent volume/rate (`playbackRate.value`) without affecting others.
- Shared singleton: a single global `SND = new SoundBank()` instance is included via the `sfx_bank.js` token in **all four** built HTML files, so audio lab, effect lab, battle, and creator all play through the identical bank/config.
- Custom clips: `SoundBank.addCustom(id, label, dataURI)` lets the creator tool register a user-uploaded cry into the same runtime bank (used by `registerMonCry()`, per `CLAUDE.md` §5).
- Config layer riding on top: `AUDIO_CFG` / `AUDIO_CFG_DEFAULT` (also in `src/sfx_bank.js`) maps move IDs and system events to `{id, at, off, vol, rate}` playback instructions; persisted to `localStorage['shioumon_audio_cfg_v1']` (see Data Storage above). Callers must go through `playSys()`/`playMovePhase()` — sound IDs are never hardcoded elsewhere per project rule (`CLAUDE.md` §4.8).

**2. Canvas 2D API — primarily `src/fx_core.js`, `src/battle.tpl.html`, `src/creator.tpl.html`, `src/lab.tpl.html`**
- Main render surface: `<canvas id="cv" width="384" height="288">` (`src/battle.tpl.html:93`) — fixed internal resolution, scaled up via CSS `image-rendering:pixelated` for a retro pixel look; all effect visuals are drawn procedurally, never loaded from image files (per `CLAUDE.md` §4: "画像生成AIを使わない。画像ファイルを増やさない").
- Low-level draw primitives in `src/fx_core.js`: `pxLine`, `pxDisc`, `pxRing`, `pxArc`, `fillPolyPx` — hand-rolled pixel-grid drawing used by the six effect generators (projectile/beam/slash/lightning/aura/shatter).
- Off-screen canvases: `fieldCv` in `src/battle.tpl.html:736` (compositing), plus ad-hoc `document.createElement('canvas')` calls for sprite generation and image resizing.
- Export/re-encode uses:
  - `canvas.toDataURL('image/webp', q)` in `src/creator.tpl.html:1046` — re-encodes uploaded creature photos to WebP (falls back to `'image/png'` at `:1048` if the browser can't produce a WebP data URI), enforcing the 160px/WebP budget described in `CLAUDE.md` §5.
  - `canvas.toBlob(...)` in `src/lab.tpl.html:280` — exports a generated effect sprite sheet as a downloadable PNG.

**3. `localStorage`** — see Data Storage section above for the full key inventory; this is the sole persistence mechanism in the entire app.

**4. FileReader + native drag-and-drop — no upload endpoint anywhere; everything stays client-side**
- Pattern repeated across every file-ingestion point: `new FileReader()` → `r.onload` → `r.readAsDataURL(file)`, converting the picked/dropped file straight into a `data:` URI that's stored in memory and eventually persisted into the same JSON blob that goes to `localStorage`.
- Occurrences: `src/creator.tpl.html:1064,1195,1298` (photo upload, promise-wrapped variant, cry upload), `src/battle.tpl.html:1753` (custom sprite load), `src/audiolab.tpl.html:328` (custom SFX upload).
- Whole-document drag-and-drop (creator tool only, `src/creator.tpl.html:1388-1390`): `document.addEventListener('dragover', ...)` sets `dropEffect='copy'`; `document.addEventListener('drop', ...)` reads `e.dataTransfer` and routes the file to either the cry slot (audio) or the currently-selected photo slot (image) based on MIME type. Per `CLAUDE.md` §5, this exists because the target user drags files onto the page by habit, and an unhandled drop would make the browser navigate away to open the file directly.
- Known footgun documented in `CLAUDE.md` §5: `input.value=''` must only be reset **after** the read starts, since clearing it first can sever the `File` reference on some devices/browsers.

## Playwright-Driven Verification Harness

This is the project's substitute for both automated testing and CI — there is no test runner and no CI service, so this **is** the quality gate.

- **Dependency:** `playwright@^1.62.1` (only npm package in the project). Chromium is launched directly via `chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })`; the launch args exist specifically to let audio auto-decode during headless verification without a user gesture.
- **`tools/verify_audio.js`** — loads all four `dist/*.html` files via `file://` headlessly, calls `SND.resume()` in-page (`page.evaluate`) to unlock and decode all 79 bank sounds, then reports decode counts (`Object.keys(SND.buf).length`), `AUDIO_CFG` move/system counts, `AudioContext` state, and any `pageerror`/console-error events, plus a full-page screenshot to `.shots/`.
- **`tools/verify_ui.js`** — drives real interaction sequences per screen (clicks the audio-lab picker, adds a sound entry, opens the effect lab and previews a move, plays a battle for several seconds) and, for the battle screen, calls the in-page `determinismTest()` function to assert the seeded-RNG battle replay produces an identical HP-history signature across two runs — this is the project's core correctness check for its "no `Math.random()` in battle logic" rule (`CLAUDE.md` §4.1).
- **`tools/verify_creator.js`** (largest verification script, ~40KB) — exercises the creator tool end-to-end: simulates a real file pick via `page.setInputFiles('#imgFile', PNG)`, simulates drag-and-drop by constructing a `new DataTransfer()` and dispatching a synthetic `DragEvent('drop', ...)` directly on `document`, and captures every native `dialog` event (`page.on('dialog', d => d.dismiss())`) to prove the UI never silently depends on `confirm()`/`alert()` (a documented past failure mode, `CLAUDE.md` §5, since browsers that suppress dialogs make `confirm()` return `false` silently).
- **`tools/serve.js`** — zero-dependency static file server for `dist/` on `localhost:8765`, used only as a fallback when `file://` blocks a browser feature needed for verification.
- **Invocation:** `npm run verify` chains all three verify scripts; `npm run verify:creator` runs just the creator one. No `npm test` alias exists.

---

*Integration audit: 2026-08-17*
