# Phase 2: 開発シェル - Pattern Map

**Mapped:** 2026-08-18
**Files analyzed:** ~7 new/modified files (launcher, `build.js`, server, dashboard page, dev `SoundBank` variant, `package.json`, `.gitignore`)
**Analogs found:** 3 exact (extend-in-place: `build.js`, `tools/serve.js`, `package.json`), 2 strong precedent-but-not-copy (dashboard CSS shell, lazy-decode pattern), 2 no analog (launcher process-spawn, Bun-specific server APIs)

This phase is almost entirely new code. The useful output here is not "copy file X" but the **exact
interfaces the new code must not break**, plus the concrete conventions (CSS, localStorage keys, build
tokens) to reuse so the new pieces don't look or behave like a foreign transplant. The five numbered
sections below are the load-bearing content; standard File Classification / Shared Patterns tables follow
for planner convenience.

---

## 1. `SoundBank` in `src/sfx_bank.js` — THE critical interface

**File is 630,813 bytes (616.03 KB), 256 lines total.** `src/sfx_bank.js` is **read-only for all future
work** (per CONTEXT.md and CLAUDE.md law 8) — the dev build reads it, never writes it, never regenerates
it (`tools/gen_sfx.py`'s CC0 source packs are not present on this machine).

### Byte distribution (why the file is heavy)
- Lines 1–97 (data table: `SFX_CATS`, `SFX_SRC`, `CREDITS`): **623,715 bytes** — almost the entire file.
- Lines 98–256 (the `SoundBank` class + audio-assignment layer, i.e. all the *logic*): **7,098 bytes**.
- The 79 sound entries are **lines 4–82** (one entry per line), closing brace at line 83.
- **Every one of the 79 entries uses `data:audio/ogg;base64,...`** — verified by scanning all MIME
  prefixes in the data table; there is no mix of formats. A dev build only needs to handle `.ogg`.

### Exact shape of the sound table (`src/sfx_bank.js` lines 1–4, truncated)
```js
/* ===== sfx_bank.js — CC0効果音バンク（自動生成・編集しないで） ===== */
const SFX_CATS = [{"id": "shot", "label": "発射・弾"}, {"id": "beam", "label": "光線"}, ...];
const SFX_SRC = {
  "shot_light":{label:"発射・軽い",cat:"shot",src:"webgameattacksfxcc0/.../sfx_weapon_singleshot1.ogg",data:"data:audio/ogg;base64,T2dnUwACAAAA..."},
  "shot_mid":{label:"発射・中",cat:"shot",src:"...", data:"data:audio/ogg;base64,..."},
  /* ... 77 more, lines 4-82 ... */
};
```
Key = sound id (string, used everywhere as the "音ID" from CLAUDE.md law 8). Value fields: `label`
(Japanese display name), `cat` (category id, matches `SFX_CATS`), `src` (original CC0 file path — only
provenance metadata, not used at runtime), `data` (the full `data:audio/ogg;base64,...` URI — the only
field the decode path reads).

### Full class + decode path (`src/sfx_bank.js` lines 98–163)
```js
class SoundBank{
  constructor(){ this.ctx=null; this.buf={}; this.custom={}; this.master=0.55; this.ready=false; this.loading=null; }
  ensure(){
    if(this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.gain = this.ctx.createGain(); this.gain.gain.value = this.master;
    this.gain.connect(this.ctx.destination);
    return this.ctx;
  }
  async load(onProgress){
    if(this.loading) return this.loading;
    this.loading = (async()=>{
      const ctx = this.ensure();
      const ids = Object.keys(SFX_SRC).concat(Object.keys(this.custom));
      let n=0;
      for(const id of ids){
        try{
          const uri = (SFX_SRC[id]||this.custom[id]).data;
          const bin = atob(uri.split(',')[1]);
          const ab = new ArrayBuffer(bin.length); const u8 = new Uint8Array(ab);
          for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
          this.buf[id] = await ctx.decodeAudioData(ab);
          n++;
        }catch(e){ console.warn('[SND] decode失敗', id, e); }
        if(onProgress) onProgress(n, ids.length);
      }
      this.ready = true;
      return n;
    })();
    return this.loading;
  }
  addCustom(id, label, dataURI){
    this.custom[id] = {label:label||id, cat:'custom', src:'ユーザー追加', data:dataURI};
    this.buf[id] = null;
    return this.decodeOne(id);
  }
  async decodeOne(id){
    const ctx = this.ensure();
    const uri = (SFX_SRC[id]||this.custom[id]).data;
    const bin = atob(uri.split(',')[1]);
    const ab = new ArrayBuffer(bin.length); const u8 = new Uint8Array(ab);
    for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    this.buf[id] = await ctx.decodeAudioData(ab);
    return this.buf[id];
  }
  meta(id){ return SFX_SRC[id] || this.custom[id] || null; }
  list(cat){ const o=[]; for(const id in SFX_SRC) if(!cat||SFX_SRC[id].cat===cat) o.push(id);
             for(const id in this.custom) if(!cat||cat==='custom') o.push(id); return o; }
  setMaster(v){ this.master=v; if(this.gain) this.gain.gain.value=v; }
  setVol(v){ this.setMaster(v); }                 /* 旧API互換 */
  resume(){ this.ensure(); if(this.ctx.state==='suspended') this.ctx.resume();
            if(!this.loading) this.load(); return this.loading; }
  play(id,opt){
    opt = opt||{};
    if(!this.ctx || !this.buf[id]) return false;
    if(this.ctx.state==='suspended') this.ctx.resume();
    const s = this.ctx.createBufferSource(); s.buffer = this.buf[id];
    s.playbackRate.value = opt.rate==null?1:opt.rate;
    const g = this.ctx.createGain(); g.gain.value = opt.vol==null?1:opt.vol;
    s.connect(g); g.connect(this.gain);
    s.start(0, opt.from||0);
    return true;
  }
}
const SND = new SoundBank();
```

**Key facts a lazy loader must not break:**
- `this.buf` is the decoded-buffer cache, keyed by sound id (bank ids and custom ids share the same
  namespace). `this.custom` holds `{label,cat,src,data}` for user-added sounds (same shape as `SFX_SRC`
  entries). `meta(id)` and `list(cat)` already read from both maps transparently — any dev-mode change
  must keep reading through `SFX_SRC[id]||this.custom[id]`, not replace it.
- **`play(id,opt)` is synchronous and does NOT decode on demand.** `if(!this.ctx || !this.buf[id]) return
  false;` — if the buffer isn't already decoded, it silently no-ops. Nothing in `play()` triggers a
  decode. All 79 bank sounds are only ever decoded via `load()`, which decodes **all** of them in one
  pass (the "864KB HTML decodes 616KB of base64 on open" problem CONTEXT.md describes — technically it's
  "on first `resume()`", not literally on HTML parse, see below).
- `resume(){ this.ensure(); ...; if(!this.loading) this.load(); return this.loading; }` — this is the
  single trigger point for the expensive eager decode-everything pass. Every screen calls `SND.resume()`
  from its own "sound on" interaction point (confirmed call sites: `src/battle.tpl.html:1618,1783,1786,1801`,
  `src/creator.tpl.html:637,788,813,1304,1427,1847,1864`, `src/lab.tpl.html:184,298`,
  `src/audiolab.tpl.html:189,330,362,366,396`). None of these call sites decode a single sound — they all
  go through the same all-79 `load()`.

### The lazy-decode pattern already exists in this codebase — for cries, not bank sounds
`registerMonCry()` / `playCry()` in `src/creator.tpl.html` (lines 804–819) already implement exactly the
"decode this one id on first use, then play" pattern a lazy `SoundBank` needs — **this is the concrete
precedent to generalize**, not something to invent:
```js
function registerMonCry(S){
  const c=((S||SELF).mon||{}).cry;
  if(!c||!c.id||!c.data) return;
  SND.custom[c.id]={label:c.label||'鳴き声',cat:'custom',src:'ユーザー追加',data:c.data};
  if(SND.ctx && !SND.buf[c.id]) SND.decodeOne(c.id).catch(e=>console.warn('鳴き声デコード失敗',e));
}
function playCry(rateMul,S){
  S=S||SELF;
  const c=(S.mon||{}).cry; if(!c||!c.id) return;
  SND.resume();
  const opt={vol:c.vol==null?1:c.vol, rate:(c.rate==null?1:c.rate)*(rateMul||1)};
  if(!SND.buf[c.id] && c.data){
    registerMonCry(S);
    SND.decodeOne(c.id).then(()=>SND.play(c.id,opt)).catch(()=>{});
    return;
  }
  /* ...buf already present: play immediately... */
```
`decodeOne(id)` (sfx_bank.js lines 135–143) already exists as a single-sound async decode — it is
currently only called manually by cry code, never by `play()`/`playAt()`/`playMovePhase()`/`playSys()`
themselves. For dev-mode lazy loading to be a true drop-in against law 8 (`playSys()`/`playMovePhase()`
must stay the only entry points), the natural seam is: make `play()`/`playAt()` do what `playCry()` already
does by hand — check `buf[id]`, and if missing, `decodeOne(id).then(()=>play again)` instead of silently
returning `false`. **Consequence to flag for planning:** this makes the *first* playback of any given
sound in dev mode arrive after a decode round-trip (silent gap), whereas prod mode has zero such gap
because `load()` pre-decodes everything on `resume()`. That is the actual lazy-vs-eager tradeoff, not
something to design around — CONTEXT.md already accepts it ("音は鳴らす分だけ後から読む").

### What the dev build must change vs. what it must not
- `SFX_SRC[id].data` currently must be a full `data:...;base64,...` string for `atob()` to work. If the
  dev build decodes the 79 sounds to real files under `dist-dev/se/`, the dev-mode module text served to
  the browser needs a **different** decode path (`fetch(url).then(r=>r.arrayBuffer())` instead of
  `atob(...)`) for bank sounds, while custom/cry sounds (`SND.custom`, always populated at runtime via
  `addCustom()`/`registerMonCry()` with a real data URI from a user upload) must keep working exactly as
  today — they are never written to `dist-dev/se/`, so the dev variant's decode logic must branch (or the
  fetch path must gracefully fall back to `atob()` when the string doesn't start with `http`/a relative
  path). `src/sfx_bank.js` itself is never edited — this rewrite has to happen in generated output
  (`dist-dev/`), produced by `build.js`, not by hand-editing the source.
- `list(cat)`, `meta(id)`, `addCustom()`, `SND.custom` must keep their exact current signatures — nothing
  outside `sfx_bank.js` should need to change (`audio_ui.js`, `movelab.js`, all four `*.tpl.html` call
  these by name).

### `AUDIO_CFG` layer (shared across all 4 screens, lines 165–256)
`playSys(ev)` (line 242) and `playMovePhase(moveId,phase,speed)` (line 237) are the **only** sanctioned
entry points per CLAUDE.md law 8 — both just look up `AUDIO_CFG.system`/`AUDIO_CFG.moves` and call
`playAt(e,speed)` (line 231), which calls `SND.play(e.id,{vol,rate})`. `AUDIO_CFG` is loaded/saved via
`localStorage['shioumon_audio_cfg_v1']` (`AUDIO_CFG_KEY`, line 247) through `audioLoadSaved()` /
`audioSave()` (lines 248–256) — called from all four templates (`battle.tpl.html:1793,1803,1810,1811`,
`lab.tpl.html:284-285`, `audiolab.tpl.html:144,317`, `creator.tpl.html:1819,2266`). None of this needs to
change for the dev build; it's listed because any lazy-loader change to `play()` sits directly downstream
of it.

---

## 2. `build.js` — verbatim, and where a `--dev` branch hooks in

Full file is 55 lines. `MODULES` (7 entries, post-Phase-1 — `fx_audio` confirmed absent) and `TARGETS` (4
entries, matches the 4 files actually in `dist/`):

```js
const MODULES = {
  '/*__FX_CORE__*/' : read('fx_core.js'),
  '/*__SFX_BANK__*/': read('sfx_bank.js'),
  '/*__MOVES__*/'   : read('moves.js'),
  '/*__ANIMS__*/'   : read('anims.js'),
  '/*__AUDIO_UI__*/': read('audio_ui.js'),
  '/*__MOVELAB__*/' : read('movelab.js'),
  '/*__STARTER__*/' : read('starter_moves.js'),
};

const TARGETS = [
  ['lab.tpl.html',      'shioumon_effect_lab.html'],
  ['battle.tpl.html',   'shioumon_field_test.html'],
  ['audiolab.tpl.html', 'shioumon_audio_lab.html'],
  ['creator.tpl.html',  'shioumon_creator.html'],
];

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

let ok = 0;
for (const [tpl, out] of TARGETS) {
  const p = path.join(SRC, tpl);
  if (!fs.existsSync(p)) { console.warn('skip (無い):', tpl); continue; }
  let s = fs.readFileSync(p, 'utf8');
  for (const [token, code] of Object.entries(MODULES)) {
    if (s.includes(token)) s = s.replace(token, () => code);   // $& 展開を避けるため関数で渡す
  }
  const dst = path.join(DIST, out);
  fs.writeFileSync(dst, s);
  console.log('built', 'dist/' + out, '(' + Math.round(fs.statSync(dst).size / 1024) + ' KB)');
  ok++;
}
console.log(ok + ' / ' + TARGETS.length + ' 個ビルドした');
```

**All four `*.tpl.html` files use `/*__SFX_BANK__*/`** (confirmed: `lab.tpl.html:114`,
`audiolab.tpl.html:133`, and the same token is present in `battle.tpl.html`/`creator.tpl.html` — all four
screens play sound, all four embed the bank). This confirms the 616KB payload is duplicated into every
one of the 4 HTML outputs, not just one.

**Where a `--dev` branch hooks in without touching the existing behavior:** the loop above (lines 39–54)
is completely self-contained and unconditional — it is the entire current program. The safest hook is to
**append**, not branch-and-replace:
1. Read a flag near the top (after the `ROOT`/`SRC`/`DIST` consts, lines 12–14): `const DEV =
   process.argv.includes('--dev');` — there is **no existing CLI-arg parsing in `build.js` today** (it
   takes zero arguments); the closest convention in this repo for a script reading `process.argv` is
   `tools/serve.js`'s positional port argument (`parseInt(process.argv[2] || '8765', 10)`, see §3).
2. Leave the existing `MODULES`/`TARGETS`/loop (lines 22–54) completely untouched — this is what
   guarantees `dist/`'s 4 files stay byte-for-byte identical, which is this phase's explicit constraint.
3. Add a new block **after** line 54 (`console.log(ok + ' / ' + ...)`), guarded by `if (DEV) { ... }`,
   that: creates `dist-dev/`, decodes the 79 `SFX_SRC` entries already sitting in `MODULES['/*__SFX_BANK__*/']`-text
   (or re-parses `src/sfx_bank.js` directly) out to files under `dist-dev/se/`, and writes its own
   dev-mode HTML outputs using a **different** substitution for the `/*__SFX_BANK__*/` token (see §1 —
   this cannot just reuse `MODULES['/*__SFX_BANK__*/']` verbatim, since that string is still the full
   616KB inline version).
   Note `read('sfx_bank.js')` (line 24) always loads the full 616KB into memory regardless of `--dev` —
   that's fine (reading is cheap); what must not happen in dev mode is *emitting* that string into the
   dev HTML unchanged.
4. `console.log(ok + ' / ' + TARGETS.length + ...)` (line 54) is the last line of current output; anything
   dev-specific should log after it, so `node build.js` (no flag) prints exactly what it prints today.

---

## 3. `tools/serve.js` — verbatim (19 lines)

```js
#!/usr/bin/env node
/* dist/ をローカル配信するだけの検証用サーバ。file:// だとブラウザ検証が効かん環境がある。
   使い方:  node tools/serve.js [port]   → http://localhost:8765/shioumon_creator.html */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');
const PORT = parseInt(process.argv[2] || '8765', 10);
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json',
               '.png':'image/png', '.css':'text/css' };
http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('no'); return; }
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('見つからん: ' + rel); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
    res.end(buf);
  });
}).listen(PORT, () => console.log('serve  http://localhost:' + PORT + '/  ← dist/'));
```

**What the Bun rewrite must preserve:**
- **Path safety check** (`if (!file.startsWith(ROOT))`) — prevents `..`-escaping `ROOT`. Must be
  duplicated for whichever additional root(s) the Bun server serves (`dist-dev/`, and wherever the
  dashboard HTML lives) — each served root needs its own containment check, or one check per resolved
  root.
- **`ROOT` is single-rooted today** (`dist/` only) — the Bun version needs to serve at minimum `dist/`
  (unchanged, byte-identical per this phase's constraint) **and** `dist-dev/` (new), which means either
  routing by URL prefix (`/dev/...` → `dist-dev/`) or by port, plus the new audio files. **MIME table gap:
  no audio type is registered today** (`.ogg` is absent — `MIME[path.extname(file)] || 'application/octet-stream'`
  is the fallback used for every one of the 79 files in `dist-dev/se/` unless `.ogg`/`audio/ogg` is added).
- **404/403 response shape** — plain-text Japanese error bodies (`'見つからん: ' + rel`, `'no'`), not
  JSON. Keep this convention if the dashboard's future data endpoints (Phase 3) need to stay consistent,
  though this phase has no server-side write endpoints (dashboard is display-only, see §5).
- **Default port** stays positional-argument-driven (`process.argv[2]`, default `8765`) — this is the
  only existing precedent in the repo for reading a CLI argument; a `--dev` flag on `build.js` (§2) would
  be introducing boolean-flag parsing where none exists yet, while a Bun server's dev-vs-prod root
  selection could keep the same *positional* style (`node/bun tools/serve.js dev` or similar) to match
  existing convention, or introduce a flag — CONTEXT.md leaves the exact form to discretion, but matching
  serve.js's existing minimalism (no arg-parsing library, raw `process.argv`) is the established local
  convention worth keeping consistent with `--dev` on the build side.

---

## 4. Visual language — CSS conventions shared by `creator.tpl.html` and `lab.tpl.html`

Both files declare the same design tokens and are structurally identical style blocks (`creator.tpl.html`
lines 1–90, `lab.tpl.html` lines 1–45). This is the look the dashboard must not clash with.

**Color palette** (`creator.tpl.html:9-10`, `lab.tpl.html:9` — identical values, creator adds one extra
accent):
```css
:root{--bg:#0f1218;--panel:#191e27;--line:#2c3442;--text:#dfe6f0;--dim:#8b97a8;
      --accent:#f0a020;--mk:#7ad6a0;}
```
- `--bg:#0f1218` — page background (near-black navy)
- `--panel:#191e27` — card/section background, one step lighter than `--bg`
- `--line:#2c3442` — all borders
- `--text:#dfe6f0` — primary text (off-white)
- `--dim:#8b97a8` — secondary/hint text (muted blue-gray)
- `--accent:#f0a020` — orange; used for section headers in `lab.tpl.html` and for fx-specific headers /
  warnings in `creator.tpl.html` (`.warn{color:var(--accent);}`, `creator.tpl.html:67`) — **this doubles
  as the warning color**, so reuse it for the dashboard's "検証が通っとらん" state.
  `lab.tpl.html` has no `--mk`, so it also uses `--accent` for its primary "on/active" highlight.
- `--mk:#7ad6a0` (creator only) — green "ok/positive" accent; used for section headers, active button
  state, and every inline "this is good/confirmed" phrase (`color:#7ad6a0` appears throughout
  `creator.tpl.html` for confirmations). **Use this for the dashboard's "検証が通っとる" / "最終更新済み" state.**
- Other recurring inline hex not in `:root`: `#e07070` (error red, `creator.tpl.html:2042`), `#c07af0`
  (purple, personality sliders), `#8fb4d8` (blue, shadow sliders / lab's "go" button family).

**Font stack** (`creator.tpl.html:7,13`, identical in `lab.tpl.html:7,12`) — this is the **one** allowed
external reference per CLAUDE.md:
```html
<link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet">
```
```css
html,body{margin:0;background:var(--bg);color:var(--text);
  font-family:"DotGothic16","MS Gothic","Hiragino Kaku Gothic ProN",monospace;}
```

**Layout shell** (both files):
```css
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
body{padding:10px 10px 60px;}
h1{font-size:14px;margin:2px 0 8px;color:var(--accent);letter-spacing:1px;}
.wrap{max-width:576px;margin:0 auto;}
```
`.wrap{max-width:576px}` is the single-column, phone-width-ish shell every screen uses — matches
CONTEXT.md's "1画面に収める" requirement for the dashboard directly.

**Panel / section pattern** (`creator.tpl.html:30-35`, `lab.tpl.html:26-30`):
```css
.sec{background:var(--panel);border:1px solid var(--line);border-radius:4px;margin-bottom:8px;}
.sec>h2{font-size:12px;margin:0;color:var(--accent);padding:10px 12px;cursor:pointer;
  display:flex;justify-content:space-between;letter-spacing:1px;}
.sec>div{padding:0 12px 12px;}
.sec.closed>div{display:none;}
```

**Button pattern** (`creator.tpl.html:23-29`, `lab.tpl.html:21-25` — same base, different "on" hue):
```css
button{background:#252d3a;border:1px solid var(--line);color:var(--text);border-radius:3px;
  padding:9px 6px;font-size:11px;font-family:inherit;cursor:pointer;}
button:active{background:var(--mk);color:#0f1218;}          /* lab.tpl.html uses var(--accent) here */
button.on{background:var(--mk);color:#0f1218;border-color:var(--mk);}
button.go{background:#1d5a3a;border-color:#2c8a5c;color:#d0f5e4;}      /* creator: green "go" */
/* lab.tpl.html's .go is blue instead: background:#1d4a63;border-color:#2c6d92;color:#cdeaf8; */
button.warnbtn{background:#5a2a1a;border-color:#8a4a2c;color:#f5d4c0;} /* creator only — destructive action */
```

**`.ctl` (control row) and `.hint` (secondary text) patterns** (`creator.tpl.html:36-43,66`, near-identical
in `lab.tpl.html:31-36,45`):
```css
.ctl{display:flex;align-items:center;gap:8px;margin-bottom:7px;}
.ctl label{font-size:11px;color:var(--dim);width:78px;flex:none;}
.ctl input[type=range]{flex:1;min-width:50px;accent-color:var(--mk);}
.ctl .v{font-size:11px;color:var(--mk);width:50px;text-align:right;flex:none;}
.hint{font-size:10px;color:var(--dim);line-height:1.6;margin-top:6px;}
```
`.hint` divs are used everywhere for the small explanatory Japanese notes under a control — this is the
right class for the dashboard's "開き方が違う箱を見とるかもしれん" localStorage-origin caveat that
CONTEXT.md requires.

**Convention worth naming explicitly:** every screen is **one self-contained HTML file** with inline
`<style>` and inline `<script>` — there are zero page-specific external `.js`/`.css` files (only the
*shared* component modules `audio_ui.js`/`movelab.js` are separate, and those get textually inlined by
`build.js`, never `<script src>`-loaded). The dashboard should follow the same shape: a single HTML file
with everything inline, not a split HTML+JS+CSS trio.

---

## 5. What the dashboard can display, and from which side

### Client-side only (dashboard's own `<script>`, reads `localStorage` after the page loads at
`http://localhost:PORT` — **empty if the origin doesn't match what a screen was opened as, see CLAUDE.md
line 225 "保存データは開き方ごとに別の箱"**):

| Key (exact string) | Constant name / defined in | Value shape | Written by |
|---|---|---|---|
| `shioumon_creator_slots` | `SLOT_KEY`, `src/creator.tpl.html:1969` | `{ [表示名:string]: JSON文字列(snapshot) }` — **outer object is real JSON, each value is itself a JSON string** (`JSON.parse(sl[k])` to get the mon). This is the "四皇モンの一覧". | 制作ツール only (`creator.tpl.html:2065,2103,2119` — save/overwrite/delete) |
| `shioumon_creator_auto` | `AUTO_KEY`, `src/creator.tpl.html:1969` | single JSON string = one `snapshot()` (the in-progress, unsaved mon) — debounced 350ms | 制作ツール only, on every edit |
| `shioumon_move_lib_v1` | `MOVE_LIB_KEY`, `src/movelab.js:589` | `{ [技名:string]: {name, fx, battle, audio} }` — values are **plain objects, not stringified** (unlike `shioumon_creator_slots`) | 技ラボ **and** 制作ツール (shared component `movelab.js`) |
| `shioumon_wild_pool_v1` | `WILD_KEY`, `src/creator.tpl.html:955` | JSON array of `{uid, at:ISO8601string, cost:number, mon:<object, not stringified>}` (`creator.tpl.html:970-971`) — **this is the only key with a real timestamp field** | 制作ツール only ("草むらへ放つ") |
| `shioumon_audio_cfg_v1` | `AUDIO_CFG_KEY`, `src/sfx_bank.js:247` | `{master:number, moves:{...}, system:{...}}` (same shape as `AUDIO_CFG_DEFAULT`) | All 4 screens (`audioSave()`/`audioLoadSaved()`, shared via `sfx_bank.js`) |
| `shioumon_scene_sfx_v1` | `SCENE_SFX_KEY`, `src/creator.tpl.html:396` | `{appear:{id,vol,rate}, grass:{id,vol,rate}}` | 制作ツール only |
| `shioumon_crydelay_050` | inline literal, `src/creator.tpl.html:2274-2275` | one-time migration flag, value `'1'` | 制作ツール only (not real content, skip in dashboard) |

**Per-mon "技の本数" is computable but not stored as a count** — each stringified mon in
`shioumon_creator_slots` has `.moves` (array of built-in move ids) and `.customMoves` (array of custom
move objects); count = `moves.length + customMoves.length` after `JSON.parse`. `DEFAULT_MON()`
(`creator.tpl.html:358-375`) shows the full mon field set (`id, name, types, stats, per, moves,
customMoves, cry, scale, dy, idleMotion, summon, shadow, img`) — **no `updatedAt`/`savedAt`/timestamp
field anywhere on a mon or on the `shioumon_creator_slots` entry that holds it.**

> **Gap to flag for planning:** CONTEXT.md asks the dashboard to show "最終更新" per saved 四皇モン, but
> **no per-mon timestamp exists anywhere in current localStorage data.** `shioumon_wild_pool_v1` is the
> only key with a real `at` timestamp, and that's the *wild pool* (released copies), not the saved-slot
> list. The planner needs to decide: drop "最終更新" per-row, substitute something else (e.g. just the KB
> size, which is available), or accept that only a global "some KB total, saved N体" summary is honestly
> derivable from what exists today — adding a timestamp field would be a (small) schema change to
> `creator.tpl.html`'s save path, which is outside this pattern map's remit to decide.

**Storage-usage calculation already has an exact precedent** — reuse this verbatim pattern
(`creator.tpl.html:2036-2039`, inside `autoSave()`):
```js
const kb=Math.round(j.length/1024);
let used=0; try{ for(const k in localStorage) used+=(localStorage[k]||'').length; }catch(e){}
$('autoState').innerHTML='<b style="color:#7ad6a0">自動保存済み</b>　この1体 '+kb+'KB　'+
  '<span style="color:#6a7484">置き場ぜんぶで '+Math.round(used/1024)+'KB</span>　'+
  new Date().toLocaleTimeString('ja-JP');
```
The `for(const k in localStorage) used+=(localStorage[k]||'').length` loop is the exact idiom for a
"保存容量" total, already used in production code — the dashboard should copy this, not reinvent it.

**Name-collision-safe listing** — `buildSlotList()` (`creator.tpl.html:2050-2071`) is the existing
pattern for enumerating `shioumon_creator_slots` into rows (name, KB size, action buttons); dashboard's
mon-list rendering is structurally the same enumeration minus the load/delete actions.

### Server-side only (Bun reads the filesystem; the dashboard cannot see any of this from `localStorage`):
- **`dist/` file sizes/mtimes** — currently (measured this session): `shioumon_creator.html` 884,781 B
  (~864 KB), `shioumon_field_test.html` 781,838 B (~763.5 KB), `shioumon_effect_lab.html` 734,616 B
  (~717.4 KB), `shioumon_audio_lab.html` 702,568 B (~686.1 KB). These match REQUIREMENTS.md's "693〜864KB"
  range. `dist-dev/` does not exist yet on this machine — nothing to size until the dev build runs.
  Removing the 630,813-byte `sfx_bank.js` payload from `shioumon_creator.html` alone projects to roughly
  254 KB (~29% of current size) — **this is a projection from current file sizes, not a measurement of
  the actual dev build output**; CONTEXT.md explicitly wants the real number measured and recorded once
  the dev build exists, not asserted in advance.
- **Whether `npm run verify` last passed — there is currently no persisted result to read.** Checked all
  four `tools/verify_*.js` scripts: none of them write a status/report file to disk. Each only
  `console.log`s (one of them, `verify_audio.js:52`, logs a JSON blob to stdout) and sets
  `process.exit(errs.length ? 1 : 0)` (`verify_audio.js:59`, `verify_ui.js:134`, `verify_creator.js:807`,
  `verify_resolve.js:92`). **There is no cached pass/fail artifact anywhere in the repo.** For the
  dashboard to show verify status, the Bun server has to actually spawn the verify command itself (all 4
  scripts run sequentially, each opens a Playwright Chromium instance — not instant) and capture the exit
  code, or the phase needs to add a small result-file write step to the verify chain. This is worth
  surfacing explicitly since CONTEXT.md phrases it as "サーバー側でファイルを見て出す" as if a result file
  already exists — it doesn't.
- File mtimes for staleness comparisons (e.g. "is `dist/` older than `src/`?") are legitimately
  server-only and cheap (`fs.statSync(...).mtime`) — this is a reasonable fallback/complement to a full
  verify run.

---

## Chromium/Chrome/Edge discovery (for the launcher, SHELL-01)

**Confirmed by file existence only (no `--version`, no launch) this session:**
- `C:\Users\genki\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe` — **EXISTS**.
- Sibling entries under `ms-playwright\`: `chromium-1234`, `chromium_headless_shell-1234` (**not the same
  thing** — note underscore vs. hyphen after `chromium`; this one only contains
  `chrome-headless-shell-win64\`, no full GUI-capable `chrome.exe` at the `chrome-win64` relative path),
  `ffmpeg-1011`, `winldd-1007`, `daemon`, `cli-update-check.json`, `b`.
- Fallback candidates, also confirmed present on this machine: `C:\Program Files\Google\Chrome\Application\chrome.exe`
  (exists), `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` (exists). Not present:
  `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`, `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`,
  `C:\Program Files\Microsoft\Edge\Application\msedge.exe`.

**How to discover the Playwright Chromium path without hardcoding the version:** the `1234` segment is a
Playwright-internal build number that changes on every `playwright` package upgrade (it is not the Chrome
version number — the `.manifest` file inside is named `151.0.7922.34.manifest`, a different number
entirely). A launcher must **glob** `%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe`
(literal hyphen after `chromium`, which naturally excludes `chromium_headless_shell-*`), then verify
existence of the matched file, rather than embed `chromium-1234` as a literal.

**Existing but only conceptually related precedent** — all four `tools/verify_*.js` scripts already
implement a "prefer bundled, allow override" idiom via an env var (not the same launch mechanism the
launcher needs — `chromium.launch()` is Playwright's own automation API, headless by default, not a
detached GUI process with `--app`/`--user-data-dir`):
```js
/* Chromium が見つからんときは PW_CHROMIUM に実行ファイルのパスを入れる */
const LAUNCH = { args:['--autoplay-policy=no-user-gesture-required'] };
if(process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;
const b = await chromium.launch(LAUNCH);
```
This confirms the project's established convention — default to Playwright's own browser, fall back to an
explicit path — but the launcher itself has **no analog in this codebase**: nothing today spawns an
external OS-level GUI process (`child_process.spawn`) with `--app=<url> --user-data-dir=<dir>`. This is
genuinely new code with no local precedent to copy; the only reusable idea is the "try candidates in
order, existence-check each" shape.

---

## `package.json` — verbatim (17 lines, current)

```json
{
  "name": "pocket-shiou-monster",
  "version": "0.14.0",
  "private": true,
  "description": "ポケット四皇モンスター — 収集・育成・AI自動戦闘のモンスターゲーム",
  "scripts": {
    "build": "node build.js",
    "serve": "node tools/serve.js",
    "verify": "node tools/verify_audio.js && node tools/verify_ui.js && node tools/verify_creator.js && node tools/verify_resolve.js",
    "verify:creator": "node tools/verify_creator.js",
    "verify:resolve": "node tools/verify_resolve.js",
    "sfx": "python3 tools/gen_sfx.py"
  },
  "devDependencies": {
    "playwright": "^1.62.1"
  }
}
```
Precedent for adding a script entry: Phase 1 added `"verify:resolve": "node tools/verify_resolve.js"` —
a single flat key, no nesting, imperative name matching the file it runs. A `"dev"` entry (SHELL-04's "1
コマンドで起動する") should follow the same flat, one-line convention.

`.gitignore` (11 lines, verbatim) does not yet exclude `dist-dev/` — only `node_modules/`, `.shots/`,
`*.log`, `.DS_Store`, and the two CC0 asset-pack folders under `assets/` are ignored. Worth a one-line
addition alongside the new build output.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `build.js` (extend) | config/build script | batch/transform | itself, lines 1–55 | exact — extend in place, append after existing loop |
| `tools/serve.js` (extend/rewrite for Bun) | server | request-response | itself, 19 lines | exact — extend in place, keep path-safety + MIME-table shape |
| launcher (new: `.cmd`/`.ps1`/`.lnk`) | utility / launcher | process-spawn (one-shot, not request-response) | none in-repo for the spawn mechanism; `tools/verify_*.js`'s `PW_CHROMIUM` idiom for the *discovery* concept only | no true analog — see dedicated section above |
| dashboard page (new, single self-contained HTML) | component (page) | request-response (page load) + client-side read (localStorage) | `src/lab.tpl.html` / `src/creator.tpl.html` for the HTML/CSS shell only | role-match (visual shell only — no existing screen aggregates data the way a dashboard does) |
| dev `SoundBank`/`sfx_bank` variant (generated into `dist-dev/`, not hand-written under `src/`) | service | file-I/O + event-driven (decode-on-demand) | `registerMonCry()`/`playCry()` in `src/creator.tpl.html:804-819`, `SoundBank.decodeOne()` in `src/sfx_bank.js:135-143` | exact — this pattern already exists for cries, generalize it |
| `package.json` (add `dev` script) | config | n/a | itself; Phase 1's `verify:resolve` addition | exact |
| `.gitignore` (add `dist-dev/`) | config | n/a | itself, existing entries | exact |

## Shared Patterns

### Visual shell (color, font, panel/button/hint classes)
**Source:** `src/creator.tpl.html` lines 1–90, `src/lab.tpl.html` lines 1–45 (see §4 above for full excerpts)
**Apply to:** dashboard page — `:root` palette, `.wrap{max-width:576px}`, `.sec`/`.ctl`/`.hint` classes,
button base + `.on`/`.go`/`.warnbtn` variants, DotGothic16 font stack with the same single external
Google Fonts `<link>`.

### localStorage read-with-fallback idiom
**Source:** e.g. `src/creator.tpl.html:2046-2049` (`loadSlots()`), `src/creator.tpl.html:958-961` (`loadWild()`)
```js
function loadSlots(){
  try{ const o=JSON.parse(localStorage.getItem(SLOT_KEY)||'{}');
       return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; }
}
```
**Apply to:** every localStorage read the dashboard does — always `try/catch`, always a safe-typed
fallback (`{}`/`[]`), never let a corrupt/missing key throw into the page.

### Storage-usage total
**Source:** `src/creator.tpl.html:2036-2039` (see §5 above)
**Apply to:** dashboard's "保存容量" panel — copy the `for(const k in localStorage) used+=...length` loop verbatim.

### Decode-on-demand-then-play
**Source:** `src/creator.tpl.html:804-819`, `src/sfx_bank.js:135-143` (`decodeOne`)
**Apply to:** dev-mode lazy `SoundBank` — see full discussion in §1.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| launcher script | utility/launcher | process-spawn | Nothing in this repo spawns a detached OS GUI process; `tools/verify_*.js` uses Playwright's own automation launch API, a different mechanism (headless-by-default, CDP-attached) than a user-facing `--app` window |
| dashboard's data-aggregation logic | component | request-response + read | No existing screen summarizes/lists data the way a dashboard does — closest are `buildSlotList()`/`buildFoe()` enumerations in `creator.tpl.html`, which are single-purpose (mon-picker lists), not a mixed-source summary view |
| Bun-native server APIs (`Bun.serve`, `Bun.file`, etc.) | server | request-response | `tools/serve.js` is plain Node `http`; nothing in the repo currently touches Bun's API surface |

## Metadata

**Analog search scope:** `build.js`, `tools/serve.js`, `tools/verify_*.js`, `src/*.tpl.html`,
`src/sfx_bank.js`, `src/movelab.js`, `package.json`, `.gitignore`, `.planning/REQUIREMENTS.md`,
`.planning/ROADMAP.md`. `node_modules/` excluded throughout. No browser launched at any point (all
Chromium/Chrome/Edge checks were file-existence only, per instruction).
**Files scanned:** 4 `*.tpl.html` templates, `build.js`, `tools/serve.js`, all 4 `tools/verify_*.js`,
`src/sfx_bank.js` (targeted, never loaded whole — see §1 byte breakdown), `src/movelab.js` (targeted),
`package.json`, `.gitignore`.
**Pattern extraction date:** 2026-08-18
