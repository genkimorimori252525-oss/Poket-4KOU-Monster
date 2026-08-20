---
gsd_state_version: 1.0
current_phase: 1
current_phase_name: 依存を切る
status: ready
last_updated: "2026-08-20T06:28:33.346Z"
last_activity: 2026-08-20
last_activity_desc: 覚えられる技／覚える技を2段に割り、内蔵技を個体ごとに外せるようにした
state_head: fdf7fd08a20d82733c7ee712962b5fae7b1db57e
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 6
  completed_plans: 6
  percent: 25
stopped_at: マイルストーン開始（技の作り直し）
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** 技が**四皇モンの仕組みを実際に使う**こと。
**Current focus:** Phase 1 —— 見本44技を外しても壊れんことを確かめる

## Current Position

Phase: 1 of 3 (依存を切る)
Status: 着手
Last activity: 2026-08-20 —— quick 260820-kit 完了（覚える表）

Progress: [░░░░░░░░░░] 0%（0/3 フェーズ）

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
