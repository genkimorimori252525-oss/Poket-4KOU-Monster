---
gsd_state_version: 1.0
current_phase: 3
current_phase_name: ファイル保存と戦闘への配線
status: ready
stopped_at: Phase 2 complete — STOPPED before Phase 3 pending owner localStorage backup
last_updated: "2026-08-18T00:00:00.000Z"
last_activity: 2026-08-18
last_activity_desc: Phase 2 完了（SHELL-01〜05 全件。dist-dev/ で 69〜87%減）
state_head: 55b7adc
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 3
  completed_plans: 3
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-17)

**Core value:** にーくらが作ったもの（四皇モン・技・音）が、容量を気にせず保存でき、実際の戦闘に出てくること
**Current focus:** Phase 3 — ファイル保存と戦闘への配線

## Current Position

Phase: 3 of 4 (ファイル保存と戦闘への配線) — 未着手
Plan: 0 of ? in current phase
Status: **停止中** —— にーくらによる localStorage のバックアップ待ち
Last activity: 2026-08-18 — Phase 2 完了（SHELL-01〜05 全件）

Progress: [█████░░░░░] 50%（2/4 フェーズ完了）

### ⚠ Phase 3 に入る前に必要なこと

**にーくら本人の手が要る。** Phase 3 は保存先を localStorage からファイルへ移す工事で、
移行元（作った四皇モン・技・音設定）はブラウザの中にあり **git の外**にある。Claude からは見えない。

制作ツールを開いて F12 → Console で下記を実行し、落ちた JSON をプロジェクトフォルダへ置くこと。

```js
(()=>{const d=JSON.stringify(Object.fromEntries(Object.entries(localStorage)),null,1);const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([d],{type:"application/json"}));a.download="shioumon_backup_"+Date.now()+".json";a.click();})()
```

**保存データは開き方（オリジン）ごとに別の箱**やけん、`file://` と `http://localhost` の
心当たりのある開き方すべてで取ること（その箱が空なら `{}` だけの JSON が落ちてくる）。

落ちた JSON をリポジトリ内に置いてもらえれば、移行コードを**実物のデータ構造を見ながら**書ける。
推測で書かずに済むし、SAVE-07（1件も失わずに移行する）の検証にも使える。

### Phase 1 完了記録（2026-08-18）

FIX-01〜07 の7件すべて完了。検証は SUMMARY をなぞらず**コードベースに対して独立に再実行**して 5/5 passed。

- `tools/verify_audio.js` / `verify_ui.js` が JS エラーで非ゼロ終了するようになった（従来は常に exit 0）
- D-08（オーナー承認）: 決定論チェック `det.ok` の失敗も非ゼロ終了に含まれる
- `tools/verify_resolve.js` 新設 —— `battle` と `creator` の `resolve()` を36通りで突き合わせる。
  故意に食い違わせると16件を名指しで検出（16は手計算の予測と一致。`key='back'` を直接要求する
  ケースは両実装が必然的に同じ値へ収束するため、full/none の2セットで差が出ない）
- `npm run verify` は4段（audio → ui → creator → resolve）。最初の失敗で連鎖が止まる
- `src/fx_audio.js`（デッド15KB）削除、`audiolab.tpl.html` の未使用 `ANIMS` 除去
- 音ラボのリセットが `confirm()` から二度押し（`alArmDelete()`）へ
- `CLAUDE.md` を実装に合わせて訂正（鳴き声圧縮は手動・意図的／Google Fonts は「外部参照ゼロ」の唯一の明示例外）

**不可触物件の確認:** `src/sfx_bank.js` は codebase-map 時点（`403b730`）と SHA256 完全一致。

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
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01-groundwork P01 | 20min | 2 tasks | 2 files |
| Phase 01-groundwork P02 | 約35分 | 3 tasks | 5 files |
| Phase 01 P03 | 28min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: SAVE-* と WIRE-* は同一フェーズ（Phase 3）。ファイル保存が配線の前提で、分けるとファイル形式を二度決めることになる
- [Roadmap]: FIX-* を最初（Phase 1）に置く。`verify_*.js` が常に exit 0 で `resolve()` が二重——Phase 3 の安全網が今は壊れているため
- [Roadmap]: MOVE-* は Phase 1 にしか依存しない。Phase 2/3 と独立に進められる
- [PROJECT]: ChromiumOS は採用しない。ローカルサーバー＋`--app` 専用ウィンドウで3条件（軽い・保存できる・Claude に都合がいい）を満たす
- [PROJECT]: `dist/` の base64 焼き込みは維持し、軽量版は `dist-dev/` に別出し
- [Phase 1]: D-08（オーナー承認・2026-08-17）: 決定論チェック(det.ok)の失敗も verify_ui.js の非ゼロ終了に含めた。新しい終了経路・新しい判定基準は作らず、既存の allErrs へ合流させるだけに留めた
- [Phase 1]: Task 2 は「壊れたら落ちる」ことをコード査読ではなく実行記録（4回ぶんの終了コード＋stderr）で証明する形にした（D-07）
- [Phase 1]: 01-02: Task1のprecondition偽陽性(dist/のgit status M)はWindowsのcore.autocrlf=trueによるindex statキャッシュ陳腐化と判明。git hash-objectでHEADと内容完全一致を確認しgit update-index --refreshで解消(内容変更なし)
- [Phase 1]: 01-02: FIX-02のalArmDelete armedText文言は計画の明示指示どおり「戻す？」を採用(creator.tpl.html自身のデフォルト「消す？」とは不一致だが、より具体的な指示を優先)
- [Phase 1]: 01-02: FIX-02をTDDのRED(test:検査追加、旧実装でexit=1を実行確認)→GREEN(feat:alArmDelete実装、exit=0)の2コミットに分離して記録
- [Phase 1]: FIX-07: Fighter.prototype 経路を採用（Fighterグローバルが解決できたため、フォールバックのObject.getPrototypeOf(partyA[0])は未使用）
- [Phase 1]: Task 2 で racy git 偽陽性（dist/shioumon_field_test.htmlのstatキャッシュ陳腐化）をgit add（内容無変更）で解消
- [Phase 1]: resolve()食い違い検証の実測16件（想定18件）は数学的必然のtieと判断し、テストデータは改変しなかった。詳細は01-03-SUMMARY.mdの調査節

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

Last session: 2026-08-17T15:03:38.961Z
Stopped at: Completed 01-03-PLAN.md (Phase 1 complete)
Resume file: None
