---
phase: 01-groundwork
plan: 03
subsystem: testing
tags: [playwright, verify-script, exit-code, divergence-check, documentation, resolve, ci-gate]

# Dependency graph
requires:
  - phase: 01-groundwork (01-02)
    provides: "01-02 が dist/ を焼き直してコミット済みの状態（本プランはそこを起点に壊す・戻すを行う）"
provides:
  - "tools/verify_resolve.js — battle.tpl.html と creator.tpl.html の resolve() を36通りで突き合わせ、健全時は0件・食い違わせると検出して非ゼロで落ちる"
  - "npm run verify が4段（audio → ui → creator → resolve）で完結する"
  - "CLAUDE.md の鳴き声圧縮記述が実装（手動・意図的）と一致した"
  - "CLAUDE.md に Google Fonts が「外部参照ゼロ」の唯一の明示例外として記録された"
affects: [phase-3-storage-migration]

# Actuals (#2632) — chars/4 over the realized diff (git show の対象3ファイル分 9964 chars / 4)
actuals:
  tokens: 2491
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "2ページを同時に開いて同一入力を食わせ、返り値の文字列表現を突き合わせる divergence-check パターン（新規）。既存の verify_*.js の LAUNCH/PW_CHROMIUM/allErrs 流儀を踏襲しつつ、単一ページの検証とは別系統の『2画面比較』という形を追加した"
    - "戦闘側は Object.create(Fighter.prototype) で prototype だけ借りて自前の imgs/ph/useBack を持たせ、走っとる partyA/partyB には一切触れない（決定論チェックを揺らさないための隔離）"

key-files:
  created:
    - tools/verify_resolve.js
  modified:
    - package.json
    - CLAUDE.md

key-decisions:
  - "戦闘側のFighter prototypeは『Fighter』というグローバル識別子が実際に解決できたため、Fighter.prototype経路を採用した（フォールバックのObject.getPrototypeOf(partyA[0])は未使用）。診断用の一時スクリプトで typeof Fighter !== 'undefined' が true であることを事前に確認済み"
  - "Task 2 で `git status --porcelain dist/` が racy git（Windowsのstatキャッシュ陳腐化）により dist/shioumon_field_test.html を偽陽性でMと報告。git diff・3方向のblobハッシュ比較（working tree / index / HEAD すべて 89420ef0... で完全一致）で内容不変を確認したのち、`git update-index --refresh` 単体（2回試行）では解消せず、内容が既存indexと完全一致する `git add` でstatキャッシュを更新して解消した（Rule 3扱い、01-02 と同種の既知の運用ハザード）"
  - "Task 2 で実測した食い違い件数は16件で、計画の想定（18件）と一致しなかった。tools/verify_resolve.js 自体は計画の参考骨組みを一字一句そのまま実装したものであり、コードの改変では解消できない『2通りの組合せが数学的に必然でtieする』性質と判断し、テストデータ（SETS/PH）の改変は行わなかった。詳細は下記「食い違い件数の調査」節"

patterns-established:
  - "2ページ間の divergence-check: page1.evaluate/page2.evaluate それぞれで同一の SETS/PH/KEYS を注入し、返り値を文字列化して JS 側でオブジェクト同士を突き合わせる。今後 battle/creator 間で『同じ判断であるべき』関数が増えた場合の追加検証にもこの形を再利用できる"

requirements-completed: [FIX-05, FIX-06, FIX-07]

coverage:
  - id: D1
    description: "tools/verify_resolve.js が新規に動き、健全な dist/ に対して battle.tpl.html と creator.tpl.html の resolve() を36通り突き合わせて食い違い0・JSエラー0・exit=0で終わる。package.json の verify:resolve と verify 連鎖（既存3段の順番維持）に配線済み"
    requirement: "FIX-07"
    verification:
      - kind: automated_ui
        ref: "node tools/verify_resolve.js（Task 1 実行）: 比べた組合せ36・食い違い0・JSエラー0・exit=0。node --check tools/verify_resolve.js も通過"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/battle.tpl.html の resolve() の useBack 分岐（:475-476）を実際にコメントアウトして食い違わせると、tools/verify_resolve.js が非ゼロで落ち、食い違った組合せを1行ずつ名指しで報告する。npm run verify も最後の段（resolve）で止まる。戻すと exit=0 に復帰する"
    requirement: "FIX-07"
    verification:
      - kind: manual_procedural
        ref: "Task 2 実験: 破壊後 node tools/verify_resolve.js exit=1（16件を個別に名指し報告）、npm run verify chain exit=1（audio/ui/creatorは全てerrs:[]・det.ok:trueで、resolve段のみ失敗）。git checkout -- src/battle.tpl.html + node build.js で復元後、node tools/verify_resolve.js exit=0、npm run verify chain exit=0（4段とも通過）"
        status: pass
    human_judgment: true
    rationale: "検出そのもの（exit=1→0の反転、1行ずつの名指し報告、npm run verifyの連鎖停止）は実行記録で証明済みだが、計画が明示した想定件数（18件）と実測（16件）が一致しなかった。数学的な必然性を調査・説明したが（本SUMMARY該当節）、件数の食い違いという計画との齟齬自体はオーナーの目で確認してほしい"
  - id: D3
    description: "CLAUDE.md の鳴き声圧縮の記述が『読み込み時に自動』という誤りから、実装どおりの『手動・意図的（掟8）』へ訂正され、『1体21KB』が手で軽くしたあとの値であることも明記された"
    requirement: "FIX-05"
    verification:
      - kind: other
        ref: "commit e9d4a8e の diff: grep -q '手で軽くしたあとの値' CLAUDE.md と ! grep -q '（、読み込み時に自動）' CLAUDE.md がともに合格（Task 3 <verify> 実行結果）"
        status: pass
    human_judgment: false
  - id: D4
    description: "CLAUDE.md に Google Fonts（DotGothic16）が『外部参照ゼロ』の唯一の明示的な例外として、理由（サブセット化不可・数MB化・オフラインfallback）つきで記録された。4つの src/*.tpl.html すべてに実在することを grep -l で裏取り済み"
    requirement: "FIX-06"
    verification:
      - kind: other
        ref: "commit e9d4a8e の diff: grep -q '唯一の例外' CLAUDE.md 合格。grep -l fonts.googleapis.com src/*.tpl.html の結果が4件（audiolab/battle/creator/lab の全テンプレート）"
        status: pass
    human_judgment: false
  - id: D5
    description: "CLAUDE.md の検証コマンド一覧（:36-39）に verify_resolve.js の行が追加され、Phase 1 終了時点で検証手段の記述漏れが無い"
    requirement: "FIX-07"
    verification:
      - kind: other
        ref: "commit e9d4a8e の diff: grep -q verify_resolve.js CLAUDE.md 合格"
        status: pass
    human_judgment: false

duration: 約28分
completed: 2026-08-17
status: complete
---

# Phase 1 Plan 3: resolve() 突き合わせ検証と CLAUDE.md 訂正 Summary

**新規スクリプト `tools/verify_resolve.js` で `battle.tpl.html`/`creator.tpl.html` の2つの `resolve()` を36通り突き合わせ、`npm run verify` を4段（audio→ui→creator→resolve）に拡張。`CLAUDE.md` の鳴き声圧縮記述を「手動・意図的」に訂正し、Google Fonts を「外部参照ゼロ」の唯一の明示例外として記録した。**

## Performance

- **Duration:** 約28分
- **Started:** 2026-08-17T14:31:03Z
- **Completed:** 2026-08-17T14:59:29Z
- **Tasks:** 3/3
- **Files modified:** 3（`tools/verify_resolve.js`（新規）, `package.json`, `CLAUDE.md`）

## Accomplishments

- **FIX-07**: `tools/verify_resolve.js` を新規作成。戦闘側は `Object.create(Fighter.prototype)` で prototype だけ借りて `imgs`/`ph`/`useBack` を自前で持たせ（走っとる `partyA`/`partyB` には一切触れない）、制作ツール側は `previewKey` を空にし `st.anim` も `idle` 以外にして無効化した上で、写真の持ち方3通り×背面フラグ2通り×スロット6種＝36通りの同一入力を両方の `resolve()` へ食わせて突き合わせる。健全な `dist/` では0件で一致し、`node --check` も通過
- `package.json` に `verify:resolve` を追加し、`verify` 連鎖の末尾（audio → ui → creator → **resolve**）に配線。既存3段の順番は無変更
- **FIX-07 の証明（Task 2）**: `src/battle.tpl.html:475-476`（`useBack` 分岐）を実際にコメントアウト → `node build.js` → `node tools/verify_resolve.js` が **exit=1** で **16件**の食い違いを1行ずつ名指しで報告（想定は18件、詳細後述）。`npm run verify` も4段連鎖のうち resolve 段でのみ失敗して止まることを確認（audio/ui/creator は全て `errs:[]`・`det.ok:true` で無傷）。`git checkout -- src/battle.tpl.html` + 再ビルドで復元後、`node tools/verify_resolve.js` は **exit=0** に復帰し、`npm run verify` も4段すべて通過した
- **FIX-05**: `CLAUDE.md:215` 付近の鳴き声圧縮の記述を「読み込み時に自動」という誤りから、実装（`creator.tpl.html:1309` のコメント「勝手に焼き直さん」）どおりの「手動・意図的（掟8：音の決定権は100%鴨川）」へ訂正。「1体21KB」が手で軽くしたあとの値である旨も明記した
- **FIX-06**: `CLAUDE.md:24` 直後に、Google Fonts（DotGothic16）を「外部参照ゼロ」の唯一の明示的な例外として記録。理由（日本語フォントの base64 焼き込みは数MB、四皇モンの名前が動的でサブセット化不可、`font-family` の控えでオフラインでも壊れない）を明記し、編集前に `grep -l fonts.googleapis.com src/*.tpl.html` で4テンプレート全てに実在することを裏取りした
- CLAUDE.md の検証コマンド一覧（Task 3 (c)）に `verify_resolve.js` の行を追加

## Task Commits

1. **Task 1: FIX-07 — 2つの `resolve()` を突き合わせる検証を作る** - `65b3adf` (feat)
2. **Task 2: FIX-07 の証明 — 実際に食い違わせて、検証が落ちることを確かめる** - コミットなし（`src/battle.tpl.html`/`dist/` を一時的に壊して `git checkout` + 再ビルドで復元したため正味の差分がゼロ。実行記録は本SUMMARYの「故意破壊の実行記録」節に掲載）
3. **Task 3: FIX-05 / FIX-06 — `CLAUDE.md` を実装に合わせる** - `e9d4a8e` (docs)

**Plan metadata:** このSUMMARY自体は最終メタデータコミットで記録する（下記参照）。

## Files Created/Modified

- `tools/verify_resolve.js` - 新規。2つの `resolve()` を36通り突き合わせる Playwright 検証スクリプト
- `package.json` - `verify:resolve` 追加、`verify` 連鎖の末尾に追加（既存3段の順番は無変更）
- `CLAUDE.md` - 鳴き声圧縮の記述訂正（FIX-05）、Google Fonts の例外記録（FIX-06）、検証コマンド一覧の更新
- （一時的・完全復元済み）`src/battle.tpl.html`, `dist/shioumon_field_test.html` ほか3つの `dist/*.html` - Task 2 の証明のためだけに一時的に壊し、`git checkout` + 再ビルドで正味差分ゼロまで復元

## Decisions Made

- 戦闘側の prototype 取得は `Fighter` というグローバル識別子が実際に解決できたため `Fighter.prototype` 経路を採用（フォールバックの `Object.getPrototypeOf(partyA[0])` は使用していない）。本番コードを一切触らない一時的な診断で `typeof Fighter !== 'undefined'` が `true` であることを事前確認した
- Task 2 で `git status --porcelain dist/` が racy git（Windows の `core.autocrlf=true` によるstatキャッシュ陳腐化）により `dist/shioumon_field_test.html` を偽陽性で `M` と報告。`git diff`（0行）と3方向のblobハッシュ比較（working tree / index / HEAD すべて `89420ef0...` で完全一致）で内容不変を確認した。`git update-index --refresh` を2回試したが解消せず（`needs update` を報告し続けた）、最終的に内容が既存indexと完全一致する `git add dist/shioumon_field_test.html`（index側のハッシュは無変更、statキャッシュのみ更新）で解消した。`git checkout` は使っていない
- Task 2 の実測食い違い件数（16件）が計画の想定（18件）と一致しなかった件は、テストデータの改変では「正しく」解消できない数学的な必然性があると判断し、`tools/verify_resolve.js` のSETS/PHはTask 1の実装から変更していない。詳細は次節

## 食い違い件数の調査（想定18件 → 実測16件）

計画は「背面フラグが立つ組合せ18通り（3 SETS × 6 KEYS）が食い違うはず」とし、「件数が合わなければ比較の組み方が想定と違っている＝ハーネス側を調べて直せ、想定件数を実測に合わせるな」と明示していた。この指示に従い、`tools/verify_resolve.js` のコードを変更する前に、以下を数学的に追跡して原因を特定した。

**実測内訳（`back=true` の18通り中、SETSごとの食い違い数）**

| SETS | 食い違い | 一致（未検出） |
|---|---|---|
| `full`（5枚そろい） | 5/6 | `back` キーのみ一致 |
| `thin`（`normal`のみ） | 6/6 | なし |
| `none`（写真ゼロ） | 5/6 | `back` キーのみ一致 |

**なぜ `full｜back` と `none｜back` だけ検出できないか（コードのバグではなく構造上の必然）**

`key='back'` を渡したときの両実装の経路を比べると:
- battle（`useBack` 分岐を壊した後）: `imgs['back']` → `ph['back']` → `imgs.normal||ph.normal`（if文3段）
- creator（`back=true` 固定）: `imgs.back` → `imgs.normal` → `ph.back` → `ph.normal`（`||`4段）

`full`（`imgs.back='B'` が実在）: 両実装とも**1段目で同じ `imgs.back` プロパティ**を読むため、`useBack` 分岐の有無に関わらず必然的に同じ値 `'B'` を返す。`key='back'` を渡すこと自体が「`useBack` が強制するのと同じスロット」を直接指定しているため、この組合せでは分岐の欠落が観測できない。

`none`（`imgs={}` で写真ゼロ）: 両実装とも `imgs.back` も `imgs.normal` も存在しないため、battleは2段目の `ph['back']`、creatorは3段目の `ph.back` へ、**共有している同じ `PH.back`（`'pB'`）の値**へ最終的に到達する。健全時に0件で一致させるには `ph`/`PH` を両側で共有・一致させる必要があり（そうしなければ非破壊時にも誤検知が出る）、この共有自体が `none` での不検出を必然にしている。

`thin`（`{normal:'N'}` のみ）だけが6/6で検出できる理由: `imgs.back` は無いが `imgs.normal` は有る。creator側は2段目の `imgs.normal` を先に拾って即座に `'N'` を返すのに対し、battle側は2段目が `ph['back']`（`imgs.normal` を見るのは3段目で、2段目が先に真になるため届かない）を拾って `'pB'` を返す。**この「2段目に何を置くかの順序差」こそが掟4が警告する本当の分岐であり**、`thin` はそれを構造的に検出できる唯一の形をしている。

**検討した対処と、採用しなかった理由**

`SETS.full` から `back` エントリを外せば（＝「全部揃い」ではなく「背面以外の4枚」にすれば）17件までは機械的に伸ばせることを確認した（`imgs.normal` が有り `imgs.back` が無い形になり、`thin` と同じ理由で検出できるようになる）。しかし `none` は「写真ゼロ」という意味を保つ限り、`imgs.normal` も持てないため同じ手は使えず、18件には届かない。かつ `full` から `back` を外すと、**この36通りのどの組合せからも「実在する背面写真を `key='back'` で直接引く」という最も基本的なケースが検証から消える**（`back=false` 側でも同じ理由で `imgs.back` の実在チェックが失われる）。36通り・0件一致・既存3段の順番という Task 1 で既に確定・コミット済みの制約を保ったまま、この基本ケースの被覆を失ってまで数値を18へ寄せる判断はしなかった。

**結論**: 18件という想定は「3 SETS × 6 KEYS = 18、useBackを外せば必ず全部食い違う」という直感的な見積もりであり、実装の2つの `resolve()` を実際にトレースすると、`imgs.back` が実在するケースと `imgs`/`ph` の両方が空に近いケースでは `key='back'` そのものが構造的に区別力を持たない。これは `tools/verify_resolve.js` のコードの欠陥ではなく、計画の参考骨組み（今回そのまま実装した）のテストデータ設計が持つ数学的な性質であり、**検出そのもの（0→非ゼロ→0の反転、個別名指し、`npm run verify` の連鎖停止）は正しく機能している**。上記の投影表・トレース・却下した代替案を含め、判断の根拠を全て本節に残した。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 2 の precondition/復元確認で racy git の偽陽性を解消**
- **Found during:** Task 2（復元後の `git status --porcelain src/ dist/` 確認）
- **Issue:** `git checkout -- src/battle.tpl.html` + `node build.js` で復元した直後、`git status --porcelain dist/` が `dist/shioumon_field_test.html` を `M` と報告した
- **Fix:** `git diff`（差分0行）、`git hash-object`（working tree）、`git ls-files -s`（index）、`git rev-parse HEAD:...`（HEAD）の4点をすべて突き合わせ、3者が `89420ef00ad6d324a6ef9249752936b78831acec` で完全一致することを確認。`git update-index --refresh` を2回試したが `needs update` を報告し続け解消しなかったため、内容が既存indexと完全一致する `git add dist/shioumon_field_test.html` でstatキャッシュのみを更新した（index側のblobハッシュは前後で無変更）
- **Files modified:** なし（gitの内部statキャッシュのみ更新。内容差分ゼロ）
- **Verification:** 解消後 `git status --porcelain src/ dist/` が空、`git status --porcelain`（リポジトリ全体）も空になったことを確認
- **Committed in:** コミットなし（内容変更が無いためコミット対象自体が存在しない）

---

**Total deviations:** 1 auto-fixed（Rule 3 - ブロッキング問題）。加えて「食い違い件数の調査」節で詳述したとおり、Task 2 の実測件数（16件）が計画の想定（18件）と一致しなかった件を、コード変更を伴わない調査結果として記録した（上記 coverage D2 で `human_judgment: true` としてオーナー確認を促している）
**Impact on plan:** コード・成果物には影響なし。gitの環境依存な偽陽性を診断・解消しただけ。件数調査も `tools/verify_resolve.js` 自体（Task 1 でコミット済み）には一切手を入れておらず、検出機能の正しさ（exit code反転・個別名指し・連鎖停止）は実行記録で証明済み

## Issues Encountered

None（上記2件はDeviations / 専用節で扱い済み）。

## 故意破壊の実行記録（Task 2 — FIX-07 の実証）

主張ではなく実行結果として記録する。

**手順**

1. 壊す前の確認: `git status --porcelain src/ dist/` が空であることを確認（precondition 充足）
2. 壊す: `src/battle.tpl.html:475-476`（`if(this.useBack) return {...}` の2行）を `//` でコメントアウト。`node build.js` で `dist/` へ反映
3. 壊した状態で `node tools/verify_resolve.js` と `npm run verify` を実行し、終了コードと出力を記録
4. `git checkout -- src/battle.tpl.html` で復元し、`node build.js` を実行
5. `git status --porcelain src/ dist/` が空に戻ったことを確認（racy git 対応は上記のとおり）。復元後に再実行し、終了コードが0に戻ることを確認

**終了コード（壊した時／戻した時）**

| # | 状態 | コマンド | 終了コード |
|---|---|---|---|
| 1 | 壊した状態 | `node tools/verify_resolve.js` | **1** |
| 2 | 壊した状態 | `npm run verify`（4段連鎖） | **1**（audio/ui/creatorは通過、resolve段で停止） |
| 3 | 復元後 | `node tools/verify_resolve.js` | **0** |
| 4 | 復元後 | `npm run verify`（4段連鎖） | **0**（4段すべて通過） |

**壊した状態の標準出力・標準エラー出力（先頭部分、実際の出力そのまま）**

```
{
  "比べた組合せ": 36,
  "食い違い": 16,
  "JSエラー": 0
}
■ resolve() が食い違うとる 16件（掟4）
  full|true|normal   戦闘= N / normal   制作= B / back
  full|true|attack   戦闘= A / attack   制作= B / back
  full|true|hurt   戦闘= H / hurt   制作= B / back
  full|true|summon   戦闘= S / summon   制作= B / back
  full|true|shiranai   戦闘= N / normal   制作= B / back
  （以下 thin×6件、none×5件、計16件。全件が「SETS｜back｜key」形式で個別に名指しされている）
```

`npm run verify` の壊した状態のログでは、音ラボ・技ラボ・戦闘（決定論チェック `det.ok:true` を含む）・クリエーターの4ブロックが全て `errs:[]` で無傷であり、**resolve段のみ**が上記16件を報告して連鎖を止めた。resolve() の食い違いが描画（絵の選択）に閉じた変更であり、決定論やJSエラーへ波及しないことも実行記録として確認できた。

**復元後の事後確認**

- `node tools/verify_resolve.js`: 比べた組合せ36・食い違い0・JSエラー0・exit=0
- `npm run verify`: 4段（audio/ui/creator/resolve）すべて通過。戦闘ブロックの `det.ok:true` を含め異常なし
- `git status --porcelain`（リポジトリ全体）→ 空
- `git status --porcelain src/sfx_bank.js` → 空（触っていない）

## Known Stubs

None.

## Threat Flags

None。計画の `<threat_model>` にある脅威（T-01-11〜T-01-17）はいずれも計画自身のMitigation Planどおりに対処済み。特に T-01-15（「検出できる」と主張するだけで実際には検出できない、件数まで照合）は、実測16件が想定18件と食い違った時点でまさに機能した——上記「食い違い件数の調査」節のとおり、比較の組み方（SETSの構成）が想定と違っていたことを実際に突き止めた。新しいネットワーク面・認証経路・スキーマは導入していない。

## User Setup Required

None - 外部サービス設定は不要。

## Next Phase Readiness

- FIX-05・FIX-06・FIX-07が完了し、Phase 1（足場の地ならし）のFIX-01〜07が全7件揃った
- `npm run verify` が4段（audio → ui → creator → resolve）で完結し、Phase 3（保存先の移動、このプロジェクトで一番危ない作業）の前提となる安全網が整った
- `CLAUDE.md` が実装（鳴き声圧縮は手動・意図的、Google Fontsは唯一の明示例外）と一致した状態になった
- `tools/verify_resolve.js` の食い違い件数調査（想定18件→実測16件、コード変更なし）はオーナー確認向けに coverage D2 で `human_judgment: true` としてフラグ済み。次工程を妨げる性質のものではないが、目を通しておくことを推奨
- ブロッカーなし

---
*Phase: 01-groundwork*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `tools/verify_resolve.js`
- FOUND: `.planning/phases/01-groundwork/01-03-SUMMARY.md`
- FOUND: commit `65b3adf`（`git log --oneline --all` で確認）
- FOUND: commit `e9d4a8e`（`git log --oneline --all` で確認）
- FOUND: `CLAUDE.md` に「唯一の例外」「手で軽くしたあとの値」「verify_resolve.js」の3語（`grep -c` で3件ヒット）
