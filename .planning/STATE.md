---
gsd_state_version: '1.0'  # placeholder; syncStateFrontmatter overwrites on first state.* call
status: planning
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-17)

**Core value:** にーくらが作ったもの（四皇モン・技・音）が、容量を気にせず保存でき、実際の戦闘に出てくること
**Current focus:** Phase 1 — 足場の地ならし

## Current Position

Phase: 1 of 4 (足場の地ならし)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-08-17 — ROADMAP.md 作成（29件の v1 要件を4フェーズへ全件マップ）

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: SAVE-* と WIRE-* は同一フェーズ（Phase 3）。ファイル保存が配線の前提で、分けるとファイル形式を二度決めることになる
- [Roadmap]: FIX-* を最初（Phase 1）に置く。`verify_*.js` が常に exit 0 で `resolve()` が二重——Phase 3 の安全網が今は壊れているため
- [Roadmap]: MOVE-* は Phase 1 にしか依存しない。Phase 2/3 と独立に進められる
- [PROJECT]: ChromiumOS は採用しない。ローカルサーバー＋`--app` 専用ウィンドウで3条件（軽い・保存できる・Claude に都合がいい）を満たす
- [PROJECT]: `dist/` の base64 焼き込みは維持し、軽量版は `dist-dev/` に別出し

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- **`src/sfx_bank.js` は不可触**（全フェーズ共通）。CC0元素材がこのマシンに無く、616KB のこれが79音の唯一の実体。編集・再生成を計画に入れない
- **`dist/` の単体HTML形式を壊さない**（掟：外部ファイル参照ゼロ）。Phase 2 の軽量化は `dist-dev/` へ、Phase 3 の保存はサーバー不在時に localStorage へフォールバックする
- **SAVE-07（既存データの無損失移行）は Phase 3 の他作業と同じか、それより前**。保存先を変える前に移行経路を用意する
- **決定論を壊さない**：戦闘計算で `Math.random()` と可変 dt を使わない。Phase 4 のモーション追加は `battleRng`／`hash3` と固定タイムステップの内側で行う

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-08-17
Stopped at: ROADMAP.md / STATE.md 作成完了、REQUIREMENTS.md のトレーサビリティ更新済み
Resume file: None
