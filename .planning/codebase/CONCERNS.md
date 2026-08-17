# Codebase Concerns

**Analysis Date:** 2026-08-17

**Scope note:** This is a solo, non-distributed personal project (`配布しない`, per `CLAUDE.md` §1 and `README.md`). Severity is judged against that context — there is no remote attacker model, no multi-tenant data, and no production uptime requirement. Concerns are ranked by how much they threaten (a) the ability to keep developing / regenerating artifacts and (b) 鴨川's own creator-tool data (his hand-made 四皇モン), which is the irreplaceable asset in this project.

## Severity Summary

| # | Finding | Severity | Area |
|---|---|---|---|
| 1 | `localStorage` quota is shared by 7 keys with no eviction, and raw cry uploads can consume most of the budget alone | **High** | Persistence limits |
| 2 | `battle.tpl.html` has zero `localStorage` reads — no creator-made 四皇モン can enter battle | **High** | Unfinished wiring |
| 3 | `resolve()` is hand-duplicated in `battle.tpl.html` and `creator.tpl.html` with different signatures | **High** | Duplicated logic / fragile area |
| 4 | 44/44 `starter_moves.js` techniques reuse only 6 existing FX generators (self-admitted "雑", top priority as of 2026-08-17) | **High** | Tech debt |
| 5 | `tools/gen_sfx.py` source packs do not exist on disk; one bank sound (`ui_tick`) is already unfixable | **Medium** | Build reproducibility |
| 6 | `mon.shadow`, `mon.cry`, `customMoves`, cost economy authored in creator tool but not read/enforced in battle | **Medium** | Unfinished wiring |
| 7 | `dist/*.html` are committed to git; `sfx_bank.js` is duplicated verbatim across all 4 outputs (81% of total dist bytes) | **Medium** | Payload size / repo hygiene |
| 8 | `creator.tpl.html` (2287 lines) and `battle.tpl.html` (1906 lines) are monolithic single-file templates | **Medium** | Fragile areas |
| 9 | `src/fx_audio.js` is fully dead code (confirmed unreachable from any build output) | **Low** | Dead code |
| 10 | User-typed slot names are interpolated into `innerHTML` unescaped in two places | **Low** | Security |
| 11 | No automated tests cover `localStorage` quota-exceeded paths | **Low** | Test coverage |

---

## Tech Debt

**Starter move library reuses generators instead of building new ones (`src/starter_moves.js`, 42979 bytes / 751 lines, 68 `generator:` fields):**
- Issue: All 44 techniques in the "ネタ帳" starter set are built by parameterizing the 6 existing `fx_core.js` generators (`projectile`/`beam`/`slash`/`lightning`/`aura`/`shatter`) rather than writing new generators tailored to each move. Verified directly in code, not just docs:
  - `インファイト` (a punching move) → `fx:{ generator:'slash', ... }` (`src/starter_moves.js:248`) — an arc-slash effect played 6 times, not an impact/punch effect.
  - `いわなだれ` (falling rocks) → `fx:{ generator:'lightning', ... }` (`src/starter_moves.js:354`) — the lightning generator recolored brown, not falling debris.
  - `だいもんじ` (expanding fireball) → `fx:{ generator:'projectile', ... }` (`src/starter_moves.js:553`) — a projectile + shatter, not an expanding fireball with a shockwave ring.
- Files: `src/starter_moves.js`, `src/fx_core.js` (generator definitions), `src/movelab.js` (`SCHEMA`/`GEN_JP`/`GEN_DESC` where new generators must be registered).
- Impact: This is the **explicit, dated, top-priority complaint** from the project owner as of 2026-08-17 (`HANDOFF.md` "次の作業" section): *"新しい技、全部だめ。素材、既存のものばっかりだね... 雑なものはだめだ。雑である必要がある技のみ雑であるべきだ。"* A concrete backlog of 7 new generators is already specified in `HANDOFF.md` (`impact`, `spray`, `volley`, `fall`, `vortex`, `burst`, `spike`) with the moves each would fix. This is not speculative technical debt — it is a named, scoped, already-agreed-to phase of work that has not started.
- Fix approach: Follow the documented order in `HANDOFF.md` — add a generator to `fx_core.js`, register it in `movelab.js`'s `SCHEMA`/`GEN_JP`/`GEN_DESC`, verify it renders correctly in 技ラボ, then rebuild the affected `starter_moves.js` entries. Start with `impact` (blocks the most moves: インファイト／ばくれつパンチ／コメットパンチ／かわらわり／のしかかり／DDラリアット／アイアンヘッド).

**Cost economy is computed and displayed but not load-bearing (`src/moves.js:101-114`, `src/battle.tpl.html`):**
- Issue: `costOf()` in `src/moves.js` is explicitly commented `CostCalculator（仮式・Phase 15 で本採用）` — a provisional formula. In `battle.tpl.html`, `f.cost` is only ever displayed (`'COST '+f.cost` at lines 557, 653, 682) or logged (line 809), and can even be hand-overridden via raw number inputs (`$('eCost').oninput`/`$('aCost').oninput`, lines 1674-1675). There is no code path where cost affects win/loss, party legality, or anything else during a match.
- Files: `src/moves.js:101-114`, `src/battle.tpl.html:557,653,682,761,809,1674-1675`.
- Impact: Matches the project's own next milestone (`HANDOFF.md` "Phase 15 — コスト経済（最優先・何度も後回しになっとる）"). Flagging here only for completeness — this is tracked work, not a hidden gap, but the AI-weight coefficients and starting-cost value (150) are both explicitly marked "仮" (provisional) in `docs/開発計画_v6.md` §18.5 and the 未決事項 table, so implementing Phase 15 will require a design decision, not just wiring.
- Fix approach: Implement per `docs/開発計画_v6.md` §18 (cost as party HP pool, not squad-build limiter) — already scoped in `HANDOFF.md` §3.

**Build output (`dist/`) is committed to git alongside the sources that generate it:**
- Issue: `git ls-files dist/` shows all 4 built HTML files (`dist/shioumon_audio_lab.html`, `dist/shioumon_creator.html`, `dist/shioumon_effect_lab.html`, `dist/shioumon_field_test.html`, ~2.97MB combined) are tracked, in addition to every `src/*.js` and `src/*.tpl.html` file that produces them via `node build.js`.
- Files: `dist/*.html`, `build.js`.
- Impact: Every commit that touches a shared module (e.g. `src/sfx_bank.js`, `src/fx_core.js`) and is followed by a rebuild re-commits ~3MB of near-duplicate, largely-base64 content. Over time this inflates `.git` history size disproportionately to actual source changes, and `git diff`/`git blame` on `dist/*.html` is useless (binary-like base64 churn). This is reproducible from source at any time (`node build.js`), so it is redundant, not irreplaceable — a pure repo-hygiene cost.
- Fix approach: Either gitignore `dist/` and document "always run `node build.js` before opening," or keep it committed deliberately for the "just open the file" convenience (matches the "配布しない, but 鴨川 opens dist directly" workflow in `CLAUDE.md` §2) — if kept, it's a conscious tradeoff worth stating explicitly rather than an oversight.

---

## Known Bugs

**One of the 79 banked sounds is permanently broken and cannot be regenerated (`src/sfx_bank.js`):**
- Symptoms: The sound entry `"ui_tick":{label:"UI・チッ", ...}` (confirmed present in `src/sfx_bank.js`, part of the `ui` category) fails to decode in Chromium.
- Files: `src/sfx_bank.js` (entry `ui_tick`), the `SoundPicker` component in `src/audio_ui.js`.
- Trigger: Any attempt to decode/play `ui_tick` in a Chromium-based browser.
- Workaround: `HANDOFF.md` records that `SoundPicker` was patched to exclude undecodable sounds from being selectable at all, rather than fixing the underlying audio: *"`ui_tick` が Chromium でデコードに失敗する。79音中78音しか鳴らんのはこれが理由。元素材が手元に無いけん再生成はできん。"* (the source material isn't available, so it can't be regenerated). This is direct, first-party confirmation that the regeneration path is already provably broken, not just theoretically fragile — see "Build Reproducibility" below for why.

---

## Build Reproducibility / Irreplaceable Artifacts

**`tools/gen_sfx.py`'s source audio does not exist on this machine (`tools/gen_sfx.py:8-9`, `.gitignore`, `assets/`):**
- Risk: `tools/gen_sfx.py` reads every one of its 79 `PICKS` entries from two directories it constructs at the top of the file:
  ```python
  A = ROOT + '/webgameattacksfxcc0/webgame-attack-sfx-cc0/audio'
  K = ROOT + '/webgamesfxcc0kenney/webgame-sfx-cc0-kenney/audio'
  ```
  i.e. `assets/webgameattacksfxcc0/` and `assets/webgamesfxcc0kenney/`. Both are explicitly gitignored:
  ```
  # tools/gen_sfx.py で音を入れ替えるときだけ、下記2つのパックをここへ展開する
  assets/webgameattacksfxcc0/
  assets/webgamesfxcc0kenney/
  ```
  **Verified on disk: neither directory exists.** `find assets/ -type f` returns exactly 6 files, all under `assets/sprites/` (`akuu_setsudan.json`, `compare.png`, `palkia_back.b64/.png`, `palkia_front.b64/.png`) — **40KB total**, not the "29MB" `assets/` figure documented in `CLAUDE.md` §3 (`assets/ CC0効果音の元素材（29MB）＋ スプライト`). That 29MB figure describes a state that does not currently exist on this machine.
- Files: `tools/gen_sfx.py:6-9`, `.gitignore:8-10`, `assets/` (currently `assets/sprites/` only).
- Impact: **`python3 tools/gen_sfx.py` cannot run today.** It would fail at the first file read (`A+'/retro512_weapons/...'`) because `assets/webgameattacksfxcc0/` doesn't exist. Consequently:
  - `src/sfx_bank.js` (630813 bytes / 616KB, 79 sounds) **is currently irreplaceable via the documented path.** It is not lost — it is committed to git (`git log --oneline -- src/sfx_bank.js` shows one commit, `f6427c5`) and works in all 4 built tools — but if the file's content ever needs to change (swap one sound, fix `ui_tick`, add a new category, re-tune compression), there is no way to do that without first re-downloading both CC0 packs from their original sources (OpenGameArt "Web Game Attack SFX (CC0)" and kenney.nl "Web Game SFX (CC0)", per `.gitignore`'s own comment).
  - This is not hypothetical: the `ui_tick` decode bug above is already a case where the project *wanted* to fix/replace a sound and explicitly could not, for exactly this reason.
  - `assets/sprites/*.b64` (Palkia sprite base64 sidecar files) are the actual source for `battle.tpl.html`/`creator.tpl.html` art and **are present and committed** — sprites are not at risk, only the SFX regeneration path.
- What breaks if `sfx_bank.js` were lost outside of git (e.g. history rewrite, corrupted `.git`, or someone runs `gen_sfx.py` expecting it to "just refresh" and it silently produces nothing/errors): all 4 `dist/*.html` tools lose sound entirely (they inline `sfx_bank.js` verbatim — see "Payload Size" below), and there would be no way to rebuild the bank without manually re-sourcing 79 individual CC0 files and re-deriving the exact `PICKS` mapping already encoded in `tools/gen_sfx.py`.
- Fix approach: Not urgent (the artifact is safe in git today), but worth doing before it's needed under time pressure: either (a) re-download the two CC0 packs into `assets/` and verify `gen_sfx.py` still runs cleanly end-to-end (would also let `ui_tick` finally be replaced), or (b) if the packs are hard to re-source, treat `src/sfx_bank.js` itself as the canonical source of truth going forward and stop treating `gen_sfx.py` as re-runnable.

---

## Security Considerations

**User-typed names are interpolated into `innerHTML` without escaping in two list renderers (`src/creator.tpl.html:2056,2185`):**
- Risk: `buildSlotList()` builds each saved-四皇モン row as `d.innerHTML='<span class="nm">'+k+'</span>'+...` where `k` is a `localStorage` key taken verbatim from `$('slotName').value` (free-text user input, see the save handler at `src/creator.tpl.html:2111-2128`). The Wild Pool list builder does the same with `nm` at line 2185. Neither escapes `<`, `>`, or `"`. By contrast, `buildFoe()` (`src/creator.tpl.html:2161-2168`) *does* escape quotes when building a `<select><option value="...">` from the same slot-name set (`k.replace(/"/g,'&quot;')`), showing the inconsistency is accidental, not a deliberate trust boundary.
- Files: `src/creator.tpl.html:2056` (named-slot list), `src/creator.tpl.html:2185` (wild-pool list).
- Current mitigation: None at the render site. In practice this is self-XSS at most — this is a single-user, `file://`/localhost tool with no remote data source and no server, so the only "attacker" who could exploit it is the user typing into their own save-name field, executing in their own tab. No cross-user or cross-origin impact is possible given the project's non-distributed nature.
- Recommendations: Low priority given the threat model, but cheap to fix — either HTML-escape `k`/`nm` before interpolation (mirror the `buildFoe()` pattern) or switch these two renderers to `textContent`/DOM node construction instead of `innerHTML` string concatenation.

**No other injection surface found:** the project has no server, no network calls, no `eval()`/`Function()` construction from user input, and no remote data fetching — confirmed by the complete absence of `fetch(`/`XMLHttpRequest`/`eval(` beyond what's expected in a static, offline HTML tool.

---

## Performance Bottlenecks

**`dist/*.html` are dominated by a single 616KB embedded audio bank, duplicated identically 4 times:**
- Problem: Measured directly from the built output:

  | File | Size | `sfx_bank.js` share |
  |---|---|---|
  | `dist/shioumon_field_test.html` | 761.7KB | 81% |
  | `dist/shioumon_effect_lab.html` | 717.4KB | 86% |
  | `dist/shioumon_audio_lab.html` | 693.4KB | 89% |
  | `dist/shioumon_creator.html` | 864.0KB | 71% |
  | **Total (4 files)** | **~2.97MB** | — |

  `src/sfx_bank.js` is 630,813 bytes (616KB) and is injected via the `/*__SFX_BANK__*/` token into **all four** templates (confirmed: the token appears in `lab.tpl.html`, `battle.tpl.html`, `audiolab.tpl.html`, and `creator.tpl.html`). That means **2.41MB of the 2.97MB total dist footprint (81%) is four verbatim copies of the same audio payload** — there is no sharing between the 4 standalone files because each must be independently openable via `file://` with zero external references (an explicit design requirement, `CLAUDE.md` §2: "外部ファイル参照はゼロ").
- Files: `src/sfx_bank.js`, `build.js` (`MODULES['/*__SFX_BANK__*/']`), all `src/*.tpl.html`.
- Cause: Deliberate architectural tradeoff (standalone, zero-dependency HTML files), not a bug — but it means **every sound added to the bank grows all 4 dist files simultaneously**, and there is no browser-level caching benefit across the 4 tools since they are 4 unrelated files with no shared origin caching semantics beyond what a single `file://` document gets.
- Improvement path: If dist size becomes a real problem (slow initial parse on low-end devices, e.g.), the only ways to reduce it within the current "no external files" constraint are (a) more aggressive audio compression in `tools/gen_sfx.py` (already mono 22kHz per `HANDOFF.md`), (b) trimming unused sounds from `PICKS`, or (c) accepting one external `.js` file for the bank and relaxing the "zero external references" rule for local dev builds only (would need explicit sign-off from 鴨川 since it's a named design rule, not an incidental choice).

**Dead weight already present in the build pipeline (does not affect current output, but is worth knowing about):** `build.js:30` defines a `/*__FX_AUDIO__*/` → `fx_audio.js` module mapping, but **no template contains that token** (confirmed via `grep -o '/\*__[A-Z_]*__\*/' src/*.tpl.html` across all 4 templates — only `FX_CORE`, `SFX_BANK`, `MOVES`, `ANIMS`, `AUDIO_UI`, `MOVELAB`, `STARTER` tokens are ever referenced). `fx_audio.js` (15012 bytes) is read from disk on every build for nothing. This costs nothing at runtime (see "Dead Code" below) but is a very small, easy build-script cleanup.

---

## Fragile Areas

**`resolve()` is independently duplicated in `battle.tpl.html` and `creator.tpl.html` with different call signatures — the exact divergence risk `CLAUDE.md` calls out by name:**
- Files: `src/battle.tpl.html:474-481` (method, 1 implicit `this`), `src/creator.tpl.html:464-479` (standalone function, 4 explicit params).
- Why fragile: These are **two separately hand-written implementations of the same fallback chain**, not one shared function:

  `battle.tpl.html:474` (a `Fighter` method):
  ```js
  resolve(key){
    if(this.useBack)
      return {img:this.imgs.back||this.imgs.normal||this.ph.back||this.ph.normal, key:'back'};
    if(this.imgs[key]) return {img:this.imgs[key], key};
    if(this.ph[key])   return {img:this.ph[key],   key};
    return {img:this.imgs.normal||this.ph.normal, key:'normal'};
  }
  ```

  `creator.tpl.html:464` (a standalone function taking `S={mon,imgs}`):
  ```js
  function resolve(key,back,st,S){
    S=S||SELF;
    const imgs=S.imgs;
    if(previewKey && st.anim==='idle'){ ... }        // creator-only branch, no battle equivalent
    if(back) return {img:imgs.back||imgs.normal||ph.back||ph.normal, key:'back'};
    if(imgs[key]) return {img:imgs[key],key};
    if(ph[key])   return {img:ph[key],key};
    return {img:imgs.normal||ph.normal, key:'normal'};
  }
  ```

  The core fallback ordering (back → per-key image → per-key placeholder → normal image/placeholder) must stay identical by hand across two files bound to differently-named variables (`this.imgs`/`this.ph` vs closure-scoped `imgs`/`ph`/`S`). `CLAUDE.md` §4 rule 4 states this explicitly as a **previously-triggered real bug**: *"`battle.tpl.html`の`resolve()`と`creator.tpl.html`の`resolve()`は必ず同じ判断にする"* — and `HANDOFF.md` confirms this rule exists *because* the two drifted apart once already (the "自分側だけ攻撃の瞬間に絵と倍率が入れ替わって大きさが跳ねる" bug), and both had to be hand-patched in the same session to re-align them.
- Safe modification: Any change to the back/foreground image fallback logic must be applied to **both** functions in the same commit, re-verified against `CLAUDE.md` §4's photo-viewpoint rule (own side always shows the back sprite, regardless of action), and checked with `tools/verify_creator.js` / `tools/verify_ui.js` before considering the change done. There is no compiler or lint rule enforcing this — it is a manual discipline documented only in prose.
- Test coverage: `tools/verify_creator.js` (808 lines) exercises the creator tool's rendering interactively but does not appear to assert pixel/byte equality between the two `resolve()` implementations — it can catch a crash but not a silent logic drift between the two copies.

**Two large, monolithic single-file UI templates carry most of the app's logic:**
- Files: `src/creator.tpl.html` (114,420 bytes / **2287 lines**), `src/battle.tpl.html` (98,365 bytes / **1906 lines**).
- Why fragile: Both mix inline `<style>`, markup, and the full JS runtime for their screen in one file. `CLAUDE.md` §5 documents at least two real incidents caused by this file shape: a temporal-dead-zone crash from declaring `previewKey` "behind" the code that reads it (state now must live in an explicit "0. 状態" block at the top of `creator.tpl.html`), and a full page freeze from an exception thrown before `requestAnimationFrame` was scheduled. Both are exactly the class of bug that a 2000+ line single-scope file makes easy to reintroduce, because there is no module boundary stopping a new variable/handler from being declared in the wrong place relative to the render loop.
- Safe modification: Follow the two house rules already written into `CLAUDE.md` §5 for `creator.tpl.html`: (1) every variable the draw loop reads must be declared in the leading "0. 状態" block, never further down; (2) the render loop must be scheduled via `requestAnimationFrame(tick)` before any code that can throw runs, never called synchronously inline.

---

## Persistence Limits (`localStorage`)

**Complete key inventory** (all under the shared origin quota — verified by exhaustive grep across `src/*.js` and `src/*.tpl.html`, no other keys exist):

| Key | Defined at | Holds | Grows unbounded? |
|---|---|---|---|
| `shioumon_audio_cfg_v1` | `src/sfx_bank.js:247` | `AUDIO_CFG` (move/system sound timing overrides) — numbers and IDs only, no media | No — bounded by move/event count |
| `shioumon_move_lib_v1` | `src/movelab.js:589` | Named custom moves `{name:{name,fx,battle,audio}}`, shared by 技ラボ + creator | **Yes** — never overwrites, appends `◯◯2`, `◯◯3`... on name collision |
| `shioumon_scene_sfx_v1` | `src/creator.tpl.html:396` | Wild-release scene UI sound picks | No — fixed small config |
| `shioumon_wild_pool_v1` | `src/creator.tpl.html:955` | Array of `{uid, at, cost, mon}` — **`mon` is a full snapshot including images/cry** | **Yes** — every "草むらへ放つ" appends a record |
| `shioumon_creator_auto` | `src/creator.tpl.html:1969` | Current in-progress mon snapshot (images/cry included) | No — single slot, overwritten every ~350ms debounce |
| `shioumon_creator_slots` | `src/creator.tpl.html:1969` | Named saved mon `{name: JSON string}`, full snapshot per entry | **Yes** — explicitly never overwrites (`CLAUDE.md` §5: "同じ名前で保存しても上書きせん... ◯◯2, ◯◯3") |
| `shioumon_crydelay_050` | `src/creator.tpl.html:2274-2275` | One-time migration flag | No |

**Two of the seven keys (`shioumon_creator_slots`, `shioumon_wild_pool_v1`) are the only ones carrying image/audio payloads, and both are designed to accumulate without limit** — the "never silently overwrite" rule (a deliberate, documented safety feature to prevent accidental data loss, `CLAUDE.md` §5) is exactly what guarantees these two keys grow monotonically as 鴨川 uses the tool.

**Per-entry payload size and the base64 inflation risk:**
- Photos are auto-downscaled and re-encoded before storage: `IMG_CAP=160` (`src/creator.tpl.html:1037`), converted to WebP via `c.toDataURL('image/webp', q)` (`src/creator.tpl.html:1046-1048`), falling back to PNG only on unsupported browsers. This conversion is **automatic on every image load** — the project's own numbers: 727KB (256px PNG) → 73KB (160px WebP), a 90% reduction (`HANDOFF.md` §1, "容量まわり"). Only one photo slot is stored raw per mon; the other 4 (attack/hurt/back/summon) are marked `derived[k]=true` and omitted from the JSON entirely when they're just copies of "normal" (`src/creator.tpl.html:1973`).
- Cries are **not** auto-compressed. `src/creator.tpl.html:1292` rejects files over `3*1024*1024` (3MB) outright; `src/creator.tpl.html:1314` warns ("重い。保存できんくなるかもしれん" — "heavy, might become unable to save") above `300*1024` (300KB) but still accepts and stores it as-is. Manual compression to Opus is available (`HANDOFF.md`: 316KB → 28KB, 91% reduction) but is **opt-in only**, per 鴨川's explicit instruction not to auto-compress ("自動でやるな、正確でない場合がある"). This means **a single uncompressed cry just under the 3MB cap becomes a ~3.86-4MB base64 string** (raw bytes × ~1.33 inflation, the same multiplier `CLAUDE.md` §5 itself calls out: "base64の1.33倍も消える") embedded directly in whichever `localStorage` key holds that mon (`shioumon_creator_auto`, then `shioumon_creator_slots`, and again in `shioumon_wild_pool_v1` if released) — **on its own, close to the entire per-origin quota**, before accounting for any other key.
- The project's own accounting for the *good* case (photo auto-compressed, cry manually compressed): **1 mon ≈ 21KB, 100 mon ≈ 2.1MB** (`HANDOFF.md` §1, "容量まわり"). That leaves a comfortable margin under a ~5MB quota — **but only if the user remembers to manually compress every cry**, which the UI nudges but does not enforce.

**Quota exceeded is handled (not silent), but recovery is entirely manual:**
- All four save paths wrap `localStorage.setItem` in `try/catch` and surface a message on failure — verified for all of them: `autoSave()` (`src/creator.tpl.html:2031-2044`), "名前を付けて保存" (`src/creator.tpl.html:2111-2128`), "上書き保存" (`src/creator.tpl.html:2088-2107`), and `saveWild()` (`src/creator.tpl.html:962-965`, whose `{ok:false,msg:...}` result is rendered in the release-scene text at `src/creator.tpl.html:940-944`). This matches the project's own stated principle ("黙って失敗するのが一番たちが悪い" — silent failure is the worst) and past incident (`HANDOFF.md` "過去に踏んだ地雷" table: "保存した四皇モンが見えん").
- `autoSave()` also proactively displays **total current usage across all of `localStorage`** on every save (`src/creator.tpl.html:2037-2039`, iterating `for(const k in localStorage)`), so the user has an early warning before hitting the ceiling — a real, working mitigation, not just error handling after the fact.
- What is *not* handled: there is no automatic eviction, no "delete oldest" option, and no `IndexedDB` fallback anywhere in the codebase (confirmed: zero occurrences of `IndexedDB`/`indexedDB` in `src/`). `CLAUDE.md` §5 already names this as the next step once volume grows ("これ以上増やすなら localStorage やのうて IndexedDB へ移す"), but today the only recovery from a full quota is the user manually deleting named slots/wild-pool entries one at a time via the UI, or exporting to JSON first.

**Per-origin partitioning is a distinct, separate data-loss risk from quota, already flagged in the project's own incident log:**
- `localStorage` is partitioned per origin. `file://<path>`, `http://localhost:8765` (via `tools/serve.js`), and any other browser profile are **three separate stores with no shared data**, even though they open the exact same `dist/*.html` bytes. `CLAUDE.md` §5 documents this directly: *"保存データは「開き方（オリジン）」ごとに別の箱... 「保存したのが消えた」の相談はまずこれを疑う"* — and `HANDOFF.md`'s incident table confirms this has already happened once ("保存した四皇モンが見えん / localStorageはオリジンごとに別の箱").
- The only cross-origin portability the tool offers is manual: "■ JSON" export (single mon, `src/creator.tpl.html:2226-2231`, `Blob`+`<a download>`) and "草むらへ放つ" into the wild pool (still origin-local, not portable). A previously-existing "■ 引っ越し" (bulk migration) feature was deliberately removed at 鴨川's request (`HANDOFF.md` §1, "14件目") — there is currently **no bulk export/import path**, only per-mon JSON, meaning recovering an entire `shioumon_creator_slots` collection after an origin change (e.g. switching from `file://` to `node tools/serve.js`) requires re-exporting and re-importing every mon individually.

---

## Missing Critical Features

**Battle test screen cannot load any creator-authored 四皇モン — confirmed absolute, not partial:**
- Problem: `grep -n "localStorage" src/battle.tpl.html` returns **zero matches**. `battle.tpl.html` never reads `shioumon_wild_pool_v1`, `shioumon_creator_slots`, or any other key. All fighters come from two hardcoded literal arrays:
  ```js
  const ROSTER_A=[ {name:'パルキア', ...}, {name:'テストモン', ...}, {name:'みならい', ...} ];
  const ROSTER_B=[ {name:'ルギアもどき', ...}, {name:'いわもどき', ...}, {name:'かげもどき', ...} ];
  ```
  (`src/battle.tpl.html:769-796`), built into `Fighter` objects via `addMember()` (`src/battle.tpl.html:755-767`) using only `stats`/`types`/`per`/`scale`/`dy`/`img`/`cost`/`moves` — none of which come from any saved data.
- Files: `src/battle.tpl.html:751-796` (roster + `addMember`), compare against everything the creator tool can author (`src/creator.tpl.html`: `mon.shadow`, `mon.cry`, `mon.customMoves`, `mon.idleMotion`, `mon.summon`).
- Blocks: This is the single largest gap named in the project's own handoff, verbatim: *"⚠ まだ繋がっとらん一番大きい穴：戦闘テスト画面に四皇モンを読み込む口が無い。制作ツールで作った個体を実機で動かす道がまだ無い（Phase 18〜19の仕事）。"* Every hour spent in the creator tool authoring a custom 四皇モン currently produces something that can only be *previewed* in the creator's own mini-battle sandbox — never battle-tested against the real AI/quarter-system/clash logic in `battle.tpl.html`.
- Note on scope: this is not purely an oversight — `docs/開発計画_v6.md`'s prohibition list rule 6 explicitly forbids a shortcut path ("自作四皇モンを直接手持ちへ追加できる抜け道を作らない"), meaning the eventual fix is not "just read `shioumon_wild_pool_v1` in `battle.tpl.html`" but must go through the not-yet-built capture minigame (Phase 20) per design intent. `HANDOFF.md` suggests Wild Pool as the natural read source once that gate exists ("Wild Pool（`shioumon_wild_pool_v1`）を戦闘側が読むのが素直な繋ぎ方").

**Specific creator-authored fields confirmed unread anywhere in battle/effects code:**
- `mon.shadow` (`{scale,flat,dx,dy,alpha,follow}`, defined `src/creator.tpl.html:372`, edited via `shadowCtl` UI `src/creator.tpl.html:1559-1561`, read for drawing at `src/creator.tpl.html:499`): **zero occurrences** of `.shadow` in `src/battle.tpl.html`, `src/fx_core.js`, or `src/anims.js`. `CLAUDE.md` §5 already flags this precisely: *"戦闘側はまだこの値を読んどらん。Phase 16 以降で繋ぐこと。"* Battle presumably draws a hardcoded default shadow shape instead.
- `mon.cry`, `mon.customMoves`: **zero occurrences** of either in `src/battle.tpl.html`. A custom move authored via the creator's built-in 技クリエーター, or a custom cry recorded/uploaded for a mon, has no path into the battle screen at all — consistent with the roster gap above, since there is no mon-loading mechanism for either to travel through.
- `mon.idleMotion` **is** wired on the `Fighter` class (`this.idleMotion=true`, `src/battle.tpl.html:401`, read at `src/battle.tpl.html:488`) — but since no mon data is ever loaded into a `Fighter`, this field is presently only ever the hardcoded default, never a per-mon override from creator data. It is "wired" in the sense of having a live code path, but not reachable from creator-authored data yet.

---

## Dead Code

**`src/fx_audio.js` is confirmed 100% unreachable from any build output (15012 bytes / 315 lines):**
- Verification performed (not just trusting the code comment): `build.js:30` maps `/*__FX_AUDIO__*/` → `fx_audio.js`, but `grep -o '/\*__[A-Z_]*__\*/' src/*.tpl.html` across **all four** templates (`lab.tpl.html`, `battle.tpl.html`, `audiolab.tpl.html`, `creator.tpl.html`) shows none of them contain the `/*__FX_AUDIO__*/` token. Cross-checked against the actual build output: `grep -c "FX_AUDIO" dist/*.html` returns `0` for all 4 files. The only two references to `fx_audio.js` anywhere in the repo (outside itself) are `build.js:30` (defines the unused mapping) and `CLAUDE.md:64` (documents it as unused: *"旧・手続き型音源（現在は未使用。消してよい）"*).
- Files: `src/fx_audio.js` (entire file), `build.js:30` (the dead `MODULES` entry, harmless but reads the file from disk on every build for nothing).
- Recommendation: Safe to delete both `src/fx_audio.js` and its `build.js:30` entry — this is already explicitly sanctioned in `CLAUDE.md` ("消してよい" = "OK to delete"). No further verification needed beyond what's above.

**`archive/` (5 files, `archive/maboroshi_testmon*.{json,png}`) is not referenced by any code path:**
- Verified: `grep -rln "archive" src/ tools/ build.js` returns no matches.
- Files: `archive/maboroshi_testmon.json`, `archive/maboroshi_testmon_attack.png`, `archive/maboroshi_testmon_card.png`, `archive/maboroshi_testmon_hurt.png`, `archive/maboroshi_testmon_normal.png`.
- Note: This is **intentional**, not a bug — `CLAUDE.md` §3 documents it as a deliberate keepsake ("幻の四皇モン「テストモン」（最初に生成した個体・記念保存）"). Listed here only because the audit explicitly asked to check for unused material beyond `fx_audio.js`; no action needed. (Note also that `battle.tpl.html`'s hardcoded `ROSTER_A` includes an unrelated built-in fighter literally named "テストモン" — same nickname, but a separate hardcoded roster entry, not a reference to this archived file.)

---

## Test Coverage Gaps

**No automated coverage for `localStorage` quota-exceeded behavior:**
- What's not tested: `grep -rn "Quota\|quota" tools/*.js` returns no matches — none of `tools/verify_audio.js`, `tools/verify_ui.js`, or `tools/verify_creator.js` (808 lines, the most thorough of the three, exercising 影・写真・技・鳴き声・放流・初期化) simulate a full `localStorage` or assert on the `QuotaExceededError` catch paths described above.
- Files: `tools/verify_creator.js` (would be the natural home for this), `src/creator.tpl.html` (the 4 save paths under test).
- Risk: The quota-exceeded UI paths (error messages in `autoSave`/slot-save/slot-overwrite/`saveWild`) are exercised only by hand, if at all — a regression that silently breaks the error message (e.g. an unhandled exception replacing the friendly message) would not be caught by the existing verification suite.
- Priority: Medium — the code paths themselves look correct by inspection (see "Persistence Limits" above), but given this is the most likely real-world failure mode as 鴨川 accumulates saved 四皇モン, an automated check (e.g. pre-fill `localStorage` near capacity, then attempt a save and assert the warning renders) would directly protect the project's stated core debugging philosophy ("開発の根底はデバッグだ").

**No test asserts `resolve()` parity between `battle.tpl.html` and `creator.tpl.html`:**
- What's not tested: The fallback-chain logic duplicated in both files (see "Fragile Areas") has no test that would catch the two implementations silently diverging again, only tests that catch outright crashes.
- Files: `src/battle.tpl.html:474`, `src/creator.tpl.html:464`.
- Risk: A repeat of the exact bug `HANDOFF.md` records as already having happened once (own-side image/scale swapping on attack).
- Priority: Low-Medium — cheap to add (a shared fixture asserting both functions return the same `key` for the same synthetic `{imgs, ph}` input across the back/foreground branches) relative to the cost of the bug recurring silently.

---

*Concerns audit: 2026-08-17*
