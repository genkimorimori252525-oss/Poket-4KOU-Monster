---
gsd_state_version: 1.0
current_phase: 1
current_phase_name: コストを独立させる
status: ready
stopped_at: マイルストーン開始（コスト経済）
last_updated: "2026-08-19T00:00:00.000Z"
last_activity: 2026-08-19
last_activity_desc: 開発基盤 30/30 完了。コスト経済のマイルストーンを開始
state_head: 76f0925
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

**Core value:** コストが「編成の枠」やのうて**陣営の体力**として実際に動き、
高コスト編成と低コスト編成で**違うゲーム**が成立すること
**Current focus:** Phase 1 —— `costOf` を `src/cost.js` へ剥がす（挙動は変えん）

## Current Position

Phase: 1 of 3 (コストを独立させる)
Status: 着手前
Last activity: 2026-08-19 —— マイルストーン開始

Progress: [░░░░░░░░░░] 0%（0/3 フェーズ）

## 前のマイルストーン（開発基盤）

**4/4 フェーズ・30/30 要件で完了。** 控えは `.planning/archive/v1-開発基盤/`。
Phase 4 の目視確認は 2026-08-19 に にーくらが「解決でいい」と判断して閉じた。

残したもの:

- 保存が `data/` 以下のファイルへ（localStorage の 5MB 枠から脱出）
- 制作ツールで作った四皇モンが戦闘に出る
- 開発シェル（アイコン一発・専用ウィンドウ・軽量ビルド）
- 技の「近接／遠距離／遠隔」分類と既定モーション

## このマイルストーンの出発点（数えた事実・2026-08-19）

```
CostCalculator の仮式      在る（src/moves.js:106・コメントに「Phase 15 で本採用」）
個体ごとの COST 表示       在る
戦闘不能・鳴き声0.7倍      在る（battle.tpl.html:1314）
所持コスト                 0 箇所
コストの増減               0 箇所
コストバーUI               0 箇所
敗北条件（コスト0以下）    0 箇所
```

**枠としてのコストは在るが、陣営の体力としてのコストが丸ごと無い。**
