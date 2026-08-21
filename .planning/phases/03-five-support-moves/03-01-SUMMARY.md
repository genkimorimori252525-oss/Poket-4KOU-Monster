---
phase: 03-five-support-moves
plan: 01
subsystem: battle-ai
tags: [battle-ai, support-moves, buffs, scoring, verify_support, gate-only]

requires:
  - phase: 02.1-support-moves
    provides: "statOf/isSupportMove/applySupportEffect/buffValue（補助の仕組み本体）と tools/verify_support.js の土台"
provides:
  - "りゅうのまい・どくどく・うずしお の3本が data/moves/library.json の battle 側で kind:'support'/effect/power:0 になり、fx（専用generator）は1バイトも変わっとらん"
  - "tools/verify_support.js 末尾に「段1 棚の補助技(構造)」「段2 補助の値打ち(較正実測表)」「段3 実効と名目の食い違い」「実走行(発動を数える・記録のみ)」の4ブロックを追加。本数・名前を決め打ちせず kind:'support' を拾うけん、Plan 02 が2本足したらそのまま5本を見る"
  - "実走行ブロックは発動回数を根拠にした ok(...) を1つも持たん（03-PLAN-CHECK.md B2の是正）。合否は 03-03-PLAN.md Task 1 に一本化"
affects: [03-02-two-new-support-moves, 03-03-cost-and-gate]

actuals:
  tokens: 3959
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "verify_support.js が data/moves/library.json を直に読んで kind:'support' を件数・名前を決め打ちせず拾い、実行時の平らなオブジェクトへ詰め替えてから MOVES[id] へ登録する（棚の入れ子形 → 平らな実行時形、という02.1確立済みの変換をゲート側でも再現）"
    - "実走行の合否判定を意図的に持たないゲート（記録専用ブロック）と、配線の正しさだけを条件付きで見るassert（撃たれたときだけ判定を持つ・真空で真）の2層を分離する。回数ベースの合否は別プラン（03-03）へ一本化し、判断を1箇所に寄せる"
    - "effDelta の恒等関数へのモンキーパッチ（02.1 R2チェックと同じ手口）を、較正シナリオが天井の外にあることの直接証明として段2に再利用"

key-files:
  created: []
  modified:
    - data/moves/library.json
    - tools/verify_support.js
    - dist/shioumon_creator.html

key-decisions:
  - "実走行ブロックは f=partyA[0]/foe=partyB[0] を使う（scoreMove較正の f=enemy/foe=ally とは別の対）。プラン記載どおりに実装した。TACTIC_BIASの影響は実走行（60×90フレームの通し）では無視できる規模と判断——単発scoreMove比較ではないため"
  - "うずしおの配線検査は『撃った瞬間に相手の反動が縮む』を期待せず、(a) foe.buffs.spdが立つ（delta負・until未来）(b) statOf(foe,'spd')が素の値より小さい、の2点に限定した。f.cd確定タイミングの都合で前者をassertすると必ず落ちる（03-CONTEXT.mdの明記どおり）"
  - "段2の4 assertは『実際に落ちうる』ものだけに絞った（03-PLAN-CHECK.md W2の是正を踏襲）。scoreMove(補助)>scoreHold の比較は較正シナリオでは空振り（HOLD_W.baseのみでtotal≈-34固定）になるため、当初案どおり不採用のままにした"
  - "『灼熱弾に総合点で勝つこと』はassertしない。spd/eva/defはatkの6〜7割しか換算率が無く（02.1-PLAN-CHECK.md:76-84）、勝敗をassertするとにーくらが決めた5本の設計を機械の都合で潰すことになる（03-01-PLAN.md <numbers> の明記どおり）"

patterns-established:
  - "本数を決め打ちしない恒久ゲート（Plan 03 が5本へ増やしても無改修で追随する形）を、data直読み＋Object.values(...).filter(kind==='support')という1パターンに統一した"

requirements-completed: [MOVE-01, MOVE-02, VER-01, VER-02, VER-03]

coverage:
  - id: D1
    description: "りゅうのまい・どくどく・うずしお の3本が kind:'support'/effect:{stat,delta,dur,target}/power:0 を持ち、fx（専用generator: dragon_dance_move/toxic_move/whirlpool_move）は無変更のまま棚に載った"
    requirement: MOVE-01
    verification:
      - kind: e2e
        ref: "tools/verify_support.js（段1「棚の補助技(構造)」・node -e での直接JSON検算）"
        status: pass
      - kind: other
        ref: "node tools/check_untouched.js（src/sfx_bank.js 不可触の確認）／node tools/verify_rebuilt_moves.js（39専用generatorの非流用検査、3本とも回帰なし）"
        status: pass
    human_judgment: false
  - id: D2
    description: "3本とも |effect.delta|×effect.dur ≥ 270（名目値）を満たし、段1のstat/target/delta/dur/power/generatorの構造検査を通る。本数は>=で見て技名は決め打ちしとらん"
    requirement: MOVE-02
    verification:
      - kind: e2e
        ref: "tools/verify_support.js（段1、|delta|×dur assert：352/360/360件とも270以上）"
        status: pass
    human_judgment: false
  - id: D3
    description: "段2「補助の値打ち(較正実測表)」が window.__pin の全50較正シナリオで buffValue と scoreMove().total を実測し、灼熱弾の総合点と並べて表に出す。符号・内訳（補助の値打ち項あり/期待ダメージ項なし）・target反転・effDelta恒等化の4点を実際に落ちうる形でassert"
    requirement: VER-01
    verification:
      - kind: e2e
        ref: "tools/verify_support.js（段2、4assert×3技=12件、全pass）"
        status: pass
    human_judgment: false
  - id: D4
    description: "段3「実効と名目の食い違い」が素のロスターでの effDelta(statOf(対象,stat),delta) を名目deltaと並べて記録専用（assertなし）で出す。パルキアatk92へのりゅうのまい効果が実効+8になることがログ上に見える"
    requirement: VER-01
    verification:
      - kind: e2e
        ref: "tools/verify_support.js（段3、標準出力のログ確認：りゅうのまい 名目22→実効8）"
        status: pass
    human_judgment: false
  - id: D5
    description: "実走行ブロックが較正2シード(31337/90210)＋既定ロスターの3列で発動回数を記録するが、発動回数を根拠にしたok(...)は1つも持たない（B2の是正）。りゅうのまいの配線（f.buffs.atk）とうずしおの配線（foe.buffs.spd＋statOf低下）だけは無条件/条件付きでassertする"
    requirement: VER-02
    verification:
      - kind: e2e
        ref: "tools/verify_support.js（実走行ブロック：全run 0回無し・wiringOk=true、うずしお専用チェックpass）"
        status: pass
      - kind: other
        ref: "node build.js && node build.js --dev && node tools/verify_style.js && node tools/verify_signature_moves.js && node tools/verify_movelist.js && node tools/verify_learnable.js && node tools/verify_support.js && node tools/verify_creator.js（workflow.test_command 8段）"
        status: pass
    human_judgment: false
  - id: D6
    description: "src/sfx_bank.js が HEAD と1バイトも変わっとらん（不可触の掟）"
    requirement: VER-03
    verification:
      - kind: other
        ref: "node tools/check_untouched.js"
        status: pass
    human_judgment: false

duration: 約25min（コミット間隔は9min。読み込み～Task1着手までの時間は開始時刻を記録し損ねたため概算）
completed: 2026-08-21
status: complete
---

# Phase 3 Plan 01: 補助技3本を棚に載せ、測る仕掛けだけを作る Summary

**りゅうのまい・どくどく・うずしお の3本を `kind:'support'` として棚へ乗せ（新しい絵は1枚も作らず）、`tools/verify_support.js` に「棚の補助技(構造)」「補助の値打ち(較正実測表)」「実効と名目の食い違い」「実走行(発動を数える・記録のみ)」の4段を追加した。実走行ブロックは発動回数を根拠にした合否を1つも持たず（03-PLAN-CHECK.md B2の是正）、回数の合否は `03-03-PLAN.md` Task 1 に一本化した。**

## Performance

- **Duration:** 約25min（Task 1〜3のコミット間隔は9min。読み込みフェーズを含めた総時間は開始時刻の記録漏れにより概算）
- **Started:** 記録漏れ（下記「NGSD自己採点」参照）
- **Completed:** 2026-08-21T12:59:03Z（UTC）
- **Tasks:** 3/3
- **Files modified:** 3（`data/moves/library.json`, `tools/verify_support.js`, `dist/shioumon_creator.html`。`dist-dev/*` はgitignore対象のためコミット対象外）

## Accomplishments
- `data/moves/library.json` の りゅうのまい／どくどく／うずしお の `battle` を書き換え：`power:0`、`kind:'support'`、`effect:{stat,delta,dur,target}` を追加。`type`/`range`/`tags`/`fx` は無変更（`fx.generator` は `dragon_dance_move`/`toxic_move`/`whirlpool_move` のまま——専用generatorは既に02.1以前のCodex作り直しで存在しており、このプランは1つも新しい絵を作っていない）
- `tools/verify_support.js` 末尾に4ブロックを追加：
  - **段1「棚の補助技(構造)」**: `kind:'support'` レコードを本数・名前を決め打ちせず拾い、`effect.stat`(atk/def/eva/spd)、`effect.target`(self/foe)、`effect.delta`(-25〜25)、`effect.dur`(3〜20)、`battle.power===0`、`|delta|×dur≥270`（名目値）、`fx.generator`が汎用6種でないこと、を検査
  - **段2「補助の値打ち(較正実測表)」**: `window.__pin(f,foe)` の全50較正シナリオで `buffValue` と `scoreMove().total` を実測し、参照（灼熱弾）と並べて表に出す。4つのassert（符号／「補助の値打ち」項が出て「期待ダメージ」項が出ん／target反転版が負／effDeltaを恒等関数へ差し替えても値が同じ）
  - **段3「実効と名目の食い違い」**: 素のロスターでの `effDelta(statOf(対象,stat),delta)` を名目deltaと並べて記録専用で出す（assertなし）
  - **実走行(発動を数える・記録のみ)**: `f=partyA[0]`/`foe=partyB[0]`、較正2シード(31337/90210)＋既定ロスターの3列で `applySupportEffect` の呼び出し回数を60×90フレーム回して記録。**発動回数を根拠にした `ok(...)` は1つも書いていない**（合否は `03-03-PLAN.md` Task 1 に一本化）。りゅうのまいは撃たれたときの `f.buffs.atk` 有無、うずしおは撃たれたときの `foe.buffs.spd`（delta負・until未来）と `statOf(foe,'spd')` 低下、を配線の正しさとして無条件/条件付きでassert
- 既存の検証チェーン（`workflow.test_command` の8段 + `verify_rebuilt_moves.js` + `check_untouched.js`）が全段green

## Task Commits

Each task was committed atomically:

1. **Task 1: りゅうのまい 1本だけを data → build → 戦闘 → ゲート へ通す（MOVE-01, MOVE-02, VER-01）** - `d4a2166` (feat)
2. **Task 2: どくどく・うずしお を同じ形で載せる（相手掛けと spd の注意つき）（MOVE-01, MOVE-02）** - `27cc6ac` (feat)
3. **Task 3: 構造検査と較正実測表 —— 名目で線を引き、実効は測って出す（MOVE-02, VER-01, VER-02）** - `76f3428` (test)

_Note: Task 1 は `type="tracer"`。コミット直後にそのTaskの `<verify>`（`node build.js && node build.js --dev && node tools/verify_support.js && node tools/check_untouched.js`）を再実行して通過を確認してから Task 2 へ進んだ（プランが `autonomous: true` のため、自動モードのフィードバックゲートとして扱った）。_

## Files Created/Modified
- `data/moves/library.json` - りゅうのまい／どくどく／うずしお の `battle` に `kind:'support'`/`effect`/`power:0` を追加（`fx` は無変更）
- `tools/verify_support.js` - 末尾に4ブロック（段1〜3＋実走行）を追加。新規ファイルは作っていない
- `dist/shioumon_creator.html` - `node build.js` の焼き直し（`STARTER_MOVES` 経由でのみ変化。`battle.tpl.html`（戦闘テスト画面）は `/*__STARTER__*/` トークンを持たないため今回のライブラリ変更では中身が変わらず、`dist/shioumon_field_test.html` は再ビルドしても差分なし——`STARTER_MOVES` はcreatorの棚UI専用で、`verify_support.js` は自分で `MOVES[id]` へ実行時登録するためこれで問題ない）

## Decisions Made

- **実走行の f/foe は `partyA[0]`/`partyB[0]` を使い、既存の scoreMove較正（`f=enemy`/`foe=ally`）とは別の対にした。** プランの指定どおり。60×90フレームの通し実行ではTACTIC_BIASの影響は無視できる規模と判断し、既存の較正ペアとは意図的に分離したまま実装した。
- **うずしおの配線検査は「撃った瞬間に相手の反動が縮む」を期待しない。** `f.cd[m.id]=m.cooldown*f.cdScale` が撃った瞬間に確定するため、代わりに `foe.buffs.spd` の存在（delta負・until未来）と `statOf(foe,'spd')` の低下の2点で「次に撃つときのcdScaleが重うなる」ことを示す形にした（03-CONTEXT.mdの明記どおり）。
- **段2のassertは4つに絞り、`scoreMove(補助)>scoreHold` の比較は不採用のまま。** 較正シナリオでは `scoreHold` に効く項が `HOLD_W.base` のみでtotal≈-34固定になり、`buffValue>0` が通った時点でほぼ自動的に真になる空振りのassertだった（03-PLAN-CHECK.md W2の指摘を踏襲）。
- **「灼熱弾に総合点で勝つこと」はassertしない。** `spd`/`eva`/`def` は `atk` の6〜7割しか換算率が無く、勝敗をassertするとにーくらが決めた5本の設計を機械の都合で潰すことになる。AIが実際に撃つかは `03-03-PLAN.md` の実走行ゲートで測る。

## Deviations from Plan

None - plan executed exactly as written. `<numbers>` 節の「着手時に実測して確かめること」の指示どおり、投影値と実測値を比較したところ、りゅうのまい 26.36/23.40（投影26.4/23.3）、どくどく 28.82/23.60（投影28.8/23.6）、うずしお 18.92/20.30（投影18.9/20.4）と、いずれも小数第1位レベルでほぼ一致した。灼熱弾の参照点も実測22.30（02.1較正の22.33とごく僅かな差、四捨五入経路の違いによるものと見られる）。投影が実測とズレた箇所は無く、実装を正としての補正は不要だった。

## Issues Encountered

- **`git status --short` は着手時・各コミット前とも一貫してクリーンだった**（03-CONTEXT.mdが警告していたCodexとの共有ツリー問題は今回は発生せず）。ただし `node tools/verify_movelist.js` / `node tools/verify_learnable.js` を複数回走らせたことで `tools/_movelist-shot.png` / `tools/_learnable-shot.png`（既にgit管理下のPlaywrightスクリーンショット）が更新され、コミット後に `git status --short` へ残っている。このプランの `files_modified` に含まれず、Codexの変更でもない自分自身の検証実行の副産物のため、コミットせずそのまま残した（次のセッションで気になるようなら `git checkout -- tools/_movelist-shot.png tools/_learnable-shot.png` で戻せる）。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `tools/verify_support.js` の4ブロックは本数・名前を決め打ちせず `kind:'support'` を拾う形にしてあるため、`03-02-PLAN.md`（すなかけ・斎藤尻隠れの新規2本）は `data/moves/library.json` にレコードを追加するだけで、このプランのゲートコードを1行も変更せずそのまま5本を見る形に広がる。
- `03-03-PLAN.md` Task 1 は、このプランが意図的に持たなかった「発動回数の合否（5本以上／2シードの少なくとも片方で1回以上）」を実装する番。実走行ブロックの3列（較正seed31337/90210・既定ロスター）は3本ともすべての run で1回以上発動しており（りゅうのまい5〜11回、どくどく3〜5回、うずしお7〜8回）、現時点で0回の技はない。
- `03-02`完了後、`03-03`は本プランが確立した段2（較正実測表）・段3（実効vs名目）のパターンをそのまま5本へ拡張できる（コード変更不要、データが増えれば表の行が増えるだけ）。

## NGSD自己採点（掟7）

- **課金加重コスト（主指標）**: `ngsd score` コマンドがこの実行環境（gsd-executorサブエージェント、独立ツールセット）のPATH上に存在せず、算出できなかった。**これは守れなかった規約として明記する。**
- **生トークン**: 同様の理由で正確な計測は取れていない。代替指標として、実際に変更したコンテンツの文字数ベースの見積り（`actuals.tokens: 3959`、= 段落先頭に記載の通りverify_support.jsの新規261行の差分文字数15351＋library.jsonの意味のある差分485バイトを4で割った値）を記録した。**注意**：`data/moves/library.json` と `dist/shioumon_creator.html` は1行67KB/1MBのminified/焼き込みファイルのため、素朴な `git diff` の文字数はファイル全体が置き換わったように見えてしまう（実際に変わったのは各レコード数十〜数百バイトのみ）。このため `actuals.tokens` は生の `git diff` 文字数ではなく、レコード単位で意味のある差分だけを数えた値を採用した——プロジェクトCLAUDE.md掟9「開発の根底はデバッグだ」と同じ精神で、貼るより測るを優先した。
- **守れなかった規約**: (1) 上記のNGSDスコア算出ツール不在。(2) `<step name="record_start_time">` を実行の一番最初で走らせ損ね、正確な所要時間を計測できなかった（コミット間隔9minは正確だが、読み込み〜Task1着手までの時間は概算）。
- **空振りしたゲート**: 無し。当初案にあった `scoreMove(補助)>scoreHold` の空振りassertは、Plan本文の時点（03-PLAN-CHECK.md W2）で既に不採用と決まっていたため、実装段階で新たに空振りを見つけて削る場面は発生しなかった。

## Self-Check: PASSED

- FOUND: data/moves/library.json
- FOUND: tools/verify_support.js
- FOUND: dist/shioumon_creator.html
- FOUND: commit d4a2166
- FOUND: commit 27cc6ac
- FOUND: commit 76f3428
- CONFIRMED: `node tools/verify_support.js` exit 0（段1・段2・段3・実走行の4ブロックがログに出る）
- CONFIRMED: `workflow.test_command` の8段 + `verify_rebuilt_moves.js` + `check_untouched.js` が全部exit 0
- CONFIRMED: `data/moves/library.json` の `kind:'support'` レコード数 = 3（Nodeで直接カウント）

---
*Phase: 03-five-support-moves*
*Completed: 2026-08-21*
