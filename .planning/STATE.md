---
gsd_state_version: 1.0
current_phase: 03
current_phase_name: 補助技を入れる
status: in_progress
stopped_at: Completed 03-03-PLAN.md
last_updated: "2026-08-21T14:23:59.000Z"
last_activity: 2026-08-21
last_activity_desc: Phase 3 Plan 03完了。Task 1（MOVE-01網羅assert＋発動回数ゲート）→ Task 2着手前チェックで本プラン外の既存レッド(verify_cost.js)を検出しにーくらへ報告・一旦停止 → にーくらがBAZERGIUS原型復元／PALKIA変更承認＋基準値焼き直し(commit 4ef5972)で解消 → Task 2（CostCalculatorへの値段付け）とTask 3（workflow.test_commandを11段へ）を再開・完了。Phase 3（補助技を入れる）はこれで完了、MOVE-01〜05・VER-01〜03すべて達成
state_head: 811210a7e6e9d200a834f86154ab048d3069cff5
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 8
  completed_plans: 6
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** 技が**四皇モンの仕組みを実際に使う**こと。
**Current focus:** Phase 3 — 補助技を入れる

## Current Position

Phase: 03 (補助技を入れる), Plan 3 of 3 — COMPLETE。**Phase 3 完了。**
Status: 03-03 の3タスクすべて完了。Task 1（MOVE-01網羅assert＋発動回数ゲート・commit 2cf4134）で
5本とも較正2シード(31337/90210)の少なくとも片方で発動（りゅうのまい1/4・どくどく3/2・
うずしお5/6・すなかけ5/6・斎藤尻隠れ5/1）を確認、梯子（段上げ）も降り口も発動せず。
Task 2着手前の事前チェックで `node tools/verify_cost.js` の既存レッド（本プラン外・
Phase 3着手前のデータ移行が原因）を検出し一旦停止・にーくらへ報告 →
にーくらが保存個体BAZERGIUSを原型へ復元／PALKIAは変更を承認して基準値を焼き直し
（commit 4ef5972）→ Task 2（`src/cost.js` へ `supportPart`/`K.supportPivot`/`K.supportRefPower`
を追加、5本とも `costOf().mv>0`・commit f1e88cb）とTask 3（`workflow.test_command` を
11段へ・commit 811210a）を再開して完了。MOVE-01〜05・VER-01〜03すべて達成。
Last activity: 2026-08-21 — 03-03完了。Phase 3完了

Progress: [██████████] 100%（3/3 プラン・このフェーズ）

## 前のマイルストーン（反動と間）

**3/3 フェーズ・19/19 要件で完了。** 控えは `.planning/archive/v3-反動と間/`。
反動＝待機＋白点滅／間＝AI が撃たん判断（絵は待機のまま）／溜め＝白なし。
**実戦での確認はまだ** —— 読み合いとして面白いかはにーくらが見る。

## このマイルストーンの出発点（数えた事実・2026-08-19）

```
44技      威力 6〜52（中央34）   ← 威力60以上が **0本**
          8割が威力40未満、平均CD 3.4秒
          溜め 0.1〜1秒（中央0.35）← 短すぎて「避ける値打ち」が薄い
内蔵6技   戦闘の土台。ここは残す
自作技    にーくらの5本。**指1本触れん**
```

**技は全部、相殺・分類・コスト経済・反動と間より前に作られたもの。**
後から入った仕組みを何ひとつ踏まえとらん。

## 参照について

にーくらが挙げた `ポケモン素材集/Pokemon - Pearl Version` は **.nds が1つ**（ROM本体）。
**使わん** —— 市販ゲームの中身を吸い出すことになるけん。
そもそも要らん。足りんのはよその参考やのうて、四皇モン自身の仕組みからの逆算やけん。

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260820-2k5 | 威力連動の取りこぼし2件（相殺判定を絵に揃える／技制作ツールに切替を足す） | 2026-08-20 | 27134c5 | [260820-2k5-clash-hitbox-and-power-toggle-2](./quick/260820-2k5-clash-hitbox-and-power-toggle-2/) |
| 260820-jpn | 技一覧を library.json に一本化し、技ネタ帳を廃止（made 54 / idea 135） | 2026-08-20 | 773c324 | [260820-jpn-movelist-unify-library-json](./quick/260820-jpn-movelist-unify-library-json/) |
| 260820-kit | 覚えられる技（12）／覚える技（4）の2段UIと、内蔵技の個体ごと除外 | 2026-08-20 | 5f79242 | [260820-kit-learnable-table-learnable-ui](./quick/260820-kit-learnable-table-learnable-ui/) |

## Accumulated Context

### Roadmap Evolution

- Phase 2.1 inserted after Phase 2: 補助技（aura の3本がダメージ0の件の決着。scoreMove の採点項が本体）
- Phase 3 edited: 「技を作る」→「補助技を入れる」へ書き換え。技の作り直しは Codex が並行して完了（54/56 が専用generator）。残るは Phase 2.1 の仕組みを動かす補助技5本

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02.1 P01 | 38min | 3 tasks | 4 files |
| Phase 02.1 P02 | 35min | 2 tasks | 2 files |
| Phase 02.1 P03 | 13min | 2 tasks | 2 files |
| Phase 03 P01 | 約25min | 3 tasks | 3 files |
| Phase 03 P02 | 9min | 3 tasks | 8 files |
| Phase 03 P03 | 約60min（うち約15分はverify_cost.js赤の原因追跡、停止・再開込み） | 3 tasks | 4 files |

## Session

**Last session:** 2026-08-21T14:23:59.000Z
**Stopped at:** Completed 03-03-PLAN.md
**Resume file:** None

## Blockers（解消済み・記録として残す）

- **[Phase 03-03・解消済み] `node tools/verify_cost.js` が Task 2 着手前の事前チェックで既に赤やった。**
  原因は本プランの変更やない —— `data/monsters/BAZERGIUS.json`/`PALKIA.json` の技配列が
  commit `a544b64`（Phase 3 着手前、Codexの「技棚・個体データを専用generatorに合わせる」
  データ移行）で2本→3本へ増え、`K.moveExtra` の寄与が変わったため
  （`tools/fixtures/cost-baseline.json` は2026-08-19生成・移行より前）。
  プランの明示指示（`03-03-PLAN.md` <context> と Task 2 手順0）により、
  赤の状態で `src/cost.js` へ触ることも `cost-baseline.json` を焼き直すことも禁じられとって、
  一旦実装を止めて にーくら へ報告した（判断の正しさは にーくら からも確認をもらった）。
  **にーくらの判断で解消（commit `4ef5972`）：** BAZERGIUS は「知らん間に技を装備されとった」
  本当の改変やったけん原型（`6364722` 時点）へ復元、コストは20へ復帰。PALKIA は
  「同じ技が専用FXで描かれるようになっただけ」で構成は変わっとらんため変更を受け入れ、
  `tools/cost_baseline.js` で基準値を焼き直した（動いたのは `saved:PALKIA` の2項目のみ、
  他2404通りは無変更を検算済み）。`workflow.test_command` へ `verify_cost.js` を追加登録も
  にーくら承認で完了。この解消を受けてTask 2/3を再開・完了した。

## Decisions

- [Phase 02.1]: 攻撃/補助トグルはonchangeでbuildMoveEditor()（全体作り直し）を呼ぶ — mvRebuild()はmvBaseを触らんため、切替直後に威力/効果が出し分けられない（plan-check B8）
- [Phase 02.1]: normalizeMon()はpower/cast/cooldownをNumber.isFiniteガードへ変更し、statは無効値でも書き換えずapplySupportEffectを唯一の権威にする — +c.power||20は0を無い扱いして支援技のpower:0/cast:0を毎回蘇らせていた（plan-check B5）。stat妥当性の二重判定は分岐を作るので避けた
- [Phase 02.1]: determinismTest()の40秒×2ランで補助技が実際にキャストされたことをapplySupportEffectの呼び出し回数を数えて直接証明する（movelist掲載だけでは証拠にならん） — R2チェックのeffDeltaモンキーパッチと同じ手口を決定論チェックに展開。determinismTest()自体は使用技の統計を返さんため
- [Phase 02.1]: workflow.test_commandにverify_creator.jsも追加登録（プラン外・NGSD掟7） — 02.1-02がB5/B8へ実アサーションを入れたのに恒久ゲートとして一度も自動で走っとらんかった。npm scriptはあってもtest_commandに乗っとらんければ発火しない
- [Phase 03-01]: 実走行ブロックは発動回数を根拠にしたok(...)を1つも持たず、記録専用にした — 合否は03-03-PLAN.md Task 1へ一本化（03-PLAN-CHECK.md B2の是正）。降り口を2箇所に置くと片方だけ直されて食い違う日が来るため、判断は1箇所に寄せた
- [Phase 03-01]: うずしおの配線検査は「撃った瞬間に相手の反動が縮む」を期待せず、foe.buffs.spd（delta負・until未来）とstatOf(foe,'spd')の低下の2点で「次の技から効く」ことを示した — f.cd確定タイミングの都合で前者をassertすると必ず落ちる
- [Phase 03-02]: すなかけの基準点はthis.t(相手位置)・斎藤尻隠れはthis.f(使用者位置)。渦・炎・葉・稲妻・rmRingBurstとビック尻ドロップの語彙(落下・砂煙・衝撃輪)は避け、絵の骨格を既存技と分離した
- [Phase 03-02]: tools/verify_rebuilt_moves.jsの件数assertは39を41へ書き換えず、SUPPORT_NAMES定数とALL=[...names,...SUPPORT_NAMES]からの導出へ変えた。次に専用技を足しても手直し不要な恒久形にした
- [Phase 03-03]: 段1をMOVE-01網羅assert（件数>=5・stat4種・target2種）へ格上げし、段4の実走行ブロックに発動回数を根拠にしたok(...)を初めて追加した — 03-01/03-02は記録専用のまま、合否を持つのはこの段だけ（03-PLAN-CHECK.md B2の設計どおり）
- [Phase 03-03]: Task 2着手前の事前チェック（プラン明示指示）でnode tools/verify_cost.jsが既に赤と判明。原因はPhase3開始前のCodexデータ移行（BAZERGIUS/PALKIAの技配列が2→3本）で、支援技のpower:0化とは無関係。「直さずに止めてにーくらへ報告する」の指示どおりsrc/cost.js・cost-baseline.jsonのどちらにも触れず停止した — 基準値を焼き直して通す手は明示的に禁じられとる
- [Phase 03-03]: にーくらがBAZERGIUS原型復元／PALKIA変更承認＋基準値焼き直しで詰まりを解消（commit 4ef5972）。src/cost.jsにK.supportPivot(270)/K.supportRefPower(26)とsupportPart(ids)を追加し、movePartを「威力合計+supportPart(ids)」へ組み替え。攻撃技だけの個体のコストは基準値2406通りと完全一致のまま、5本とも costOf().mv>0 になった
- [Phase 03-03]: workflow.test_commandへ空振りしとった残り2本（verify_rebuilt_moves.js／check_untouched.js）を追加し11段に。verify_cost.jsはにーくら承認済みの9段目として既存のため重複追加せず。読み直した文字列そのものを丸ごと実行してexit 0を確認
