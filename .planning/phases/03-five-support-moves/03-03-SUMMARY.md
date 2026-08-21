---
phase: 03-five-support-moves
plan: 03
subsystem: battle-ai
tags: [battle-ai, support-moves, verify_support, activation-gate, cost-calculator, blocked]

requires:
  - phase: 03-01
    provides: "kind:'support' 化された既存3本、tools/verify_support.js の段1〜3＋実走行の3列記録"
  - phase: 03-02
    provides: "すなかけ・斎藤尻隠れ の専用FX新造、補助技5本が4stat×self/foeを網羅"
provides:
  - "MOVE-01の網羅（件数>=5・4stat・self/foe両方）を段1で毎回機械assert（>=で見て名前を決め打ちしとらん）"
  - "MOVE-03（AIが実際に5本とも撃つ）を段4で毎回機械assert。5本とも較正2シード(31337/90210)の少なくとも片方で発動回数1以上。合否を持つのはこのフェーズでここだけ（03-PLAN-CHECK.md B2の設計どおり）"
  - "Task 2（CostCalculatorへの値段付け・MOVE-05）とTask 3（恒久ゲートへの3段追加・VER-02/VER-03）は、着手前の必須事前チェックで発見した本プラン外の既存レッド（node tools/verify_cost.js）により、にーくら判断待ちで停止。src/cost.js・.planning/config.jsonのどちらも無変更"
affects: [03-five-support-moves-continuation]

actuals:
  tokens: 2290
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "MOVE-01の網羅assertを「件数>=5」＋「Setで集めたstat/target集合が必須集合を包含するか」の2段構えにした。個別レコードのループとは別に、拾い終わったあとの集合演算で網羅性を見る形（技名を1つも決め打ちせん）"
    - "発動回数の合否を持つブロックを、この段（段4）だけに集約する設計を実装で踏襲。既存の段2/段3/実走行(記録専用)は無条件のまま、新規のok(...)は段4のfor-loopに1本だけ追加した"

key-files:
  created: []
  modified:
    - tools/verify_support.js

key-decisions:
  - "段1の件数assertを「>0」から「>=5」へ格上げし、effect.statの集合がatk/def/eva/spdの4つを、effect.targetの集合がself/foeの両方を包含するかを別assertとして追加した（プラン指示どおり、失敗時は今ある集合を出す）"
  - "段4「実走行(5本とも発動)」で発動回数を根拠にしたok(...)を初めて追加。5本とも較正2シード(31337/90210)の少なくとも片方で発動回数1以上をassert、3列目（既定ロスター）は記録のみで合否に使わん。全部が両シードとも1以上やったため、段上げの梯子（dur→20/|delta|→25）も降り口も発動しなかった——data/moves/library.jsonは1バイトも触っとらん"
  - "Task 2着手前の手順0（プラン明示指示）でnode tools/verify_cost.jsを走らせたところ、本プランの変更前から既に赤（2件の突き合わせ不一致）と判明。原因を追跡し、Phase 3着手前のcommit a544b64（Codexの技棚・個体データ移行）でBAZERGIUS/PALKIAの技配列が2本→3本へ増えたことによる、支援技のpower:0化とは無関係な既存の乖離と特定した。プランが明示的に禁じる「直さずに止めてにーくらへ報告する」の指示に従い、src/cost.jsに一切触れず、cost-baseline.jsonの焼き直しもせず、Task 2/3を停止した"

patterns-established:
  - "MOVE-01のような「網羅性」要件は、件数assertとは別にSet演算による集合包含assertを追加する形で表現する（今後も網羅系の要件が出たら同じ形を使える）"

requirements-completed: [MOVE-03]  # 注: PLAN.mdのrequirements配列は[MOVE-01, MOVE-03, MOVE-05, VER-01, VER-02, VER-03]の6件だが、
  # 本プランはTask 1のみ完了・Task 2/3は停止のため、テンプレ既定の「配列を丸ごとコピー」はせず、
  # 実際に完了したMOVE-03のみをここに記録する（MOVE-01は03-02完了時点で既に完了マーク済み・REQUIREMENTS.md参照）。
  # MOVE-05/VER-01/VER-02/VER-03はTask 2/3の停止によりまだ未完了——誤ってrequirements.mark-completeへ渡さんこと。

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

duration: 約35min（コミットまでの実装・調査・再現確認。うち約15分は verify_cost.js 赤の原因追跡）
completed: 2026-08-21
status: halted
---

# Phase 3 Plan 03: 発動回数ゲートを完成、コスト付けは既存レッドで停止 Summary

**補助技5本すべてが較正2シードの少なくとも片方で発動することを機械assertする恒久ゲート（MOVE-03）を追加。CostCalculatorへの値段付け（MOVE-05）と恒久ゲート3段追加（VER-02/VER-03）は、Task 2着手前の必須事前チェックで発見した本プラン外の既存レッド（`node tools/verify_cost.js`）により、`src/cost.js` に一切触れずにーくら判断待ちで停止した。**

## Performance

- **Duration:** 約35分（実装・確認・原因追跡込み）
- **Tasks:** 1/3（Task 1完了。Task 2/3は停止）
- **Files modified:** 1（`tools/verify_support.js`）
- **Commits:** 1（`2cf4134`）

## Accomplishments

- **段1をMOVE-01の網羅assertへ格上げ。** 件数を `>0` から `>=5` へ（`===5`にせん）。加えて `effect.stat` の集合が `atk`/`def`/`eva`/`spd` の4つを、`effect.target` の集合が `self`/`foe` の両方を包含するかをSet演算で確かめる2つのassertを新設。失敗メッセージには「今ある集合」を出す。
- **段4「実走行(5本とも発動)」を仕上げ、発動回数を根拠にしたok(...)を初めて追加。** Plan 01/02が作った「較正seed31337／較正seed90210／既定ロスター」の3列表示ブロックはそのまま流用し、各補助技について「較正2シードの少なくとも片方で発動回数1以上」をassert。3列目（既定ロスター）は記録専用のまま合否に使わない。落ちたときのメッセージには技名・両シードの回数・その技の補助の値打ち・総合点・対灼熱弾の差を全部含める。
- **実測：5本とも余裕をもって基準を満たした。** りゅうのまい 1/4、どくどく 3/2、うずしお 5/6、すなかけ 5/6、斎藤尻隠れ 5/1（いずれも「較正seed31337 / 較正seed90210」）。段上げの梯子（`dur`→20、`|delta|`→25）も降り口も発動せず、`data/moves/library.json` は1バイトも触っていない。
- **Task 2着手前の手順0（プラン明示指示）で `node tools/verify_cost.js` を走らせたところ、本プランの変更前から既に赤と判明。** 原因を追跡し、Phase 3着手前のCodexデータ移行（commit `a544b64`）が原因であることを特定（詳細は下記「Task 2/3 停止の報告」）。プランの明示指示どおり `src/cost.js` に触れず、Task 2/3を停止した。

## Task Commits

Each executed task was committed atomically:

1. **Task 1: AI が5本とも撃つことを実走行で数える（MOVE-01, MOVE-03, VER-01）** - `2cf4134` (test)

Task 2（CostCalculatorが補助技に値段を付ける）とTask 3（恒久ゲートへ3段追加）は未着手・未コミット。理由は下記「Task 2/3 停止の報告」を参照。

## Files Created/Modified

- `tools/verify_support.js` - 段1をMOVE-01網羅assertへ格上げ、段4「実走行(5本とも発動)」に発動回数ベースのok(...)を初めて追加

## Decisions Made

- 段1の件数assertを `>=5` へ格上げし、stat/target集合の網羅性を別assertとして分離した（プラン指示どおり、将来6本目が増えても無改修で追随する）
- 段4で「較正2シードの少なくとも片方」を発動条件とし、3列目（既定ロスター）は記録専用のまま合否から明確に除外した（にーくらの個体固有の天井クランプで数字が落ちるのは正常な現象であり、技の合否には使わない設計をそのまま踏襲）
- Task 2着手前の `node tools/verify_cost.js` 事前チェックで既存レッドを発見した時点で、プランの明示指示（「直さずに止めてにーくらへ報告する」・NGSD掟4「測っとらん症状を真因にせん」）に厳密に従い、`src/cost.js` にも `.planning/config.json` にも一切触れずに停止することを選んだ。基準値（`tools/fixtures/cost-baseline.json`）を焼き直して緑にする手はプランが明示的に禁じている

## Deviations from Plan

### 計画どおりに進まなかった箇所（Rule 4相当・アーキテクチャ判断が必要な停止）

**このケースは通常の「Rule 1〜3の自動修正」ではなく、プラン自身が明示した「止めて報告する」手順に従った停止であり、Deviationというより計画された分岐点。** 分類としてはRule 4（アーキテクチャ変更の判断が必要）に最も近いため、ここに記録する。

**1. [プラン明示指示による停止] `node tools/verify_cost.js` の既存レッドによりTask 2/3を実行しなかった**
- **見つかった場面:** Task 2 手順0（`src/cost.js` を触る前の必須事前チェック）
- **症状:** `node tools/verify_cost.js` が、本プランの変更を一切加える前の時点で既に赤（`突き合わせ 2406 通り中 2 件が相違`：`saved:BAZERGIUS 前=20 後=24` / `saved:PALKIA 前=26 後=28`）
- **原因の特定（貼るな、測れ・NGSD掟4）:**
  - `MOVES.shakunetsu.power`・`MOVES.beam.power`・`COST.K` の値はfixture生成時から無変更（`node -e` で直接確認）
  - `saved:BAZERGIUS`/`saved:PALKIA` の `stats` もfixtureと完全一致（`avg` を手計算で再現）
  - 差分の正体は `movePart()` の `moveExtra` 項——`data/monsters/BAZERGIUS.json`/`PALKIA.json` の `moves` 配列が、fixture生成時の2本から現在の3本（`["shakunetsu","mv1","mv2"]`/`["beam","mv2","mv1"]`）へ増えている
  - `git log` で特定：`tools/fixtures/cost-baseline.json` は commit `b1ed198`（2026-08-19、Phase 1で `src/cost.js` を独立させた際に生成）が最終更新。対して `data/monsters/BAZERGIUS.json`/`PALKIA.json` は commit `a544b64`（"chore(data): 技棚・個体データを専用generatorに合わせる"、Phase 3 の `CONTEXT.md` コミットより前＝Phase 3着手前）で更新されており、これが技配列を2本→3本へ変えた張本人
  - `mv1`/`mv2` は両個体それぞれの `customMoves`（自作技）のIDで、`MOVES['mv1']`/`MOVES['mv2']` は `battle.tpl.html` では未登録（`undefined`）のまま——支援技の `power:0` 化（03-01/03-02の変更）とは完全に無関係と確認済み
- **なぜ直さなかったか:** `03-03-PLAN.md` の `<context>` と Task 2 手順0 が「赤やったら、それはこのプランの変更のせいやない。直さずに止めて にーくら へ報告する（測っとらん症状を真因にせん・NGSD掟4）」と明示。加えてTask 2 手順6は「`verify_cost.js` が赤くなったら…基準値のほうを更新して通す、は絶対にせん」と明示的に禁じている。基準値を焼き直すこと（`node tools/cost_baseline.js`）も、保存個体を私が書き換えること（にーくらの保存個体は指1本触れんの掟）も、どちらも許されていないため、私の側にこの赤を解消する手段が無い
- **影響:** Task 2（`supportPart`/`K.supportPivot`/`K.supportRefPower` の実装、MOVE-05）とTask 3（`workflow.test_command` への3段追加、VER-02/VER-03の恒久化）が未実行。`src/cost.js`・`.planning/config.json` は両方とも無変更のまま
- **にーくらへの選択肢:**
  1. 保存個体（`BAZERGIUS`/`PALKIA`）の技配列を、baseline生成時点の意図した状態（2本）へ戻す
  2. 現状（3本）を正として `node tools/cost_baseline.js` を走らせ、基準値を焼き直す
  3. その他（にーくらが別の判断をする場合）
  いずれかを にーくら が選んだあと、Task 2/3 を再開できる
- **コミット:** なし（`src/cost.js`・`.planning/config.json` とも無変更）

---

**Total deviations:** 0件の自動修正（Rule 1〜3該当なし）。1件のプラン明示の停止（Task 2/3、にーくら判断待ち）。
**Impact on plan:** MOVE-03（このプランの主目的・「AIが実際に撃つ」の証明）は完全に達成。MOVE-05・VER-02・VER-03はにーくらの判断を経てから次のセッションで完了させる。

## Task 2/3 停止の報告

上の「Deviations from Plan」に詳細を記載。要点のみ再掲:

- **0回の技は無かった。** MOVE-03の梯子（`03-01-PLAN.md` `<numbers>` 節「ここでどう振る舞うか」4〜6）は**発動しなかった**——5本とも初回の較正実走行で両シードとも1回以上発動した。これは「にーくら判断待ちの降り口」（技の値が上限でも撃たれない場合の停止）とは**別の理由**による停止であることに注意。
- **停止理由は `verify_cost.js` の既存レッド一点のみ。** MOVE-01/MOVE-03/VER-01（Task 1が担当する3件）はすべて達成済み。MOVE-05/VER-02/VER-03（Task 2/3が担当する3件）のみが停止の影響を受けている。

## User Setup Required

None - no external service configuration required. ただし上記のとおり、にーくら自身の判断（保存個体の技配列を戻すか、基準値を焼き直すか）が Task 2/3 再開の前提条件。

## フェーズ全体の締め（MOVE-01〜05 / VER-01〜03）

| 要件 | 状態 | 何で満たしたか |
|---|---|---|
| MOVE-01 | 完了 | `tools/verify_support.js` 段1が件数>=5・stat4種網羅・target2種網羅を毎回assert（03-02完了時点で既にREQUIREMENTS.mdへ反映済み・本プランTask1で網羅assertを追加格上げ） |
| MOVE-02 | 完了（既存） | `03-01`/`03-02` の段1が `|delta|×dur>=270` を全件assert（本プランでは無変更） |
| MOVE-03 | **完了（本プランの主目的）** | `tools/verify_support.js` 段4が5本とも較正2シードの少なくとも片方で発動回数1以上をassert |
| MOVE-04 | 完了（既存） | `03-02` の `verify_rebuilt_moves.js`（`SUPPORT_NAMES`/`ALL` 導出、41 generator/class非流用検査） |
| MOVE-05 | **未完了（停止）** | Task 2（`supportPart`実装）が `verify_cost.js` 既存レッドにより未着手 |
| VER-01 | 完了（既存、03-01の段2が実装） | `buffValue`/`scoreMove` の4assert（符号・項の出現・target反転・effDelta恒等化）。REQUIREMENTS.mdでは複数プランにまたがる共有IDのため、本プランが停止扱いの間は完了マークを保留 |
| VER-02 | 完了（既存の8段は緑）／**恒久ゲートへの3段追加は未完了（停止）** | 現行 `workflow.test_command`（8段）は全部exit 0。`verify_rebuilt_moves.js`/`verify_cost.js`/`check_untouched.js` の追加はTask 3が未着手のため反映されていない |
| VER-03 | 完了（既存） | `node tools/check_untouched.js` が `src/sfx_bank.js` を「同じ」と言う（本プランでも再確認済み） |

## Next Phase Readiness

- **Task 1が達成したMOVE-03の恒久ゲートは、既に `workflow.test_command`（8段）に含まれる `tools/verify_support.js` の一部として即座に効力を持っている。** Task 3を待たずに、次に誰かが `node tools/verify_support.js` を走らせた瞬間から発動回数の合否は機械的に守られる。
- **Task 2/3の再開には、にーくらが `verify_cost.js` の既存レッド（保存個体の技配列 vs cost-baseline.json の乖離）についてどちらの側を正とするかを決める必要がある。** 決まり次第、次のセッションで `src/cost.js` の `supportPart` 実装（Task 2）と `workflow.test_command` への3段追加（Task 3）を再開できる——本プランの `<numbers>` 節・`<action>` の内容はそのまま使える（変更不要）。
- フェーズ3は**このTask 2/3が完了するまで完了扱いにしない**（MOVE-05・恒久ゲート3段が未達のため）。

## NGSD自己採点（掟7）

- **課金加重コスト（主指標）**: `ngsd score` コマンドがこの実行環境のPATH上に無く、算出できなかった。守れなかった規約として明記する（03-01/03-02と同じ制約）。
- **生トークン**: `actuals.tokens: 2290`（`tools/verify_support.js` の実差分 `git show 2cf4134` の9160文字を4で割った値）。1コミットのみのため、原文で正確に測れた（library.json等のminified巻き添えが無く、03-01/03-02のような按分計算は不要だった）。
- **守れなかった規約**: `ngsd score` コマンド不在（上記）。それ以外は本プランの明示指示（Task 2着手前の事前チェック・止めて報告する手順）を厳密に守れた。
- **空振りしたゲート**: 無し。今回発見した `verify_cost.js` の既存レッドは「空振りしたゲート」（掟7が問題にする、存在するのに一度も自動で走っとらんかったゲート）とは別の問題——`verify_cost.js` は今も `workflow.test_command` に載っていない（Task 3が積む予定だった3段の1つ）ため、正確には「空振りしたままのゲートが、たまたま今回の事前チェックで手動実行されて赤だと判明した」というケース。Task 3が本来この空振りを解消する予定やったが、今回はその解消自体が別の問題（cost-baseline乖離）でブロックされた。

## Self-Check: PASSED

- FOUND: tools/verify_support.js（段1網羅assert・段4発動回数assert、両方とも実装確認済み）
- FOUND: commit 2cf4134
- CONFIRMED: `node tools/verify_support.js` が exit 0（段1〜段4、全部通った）
- CONFIRMED: `node build.js && node build.js --dev && node tools/verify_style.js && node tools/verify_signature_moves.js && node tools/verify_movelist.js && node tools/verify_learnable.js && node tools/verify_creator.js && node tools/verify_rebuilt_moves.js && node tools/check_untouched.js` が全部exit 0（既存の検証チェーンに回帰なし）
- CONFIRMED: `node tools/verify_cost.js` が本プラン変更前から赤であることを再現・原因を特定済み（`src/cost.js`・`.planning/config.json` は無変更のまま）
- CONFIRMED: `data/moves/library.json` は無変更（`git status --short` で library.json が出ないことを確認）
- CONFIRMED: `git status --short` で `tools/_movelist-shot.png`/`tools/_learnable-shot.png`（Playwrightスクリーンショットの副産物、コミット対象外）以外の予期せぬ変更が無いことを確認。Codexの並行編集は検出されなかった

---
*Phase: 03-five-support-moves*
*Completed: 2026-08-21（Task 1のみ。Task 2/3は停止・status: halted）*
