---
gsd_state_version: 1.0
current_phase: 3
current_phase_name: 見た目を分ける
status: ready
stopped_at: Phase 2 完了（間が選ばれるようになった）
last_updated: "2026-08-19T00:00:00.000Z"
last_activity: 2026-08-19
last_activity_desc: Phase 2 完了。AI が「撃てるが撃たん」を選ぶようになった
state_head: 94e072c
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 0
  completed_plans: 0
  percent: 67
---
# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** 見とる人に「**撃てんのか、撃たんのか**」が分かること。
それが分かると采配に意味が出る。
**Current focus:** Phase 3 —— 反動＝静止＋白点滅／間＝別／溜め＝白を外す

## Current Position

Phase: 3 of 3 (見た目を分ける)
Status: 着手
Last activity: 2026-08-19 —— マイルストーン開始

Progress: [███████░░░] 67%（2/3 フェーズ）

## 前のマイルストーン（コスト経済）

**3/3 フェーズ・22/22 要件で完了。** 控えは `.planning/archive/v2-コスト経済/`。
所持コスト150・死亡で減・撃破で増・敗北条件・8Q判定・上部のバー2本まで入っとる。
**実戦での確認（高コスト編成 vs 低コスト編成）はまだ。** にーくらがキャラを増やしとる最中。

## このマイルストーンの出発点（数えた事実・2026-08-19）

```
白い点滅          charge が持っとる（flash 0.25→0.6→0.25・loop:true）
「間」の状態      **無い**。pickMove は撃てる技から必ず1つ返す
反動の見た目      無い（数値としては f.cd に在るが画面に出とらん）
既定に乗る自作技  にーくらの5本中2本だけ（残り3本は motions 自前）
```

**表現と意味がずれとる** —— 白は「溜め」に使われとるのに、にーくらの目には「反動」に見えた。
