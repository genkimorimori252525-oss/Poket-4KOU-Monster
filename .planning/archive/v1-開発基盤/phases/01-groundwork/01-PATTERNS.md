# Phase 1: 足場の地ならし - Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 7 (FIX-01〜07, one file touched twice in two fixes)
**Analogs found:** 6 / 7 (FIX-07's detection mechanism has no existing analog — see "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/audiolab.tpl.html` (FIX-02: `confirm()` @ line 359) | component (inline `<script>`, button handler) | event-driven | `src/movelab.js` `mlArmDelete()` | exact |
| `src/audiolab.tpl.html` (FIX-04: `/*__ANIMS__*/` @ line 135) | config (build-token include list) | transform (build-time string replace) | `build.js` `MODULES` table | role-match |
| `tools/verify_audio.js` (FIX-03) | test (standalone Playwright script) | event-driven / request-response (browser automation) | `tools/verify_creator.js` | exact |
| `tools/verify_ui.js` (FIX-03) | test (standalone Playwright script) | event-driven / request-response (browser automation) | `tools/verify_creator.js` | exact |
| `build.js` (FIX-01: drop `FX_AUDIO` entry) | config / build script | batch (token→content substitution) | itself — table is edited in place, no external analog needed | n/a (self-contained) |
| `src/fx_audio.js` (FIX-01: delete file) | utility (dead code) | n/a | — deletion only, `CLAUDE.md:64` already authorizes it | n/a |
| `src/battle.tpl.html` (FIX-07: `resolve()` @ line 474) | component (render-state query) | transform (pure-ish lookup over instance state) | `src/creator.tpl.html` `resolve()` — mutual comparison peer, not a copy source | partial (see side-by-side below) |
| `src/creator.tpl.html` (FIX-07: `resolve()` @ line 464) | component (render-state query) | transform (pure-ish lookup over module state) | `src/battle.tpl.html` `resolve()` — mutual comparison peer | partial |
| *(new)* divergence check for FIX-07 | test (likely a Playwright script or addition to one) | event-driven / request-response | `tools/verify_creator.js`'s `pg.evaluate()` calls | role-match, no direct copy target |
| `CLAUDE.md` (FIX-06 line ~24, FIX-05 lines 215-216) | documentation | n/a | n/a — corrections are grounded in actual source, quoted below | n/a |

---

## Pattern Assignments

### 1. `src/audiolab.tpl.html:359` — `confirm()` → two-press (FIX-02)

**Analog:** `src/movelab.js` — `mlArmDelete()`, the working two-press implementation.

**Full function, with its guiding comment** (`src/movelab.js:116-133`):
```js
/* 二度押しで消す。
   confirm() はブラウザに「このページのダイアログを表示しない」を効かされると
   黙って false を返す。そうなると何を押しても消えん。ダイアログに頼らん。 */
function mlArmDelete(btn, onDo, armedText){
  let armed=false, timer=null;
  const base=btn.textContent, baseW=btn.style.width, baseTitle=btn.title||'';
  const reset=()=>{ armed=false; btn.textContent=base; btn.title=baseTitle;
    btn.style.width=baseW; btn.style.background='';
    if(timer){ clearTimeout(timer); timer=null; } };
  btn.onclick=e=>{
    if(e) e.stopPropagation();
    if(armed){ reset(); onDo(); return; }
    armed=true;
    btn.textContent=armedText||'消す？'; btn.title='もう一度押すと決まる';
    btn.style.width='auto'; btn.style.background='#7a2020';
    timer=setTimeout(reset,3500);
  };
}
```

**How armed state resets:** three ways, all funneled through the same `reset()` closure — (a) a 3.5s `setTimeout` (line 131, `timer=setTimeout(reset,3500)`), (b) the second real click (`if(armed){ reset(); onDo(); return; }`), and (c) nothing else — there is no blur/outside-click handling, the timer alone guards against a stale armed state. `reset()` restores `textContent`/`title`/`width`/`background` to the values captured on first call, so it works for any button regardless of its original label.

**How the button is wired** (call-site example, `src/movelab.js:349`):
```js
mlArmDelete(bx,()=>{ forgetPart(p); sp.parts.splice(i,1); mlParts(host,ctx); ctx.change(); });
```
`bx` is a plain `<button>` element already in the DOM; `mlArmDelete` takes it over via `btn.onclick=...`, no HTML markup changes needed beyond having the button exist. Two more call sites follow the identical shape: `src/movelab.js:486` and `src/movelab.js:658`.

**Current code to replace** — HTML (`src/audiolab.tpl.html:119`):
```html
<button id="btnReset">初期設定に戻す</button>
```
JS wiring (`src/audiolab.tpl.html:359-361`):
```js
$('btnReset').onclick=()=>{ if(!confirm('初期設定に戻す？　今の割り当ては消える')) return;
  audioApply(JSON.parse(JSON.stringify(AUDIO_CFG_DEFAULT)));
  buildMoveList(); buildTL(); buildSys(); save(); };
```
Confirmed by grep this is the **only** `confirm(` in the file; the three `alert(` calls at lines 349/350/355 are pure notifications (no branch gated behind them) and are out of scope per `CLAUDE.md:186` ("動作の分かれ道に置かん" — the rule targets dialogs that gate a decision, not status alerts).

**Important caveat — `mlArmDelete` is not directly callable here.** `src/audiolab.tpl.html`'s build-token list (`src/audiolab.tpl.html:132-136`) is:
```html
<script>
/*__FX_CORE__*/
/*__SFX_BANK__*/
/*__MOVES__*/
/*__ANIMS__*/
/*__AUDIO_UI__*/
```
`/*__MOVELAB__*/` is **not** included, so `mlArmDelete` does not exist in this page's global scope. The executor has two options: (a) inline-adapt the same closure shape (armed/timer/reset driving `textContent`/`style.background`) directly inside `audiolab.tpl.html`'s own `<script>` block, or (b) add the `/*__MOVELAB__*/` token to pull in the whole module. Given `CONTEXT.md`'s wording is "倣う" (model after / follow the shape of), and `movelab.js` carries a lot of move-editor-specific code not needed here, option (a) — copy the closure shape inline — is the lighter fit. `$(id)` (`document.getElementById` shorthand) already exists in this file at `src/audiolab.tpl.html:141`, so no new helper is needed for the button lookup itself.

---

### 2. `tools/verify_audio.js` and `tools/verify_ui.js` — must exit non-zero on page error (FIX-03)

**Analog:** `tools/verify_creator.js` — the only verify script that already calls `process.exit` based on captured errors.

**How it collects page errors** (`tools/verify_creator.js:45-54`):
```js
(async () => {
  const b = await chromium.launch(LAUNCH);
  const pg = await b.newPage({ viewport: { width: 420, height: 1100 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/ERR_/.test(m.text())) errs.push('C ' + m.text()); });
  /* ダイアログは「表示できん端末」を想定して全部つっぱねる。
     それでも消せる・読み込めることを確かめる（confirm に頼っとらんかの確認） */
  const dialogs = [];
  pg.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
```
Note `m.type() === 'error'` is the only trigger — `console.warn` (`type()==='warning'`) is never pushed, so "warn は失敗扱いにしない" (CONTEXT.md) falls out automatically; no extra filtering needed, just don't add a check for `'warning'`.

**How it decides the exit code** (`tools/verify_creator.js:802-807`, the file's last 6 lines):
```js
  await pg.screenshot({ path: shot('cr_final.png'), fullPage: false });
  out['ダイアログに頼っとらんか'] = { 出たダイアログ: dialogs.length, 内容: dialogs.slice(0, 3) };
  out['errs'] = errs;
  console.log(JSON.stringify(out, null, 2));
  await b.close();
  process.exit(errs.length ? 1 : 0);
```

**Current ending of `tools/verify_audio.js`** (whole file is 51 lines; it already collects `errs` but only *reports* them, never checks them). The collection is per-page, declared **inside** the `for` loop (`tools/verify_audio.js:20-23`):
```js
    const pg = await b.newPage({ viewport: { width: 420, height: 900 } });
    const errs = [];
    pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
```
and the file ends (`tools/verify_audio.js:46-51`) with no exit-code logic at all:
```js
    results[name] = { decoded, ...info, errs: errs.slice(0, 6) };
    await pg.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await b.close();
})();
```
Because `errs` is scoped inside the `for` loop, an outer accumulator (or a check against `results[name].errs.length` after the loop) is needed before the final `process.exit` call — there's no single flat `errs` array to test as-is, unlike `verify_creator.js`.

**Current ending of `tools/verify_ui.js`** (whole file is 91 lines; it has **three independent blocks** — 音ラボ / 技ラボ / 戦闘 — each with its own block-scoped `errs` array, each logged separately, e.g. `tools/verify_ui.js:17-19`, `:51-53`, `:69-71` all repeat the same two-line pattern:
```js
    const errs = [];
    pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION/.test(m.text())) errs.push('C ' + m.text()); });
```
Each block logs its own errs independently (e.g. `console.log('■ 音ラボ', JSON.stringify({ pickerOpen, nEntries, saved, nSys, errs }));`) and the file ends (`tools/verify_ui.js:89-91`) with no aggregation and no exit-code logic:
```js
  await b.close();
})();
```
Since each block's `errs` goes out of scope after its own block, aggregating for a single exit-code decision needs an outer array (e.g. `let allErrs=[]`) that each block pushes into, checked once at the very end. Also note the console-filter regex is slightly different here (`!/ERR_CONNECTION/`) than in `verify_creator.js` (`!/ERR_/`) — worth deciding explicitly whether to align them or leave as-is when converging on the shared standard.

**Testing convention (all three verify scripts):** these are **standalone Node scripts that drive Playwright directly — not a test-runner suite** (no jest/mocha/vitest anywhere in the repo). Invocation, per `CLAUDE.md:36-39` and `package.json:9-10`:
```bash
node tools/verify_audio.js    # 4画面のロード・音デコード数・JSエラー
node tools/verify_ui.js       # UI操作＋決定論チェック
node tools/verify_creator.js  # 制作ツールを実際に触る（影・写真・技・鳴き声・放流・初期化）
```
```json
"scripts": {
  "verify": "node tools/verify_audio.js && node tools/verify_ui.js && node tools/verify_creator.js",
  "verify:creator": "node tools/verify_creator.js"
}
```
`npm run verify` already chains the three with `&&`. Today that chain can never short-circuit on `verify_audio.js`/`verify_ui.js` failures because both always exit 0 — this is precisely the gap FIX-03 closes; after the fix, `npm run verify` will correctly stop at the first failing stage.

---

### 3. `build.js` — remove the `/*__FX_AUDIO__*/` `MODULES` entry (FIX-01)

`MODULES` table, verbatim (`build.js:21-31`):
```js
/* 置換トークン → 元ファイル */
const MODULES = {
  '/*__FX_CORE__*/' : read('fx_core.js'),
  '/*__SFX_BANK__*/': read('sfx_bank.js'),
  '/*__MOVES__*/'   : read('moves.js'),
  '/*__ANIMS__*/'   : read('anims.js'),
  '/*__AUDIO_UI__*/': read('audio_ui.js'),
  '/*__MOVELAB__*/' : read('movelab.js'),
  '/*__STARTER__*/' : read('starter_moves.js'),
  '/*__FX_AUDIO__*/': read('fx_audio.js'),   // 旧・手続き型音源（現在は未使用）
};
```
The line to remove is the last entry, `'/*__FX_AUDIO__*/': read('fx_audio.js'),`.

`TARGETS` table, verbatim (`build.js:33-38`, unaffected by this fix, included for context since it's the other half of the same build loop):
```js
const TARGETS = [
  ['lab.tpl.html',      'shioumon_effect_lab.html'],
  ['battle.tpl.html',   'shioumon_field_test.html'],
  ['audiolab.tpl.html', 'shioumon_audio_lab.html'],
  ['creator.tpl.html',  'shioumon_creator.html'],
];
```
Confirmed via grep across `src/`: `FX_AUDIO` does not appear in any `*.tpl.html` — the token is genuinely unreferenced, so deleting both the `MODULES` entry and `src/fx_audio.js` itself is safe and requires no compensating template edits. `CLAUDE.md:64` already documents this file as dead: `fx_audio.js           旧・手続き型音源（現在は未使用。消してよい）`.

---

### 4. `src/audiolab.tpl.html` — remove unused `/*__ANIMS__*/` token (FIX-04)

Token location, in context (`src/audiolab.tpl.html:131-136`):
```html
<script>
/*__FX_CORE__*/
/*__SFX_BANK__*/
/*__MOVES__*/
/*__ANIMS__*/
/*__AUDIO_UI__*/
```
Grepping `ANIMS` across the whole file returns exactly **one** hit — the token itself on line 135. No `ANIMS[...]`, `ANIMS.appear`, `sampleAnim(ANIMS...)` or similar exists anywhere else in `audiolab.tpl.html`, confirming the audio lab genuinely never touches character animation. Deleting the line is a clean, isolated removal — no other line in this file depends on it.

Unlike FIX-01, the `MODULES` entry for ANIMS in `build.js:26` (`'/*__ANIMS__*/': read('anims.js'),`) **stays** — `lab.tpl.html`, `battle.tpl.html`, and `creator.tpl.html` all still consume it. Only the token *inside this one template* is removed.

---

### 5. `src/battle.tpl.html:474` vs `src/creator.tpl.html:464` — `resolve()` side by side (FIX-07)

**`src/battle.tpl.html`** — a method on `class Fighter` (class starts `src/battle.tpl.html:382`). Comment + method (`src/battle.tpl.html:469-481`):
```js
  /* 背面画像：自分側は何をしとっても背中しか見えん。
     同じ個体を、自分は背中から・相手は正面から見る。攻撃／被弾の写真は
     「正面から見とる側」にだけ出る。ここを混ぜると自分側だけ攻撃の瞬間に
     絵と倍率（img.attack）が入れ替わって、大きさがガクッと変わる。
     どのスロットの画像を使ったかも返す（画像ごとに大きさが違うため） */
  resolve(key){
    if(this.useBack)
      return {img:this.imgs.back||this.imgs.normal||this.ph.back||this.ph.normal, key:'back'};
    if(this.imgs[key]) return {img:this.imgs[key], key};
    if(this.ph[key])   return {img:this.ph[key],   key};
    return {img:this.imgs.normal||this.ph.normal, key:'normal'};
  }
  pick(key){ return this.resolve(key).img; }
```
Call site, inside `draw()` (`src/battle.tpl.html:490-494`):
```js
    const lstep=this.landStep();
    const rv=lstep
      ? {img:this.imgs[lstep.img]||this.ph[lstep.img]||this.imgs.normal||this.ph.normal,
         key:lstep.img||'normal'}
      : this.resolve(s.img);
```
Where `this.useBack` comes from — set once at construction time (`src/battle.tpl.html:395`, inside the constructor):
```js
    this.useBack=false;   // 自分側は背中が見える
```
then overridden per-fighter at roster build time (`src/battle.tpl.html:763`, inside `addMember(side,def)`):
```js
  f.useBack=(side==='ally');
```
and it can **also** be flipped live by the UI (`src/battle.tpl.html:1761-1762`):
```js
function backToggle(id,f){ $(id).onclick=e=>{ f.useBack=!f.useBack;
  e.target.textContent=f.useBack?'ON':'OFF'; e.target.classList.toggle('on',f.useBack); }; }
```
Fighter instances are reachable globally without any export: `partyA`/`partyB` arrays and `ally`/`enemy` (`src/battle.tpl.html:752-753`, `let ally, enemy; const partyA=[], partyB=[];`).

---

**`src/creator.tpl.html`** — a free top-level function (`src/creator.tpl.html:464-479`):
```js
function resolve(key,back,st,S){
  S=S||SELF;
  const imgs=S.imgs;
  if(previewKey && st.anim==='idle'){
    const im=imgs[previewKey]||ph[previewKey]||ph.normal;
    return {img:im, key:previewKey};
  }
  /* 味方側（手前）は何をしとっても背面写真。
     同じ個体を、自分は背中から・相手は正面から見る。攻撃／被弾の写真は
     「正面から見とる側」にだけ出る。ここを混ぜると、味方側だけ攻撃の瞬間に
     絵と倍率（mon.img.attack）が入れ替わって、大きさがガクッと変わる。 */
  if(back) return {img:imgs.back||imgs.normal||ph.back||ph.normal, key:'back'};
  if(imgs[key]) return {img:imgs[key],key};
  if(ph[key])   return {img:ph[key],key};
  return {img:imgs.normal||ph.normal, key:'normal'};
}
```
Call site, inside `drawMon(g,L,back,st,S)` (`src/creator.tpl.html:519-522`):
```js
  const lstep=(st.seqT!=null)?landStepAt(st.seqT,S):null;
  const rv = lstep
    ? {img:imgs[lstep.img]||ph[lstep.img]||imgs.normal||ph.normal, key:lstep.img||'normal'}
    : resolve(s.img,back,st,S);
```
`drawMon`'s own two call sites hardcode `back` per side (`src/creator.tpl.html:662-663`):
```js
  drawMon(ftx,LAY_E,false,sideE,subjE());   // 奥＝敵側（正面。保存個体に差し替え可）
  drawMon(ftx,LAY_A,true ,sideA,SELF);      // 手前＝味方側（背面）
```
`previewKey` is a module-level `let` (`src/creator.tpl.html:380`, `let slot='normal', previewKey='normal';`) mutated from many places in the file (button clicks, `fireMove`, reset — e.g. `src/creator.tpl.html:1007,1708,1881,1882,1962,2242`).

---

**Signature/behavior diff table** (this is the divergence a check needs to catch):

| | `battle.tpl.html:474` | `creator.tpl.html:464` |
|---|---|---|
| Form | `Fighter.prototype.resolve(key)` — instance method, 1 arg | `function resolve(key,back,st,S)` — free function, 4 args |
| Source of "should I show the back sprite?" | `this.useBack` — mutable **instance** flag, defaulted at `addMember()` to `side==='ally'`, but can be flipped at runtime via `backToggle()` UI | `back` — passed in explicitly **per call** by `drawMon`; no runtime toggle exists for it |
| Extra override with no counterpart | none | `previewKey` (module-level global) short-circuits everything when set **and** `st.anim==='idle'` — battle has nothing equivalent |
| Image source | `this.imgs` / `this.ph` — fixed to the Fighter instance that owns the method | `S.imgs` where `S` defaults to `SELF` but is swapped to `foe` by the caller; `ph` is a shared module-level fallback table |
| Fallback chain shape after the back-check | `imgs[key] → ph[key] → imgs.normal\|\|ph.normal` | identical shape: `imgs[key] → ph[key] → imgs.normal\|\|ph.normal` |
| Reachable from outside without modification? | Yes — via any live instance in global `partyA`/`partyB` | Yes — it's already a top-level function in the page's global scope |

Per `CONTEXT.md`, physically unifying these into one shared function is explicitly **out of scope** for this phase — the goal is only to make a future mismatch detectable. Since both functions are already reachable from their page's global scope without modification (no export needed), a Playwright-driven check could open both `dist/shioumon_field_test.html` and `dist/shioumon_creator.html`, seed equivalent `imgs`/`ph`/back-state in each, and diff the returned `key` for matched inputs — but note the two functions take **different-shaped arguments** and pull from **different-shaped state** (instance vs. module-level), so "matched inputs" requires deliberately mapping `(this.useBack, this.imgs, this.ph)` ↔ `(back, S.imgs, ph)` — there is no existing helper that does this mapping.

---

### 6. `CLAUDE.md` — doc corrections (FIX-05, FIX-06)

**FIX-06 — "外部ファイル参照ゼロ" claim, exact current text** (`CLAUDE.md:24`):
```
`dist/` の HTML はそれぞれ単体で開ける。外部ファイル参照はゼロ（画像も音も焼き込み済み）。
```
The actual external reference contradicting this, confirmed present in the template source (`src/audiolab.tpl.html:7`; the same `<link>` is expected to repeat in the other three `*.tpl.html` files since each `dist/*.html` must stand alone):
```html
<link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet">
```
And the fallback stack already in place if the font can't load (`src/audiolab.tpl.html:13`):
```css
font-family:"DotGothic16","MS Gothic","Hiragino Kaku Gothic ProN",monospace;
```
Per `CONTEXT.md`'s decision, the fix is a **documentation** change only: keep the Google Fonts load, add an explicit exception note near line 24 (Japanese font subsetting isn't viable since 四皇モン names are dynamic; base64-embedding would cost several MB; offline just degrades to MS Gothic without breaking).

**FIX-05 — cry-compression description, exact current text** (`CLAUDE.md:213-217`):
```
- **置き場を食うのは写真と鳴き声。設計データは1体2KBしかない。**
  写真は **160px・WebP**（実機は味方104px／敵80pxでしか描かん。256pxは2.5倍の無駄）。
  鳴き声は **Opus 24kbps・無音カット・上限2秒**（、読み込み時に自動）。
  この2つで1体 210KB → **21KB**。100匹で 2.1MB の見込み。
  **これ以上増やすなら localStorage やのうて IndexedDB へ移す**（base64の1.33倍も消える）。
```
The line to correct is `鳴き声は **Opus 24kbps・無音カット・上限2秒**（、読み込み時に自動）。` — "読み込み時に自動" (automatic on load) is wrong. Evidence from the actual upload handler (`src/creator.tpl.html:1300-1313`, `takeCryFile`'s `FileReader.onload`):
```js
  r.onload=ev=>{
    const data=ev.target.result;
    const base=(mon.id||'mon').replace(/[^A-Za-z0-9_]/g,'')||'mon';
    const id='cry_'+base;
    SND.resume();
    SND.custom[id]={label:(mon.name||'四皇モン')+'の声',cat:'custom',src:'ユーザー追加',data};
    decodeInto(id,data).then(()=>{
      mon.cry.id=id; mon.cry.data=data; mon.cry.label=SND.custom[id].label;
      buildCry(); refresh();
      /* **勝手に焼き直さん。** 音が変わることがあるけん、軽くするかは鴨川が決める */
      const kb=Math.round(data.length/1024);
      cryNote('<b style="color:#7ad6a0">そのまま入れた</b>　'+kb+'KB'+
        (kb>40 ? '　<b style="color:#f0a020">重いけん、必要なら下の「鳴き声を軽くする」で</b>' : ''));
```
The raw uploaded `data` (a data URI) is stored as-is; compression is a **separate, manually-triggered** step (`src/creator.tpl.html:1180-1181`, describing the pipeline invoked by the "鳴き声を軽くする" UI section built by `buildCrySlim()` at `src/creator.tpl.html:1328`):
```
   ①前後の無音を切る ②長さの上限で切る ③モノラルに落とす ④Opus で焼き直す
```
This is the intentional design CONTEXT.md references (掟8 — 音の決定権は100%鴨川). The doc fix: state that compression is a manual, opt-in step, and that the "1体21KB" figure in the following line (`CLAUDE.md:216`) is the value **after** that manual compression, not automatic.

---

## Shared Patterns

### Two-press destructive action (no `confirm()`/`alert()` gating a branch)
**Source:** `src/movelab.js:116-133` (`mlArmDelete`)
**Apply to:** `src/audiolab.tpl.html`'s `#btnReset` handler (FIX-02). Also the documented convention for any future destructive-action button per `CLAUDE.md:186-191`.
```js
function mlArmDelete(btn, onDo, armedText){
  let armed=false, timer=null;
  const base=btn.textContent, baseW=btn.style.width, baseTitle=btn.title||'';
  const reset=()=>{ armed=false; btn.textContent=base; btn.title=baseTitle;
    btn.style.width=baseW; btn.style.background='';
    if(timer){ clearTimeout(timer); timer=null; } };
  btn.onclick=e=>{
    if(e) e.stopPropagation();
    if(armed){ reset(); onDo(); return; }
    armed=true;
    btn.textContent=armedText||'消す？'; btn.title='もう一度押すと決まる';
    btn.style.width='auto'; btn.style.background='#7a2020';
    timer=setTimeout(reset,3500);
  };
}
```

### Playwright verify-script error capture → exit code
**Source:** `tools/verify_creator.js:48-50` (capture) + `:807` (decision)
**Apply to:** `tools/verify_audio.js`, `tools/verify_ui.js` (FIX-03), and whatever mechanism ends up detecting the FIX-07 `resolve()` divergence if it takes the shape of a new verify script.
```js
const errs = [];
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
pg.on('console', m => { if (m.type() === 'error' && !/ERR_/.test(m.text())) errs.push('C ' + m.text()); });
// ... at the very end, after console.log(JSON.stringify(...)) and b.close():
process.exit(errs.length ? 1 : 0);
```
Only `m.type() === 'error'` is pushed — `warning` is implicitly excluded, satisfying "console の warn は失敗扱いにしない" with no extra code.

### Build-time token substitution
**Source:** `build.js:16-31` (`read()` + `MODULES`)
**Apply to:** FIX-01 (remove one `MODULES` entry) and FIX-04 (remove one token reference from a template — `MODULES` itself untouched).
```js
const read = f => {
  const p = path.join(SRC, f);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
};
const MODULES = {
  '/*__FX_CORE__*/' : read('fx_core.js'),
  // ... token: file-content pairs, matched against `/*__TOKEN__*/` markers in *.tpl.html
};
```

### `page.evaluate()` into page-global state (Playwright ↔ app boundary)
**Source:** `tools/verify_ui.js:78` (`pg.evaluate(() => { const r = determinismTest(); return {...}; })`) and throughout `tools/verify_creator.js` (e.g. `pg.evaluate(() => mon.name)`)
**Apply to:** any FIX-07 detection mechanism — both `resolve()` implementations are already reachable as page globals (`partyA[0].resolve(key)` in the battle page; `resolve(key,back,st,S)` directly in the creator page) without modifying either source file.

---

## No Analog Found

| File / Concern | Role | Data Flow | Reason |
|---|---|---|---|
| FIX-07 divergence-detection mechanism (exact new file undecided — could be a new `tools/verify_*.js` or an addition to an existing one) | test | event-driven / request-response | No existing code compares two separately-loaded pages against each other. The closest available primitive is the `page.evaluate()` pattern used throughout `verify_creator.js`/`verify_ui.js`, but nothing in the codebase currently opens two `dist/*.html` files in the same script and diffs their outputs. Signature/state-shape differences between the two `resolve()`s (documented above) mean this can't be a blind copy-paste of an existing check — it needs a small amount of new mapping logic. |

## Metadata

**Analog search scope:** `src/` (all `*.js` and `*.tpl.html`), `tools/` (all `*.js`), `build.js`, `CLAUDE.md`, `package.json`. `node_modules/` excluded entirely.
**Files scanned:** `src/movelab.js`, `src/audiolab.tpl.html`, `src/battle.tpl.html`, `src/creator.tpl.html`, `build.js`, `tools/verify_audio.js`, `tools/verify_ui.js`, `tools/verify_creator.js`, `package.json`, `CLAUDE.md`.
**Pattern extraction date:** 2026-08-17
