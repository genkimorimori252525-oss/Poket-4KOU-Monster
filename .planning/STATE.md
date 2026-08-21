---
gsd_state_version: 1.0
current_phase: 03
current_phase_name: 補助技を入れる
status: in_progress
stopped_at: 03-03-PLAN.md Task 1 完了、Task 2/3 は にーくら判断待ちで停止
last_updated: "2026-08-21T14:03:39.000Z"
last_activity: 2026-08-21
last_activity_desc: Phase 3 Plan 03 Task 1完了（MOVE-01網羅assert格上げ＋発動回数ゲート、5本とも較正2シードの少なくとも片方で発動）。Task 2着手前の事前チェックでnode tools/verify_cost.jsが本プラン変更と無関係な原因で赤と判明、プランの明示指示どおり実装を止めてにーくらへ報告（cost.js/config.jsonは無変更）
state_head: 2cf4134bda60203768896ef92a29a0fee8b3384b
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 8
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** 技が**四皇モンの仕組みを実際に使う**こと。
**Current focus:** Phase 3 — 補助技を入れる

## Current Position

Phase: 03 (補助技を入れる), Plan 3 of 3 — Task 1 完了、Task 2/3 停止（にーくら判断待ち）
Status: 03-03 Task 1（MOVE-01網羅assert＋発動回数ゲート）完了・commit 2cf4134。
5本とも較正2シード(31337/90210)の少なくとも片方で発動（りゅうのまい1/4・どくどく3/2・
うずしお5/6・すなかけ5/6・斎藤尻隠れ5/1）、梯子（段上げ）も降り口も発動せず。
Task 2（CostCalculatorへ補助技の値段付け）着手前の必須事前チェックで
`node tools/verify_cost.js` が本プランの変更と無関係な原因で既に赤と判明したため、
プランの明示指示（「直さずに止めてにーくらへ報告する」）どおり src/cost.js に一切触れず停止。
詳細は 03-03-SUMMARY.md の「Task 2/3 停止の報告」節。
Last activity: 2026-08-21 — 03-03 Task 1完了・Task 2/3停止

Progress: [████████░░] 80%（Task 1/3 タスク・このプラン。3プラン目のうち完了扱いはまだ2）

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

## Session

**Last session:** 2026-08-21T14:03:39.000Z
**Stopped at:** 03-03-PLAN.md Task 1 完了、Task 2/3 は にーくら判断待ちで停止
**Resume file:** .planning/phases/03-five-support-moves/03-03-SUMMARY.md（「Task 2/3 停止の報告」節）

## Blockers

- **[Phase 03-03] `node tools/verify_cost.js` が Task 2 着手前の事前チェックで既に赤。**
  原因は本プランの変更やない —— `data/monsters/BAZERGIUS.json`/`PALKIA.json` の技配列が
  commit `a544b64`（Phase 3 着手前、Codexの「技棚・個体データを専用generatorに合わせる」
  データ移行）で2本→3本へ増え、`K.moveExtra` の寄与が変わったため
  （`tools/fixtures/cost-baseline.json` は2026-08-19生成・移行より前）。
  プランの明示指示（`03-03-PLAN.md` <context> と Task 2 手順0）により、
  赤の状態で `src/cost.js` へ触ることも `cost-baseline.json` を焼き直すことも禁じられとる。
  **にーくらの判断待ち**：(a) 保存個体の技配列を意図した状態へ戻す (b) 現状を正として
  `node tools/cost_baseline.js` で基準値を焼き直す、のどちらかを にーくら が選んでから
  Task 2/3 を再開する。詳細は 03-03-SUMMARY.md。

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
