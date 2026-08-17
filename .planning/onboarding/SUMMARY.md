# Onboarding Summary

## Project State
- PROJECT.md: present
- REQUIREMENTS.md: present
- ROADMAP.md: present
- STATE.md: present

## Codebase Context
- Brownfield repo: yes
- Map readiness: complete
- Codebase map: complete
- Fast map available: yes

## Docs Context
- Existing ADR/PRD/SPEC/RFC candidates: 0
  （`docs/開発計画_v6.md` はゲーム本編の正典として**そのまま据え置き**。GSD は開発基盤だけを管理する）

## オンボーディングで判明した要点

コードベースマップ（`.planning/codebase/`、7文書1573行）から出た、計画に効く発見：

1. **制作ツールで作った四皇モンは戦闘に出ていない。** `src/battle.tpl.html` は localStorage を
   一切読まず、出場するのは `ROSTER_A`/`ROSTER_B` のベタ書き個体だけ（`battle.tpl.html:769-796`）。
   → Phase 3（WIRE-01〜05）
2. **保存が 5MB 枠に迫っている。** `shioumon_creator_slots` と `shioumon_wild_pool_v1` は
   設計上上書きせず積み上がる。鳴き声は最大3MB弱まで素通しで入る（圧縮は掟8により手動・意図的）。
   → Phase 3（SAVE-01〜07）
3. **`src/sfx_bank.js`（616KB・79音）は復元不可。** `tools/gen_sfx.py` が要求する CC0パック2種が
   このマシンに存在しない。全フェーズを通して不可触。→ STATE.md Blockers
4. **検証スクリプトが嘘をつく。** `verify_audio.js` / `verify_ui.js` はエラー検出時も常に exit 0。
   → Phase 1（FIX-03）。これが Phase 3 の安全網なので先に直す
5. **`resolve()` が二重実装。** `battle.tpl.html:474` と `creator.tpl.html:464` でシグネチャ違い。
   掟4が「必ず同じ判断にする」と要求する当の箇所。→ Phase 1（FIX-07）
6. **`dist/` は 2.97MB、その 81% が `sfx_bank.js`。** 4ファイルすべてに 616KB が重複コピーされている。
   → Phase 2（SHELL-02/03、`dist-dev/` として別に軽量版を出す）
7. **掟違反が1件実在。** `audiolab.tpl.html:359` の `confirm()`。→ Phase 1（FIX-02）
8. **ドキュメントと実装のズレが1件。** `CLAUDE.md:216` の「鳴き声は読み込み時に自動で圧縮」は
   実装と食い違う（実装は手動・意図的）。→ Phase 1（FIX-05）

## Recommended Next Step
- `/gsd-manager`
- または直接 `/gsd-plan-phase 1`（足場の地ならし）
