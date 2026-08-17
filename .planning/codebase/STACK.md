# Technology Stack

**Analysis Date:** 2026-08-17

## Languages

**Primary:**
- JavaScript (vanilla ES2020+, no TypeScript) — all game logic and UI. Lives in `src/*.js` (shared modules) and inline `<script>` blocks in `src/*.tpl.html` (per-screen logic). No transpilation, no bundler — the code that runs in the browser is exactly the code checked into `src/`.
- HTML5 + CSS3 — `src/*.tpl.html` (4 files), inline `<style>` blocks per template. No CSS framework, no preprocessor (no Sass/Less/PostCSS).

**Secondary:**
- Python 3 — `tools/gen_sfx.py` only. Build-time/asset-time tool, never shipped to the browser. Not version-pinned (no `.python-version`, no `pyproject.toml`); dev environment observed running Python 3.13.14.
- Node.js (CommonJS) — `build.js`, `tools/serve.js`, `tools/verify_*.js`. Dev/build tooling only, never shipped to the browser.

## Runtime

**Environment:**
- **Shipped product runtime = the browser.** `dist/*.html` are self-contained single-file artifacts (all images/audio embedded as base64 `data:` URIs) meant to be opened directly via `file://` or served statically. There is no Node.js, no server, and no runtime dependency of any kind once a `dist/*.html` file exists.
- **Dev/build runtime = Node.js.** No `engines` field in `package.json`. The sole npm dependency, `playwright@^1.62.1`, declares `"engines": {"node": ">=20"}` in its own manifest (`package-lock.json`), which is the closest thing to a stated minimum. Dev environment observed running Node v26.1.0.
- Target browser capability (inferred from API usage, not stated anywhere): ES2020 `class` syntax, `Web Audio API`, `Canvas 2D`, `requestAnimationFrame`, `FileReader`, HTML5 drag-and-drop, `localStorage`. Verification is explicitly against Chromium only (via Playwright) — no cross-browser test matrix.

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present (`lockfileVersion: 3`)

## Frameworks

**Core:**
- None. No frontend framework (no React/Vue/Svelte/etc.), no state-management library, no router. All 4 screens are plain global-scope scripts operating directly on the DOM and a `<canvas>`.

**Testing:**
- `playwright` `^1.62.1` (the project's only npm dependency, declared as a `devDependency` in `package.json`) — used as a **browser automation / verification harness**, not a conventional test framework. There is no test runner (no Jest/Vitest/Mocha), no `describe`/`it` blocks, and no assertion library. `tools/verify_audio.js`, `tools/verify_ui.js`, `tools/verify_creator.js` are plain async Node scripts that drive `chromium.launch()` directly and `console.log(JSON.stringify(results))` for a human to read. See `TESTING.md` (quality focus) for details if present.

**Build/Dev:**
- `build.js` (project root, ~56 lines) — a hand-rolled templater. It reads each `src/*.js` module into memory and does literal token replacement (e.g. `/*__FX_CORE__*/` → contents of `src/fx_core.js`) inside each `src/*.tpl.html`, then writes the result to `dist/`. No AST parsing, no minification, no source maps, no watch mode.
- `tools/serve.js` (~19 lines) — zero-dependency static file server built directly on Node's `http` module (no Express/Koa/etc.). Serves `dist/` on `http://localhost:8765`. Exists only because some browsers restrict JS features (e.g. audio autoplay, fetch) under `file://`.
- `tools/gen_sfx.py` — regenerates `src/sfx_bank.js` from raw CC0 audio files in `assets/` (not committed — see Configuration below). Shells out to `ffmpeg` (via `subprocess.run`) to downmix/recompress each clip to mono 22.05kHz Ogg Vorbis before base64-embedding it, to minimize the size of the generated JS file.

## Key Dependencies

**Critical:**
- `playwright` `^1.62.1` — the **only** entry in `package.json` (`devDependencies`). Not used by the shipped app at all; used exclusively by `tools/verify_*.js` to drive headless/headed Chromium for manual-style verification runs (screenshots to `.shots/`, console/page-error capture, in-page evaluation of app state like `determinismTest()`).
- `playwright-core` `1.62.1` and `fsevents` `2.3.2` (macOS-only, optional) — transitive, pulled in automatically by `playwright`.

**Infrastructure:**
- None. Zero runtime npm packages are bundled into `dist/*.html` — the shipped product has no dependency graph at all, by design (see `CLAUDE.md` rule 4: no image-gen AI, no added image files; everything is hand-written procedural code).

## Configuration

**Environment:**
- No `.env` files exist in the project (confirmed by directory listing).
- No required environment variables for the app itself (it's static HTML/JS with no server).
- One optional dev-only env var: `PW_CHROMIUM` — path to a Chromium executable, read by all three `tools/verify_*.js` scripts when Playwright's bundled Chromium can't be found/launched in the current environment.
- `.gitignore` excludes `node_modules/`, `.shots/` (Playwright screenshot output), `*.log`, and two large asset-source directories (`assets/webgameattacksfxcc0/`, `assets/webgamesfxcc0kenney/` — the raw CC0 sound packs, ~29MB combined, only needed when re-running `tools/gen_sfx.py`; not required for normal build/dev since `src/sfx_bank.js` already has everything baked in).

**Build:**
- No `tsconfig.json`, no `.eslintrc*`, no `.prettierrc*`, no `webpack`/`vite`/`rollup`/`esbuild` config, no `.babelrc`, no `.editorconfig`, no `.nvmrc`. Zero tooling-config files exist in this repo beyond `package.json` itself and `build.js`.
- `build.js` token map (source module → template placeholder), all in `src/`: `fx_core.js`→`/*__FX_CORE__*/`, `sfx_bank.js`→`/*__SFX_BANK__*/`, `moves.js`→`/*__MOVES__*/`, `anims.js`→`/*__ANIMS__*/`, `audio_ui.js`→`/*__AUDIO_UI__*/`, `movelab.js`→`/*__MOVELAB__*/`, `starter_moves.js`→`/*__STARTER__*/`, `fx_audio.js`→`/*__FX_AUDIO__*/` (legacy, unused, marked for deletion in `CLAUDE.md`).
- Build targets (`src/*.tpl.html` → `dist/*.html`): `lab.tpl.html`→`shioumon_effect_lab.html`, `battle.tpl.html`→`shioumon_field_test.html`, `audiolab.tpl.html`→`shioumon_audio_lab.html`, `creator.tpl.html`→`shioumon_creator.html`.
- `src/sfx_bank.js` (630,813 bytes / ~616KB) is machine-generated by `tools/gen_sfx.py` and must never be hand-edited (enforced only by convention/comment, not tooling) — it embeds 79 CC0 sound effects as base64 `data:` URIs plus the `SoundBank` class and the default `AUDIO_CFG` sound-assignment table.

## Platform Requirements

**Development:**
- Node.js (>=20 recommended, per Playwright's own engine constraint) + npm, for `npm install` (pulls in Playwright + its bundled Chromium) and running `build.js`/`tools/*.js`.
- Python 3 + `ffmpeg` on `PATH` — **only** needed to regenerate `src/sfx_bank.js` via `python3 tools/gen_sfx.py`, and only if the two raw CC0 asset packs are present under `assets/` (gitignored, ~29MB, not part of a fresh checkout). Not required for `npm install && node build.js`.
- A Chromium binary reachable by Playwright (bundled by default; override via `PW_CHROMIUM` env var if unavailable) — needed only to run `tools/verify_*.js`, not to build.

**Production:**
- None — there is no production deployment. `dist/*.html` are meant to be opened locally (`file://`) or shared as standalone files; `tools/serve.js` exists purely as a local dev convenience for environments where `file://` blocks certain JS behavior, not as a hosting solution.
- Target consumer is a single developer/tester on desktop or mobile browser (`README.md`: internal render resolution 384×288 upscaled nearest-neighbor, "スマホ片手で触る前提のUI" — designed for one-handed phone use, viewport meta locks zoom).
- Explicitly not distributed: `README.md` states this is a personal project that will not be published, in part because `assets/sprites/` contains copyrighted Pokémon sprite reference art used only for internal prototyping.

---

*Stack analysis: 2026-08-17*
