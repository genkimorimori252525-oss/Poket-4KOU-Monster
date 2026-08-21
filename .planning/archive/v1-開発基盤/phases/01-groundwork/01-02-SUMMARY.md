---
phase: 01-groundwork
plan: 02
subsystem: ui
tags: [playwright, verify-script, two-press, build-config, dead-code-removal, dialog-free-ui, tdd]

# Dependency graph
requires:
  - phase: 01-groundwork (01-01)
    provides: "tools/verify_ui.js / verify_audio.js が非ゼロ終了する安全網（本プランのRED/GREEN実証の前提）"
provides:
  - "src/fx_audio.js が削除され、build.js の MODULES が7エントリ（anims.js の行は残存）"
  - "src/audiolab.tpl.html から未使用の /*__ANIMS__*/ トークンが消え、dist が8,496バイト軽くなった（build.js側のANIMSエントリは無変更）"
  - "src/audiolab.tpl.html の #btnReset が confirm() ではなく alArmDelete() の二度押しへ移行（ダイアログ0件）"
  - "tools/verify_ui.js に音ラボの二度押し回帰検査が常設され、RED→GREENを実行記録で実証済み"
affects: [01-03-groundwork, phase-3-storage-migration]

# Actuals (#2632) — chars/4 over the realized diff (build.js + src/audiolab.tpl.html + tools/verify_ui.js の3ファイル分 5370 chars / 4。dist/ の機械生成差分とsrc/fx_audio.jsの削除分は除外)
actuals:
  tokens: 1343
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "二度押し削除パターン（armed/timer/resetのクロージャ）を src/movelab.js の mlArmDelete() から src/audiolab.tpl.html へ書き写して alArmDelete() として複製。MOVELABトークンを取り込まない意図的な非DRY（音ラボへ技クリエーター全体を持ち込まないため）"
    - "01-01のallErrs集約パターン（画面名プレフィックス付きでpushし、最後にprocess.exit(allErrs.length?1:0)）へ二度押し検査をそのまま合流させた。新しい判定基準・新しい終了経路は増やしていない"
    - "verify_creator.jsと同形のダイアログ全つっぱねリスナー（pg.on('dialog', d=>{dialogs.push(d.message());d.dismiss();})）をverify_ui.jsの音ラボブロックにも追加"

key-files:
  created: []
  modified:
    - build.js
    - src/fx_audio.js (削除)
    - src/audiolab.tpl.html
    - tools/verify_ui.js
    - dist/shioumon_audio_lab.html

key-decisions:
  - "Task 1のprecondition（`git status --porcelain dist/`が空であること）が最初のチェックで失敗した。診断の結果、`git hash-object`がHEADのブロブハッシュと完全一致し、原因はWindowsの`core.autocrlf=true`によるgitインデックスのstatキャッシュ陳腐化（racy git）と判明。`git update-index --refresh`で解消（内容変更なし、コミットもなし）。Rule 3（ブロッキング問題の自動修正）として処理"
  - "FIX-02のarmed時の表示文字は、計画の明示的な指示どおり「戻す？」を採用した。creator.tpl.html自身のbtnResetはmlArmDelete()のデフォルト文言「消す？」を使っており一致しないが、計画がこのプラン専用に「戻す？」を指定していたため、より具体的な指示を優先した"
  - "TaskをTDDのRED/GREENとして2コミットに分離（test→feat）。RED時点の失敗理由（ボタン表示不変・2回目で初期化されない・ダイアログ2件）を実行ログとしてコミットメッセージに残した"

patterns-established:
  - "confirm()/alert()を分かれ道に置く旧実装を発見したら、mlArmDelete()を直接呼べない画面では同じクロージャ形状を書き写す（トークンを追加してモジュール全体を引き込まない）"

requirements-completed: [FIX-01, FIX-02, FIX-04]

coverage:
  - id: D1
    description: "src/fx_audio.js（旧・手続き型音源、15KB・完全なデッドコード）をファイルごと削除し、build.js の MODULES から該当エントリを外した。anims.js の行は無編集で残した"
    requirement: "FIX-01"
    verification:
      - kind: other
        ref: "node -e '...MODULES entries===7' && grep -c anims.js build.js===1 && node build.js が「4 / 4 個ビルドした」で終了 && git status --porcelain dist/ が空"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/audiolab.tpl.html から未使用の /*__ANIMS__*/ トークン参照1行を削除。build.js 側の ANIMS MODULES エントリ（battle.tpl.html / creator.tpl.html が今も消費）は無変更"
    requirement: "FIX-04"
    verification:
      - kind: other
        ref: "ビルドトークンが__FX_CORE__,__SFX_BANK__,__MOVES__,__AUDIO_UI__の4つに一致 && dist/shioumon_audio_lab.htmlがHEAD(Task1時点)より8496バイト減 && node tools/verify_audio.js exit=0"
        status: pass
    human_judgment: false
  - id: D3
    description: "src/audiolab.tpl.html の #btnReset を confirm() から alArmDelete() の二度押しへ移行。1回目で表示が「戻す？」に変わり割り当ては不変、2回目でAUDIO_CFG_DEFAULTへ一致、ダイアログは0件"
    requirement: "FIX-02"
    verification:
      - kind: automated_ui
        ref: "tools/verify_ui.js 音ラボブロック resetTwoPress（Playwrightでdist/shioumon_audio_lab.htmlを実際に2回クリックし、AUDIO_CFG.movesのJSON.stringify一致/不一致とボタンtextContent変化とdialogs.lengthを判定）"
        status: pass
    human_judgment: false
  - id: D4
    description: "二度押しの検査を verify_ui.js に常設し、confirm() への先祖返りや二度押しロジックの崩れを今後も自動検出できるようにした（RED→GREENを実行記録で実証）"
    requirement: "FIX-02"
    verification:
      - kind: automated_ui
        ref: "実装前: node tools/verify_ui.js exit=1（3件のエラー: ラベル不変・2回目で初期化されない・ダイアログ2件）。実装後: 同exit=0"
        status: pass
    human_judgment: false
  - id: D5
    description: "3件の変更後も4画面（戦闘・技ラボ・音ラボ・制作ツール）すべてがJSエラーなしで開き、決定論チェックも通る（回帰なし）"
    verification:
      - kind: other
        ref: "npm run verify（verify_audio.js && verify_ui.js && verify_creator.js の3段連鎖） exit=0、ログにPAGEERROR/決定論チェック失敗の出現なし"
        status: pass
    human_judgment: false

duration: 約35分（推定。実行開始時刻を明示的に記録しなかったため正確な計測値ではない）
completed: 2026-08-17
status: complete
---

# Phase 1 Plan 2: 掟違反とデッドコードの除去 Summary

**`src/fx_audio.js`（15KB）を削除、音ラボから未使用の`ANIMS`インクルードを外して8,496バイト軽量化、「初期設定に戻す」の`confirm()`を`mlArmDelete()`と同形の二度押しへ置換。3件とも`tools/verify_ui.js`/`verify_audio.js`の自動検査つきで完了、`npm run verify`3段が0で終了。**

## Performance

- **Duration:** 約35分（推定）
- **Completed:** 2026-08-17T14:24:08Z
- **Tasks:** 3/3
- **Files modified:** 5（`build.js`, `src/fx_audio.js`削除, `src/audiolab.tpl.html`, `tools/verify_ui.js`, `dist/shioumon_audio_lab.html`）

## Accomplishments

- **FIX-01**: `src/fx_audio.js`をファイルごと削除し、`build.js`の`MODULES`から該当エントリを除去（8→7エントリ）。`anims.js`を読む行は無編集で残り、`dist/`は理論どおり無変化（トークンがどのテンプレートにも存在しなかったため）
- **FIX-04**: `src/audiolab.tpl.html`から未使用の`/*__ANIMS__*/`トークン参照1行のみを削除。`build.js`側の`ANIMS`エントリは`battle.tpl.html`・`creator.tpl.html`がまだ消費しているため無変更。`dist/shioumon_audio_lab.html`が8,496バイト（`anims.js`の全量）軽量化された
- **FIX-02**: `#btnReset`のハンドラを`confirm('初期設定に戻す？...')`から`alArmDelete($('btnReset'), onDo, '戻す？')`へ置換。`src/movelab.js`の`mlArmDelete()`と同じクロージャ形状（armed／timer／reset、3.5秒で自動解除、2回目の実クリックでのみ確定）を、音ラボが`MOVELAB`トークンを取り込んでいないためインラインで書き写した。`:349/:350/:355`の`alert()`通知（純粋な通知、分かれ道ではない）は無変更のまま残した
- **TDD gate**: `tools/verify_ui.js`の音ラボブロックに二度押し検査を先に追加し、旧実装に対して実行して**RED（exit=1、3件のエラー）**を確認。その後に実装を直し、**GREEN（exit=0）**へ移行したことを実行記録として残した
- 全変更後、`npm run verify`（`verify_audio.js && verify_ui.js && verify_creator.js`）が3段とも0で終了。4画面すべてJSエラーなし、決定論チェック（`det.ok`）も維持

## Task Commits

各タスクをアトミックにコミット：

1. **Task 1: FIX-01 — デッドな旧音源を、ファイルごと消す** - `d2fc038` (refactor)
2. **Task 2: FIX-04 — 音ラボから、使っていないキャラアニメのインクルードを外す** - `2e6626a` (refactor)
3. **Task 3: FIX-02 — 「初期設定に戻す」をダイアログから二度押しへ**
   - RED: `2f50572` (test) — `tools/verify_ui.js`に二度押し検査を追加。実装は未変更のまま実行し、exit=1（3件のエラー）を確認してからコミット
   - GREEN: `395c6dd` (feat) — `src/audiolab.tpl.html`に`alArmDelete()`を実装。再実行してexit=0を確認してからコミット

**Plan metadata:** このSUMMARY自体は最終メタデータコミットで記録する（下記参照）。

_REFACTORコミットは無し —— `alArmDelete()`は`mlArmDelete()`をそのまま書き写した形で、実装時点で既に整っており追加のクリーンアップは不要だった。_

## Files Created/Modified

- `build.js` - `MODULES`テーブルから`/*__FX_AUDIO__*/`エントリを削除（8→7エントリ）
- `src/fx_audio.js` - ファイルごと削除（15KB・デッドコード。git履歴から復元可能）
- `src/audiolab.tpl.html` - `/*__ANIMS__*/`トークン削除、`alArmDelete(btn,onDo,armedText)`ヘルパ追加、`#btnReset`の結線を`confirm()`から二度押しへ置換
- `tools/verify_ui.js` - 音ラボブロックへダイアログ全つっぱねリスナーと二度押し回帰検査（`resetTwoPress`）を追加
- `dist/shioumon_audio_lab.html` - `node build.js`で再生成（上記テンプレート変更を反映）

## Decisions Made

- **Task 1のprecondition偽陽性への対処**: 編集前の`node build.js`直後、`git status --porcelain dist/`が`dist/shioumon_audio_lab.html`と`dist/shioumon_field_test.html`をMとして報告した。`git hash-object`で両ファイルともHEADのブロブハッシュと完全一致することを確認し（内容差分ゼロ）、`git diff`も0行だったことから、Windowsの`core.autocrlf=true`によるgitインデックスのstatキャッシュ陳腐化（racy git）と断定。`git update-index --refresh`（内容変更なし・コミットなし）で解消してから本編集に進んだ。Rule 3として処理
- **FIX-02のarmedText**: 計画が明示した「戻す？」をそのまま採用（`creator.tpl.html`自身の`btnReset`はデフォルト文言「消す？」を使っており完全一致はしないが、本プラン向けの明示的指示を優先）
- **TDDのRED/GREENを2コミットに分離**: `tools/verify_ui.js`の検査追加（RED、`test(...)`）と`src/audiolab.tpl.html`の実装（GREEN、`feat(...)`）を別コミットにし、RED時点の失敗理由（ラベル不変・2回目で初期化されない・ダイアログ2件、メッセージ「初期設定に戻す？　今の割り当ては消える」）をコミットメッセージに実行結果として記録した

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1のprecondition偽陽性（git indexのstatキャッシュ陳腐化）を解消**
- **Found during:** Task 1（precondition確認、実装前）
- **Issue:** 何も編集していない状態で`node build.js`を1回走らせた直後、`git status --porcelain dist/`が`dist/shioumon_audio_lab.html`・`dist/shioumon_field_test.html`をMと報告し、precondition（空であること）を満たさなかった
- **Fix:** `git hash-object`で両ファイルの内容がHEADのブロブハッシュと完全一致すること（`git diff`も0行）を確認し、Windowsの`core.autocrlf=true`起因のgitインデックスstatキャッシュ陳腐化と診断。`git update-index --refresh`で解消（ファイル内容・コミット履歴とも無変更）
- **Files modified:** なし（gitの内部キャッシュのみ更新）
- **Verification:** 解消後`git status --porcelain dist/`が空になったことを確認してからTask 1の本編集に着手
- **Committed in:** コミットなし（内容変更が無いためコミット対象自体が存在しない）

---

**Total deviations:** 1 auto-fixed（Rule 3 - ブロッキング問題）
**Impact on plan:** コード・成果物には一切影響なし。gitの環境依存な偽陽性を診断・解消しただけで、以降のdist/差分は本フェーズの実編集のみに帰属する状態を保った。スコープの拡大なし。

## Issues Encountered

None（上記のprecondition偽陽性はDeviationsで扱い済み）。

## 計測に関する注記（dist/shioumon_audio_lab.html のバイト数）

計画の`<verification>`項目5「`dist/shioumon_audio_lab.html`がHEAD時点より8,000バイト以上小さい」について、2つの異なる基準で数値が変わる点を明記する。

- **Task 2（FIX-04）単体の寄与**（Task 1コミット`d2fc038`時点のHEAD比）: **-8,496バイト**（`anims.js`の全量。Task 2自身の`<verify>`で実行・合格済み）
- **Wave 2全体の累積**（Wave 1最終コミット`d035b3a`時点のHEAD比、Task 3のFIX-02実装で追加した`alArmDelete()`約1,015バイト分を相殺後）: **-7,481バイト**

計画の目的文（「8.5KB軽くなった音ラボ」）およびmust_haves（「キャラアニメのぶんだけ小さくなっている」）はいずれもFIX-04単体の効果を指しており、これはTask 2の`<verify>`で8,496バイト減として実測・合格済み。累積値がFIX-02の必須の追加コード分だけ8,000バイトをわずかに下回るのは、同一プラン内でFIX-02（ダイアログ廃止という別の必須要件）も完了させた結果であり、両要件を欠けることなく満たした上での事実として記録する。armedText用のコメントを削って数百バイト稼ぐことも検討したが、`movelab.js`側の既存コメント慣習との一貫性を優先し、桁を合わせるための説明省略はしなかった。

## Known Stubs

None.

## Threat Flags

None（計画の`<threat_model>`にある脅威はすべて計画自身のMitigation Planどおりに対処済みで、新しいネットワーク面・認証経路・スキーマは導入していない）。

## User Setup Required

None - 外部サービス設定は不要。

## Next Phase Readiness

- FIX-01・FIX-02・FIX-04が完了。`build.js`の`MODULES`は7エントリ（`anims.js`は健在）、音ラボの初期化はダイアログ無しの二度押しに統一され、`tools/verify_ui.js`がその振る舞いを常時見張る
- `npm run verify`3段（audio/ui/creator）が0で終了する状態を維持したまま本プランを終えた
- 01-03（同フェーズ残りのプラン、FIX-03の続きやFIX-05〜07を含む可能性）は本プランの成果に依存しない独立プランとして進行可能
- ブロッカーなし
- 参考: `src/creator.tpl.html:2235`の`btnReset`は`mlArmDelete()`のデフォルト文言「消す？」を使っており、本プランで音ラボに採用した「戻す？」とは文言が異なる。両者とも計画の指示どおりの実装であり不具合ではないが、将来「初期化系ボタンの文言を全画面で揃えるか」を判断する余地として記録しておく

---
*Phase: 01-groundwork*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `.planning/phases/01-groundwork/01-02-SUMMARY.md`
- FOUND: `src/fx_audio.js` が正しく不在
- FOUND: `alArmDelete` が `src/audiolab.tpl.html` に定義されている
- FOUND: `resetTwoPress` が `tools/verify_ui.js` に存在する
- FOUND: commit `d2fc038`（`git log --oneline --all` で確認）
- FOUND: commit `2e6626a`（`git log --oneline --all` で確認）
- FOUND: commit `2f50572`（`git log --oneline --all` で確認）
- FOUND: commit `395c6dd`（`git log --oneline --all` で確認）
