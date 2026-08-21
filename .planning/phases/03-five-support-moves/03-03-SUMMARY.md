---
phase: 03-five-support-moves
plan: 03
subsystem: battle-ai
tags: [battle-ai, support-moves, verify_support, activation-gate, cost-calculator, regression-gate]

requires:
  - phase: 03-01
    provides: "kind:'support' 化された既存3本、tools/verify_support.js の段1〜3＋実走行の3列記録"
  - phase: 03-02
    provides: "すなかけ・斎藤尻隠れ の専用FX新造、補助技5本が4stat×self/foeを網羅"
provides:
  - "MOVE-01の網羅（件数>=5・4stat・self/foe両方）を段1で毎回機械assert（>=で見て名前を決め打ちしとらん）"
  - "MOVE-03（AIが実際に5本とも撃つ）を段4で毎回機械assert。5本とも較正2シード(31337/90210)の少なくとも片方で発動回数1以上。合否を持つのはこのフェーズでここだけ（03-PLAN-CHECK.md B2の設計どおり）"
  - "MOVE-05：src/cost.js の supportPart(ids) が補助技のeffectから等価威力を出し、CostCalculatorへ値段を付ける。攻撃技だけの個体のコストは1も動かん（tools/verify_cost.jsが基準値2406通りと完全一致で守る）"
  - "空振りしとった3本のゲート（verify_rebuilt_moves.js・verify_cost.js・check_untouched.js）が workflow.test_command に載り、11段が毎回自動で走る（VER-02, VER-03）"
affects: []

actuals:
  tokens: 4814
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "MOVE-01の網羅assertを「件数>=5」＋「Setで集めたstat/target集合が必須集合を包含するか」の2段構えにした。個別レコードのループとは別に、拾い終わったあとの集合演算で網羅性を見る形（技名を1つも決め打ちせん）"
    - "発動回数の合否を持つブロックを、この段（段4）だけに集約する設計を実装で踏襲。既存の段2/段3/実走行(記録専用)は無条件のまま、新規のok(...)は段4のfor-loopに1本だけ追加した"
    - "コストの式へ新種目（補助技）を足すとき、既存の movePart を書き換えるやのうて supportPart(ids) という別関数へ切り出し、movePart 側で加算する形にした。攻撃技だけの入力では supportPart が恒等的に0を返すけん、既存の基準値（tools/fixtures/cost-baseline.json）と衝突せんことが構造上保証される"
    - "Task着手前の事前チェック（手順0）で発見した、本プランの変更と無関係な既存のレッドは、直さずに実行者からオーケストレータ（にーくら）へエスカレーションする——この往復自体が本プランの実測記録として残る（下記「Task 2着手前の停止と解決の経緯」節）"

key-files:
  created: []
  modified:
    - tools/verify_support.js
    - src/cost.js
    - .planning/config.json

key-decisions:
  - "段1の件数assertを「>0」から「>=5」へ格上げし、effect.statの集合がatk/def/eva/spdの4つを、effect.targetの集合がself/foeの両方を包含するかを別assertとして追加した（プラン指示どおり、失敗時は今ある集合を出す）"
  - "段4「実走行(5本とも発動)」で発動回数を根拠にしたok(...)を初めて追加。5本とも較正2シード(31337/90210)の少なくとも片方で発動回数1以上をassert、3列目（既定ロスター）は記録のみで合否に使わない。全部が両シードとも1以上やったため、段上げの梯子（dur→20/|delta|→25）も降り口も発動しなかった——data/moves/library.jsonは1バイトも触っとらん"
  - "Task 2着手前の手順0（プラン明示指示）でnode tools/verify_cost.jsを走らせたところ、本プランの変更前から既に赤（2件の突き合わせ不一致）と判明。原因を追跡し、Phase 3着手前のcommit a544b64（Codexの技棚・個体データ移行）でBAZERGIUS/PALKIAの技配列が2本→3本へ増えたことによる、支援技のpower:0化とは無関係な既存の乖離と特定した。プランが明示的に禁じる「基準値を焼き直して通す」手を避け、「直さずに止めてにーくらへ報告する」の指示に従い、src/cost.jsに一切触れず、cost-baseline.jsonの焼き直しもせず、Task 2/3を一旦停止した——この判断はにーくらから直接「正しかった」と確認をもらった"
  - "にーくらの判断（BAZERGIUSは原型復元、PALKIAは変更を受け入れて基準値焼き直し、性質の違う2件を別々に扱う）で詰まりが解け、workflow.test_commandへverify_cost.jsが9段目として追加された状態でTask 2/3を再開した"
  - "supportPart(ids)はisSupportMove（src/moves.js）を呼んで判定し、kind==='support'を自前で書き直さない——判定が2か所に散るのが02.1が潰した事故の形。effect.delta/durはNumber.isFiniteで見て、+x||0が0を無い扱いする罠（02.1-02のnormalizeMonが踏んだのと同じ形）を避けた"
  - "workflow.test_commandへの追加は、既にある9段目（verify_cost.js、にーくら承認済み）に重複させず、残り2本（verify_rebuilt_moves.js・check_untouched.js）だけを末尾へ足した。追加後は必ずnode -eで読み直し、11段・model_overrides.gsd-planner=opus維持・他キー無傷を確認してから、読み直した文字列そのものを丸ごと1回実行した"

patterns-established:
  - "MOVE-01のような「網羅性」要件は、件数assertとは別にSet演算による集合包含assertを追加する形で表現する（今後も網羅系の要件が出たら同じ形を使える）"
  - "コストのような『既存の基準値を守りながら新種目を足す』式の変更は、新種目専用の関数を切り出し、既存の入力では恒等的に0を返す設計にすることで、基準値ゲートとの両立を構造上保証する"

requirements-completed: [MOVE-01, MOVE-03, MOVE-05, VER-01, VER-02, VER-03]

coverage:
  - id: D1
    description: "補助技5本すべてが、較正済みの実走行（2シード×90秒）で少なくとも片方のシードで1回以上発動することを、tools/verify_support.jsの段4が毎回機械的にassertする。AIが『撃つ』ことの証拠を初めて発動回数ベースの合否として持たせた（MOVE-03）"
    requirement: MOVE-03
    verification:
      - kind: e2e
        ref: "tools/verify_support.js（段4「実走行(5本とも発動)」。5本×2シードの発動回数を全数チェック）"
        status: pass
    human_judgment: false
  - id: D2
    description: "段1がMOVE-01の網羅性（件数>=5・4stat・self/foe両方）を機械assertするようになった"
    requirement: MOVE-01
    verification:
      - kind: e2e
        ref: "tools/verify_support.js（段1「棚の補助技(構造)」に続くMOVE-01網羅assert2件）"
        status: pass
    human_judgment: false
  - id: D3
    description: "src/cost.jsのsupportPart(ids)が補助技のeffectから等価威力を出し、CostCalculatorが5本とも0より大きい値段を付ける。攻撃技だけの個体のコストは基準値2406通りと完全一致のまま1も動かん（N5の申し送りが塞がった）"
    requirement: MOVE-05
    verification:
      - kind: e2e
        ref: "tools/verify_support.js（段5「値段」。5本とも costOf().mv>0、基準コストより高いことをassert）"
        status: pass
      - kind: integration
        ref: "node tools/verify_cost.js（2406通りの入力で基準値と完全一致・決定論ok）"
        status: pass
    human_judgment: false
  - id: D4
    description: "空振りしとった3本のゲート（verify_rebuilt_moves.js・verify_cost.js・check_untouched.js）が.planning/config.jsonのworkflow.test_commandへ載り、11段構成になった。読み直した文字列そのものを丸ごと1回実行してexit 0を確認"
    requirement: VER-02
    verification:
      - kind: integration
        ref: "workflow.test_commandの読み直した文字列を丸ごと実行（build/build --dev/verify_style/verify_signature_moves/verify_movelist/verify_learnable/verify_support/verify_creator/verify_cost/verify_rebuilt_moves/check_untouched、11段）"
        status: pass
    human_judgment: false

duration: 約70分（Task1〜停止まで約35分、にーくらの解決作業を挟んでTask2/3再開後〜完了まで約35分。停止期間そのものは含まず）
completed: 2026-08-21
status: complete
---

# Phase 3 Plan 03: 発動回数ゲートとコスト付け、恒久ゲート11段化 Summary

**補助技5本すべてが較正2シードの少なくとも片方で発動することを機械assertする恒久ゲート（MOVE-03）を追加し、CostCalculatorへ補助技の等価威力による値段付け（MOVE-05）を実装、空振りしとった3本のゲートをworkflow.test_commandへ載せて11段構成にした（VER-02, VER-03）。途中、本プラン外の既存レッド（`node tools/verify_cost.js`）を検出して一旦停止・にーくらへ報告し、にーくらの判断（保存個体BAZERGIUSの原型復元／PALKIAの変更承認＋基準値焼き直し）で解決してからTask 2/3を完遂した。**

## Performance

- **Duration:** 約70分（Task 1〜停止まで約35分、にーくらの解決を挟んでTask 2/3再開〜完了まで約35分）
- **Tasks:** 3/3（全完了）
- **Files modified:** 3（`tools/verify_support.js`, `src/cost.js`, `.planning/config.json`。加えて `dist/` 4ファイルの焼き直し）
- **Commits:** 5（`2cf4134` Task1 / `636c85d` 停止時点のSUMMARY / `4ef5972` にーくらによる解決＝コーディネータ側 / `f1e88cb` Task2 / `811210a` Task3。本SUMMARYの最終コミットで6件目）

## Accomplishments

- **段1をMOVE-01の網羅assertへ格上げ。** 件数を `>0` から `>=5` へ（`===5`にせん）。加えて `effect.stat` の集合が `atk`/`def`/`eva`/`spd` の4つを、`effect.target` の集合が `self`/`foe` の両方を包含するかをSet演算で確かめる2つのassertを新設。
- **段4「実走行(5本とも発動)」に発動回数を根拠にしたok(...)を初めて追加。** 5本とも較正2シード(31337/90210)の少なくとも片方で発動回数1以上をassert。実測：りゅうのまい 1/4、どくどく 3/2、うずしお 5/6、すなかけ 5/6、斎藤尻隠れ 5/1（全部余裕をもって基準を満たし、段上げの梯子も降り口も発動せず）。
- **Task 2着手前の手順0（プラン明示指示）で `node tools/verify_cost.js` の既存レッドを検出、原因を追跡（本プラン外・Phase 3着手前のCodexデータ移行が原因）した上で停止し、にーくらへ報告。** にーくらが調査結果の正しさを確認したうえで、保存個体BAZERGIUSの原型復元とPALKIAの変更承認＋基準値焼き直しで解決（詳細は下記）。
- **`src/cost.js` に `K.supportPivot`(270)/`K.supportRefPower`(26) と `supportPart(ids)` を追加。** `movePart` を「威力合計 + `supportPart(ids)`」を掛ける形へ組み替え。実測：5本とも変更前は `mv=0`（タダで通っとった）→ 変更後は `mv=4.07`（りゅうのまい）/`4.16`（どくどく）/`4.16`（うずしお）/`3.70`（すなかけ）/`4.07`（斎藤尻隠れ）、コストは全部 26→30（+4）。攻撃技だけの入力の答えは `node tools/verify_cost.js` の2406通りの突き合わせで0件相違を確認。
- **`tools/verify_support.js` に段5「値段」を追加。** 5本とも `costOf().mv>0`、技を持たん基準コストより高いことをassert。等価威力とコスト寄与の表をログへ出す。
- **`.planning/config.json` の `workflow.test_command` を9段（`verify_cost.js`込み・にーくら承認済み）から11段へ。** 残っとった `verify_rebuilt_moves.js`（掟3の非流用・41本の専用素材）と `check_untouched.js`（VER-03・`src/sfx_bank.js`不可触）を追加。重複追加はしていない。読み直した文字列そのものを丸ごと1回実行し、11段全部exit 0を確認。

## Task Commits

Each task was committed atomically:

1. **Task 1: AI が5本とも撃つことを実走行で数える（MOVE-01, MOVE-03, VER-01）** - `2cf4134` (test)
2. **Task 2: CostCalculatorが補助技に値段を付ける（N5の申し送りを塞ぐ）（MOVE-05）** - `f1e88cb` (feat)
3. **Task 3: 恒久ゲートへ載せる —— 空振りしとった残り2本を workflow.test_command へ（MOVE-05, VER-02, VER-03）** - `811210a` (chore)

_Note: Task 2着手前に本プラン外の既存レッドを検出して一旦停止し、`636c85d`（`status: halted`のSUMMARY）をコミットした。にーくらの解決作業（`4ef5972`、コーディネータ側のコミット）を挟んで、Task 2/3を再開・完了した。_

## Files Created/Modified

- `tools/verify_support.js` - 段1をMOVE-01網羅assertへ格上げ、段4「実走行(5本とも発動)」に発動回数ベースのok(...)を追加、段5「値段」を新設
- `src/cost.js` - `K.supportPivot`/`K.supportRefPower`を追加、`supportPart(ids)`を新設し`movePart`を組み替え
- `.planning/config.json` - `workflow.test_command`を9段から11段へ（`verify_rebuilt_moves.js`・`check_untouched.js`を追加）

## Decisions Made

- 段1の件数assertを `>=5` へ格上げし、stat/target集合の網羅性を別assertとして分離した（プラン指示どおり、将来6本目が増えても無改修で追随する）
- 段4で「較正2シードの少なくとも片方」を発動条件とし、3列目（既定ロスター）は記録専用のまま合否から明確に除外した
- Task 2着手前の `node tools/verify_cost.js` 事前チェックで既存レッドを発見した時点で、プランの明示指示（「直さずに止めてにーくらへ報告する」・NGSD掟4「測っとらん症状を真因にせん」）に厳密に従い、`src/cost.js` にも `.planning/config.json` にも一切触れずに停止した。基準値を焼き直して緑にする手はプランが明示的に禁じている——この判断はにーくらから「正しかった」と確認をもらった
- `supportPart(ids)` は `isSupportMove` を呼んで判定し、`kind==='support'` を自前で書き直さない。`effect.delta`/`dur` は `Number.isFinite` で見て `+x||0` の罠を避けた
- `workflow.test_command` への追加は、既に9段目にある `verify_cost.js`（にーくら承認済み）へ重複させず、残り2本だけを末尾へ足した

## Deviations from Plan

### Task 2着手前の停止と解決の経緯（Rule 4相当・にーくらの判断を仰いだ分岐点）

**このケースは通常の「Rule 1〜3の自動修正」ではなく、プラン自身が明示した「止めて報告する」手順に従った停止であり、Deviationというより計画された分岐点。にーくらの介入で解決し、Task 2/3を完遂した。**

**1. [プラン明示指示による一時停止 → にーくら判断で解消] `node tools/verify_cost.js` の既存レッドによりTask 2/3を一旦停止し、にーくらの判断を経て再開した**
- **見つかった場面:** Task 2 手順0（`src/cost.js` を触る前の必須事前チェック）
- **症状:** `node tools/verify_cost.js` が、本プランの変更を一切加える前の時点で既に赤（`突き合わせ 2406 通り中 2 件が相違`：`saved:BAZERGIUS 前=20 後=24` / `saved:PALKIA 前=26 後=28`）
- **原因の特定（貼るな、測れ・NGSD掟4）:**
  - `MOVES.shakunetsu.power`・`MOVES.beam.power`・`COST.K` の値はfixture生成時から無変更（`node -e` で直接確認）
  - `saved:BAZERGIUS`/`saved:PALKIA` の `stats` もfixtureと完全一致（`avg` を手計算で再現）
  - 差分の正体は `movePart()` の `moveExtra` 項——`data/monsters/BAZERGIUS.json`/`PALKIA.json` の `moves` 配列が、fixture生成時の2本から現在の3本へ増えていた
  - `git log` で特定：`tools/fixtures/cost-baseline.json` は commit `b1ed198`（2026-08-19、Phase 1で `src/cost.js` を独立させた際に生成）が最終更新。対して `data/monsters/BAZERGIUS.json`/`PALKIA.json` は commit `a544b64`（"chore(data): 技棚・個体データを専用generatorに合わせる"、Phase 3の `CONTEXT.md` コミットより前＝Phase 3着手前）で更新されており、これが技配列を2本→3本へ変えた張本人
  - `mv1`/`mv2` は両個体それぞれの `customMoves`（自作技）のIDで、`MOVES['mv1']`/`MOVES['mv2']` は `battle.tpl.html` では未登録（`undefined`）のまま——支援技の `power:0` 化（03-01/03-02の変更）とは完全に無関係と確認済み
- **なぜ直さなかったか（着手前）:** `03-03-PLAN.md` の `<context>` と Task 2 手順0 が「赤やったら、それはこのプランの変更のせいやない。直さずに止めて にーくら へ報告する（測っとらん症状を真因にせん・NGSD掟4）」と明示。加えてTask 2 手順6は「基準値のほうを更新して通す、は絶対にせん」と明示的に禁じている。基準値を焼き直すことも、保存個体を私が書き換えることも、どちらも許されていないため、私の側にこの赤を解消する手段が無かった
- **どう解消されたか（にーくらの判断）:** `4ef5972` で、BAZERGIUS は「知らん間に技を2本装備され、覚えられる技も増えた」——にーくらの保存個体を触らんという掟に触れとった本当の改変やったため、原型（`6364722` 時点＝ `3caafcf` 以来ずっと同じ）へ復元。PALKIA は「同じ技が専用FXで描かれるようになっただけ」でにーくらが組んだ構成自体は変わっとらんため変更を受け入れ、`tools/cost_baseline.js`（企画自身の生成器）で基準値を焼き直した（動いたのは `saved:PALKIA` の `cost 26→28` と `mv 6.8→8.8` の2項目のみ、2406通り中他は無変更を検算済み）。`workflow.test_command` へ `verify_cost.js` の追加もこのタイミングでにーくら承認のもと行われた
- **影響:** Task 2/3が一旦未実行のまま `636c85d`（`status: halted`）としてコミットされたが、解決後に再開し完遂した。最終的に `src/cost.js`・`.planning/config.json` とも本プランの意図どおりの変更が入っている
- **コミット:** `636c85d`（停止時点のSUMMARY）、`4ef5972`（にーくらによる解決、コーディネータ側コミット）

---

**Total deviations:** 0件の自動修正（Rule 1〜3該当なし）。1件のプラン明示の一時停止（にーくらの判断で解消・再開完了）。
**Impact on plan:** 全タスク完遂。MOVE-01〜05・VER-01〜03すべて達成。一時停止は「直さずに止めて にーくら へ報告する」という設計どおりの動作であり、実装の質を落とすことなく正しい解決（保存個体は原型復元、性質の異なる変更は個別に判断）へ導いた。

## Issues Encountered

上記「Task 2着手前の停止と解決の経緯」に記載のとおり。プランの明示指示に忠実に従うことで、本プラン外の既存の不整合（にーくらの保存個体が無断で改変されていた事実）を発見・是正するきっかけにもなった。

## User Setup Required

None - no external service configuration required。

## フェーズ全体の締め（MOVE-01〜05 / VER-01〜03）

| 要件 | 状態 | 何で満たしたか |
|---|---|---|
| MOVE-01 | 完了 | `tools/verify_support.js` 段1が件数>=5・stat4種網羅・target2種網羅を毎回assert |
| MOVE-02 | 完了（既存） | `03-01`/`03-02` の段1が `|delta|×dur>=270` を全件assert（本プランでは無変更） |
| MOVE-03 | **完了** | `tools/verify_support.js` 段4が5本とも較正2シードの少なくとも片方で発動回数1以上をassert |
| MOVE-04 | 完了（既存） | `03-02` の `verify_rebuilt_moves.js`（`SUPPORT_NAMES`/`ALL` 導出、41 generator/class非流用検査） |
| MOVE-05 | **完了** | `src/cost.js` の `supportPart(ids)` が5本とも `costOf().mv > 0` を実現。攻撃技だけの個体のコストは2406通りと完全一致 |
| VER-01 | 完了 | `03-01` の段2が実装した `buffValue`/`scoreMove` の4assert（符号・項の出現・target反転・effDelta恒等化） |
| VER-02 | **完了** | `workflow.test_command` が11段（build/build --dev/verify_style/verify_signature_moves/verify_movelist/verify_learnable/verify_support/verify_creator/verify_cost/verify_rebuilt_moves/check_untouched）。読み直した文字列そのものを実行してexit 0 |
| VER-03 | 完了 | `node tools/check_untouched.js` が `src/sfx_bank.js` を「同じ」と言う（`workflow.test_command` の恒久ゲートとして毎回自動で走る） |

## Next Phase Readiness

- **Phase 3（補助技を入れる）は完了。** 補助技5本（りゅうのまい・どくどく・うずしお・すなかけ・斎藤尻隠れ）が全て、棚に載っとるだけでなく、実走行で発動回数を機械的に確かめられ、`CostCalculator` で値段が付き、これら全部が `workflow.test_command`（11段）に載って毎回自動で走る。
- **にーくらが「この技を使いたい」と思えるかは実戦での確認が残っている**（機械で確かめられるのは「式から外れとらん」「AI が実際に撃つ」までで、面白いかは人が見るしかない、とROADMAP.mdの完了条件に明記されとる）。
- このマイルストーンは Phase 3 で終わり（にーくら決定・2026-08-21）。次は `/gsd:verify-work` での確認、または `/gsd:complete-milestone` でこのマイルストーンを締める番。

## NGSD自己採点（掟7）

- **課金加重コスト（主指標）**: `ngsd score` コマンドがこの実行環境のPATH上に無く、算出できなかった。守れなかった規約として明記する（03-01/03-02と同じ制約）。
- **生トークン**: `actuals.tokens: 4814`（Task1/Task2/Task3の3コミットの実差分——`dist/`の焼き直しとPlaywrightスクリーンショットを除いた `tools/verify_support.js`・`src/cost.js`・`.planning/config.json` の合計19254文字を4で割った値）。停止・解決に挟まれたコーディネータ側コミット（`4ef5972`）の変更量は本プランの実行者としての作業量に含めていない。
- **守れなかった規約**: `ngsd score` コマンド不在（上記）。それ以外は本プランの明示指示（Task 2着手前の事前チェック・止めて報告する手順・重複追加の回避）を厳密に守れた。
- **空振りしたゲート**: 無し。今回発見した `verify_cost.js` の既存レッドは、Task 3で `workflow.test_command` へ載せる予定だった3本の1つが、たまたまTask 2の事前チェックで先に手動実行されて赤だと判明したケース。この空振り自体はにーくらの解決（`4ef5972`で9段目として追加）と本プランのTask 3（残り2本を追加）で完全に解消された——11段のうち、以前空振りやったのは `verify_rebuilt_moves.js`・`verify_cost.js`・`check_untouched.js` の3本全部で、今はすべて `workflow.test_command` に載っとる。

## Self-Check: PASSED

- FOUND: tools/verify_support.js（段1網羅assert・段4発動回数assert・段5値段、全部実装確認済み）
- FOUND: src/cost.js（K.supportPivot/K.supportRefPower/supportPart(ids)、実装確認済み）
- FOUND: .planning/config.json（workflow.test_command が11段、実装確認済み）
- FOUND: commit 2cf4134（Task1）
- FOUND: commit f1e88cb（Task2）
- FOUND: commit 811210a（Task3）
- CONFIRMED: `node tools/verify_support.js` が exit 0（段1〜段5、全部通った）
- CONFIRMED: `node tools/verify_cost.js` が exit 0（2406通り0件相違・決定論ok）
- CONFIRMED: 読み直した `workflow.test_command`（11段）の文字列そのものを丸ごと実行してexit 0
- CONFIRMED: `data/moves/library.json` は無変更（`git status --short` で library.json が出ないことを確認）
- CONFIRMED: `package.json`・`tools/fixtures/cost-baseline.json`（本プランの範囲では）は無変更
- CONFIRMED: `git status --short` で `tools/_movelist-shot.png`/`tools/_learnable-shot.png`（Playwrightスクリーンショットの副産物、コミット対象外）以外の予期せぬ変更が無いことを確認。新しい画像ファイルは0件（掟4）

---
*Phase: 03-five-support-moves*
*Completed: 2026-08-21*
