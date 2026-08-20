---
gsd_state_version: 1.0
current_phase: 1
current_phase_name: 依存を切る
status: ready
stopped_at: マイルストーン開始（技の作り直し）
last_updated: "2026-08-19T00:00:00.000Z"
last_activity: 2026-08-20
last_activity_desc: 技一覧を library.json に一本化。技ネタ帳は廃止し idea 135本として取り込んだ
state_head: 773c324
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---
# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** 技が**四皇モンの仕組みを実際に使う**こと。
**Current focus:** Phase 1 —— 見本44技を外しても壊れんことを確かめる

## Current Position

Phase: 1 of 3 (依存を切る)
Status: 着手
Last activity: 2026-08-20 —— quick 260820-jpn 完了（技一覧の一本化）

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
