---
phase: 01-groundwork
plan: 01
subsystem: testing
tags: [playwright, verify-script, exit-code, ci-gate, determinism]

# Dependency graph
requires: []
provides:
  - "tools/verify_audio.js が dist/ のJSエラーで終了コード1になる（従来は常に0）"
  - "tools/verify_ui.js が dist/ のJSエラーで終了コード1になる（従来は常に0）"
  - "tools/verify_ui.js が決定論チェック失敗（det.ok===false）でも終了コード1になる（D-08）"
  - "npm run verify の && 連鎖が、verify_audio.js / verify_ui.js の段でも正しく止まるようになった"
  - "故意破壊→非ゼロ終了→復元→ゼロ終了、を実行して得た終了コード4回ぶんの記録（D-07の実証）"
affects: [01-02-groundwork, 01-03-groundwork, phase-3-storage-migration]

# Actuals (#2632) — chars/4 over the realized diff (git show の当該2ファイル分 4549 chars / 4)
actuals:
  tokens: 1137
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "verify_creator.js:807 と同一の allErrs → process.exit(allErrs.length?1:0) パターンを他2スクリプトへ複製"
    - "表示用の切り詰め（errs.slice(...)）と終了判定（切り詰めなしの errs 全件を集めた allErrs）を分離する"

key-files:
  created: []
  modified:
    - tools/verify_audio.js
    - tools/verify_ui.js

key-decisions:
  - "D-08（オーナー承認・2026-08-17）: 決定論チェック(det.ok)の失敗も verify_ui.js の非ゼロ終了に含めた。新しい終了経路・新しい判定基準は作らず、既存の allErrs へ合流させるだけに留めた"
  - "Task 2 は「壊れたら落ちる」ことをコード査読ではなく実行記録（4回ぶんの終了コード＋stderr）で証明する形にした（D-07）"

patterns-established:
  - "検証スクリプトの非ゼロ終了パターン: allErrs（全ページ／全ブロック共通の配列）→ 各ページ・各ブロック末尾で errs を（切り詰めずに）画面名付きで allErrs へ移す → 最後に console.error で全件表示＋process.exit(allErrs.length?1:0)"

requirements-completed: [FIX-03]

coverage:
  - id: D1
    description: "dist/ にJSエラーを1つ仕込むと node tools/verify_audio.js が非ゼロで終わる"
    requirement: "FIX-03"
    verification:
      - kind: manual_procedural
        ref: "Task 2 実験: dist/shioumon_audio_lab.html, dist/shioumon_field_test.html に throw を注入 → node tools/verify_audio.js → exit=1、stderrに GSD_SELFTEST_BREAK を確認"
        status: pass
    human_judgment: false
  - id: D2
    description: "同じ仕込みで node tools/verify_ui.js も非ゼロで終わる"
    requirement: "FIX-03"
    verification:
      - kind: manual_procedural
        ref: "Task 2 実験: 同上の仕込み → node tools/verify_ui.js → exit=1、stderrに GSD_SELFTEST_BREAK を確認（音ラボ・戦闘の両ブロック）"
        status: pass
    human_judgment: false
  - id: D3
    description: "落ちたとき、エラーの中身が標準エラー出力に文字で出る（黙って落ちない）"
    requirement: "FIX-03"
    verification:
      - kind: manual_procedural
        ref: "Task 2 実験の stderr ログ（本SUMMARY「故意破壊の実行記録」節に全文掲載）"
        status: pass
    human_judgment: false
  - id: D4
    description: "仕込みを git checkout で戻すと、両方とも0で終わる"
    requirement: "FIX-03"
    verification:
      - kind: manual_procedural
        ref: "Task 2 手順4: git checkout -- dist/ → node tools/verify_audio.js && node tools/verify_ui.js → restored audio=0 ui=0"
        status: pass
    human_judgment: false
  - id: D5
    description: "console.warn は失敗扱いにならない（m.type()==='error' だけを拾う）"
    requirement: "FIX-03"
    verification:
      - kind: other
        ref: "commit 58c76ec の git diff: m.type() の分岐行はいずれも無編集（'warning' を見る分岐を追加していない）"
        status: pass
    human_judgment: false
  - id: D6
    description: "決定論チェックが落ちた（det.ok===false）とき verify_ui.js が非ゼロで終わる（D-08）"
    requirement: "FIX-03"
    verification:
      - kind: unit
        ref: "commit 58c76ec: verify_ui.js に det.ok===false → allErrs へ積む分岐を追加。determinismTest() 呼び出し行（78行目）と console.log('■ 戦闘', ...)（86行目）は diff 上で無変更"
        status: pass
    human_judgment: false
  - id: D7
    description: "npm run verify の && 連鎖が、最初に落ちた段で止まる"
    requirement: "FIX-03"
    verification: []
    human_judgment: true
    rationale: "package.json の verify スクリプト自体は変更していない。3本目の verify_creator.js まで含めた連鎖全体を実地で流す確認は本プランのスコープ外（verify_audio.js / verify_ui.js 単体が非ゼロで終わることは D1〜D4 で実行記録により証明済み）。連鎖全体の目視確認は任意"

duration: 約20分（推定。実行開始時刻を明示的に記録しなかったため正確な計測値ではない）
completed: 2026-08-17
status: complete
---

# Phase 1 Plan 1: 検証スクリプトの非ゼロ終了化 Summary

**`verify_audio.js` / `verify_ui.js` を `verify_creator.js` と同じ基準（ページのJSエラーで `process.exit(1)`）へ揃え、`verify_ui.js` にはオーナー承認の D-08（決定論チェック失敗も非ゼロ終了に含める）を追加。故意に `dist/` を壊して実際に非ゼロで落ち、戻せば0に戻ることを実行記録として証明した。**

## Performance

- **Duration:** 約20分（推定）
- **Completed:** 2026-08-17T13:44:51Z
- **Tasks:** 2/2
- **Files modified:** 2（`tools/verify_audio.js`, `tools/verify_ui.js`）

## Accomplishments

- `tools/verify_audio.js`: ループ外の `allErrs` 集計配列と、末尾の `process.exit(allErrs.length ? 1 : 0)` を追加。表示用の `errs.slice(0, 6)` は据え置き、終了判定は切り詰めていない `errs` 全件を画面名付きで `allErrs` に移して行う
- `tools/verify_ui.js`: 同じ `allErrs` パターンを3ブロック（音ラボ／技ラボ／戦闘）へ適用。加えて戦闘ブロックに D-08 の決定論ゲート（`det.ok===false` なら `allErrs` へ1件積む）を実装。`determinismTest()` の呼び出し行（78行目）と `console.log('■ 戦闘', ...)`（86行目）は一切変更していない
- Task 2 で `dist/shioumon_audio_lab.html` と `dist/shioumon_field_test.html` を実際に壊し（`</body>` 直前に投げるだけの `<script>` を注入）、両スクリプトが `exit=1` になり、標準エラー出力に仕込んだ目印文字列 `GSD_SELFTEST_BREAK` が画面名付きで出ることを実行して確認。`git checkout -- dist/` で復元後、両方とも `exit=0` に戻ることも確認した

## Task Commits

1. **Task 1: 2つの検証スクリプトを、JSエラーで非ゼロ終了させる** - `58c76ec` (fix)
2. **Task 2: 故意に壊して、実際に非ゼロで落ちることを確かめる** - コミットなし（`dist/` を一時的に壊して `git checkout -- dist/` で復元したため正味の差分がゼロ。実行記録は本SUMMARYの「故意破壊の実行記録」節に掲載）

**Plan metadata:** このSUMMARY自体は最終メタデータコミットで記録する（下記参照）。

_Note: Task 1 は `type="tracer" tdd="true"` だが、本プロジェクトに jest/mocha 等のテストランナーは存在しない（`01-PATTERNS.md` で確認済み）。したがって RED/GREEN の実体は「Task 1 でロジックを実装し、Task 1 自身の `<verify>`（`node --check` ＋健全な `dist/` で exit=0/0）で GREEN を確認」「Task 2 で故意に壊して exit=1/1（失敗経路が本当に機能する証明）→ 復元して exit=0/0（GREEN に戻る）」という、このコードベース固有の verify スクリプトそのものを使った統合レベルの RED/GREEN サイクルとして扱った。新しいテストランナーやテストファイルは追加していない（D-04 が禁じる「新しい判定基準の発明」を避けるのと同じ理由）。_

## Files Created/Modified

- `tools/verify_audio.js` - `allErrs` 集計と `process.exit` を追加（3箇所）
- `tools/verify_ui.js` - `allErrs` 集計・`process.exit`・D-08 決定論ゲートを追加（5箇所）

## Decisions Made

- D-08 をスコープに含めて実装した（オーナー承認・2026-08-17）。`det.ok===false` のとき既存の `allErrs` へ1件積むだけに留め、`determinismTest()` の呼び出し行・ログ行・`src/battle.tpl.html` は一切変更していない
- 画面名／ブロック名のプレフィックスは各ファイルの既存ログ文言（音ラボ／技ラボ／戦闘／クリエーター）をそのまま使い、`'[' + name + '] ' + e` の形で統一した。表示用の `slice(...)` とは別経路で、切り詰めていない `errs` 全件を `allErrs` へ流す設計にして、表示の見た目と終了判定の正確性を分離した
- 2ファイルの終了処理（エラー件数見出し＋`console.error`全件＋`process.exit`）は文言まで同一の形にした（`verify_audio: N件のエラー` / `verify_ui: N件のエラー`）

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None（既存の開発用検証スクリプトのみを変更。新しいネットワーク面・認証経路・スキーマは一切導入していない）。

## 故意破壊の実行記録（Task 2 — D-07 の実証）

主張ではなく実行結果として記録する。

**手順**

1. 壊す前の確認: `git status --porcelain dist/` が空であることを確認（precondition 充足、Task 2 実行直前に再確認済み）
2. 壊す: `dist/shioumon_audio_lab.html` と `dist/shioumon_field_test.html` の `</body>` 直前に `<script>throw new Error('GSD_SELFTEST_BREAK')</script>` を注入（ページ本体のスクリプトより後に走るため、UI操作自体は妨げず `pageerror` だけが1件増える）
3. 壊した状態で2本を実行し、終了コードと標準エラー出力を記録
4. `git checkout -- dist/` で復元し、`git status --porcelain dist/` が空に戻ったことを確認
5. 復元後の状態で2本を再実行し、終了コードが0に戻ることを確認

**4回ぶんの終了コード**

| # | 状態 | コマンド | 終了コード |
|---|---|---|---|
| 1 | 壊した `dist/` | `node tools/verify_audio.js` | **1** |
| 2 | 壊した `dist/` | `node tools/verify_ui.js` | **1** |
| 3 | 復元後の `dist/` | `node tools/verify_audio.js` | **0** |
| 4 | 復元後の `dist/` | `node tools/verify_ui.js` | **0** |

**壊した状態の標準エラー出力（先頭数行、実際の出力そのまま）**

`node tools/verify_audio.js`:
```
verify_audio: 2件のエラー
[音ラボ] PAGEERROR GSD_SELFTEST_BREAK
[戦闘] PAGEERROR GSD_SELFTEST_BREAK
```

`node tools/verify_ui.js`:
```
verify_ui: 2件のエラー
[音ラボ] PAGEERROR GSD_SELFTEST_BREAK
[戦闘] PAGEERROR GSD_SELFTEST_BREAK
```

`verify_audio.js` は4画面中2画面（音ラボ・戦闘）で検知、`verify_ui.js` は3ブロック中2ブロック（音ラボ・戦闘）で検知——狙いどおり両ファイルの集計線を通した。

**復元後の事後確認**

- `git status --porcelain dist/` → 空
- `git status --porcelain`（リポジトリ全体）→ 空（`tools/` の2ファイルは既に Task 1 でコミット済みのため、それ以外の差分は一切残っていない）
- Task 1 の `<verify>` 自体でも健全な `dist/` に対して事前に `audio=0 ui=0`（`det.ok:true, len:1495`）を確認済みで、上表 #3/#4 はこれと整合する

## Next Phase Readiness

- FIX-03 完了。`verify_audio.js` / `verify_ui.js` が壊れを見逃さなくなり、`npm run verify` の `&&` 連鎖がこの2段でも正しく止まるようになった
- Phase 3（保存先の移動、このプロジェクトで一番危ない作業）の前提となる安全網が整った
- 01-02・01-03（同フェーズの残り2プラン）は本プランの成果に依存しない（`depends_on: []` のとおり独立）
- ブロッカーなし

---
*Phase: 01-groundwork*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `.planning/phases/01-groundwork/01-01-SUMMARY.md`
- FOUND: `tools/verify_audio.js`
- FOUND: `tools/verify_ui.js`
- FOUND: commit `58c76ec`（`git log --oneline --all` で確認）
