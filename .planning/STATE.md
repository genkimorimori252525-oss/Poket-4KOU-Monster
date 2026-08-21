---
gsd_state_version: 1.0
current_phase: 02.1
current_phase_name: 補助技 (INSERTED)
status: executing
stopped_at: Completed 02.1-02-PLAN.md
last_updated: "2026-08-21T07:24:29.579Z"
last_activity: 2026-08-21
last_activity_desc: 02.1-02（技クリエーターの補助技UI）完了
state_head: c2dee263fee5bce7e4b8d35d0aed51ab38f19412
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 10
  completed_plans: 8
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** 技が**四皇モンの仕組みを実際に使う**こと。
**Current focus:** Phase 02.1 — 補助技 (INSERTED)

## Current Position

Phase: 02.1 (補助技 (INSERTED)), Plan 2 of 3 — EXECUTING
Status: 02.1-02 完了。次は 02.1-03（verify_support.js の determinismTest 拡張・verify:support 登録）
Last activity: 2026-08-21 — 02.1-02（技クリエーターの攻撃/補助トグル・効果入力・normalizeMonのpower:0保存）完了

Progress: [████████░░] 80%（2/3 プラン・このフェーズ）

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

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02.1 P01 | 38min | 3 tasks | 4 files |
| Phase 02.1 P02 | 35min | 2 tasks | 2 files |

## Session

**Last session:** 2026-08-21T07:23:57.525Z
**Stopped at:** Completed 02.1-02-PLAN.md
**Resume file:** None

## Decisions

- [Phase 02.1]: 攻撃/補助トグルはonchangeでbuildMoveEditor()（全体作り直し）を呼ぶ — mvRebuild()はmvBaseを触らんため、切替直後に威力/効果が出し分けられない（plan-check B8）
- [Phase 02.1]: normalizeMon()はpower/cast/cooldownをNumber.isFiniteガードへ変更し、statは無効値でも書き換えずapplySupportEffectを唯一の権威にする — +c.power||20は0を無い扱いして支援技のpower:0/cast:0を毎回蘇らせていた（plan-check B5）。stat妥当性の二重判定は分岐を作るので避けた
