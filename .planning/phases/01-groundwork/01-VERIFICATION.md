---
phase: 01-groundwork
verified: 2026-08-17T15:30:14Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: 足場の地ならし Verification Report

**Phase Goal:** 掟違反とデッドコードが消え、検証ツールが壊れを見逃さなくなる
**Verified:** 2026-08-17T15:30:14Z
**Status:** passed
**Re-verification:** No — initial verification

## 検証の方針についての注記

`.planning/ROADMAP.md` は Phase 1 に `Mode: mvp` を付けているが、Goal は
`"As a ..., I want to ..., so that ..."` の User Story 形式ではなく日本語の記述文
（「掟違反とデッドコードが消え、検証ツールが壊れを見逃さなくなる」）であり、User Story
バリデーションの対象外（プロジェクト全4フェーズが同じ書式）。本フェーズはユーザー向け機能
ではなく開発基盤・デッドコード除去・検証ツール自体が対象であるため、MVP モードの
「User Flow Coverage」形式は素直に当てはまらない。したがって本レポートは
ROADMAP.md の5件の Success Criteria を対象にした通常の goal-backward 検証として作成した
（オーケストレーターからの指示内容とも一致する）。

## 検証の進め方

SUMMARY.md の主張を鵜呑みにせず、以下はすべて**このセッションで実際に自分の手で再実行**して
得た結果である（SUMMARY記載の実行記録をなぞっただけの箇所はその旨を明記する）。

- SC1: SUMMARYとは**別のファイル**（`shioumon_effect_lab.html` / `shioumon_creator.html`）に
  故意に例外を注入し、4本の検証スクリプト＋`npm run verify`連鎖の反応を実測 → 復元
- SC4: `battle.tpl.html:475-476` を実際にコメントアウトして再ビルドし、
  `tools/verify_resolve.js` を再実行 → 復元。想定18件/実測16件の内訳を実行前に手計算で
  導出し、実行結果と突き合わせて一致を確認
- SC2/SC3/SC5: 静的コード読解に加え、健全な`npm run verify`の実行結果（`resetTwoPress`の
  実測値、4画面のJSエラー0件など）で裏取り

実験はすべて`git checkout`／再ビルドで復元し、セッション終了時点で`git status`は
クリーン（新規コミットなし、検証エージェントはコミットしない）。

## Goal Achievement

### Observable Truths（ROADMAP.md の5件のSuccess Criteria）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | わざと壊した `dist/` に対して `verify_ui.js`/`verify_audio.js` が非ゼロで落ちる | ✓ VERIFIED | 自分で実施した故意破壊・復元の実行記録（下記参照）。SUMMARYとは異なる注入先ファイルで再現し、同じ結果を得た |
| 2 | 音ラボの削除操作でOSダイアログが出ず、同じボタンの二度押しで消える | ✓ VERIFIED | `src/audiolab.tpl.html:339-357,378`のコード読解＋`npm run verify`実測（`resetTwoPress`が`dialogs:0`） |
| 3 | `fx_audio.js`と`build.js`のトークン、未使用`ANIMS`が消え、`node build.js`が通り4画面が開く。`MODULES`のanims.jsエントリは1つのみ残存 | ✓ VERIFIED | ファイル不在・トークン不在をgrepで確認、`node build.js`を複数回実行して成功、4画面をPlaywrightで実測（後述） |
| 4 | `resolve()`の食い違いを検証が検出して落ちる。健全時は0件 | ✓ VERIFIED | 健全時0件をこのセッションで3回確認。故意破壊（16件）を自分で再現し、想定18件との差異の数学的必然性を実行前の手計算と実行結果の完全一致で検証 |
| 5 | `CLAUDE.md`が実装と一致（鳴き声圧縮=手動、Google Fonts=明示例外） | ✓ VERIFIED | `creator.tpl.html`のコード読解で自動圧縮不在を確認、4テンプレート全てにフォントリンクが実在することを確認 |

**Score:** 5/5 truths verified（0 present-behavior-unverified）

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tools/verify_audio.js` | JSエラーで`process.exit(1)` | ✓ VERIFIED | 自作の故意破壊で実測: exit=1、`[技ラボ] PAGEERROR ...`形式で明示表示 |
| `tools/verify_ui.js` | JSエラー・決定論失敗で`process.exit(1)`、二度押し回帰検査を含む | ✓ VERIFIED | 自作の故意破壊で実測: exit=1。健全時`resetTwoPress`が`dialogs:0`で合格 |
| `tools/verify_resolve.js`（新規） | 36通りの`resolve()`突き合わせ、食い違い検出でexit非ゼロ | ✓ VERIFIED | 健全時: 36通り・食い違い0・exit=0（複数回実測）。破壊時: 16件検出・exit=1（自分で再現） |
| `src/fx_audio.js` | 削除済み | ✓ VERIFIED | `ls src/fx_audio.js` → No such file or directory |
| `build.js`のMODULESテーブル | `FX_AUDIO`トークン削除、`ANIMS`(anims.js)エントリは1つ残存 | ✓ VERIFIED | `build.js:22-30`。7エントリ、`anims.js`読み込みは1箇所のみ（`/*__ANIMS__*/`） |
| `src/audiolab.tpl.html` | `confirm()`除去、`ANIMS`インクルード除去、二度押し実装 | ✓ VERIFIED | `confirm(`はコメント内のみ（:339）。`ANIMS`は0件。`alArmDelete()`が:343で定義、:378で`btnReset`に結線 |
| `CLAUDE.md` | 鳴き声圧縮・Google Fonts記述の訂正 | ✓ VERIFIED | :221-224（鳴き声）、:25（Google Fonts）。実装と一致することをコード側から裏取り |
| `src/sfx_bank.js`（不可触） | commit `403b730`から1バイトも不変 | ✓ VERIFIED | `git diff 403b730 -- src/sfx_bank.js`が空。SHA256ハッシュが完全一致（`000ea5db...`） |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `package.json`の`verify`スクリプト | `verify_audio.js`→`verify_ui.js`→`verify_creator.js`→`verify_resolve.js` | `&&`連鎖 | ✓ WIRED | 4段構成を確認。壊した状態で`npm run verify`を実行し、1段目（audio）で停止して残り3段が走らないことを実測（chain exit=1） |
| `#btnReset`（`src/audiolab.tpl.html`） | `alArmDelete()` | `.onclick`結線（:378） | ✓ WIRED | 静的結線に加え、`npm run verify`のPlaywright実測で二度押しの実挙動（1回目でラベル変化・割り当て不変、2回目で初期化・ダイアログ0件）を確認 |
| `src/battle.tpl.html`の`resolve()` | `src/creator.tpl.html`の`resolve()` | `tools/verify_resolve.js`による突き合わせ | ✓ WIRED | 健全時0件一致、`useBack`分岐を壊すと16件検出。検出経路が実際に機能していることを実行で確認 |
| `build.js`のANIMSエントリ | `src/battle.tpl.html`, `src/creator.tpl.html` | `/*__ANIMS__*/`トークン | ✓ WIRED | `grep -l "__ANIMS__" src/*.tpl.html`が2件（battle・creator）。`dist/`の両ファイルに実コンテンツが焼き込まれていることを確認（`audiolab.tpl.html`は0件で正しく除去済み） |

### 故意破壊の実行記録（このセッションで実施・SC1）

`shioumon_effect_lab.html`と`shioumon_creator.html`（SUMMARYの実験とは異なる2ファイル）に
`<script>throw new Error('VERIFIER_INDEPENDENT_BREAK')</script>`を注入して実施。

**precondition:** `git status --porcelain dist/` 空を確認済み

| # | 状態 | コマンド | 終了コード | 検出内容 |
|---|------|---------|-----------|---------|
| 1 | 壊した状態 | `node tools/verify_audio.js` | **1** | 2件（技ラボ・クリエーター、両方とも注入先） |
| 2 | 壊した状態 | `node tools/verify_ui.js` | **1** | 1件（技ラボ。`verify_ui.js`はクリエーターを訪問しないため） |
| 3 | 壊した状態 | `node tools/verify_creator.js` | **1** | `errs`配列に3件（`PAGEERROR VERIFIER_INDEPENDENT_BREAK`） |
| 4 | 壊した状態 | `node tools/verify_resolve.js` | **1** | 1件（`制作`ページ側でPAGEERROR検出） |
| 5 | 壊した状態 | `npm run verify`（4段連鎖） | **1** | 1段目（audio）で停止。2〜4段目は実行されず |
| 6 | 復元後 | `git checkout -- dist/` → `git status --porcelain dist/` | - | 空（クリーン） |
| 7 | 復元後 | `node tools/verify_audio.js` | **0** | エラーなし |
| 8 | 復元後 | `node tools/verify_ui.js` | **0** | エラーなし |

注: 手順3の実行で最初`| tail -20`経由で`$?`を取得し誤って`CREATOR_EXIT=0`と記録しかけたが、
これは`tail`自身の終了コードを拾った誤りと気づき、リダイレクト方式で再実行して`exit=1`
（正）を確認した。この訂正の経緯自体も検証の厳密さの記録として残す。

### resolve() 食い違い件数の独立検証（SC4・「唯一の判断が必要な論点」）

`src/battle.tpl.html:475-476`（`if(this.useBack) return {...}`の2行）をコメントアウトする前に、
両`resolve()`の実装を読解して手計算で以下を導出した（実行結果を見る前）。

**手計算による事前予測:**

`SETS.full`（写真5枚揃い、`back='B'`）: `key='back'`のときのみ、battle側（壊れた版）が
`imgs['back']`を2段目で拾い、creator側も`imgs.back`を1段目で拾うため**両者とも`'B'`に一致**
（`useBack`分岐の有無に関係なく必然的に一致）。他5キーは不一致 → **5/6件不一致**。

`SETS.none`（写真ゼロ）: `key='back'`のとき、battle側は`ph['back']`（2段目）、creator側は
`ph.back`（3段目）へ、**共有している同じ`PH.back`値**へ到達するため一致。他5キーは不一致
→ **5/6件不一致**。

`SETS.thin`（`normal`のみ）: `imgs.back`が無いため、`key='back'`でもbattle側は`ph['back']`
（`'pB'`）、creator側は`back=true`固定で`imgs.normal`（`'N'`）を拾い、**値もkeyも一致しない**
→ **6/6件不一致**。

**合計予測: 5+5+6=16件**（SETS別の一致箇所は`back`キーのみ）

**実行結果（このセッションで実際に破壊・実行）:**

```
node build.js（コメントアウト後）→ node tools/verify_resolve.js
{"比べた組合せ": 36, "食い違い": 16, "JSエラー": 0}
```
内訳: `full|true`側5件不一致（`back`キーのみ一致）／`thin|true`側6件不一致（全件）／
`none|true`側5件不一致（`back`キーのみ一致）。**個々のキー単位の不一致リストまで手計算と完全一致**。

**結論（このセッションの独立判断）:** 実測16件は`tools/verify_resolve.js`の欠陥や
under-detectionではなく、テストデータ（`SETS`/`PH`）の構造上、`key='back'`を直接要求した
場合にのみ`useBack`分岐の有無が結果に影響しなくなるという**数学的必然**である。計画時点の
想定18件は「3 SETS × 6 KEYS = 18、`useBack`を外せば全部食い違うはず」という直感的な見積もりで、
実装を実際にトレースしていなかった側の誤差。検出の仕組み自体（0→非ゼロ→0の反転、個別名指し、
`npm run verify`連鎖の停止）は正しく機能していることを実行で確認済みであり、この論点は
SUMMARY記載どおり**オーナー参考情報**として扱ってよく、Phase 1のゴール達成を妨げるものではない。
（実測破壊後は`git checkout -- src/battle.tpl.html` + `node build.js`で復元。復元直後に
Windows `core.autocrlf=true`起因の racy git 偽陽性が再発したため、`git diff`とハッシュ3点
一致を確認したうえで`git add`によりstatキャッシュのみ更新——SUMMARY 01-03と同一の対処）

### 4画面が今まで通り開くことの実測

`npm run verify`（健全な`dist/`、このセッションで複数回実行、最終確認時 exit=0）:

- 音ラボ・技ラボ・戦闘・クリエーターの4画面すべて `decoded: 78, bank: 79, errs: []`
- 戦闘の決定論チェック: `det.ok:true, len:1495`
- `resolve()`突き合わせ: `比べた組合せ: 36, 食い違い: 0, JSエラー: 0`
- Chromiumは`PW_CHROMIUM`指定なしで問題なく起動（このマシンでは環境変数不要だった）

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| FIX-01 | 01-02 | `fx_audio.js`削除＋`build.js`トークン除去 | ✓ SATISFIED | ファイル不在、トークン不在を確認 |
| FIX-02 | 01-02 | `confirm()`→二度押し | ✓ SATISFIED | コード読解＋`resetTwoPress`実測 |
| FIX-03 | 01-01 | `verify_audio.js`/`verify_ui.js`が非ゼロ終了 | ✓ SATISFIED | 自分で故意破壊・復元を実行、4スクリプト全て正しく反応 |
| FIX-04 | 01-02 | 未使用`ANIMS`インクルード除去 | ✓ SATISFIED | `audiolab.tpl.html`から0件、battle/creatorは健在 |
| FIX-05 | 01-03 | 鳴き声圧縮の記述訂正 | ✓ SATISFIED | `CLAUDE.md:221-224`とコードの一致を確認 |
| FIX-06 | 01-03 | Google Fontsの例外記録 | ✓ SATISFIED | `CLAUDE.md:25`と4テンプレート全部のリンクを確認 |
| FIX-07 | 01-03 | `resolve()`食い違い検出 | ✓ SATISFIED | 自分で故意破壊・復元を実行、検出機能を確認 |

**Orphaned requirements:** なし（REQUIREMENTS.mdのPhase 1範囲＝FIX-01〜07が3プランの
`requirements-completed`で過不足なくカバーされている）

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CLAUDE.md` | 70 | `fx_audio.js`が「構成」節のファイル一覧に旧説明（「現在は未使用。消してよい」）のまま残存しているが、FIX-01で実際にはファイルごと削除済み | ℹ️ Info | ROADMAP/FIX-01/SC5のいずれの必須要件でもない（SC5が名指しした対象は鳴き声圧縮とGoogle Fontsの2件のみ）。実害はゼロ（`build.js`からもトークンからも既に除去済みで、ビルドや検証には影響しない）が、同じドキュメントの精度を上げる本フェーズの趣旨からすると片手落ち。1行削除で直る些末事項としてオーナーに共有 |

modifiedファイル（`tools/verify_audio.js`, `tools/verify_ui.js`, `tools/verify_resolve.js`,
`build.js`, `src/audiolab.tpl.html`, `package.json`, `CLAUDE.md`）に対する
`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`マーカー・空実装スキャン: 該当なし。
`node --check`は4本のJSファイル全てで合格。

### Human Verification Required

なし。本フェーズは開発基盤・検証ツール自体が対象であり、視覚的判断やリアルタイム体感を
要する項目がない。SUMMARYが`human_judgment: true`としていた2件（`npm run verify`連鎖の停止
挙動／16件対18件の食い違い件数の妥当性）は、いずれもこのセッションで実行によって解消済み
（上記「故意破壊の実行記録」「resolve()食い違い件数の独立検証」節）。

### Gaps Summary

ブロッキングな不足なし。5件のSuccess Criteriaは全てこのセッションでの実行またはコード読解に
よって裏取りされ、SUMMARY.mdの主張と一致した。唯一の軽微な指摘は`CLAUDE.md`の構成表に残る
`fx_audio.js`の記述だが、SC5が名指しした2項目（鳴き声圧縮／Google Fonts）には含まれず、
機能にも影響しないためgapとして扱わずInfoとして記録した。

Phase 3（保存先の移動、このプロジェクトで最も危険な作業）が依拠する安全網——`verify_*.js`の
非ゼロ終了と`resolve()`の食い違い検出——は、このセッションで自分の手による故意破壊と復元を
通じて実際に機能することを確認できた。

---

_Verified: 2026-08-17T15:30:14Z_
_Verifier: Claude (gsd-verifier)_
