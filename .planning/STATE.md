---
gsd_state_version: 1.0
current_phase: 03
current_phase_name: 補助技を入れる
status: in_progress
stopped_at: 03-01完了。次はPlan 02（すなかけ・斎藤尻隠れの新規2本）
last_updated: "2026-08-21T12:59:03.000Z"
last_activity: 2026-08-21
last_activity_desc: Phase 3 Plan 01完了。りゅうのまい・どくどく・うずしお の3本をkind:'support'化し、verify_support.jsに段1〜3＋実走行ブロックを追加（発動回数の合否は03-03へ一本化）
state_head: 76f34281a1b1935fcc48c823f1690d20c8b9f81d
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 8
  completed_plans: 4
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** 技が**四皇モンの仕組みを実際に使う**こと。
**Current focus:** Phase 3 — 補助技を入れる

## Current Position

Phase: 03 (補助技を入れる), Plan 1 of 3 — COMPLETE
Status: 03-01 完了。既存3本（りゅうのまい・どくどく・うずしお）を kind:'support' 化し、
tools/verify_support.js に段1〜3＋実走行の測る仕掛けを作った（発動回数の合否は持たん・03-PLAN-CHECK.md B2）。
次は 03-02（すなかけ・斎藤尻隠れの新規2本、専用FXクラスの新造）
Last activity: 2026-08-21 — 03-01（3本を補助技化・verify_support.jsに較正実測表と実走行記録ブロックを追加）完了

Progress: [███░░░░░░░] 33%（1/3 プラン・このフェーズ）

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

## Session

**Last session:** 2026-08-21T12:59:03Z
**Stopped at:** Completed 03-01-PLAN.md
**Resume file:** None

## Decisions

- [Phase 02.1]: 攻撃/補助トグルはonchangeでbuildMoveEditor()（全体作り直し）を呼ぶ — mvRebuild()はmvBaseを触らんため、切替直後に威力/効果が出し分けられない（plan-check B8）
- [Phase 02.1]: normalizeMon()はpower/cast/cooldownをNumber.isFiniteガードへ変更し、statは無効値でも書き換えずapplySupportEffectを唯一の権威にする — +c.power||20は0を無い扱いして支援技のpower:0/cast:0を毎回蘇らせていた（plan-check B5）。stat妥当性の二重判定は分岐を作るので避けた
- [Phase 02.1]: determinismTest()の40秒×2ランで補助技が実際にキャストされたことをapplySupportEffectの呼び出し回数を数えて直接証明する（movelist掲載だけでは証拠にならん） — R2チェックのeffDeltaモンキーパッチと同じ手口を決定論チェックに展開。determinismTest()自体は使用技の統計を返さんため
- [Phase 02.1]: workflow.test_commandにverify_creator.jsも追加登録（プラン外・NGSD掟7） — 02.1-02がB5/B8へ実アサーションを入れたのに恒久ゲートとして一度も自動で走っとらんかった。npm scriptはあってもtest_commandに乗っとらんければ発火しない
- [Phase 03-01]: 実走行ブロックは発動回数を根拠にしたok(...)を1つも持たず、記録専用にした — 合否は03-03-PLAN.md Task 1へ一本化（03-PLAN-CHECK.md B2の是正）。降り口を2箇所に置くと片方だけ直されて食い違う日が来るため、判断は1箇所に寄せた
- [Phase 03-01]: うずしおの配線検査は「撃った瞬間に相手の反動が縮む」を期待せず、foe.buffs.spd（delta負・until未来）とstatOf(foe,'spd')の低下の2点で「次の技から効く」ことを示した — f.cd確定タイミングの都合で前者をassertすると必ず落ちる
