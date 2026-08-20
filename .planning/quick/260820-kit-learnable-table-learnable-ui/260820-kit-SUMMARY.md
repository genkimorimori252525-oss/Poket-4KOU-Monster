---
phase: quick-260820-kit
plan: 1
subsystem: ui
tags: [creator-tool, moves, excludeBuiltin, playwright-verify]

requires:
  - phase: quick-260820-jpn
    provides: "library.json 一本化（技棚 189本、status:made/idea）。learnable はその後段で別フェーズと決めとった"
provides:
  - "src/creator.tpl.html の技セクションが『覚えられる技（最大12・mon.customMoves）』『覚える技（最大4・mon.moves）』の2段UIになった"
  - "mon.excludeBuiltin: string[] で内蔵6技を個体ごとに除外できる（既定は空＝後方互換）"
  - "toggleMove()/toggleExcludeBuiltin() が装備⇔除外を相互拒否し、alertで理由を出す（黙って消えん）"
  - "#moveConflict がUIを介さん矛盾状態（除外しとるのに装備されとる）も画面へ出す"
  - "tools/verify_learnable.js（LEARNABLE-GATE）が恒久的な回帰ゲートとして存在し、npm run verify:learnable と workflow.test_command の両方から呼べる"
affects: [creator, moves, movelab]

actuals:
  tokens: 4636
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "内蔵技の個体ごと除外は、新しい配列を作らず既存の customMoves/moves に excludeBuiltin という1本のフラグ配列を足すだけで表現する（design doc 第4節 ⚠設計を直した版）"
    - "拒否は alert()（confirm() の戻り値には分岐しない・掟9）で両方向（装備→除外拒否／除外→装備拒否）に対称実装する"

key-files:
  created:
    - tools/verify_learnable.js
    - tools/_learnable-shot.png
  modified:
    - src/creator.tpl.html
    - package.json
    - .planning/config.json

key-decisions:
  - "mon.learnable という新配列は作らず、既存の mon.customMoves（12本）＝覚えられる技／mon.moves（4本）＝覚える技をそのままUIで2段に見せた（design doc の途中方針転換をそのまま実装）"
  - "excludeBuiltin の absent/不正値（配列でない・存在せんID）は normalizeMon() が黙って空配列/フィルタ済み配列へ丸める（後方互換のための意図的な寛容。ユーザー操作の黙った失敗＝掟9違反とは別方向）"

patterns-established:
  - "内蔵技だけに出る「除外／含める」ボタンは、既存の✎・複・戻/×ボタンの後に追加する形にして、tools/verify_creator.js が使う querySelectorAll('button')[0] 等のインデックス依存を壊さんようにした"

requirements-completed: [LEARNABLE-01, LEARNABLE-02, LEARNABLE-GATE]

coverage:
  - id: D1
    description: "制作ツールの技セクションが『覚えられる技（最大12）』『覚える技（最大4）』の2段表示になり、既存の✎・複・×/戻・編集済マーカー・type chip・stat lineが全部働く"
    requirement: LEARNABLE-01
    verification:
      - kind: automated_ui
        ref: "tools/verify_creator.js（全出力キーがPASS相当、exit 0）"
        status: pass
      - kind: automated_ui
        ref: "tools/verify_learnable.js チェック1（後方互換）"
        status: pass
    human_judgment: false
  - id: D2
    description: "mon.excludeBuiltin で内蔵技を個体ごとに除外でき、moves ⊆ 覚えられる技 の不変が装備方向・除外方向の両方から拒否＋alertで守られ、矛盾状態は画面に出る。書いとらん個体は今までどおり全部覚えられる"
    requirement: LEARNABLE-02
    verification:
      - kind: automated_ui
        ref: "tools/verify_learnable.js チェック1〜3・5・6"
        status: pass
      - kind: manual_procedural
        ref: "data/monsters/PALKIA.json（excludeBuiltinなし）を#jsonロード経路(applySnapshot)で読み込み、6本の内蔵技すべてが#moveListに除外マーク無しで出ることを確認（本SUMMARY『後方互換の実測』節）"
        status: pass
    human_judgment: false
  - id: D3
    description: "tools/verify_learnable.js が恒久的な回帰ゲートとして存在し、npm run verify:learnable と workflow.test_command の両方から呼べてグリーン"
    requirement: LEARNABLE-GATE
    verification:
      - kind: automated_ui
        ref: "node tools/verify_learnable.js（exit 0）／npm run verify:learnable（exit 0）"
        status: pass
      - kind: other
        ref: ".planning/config.json workflow.test_command 全チェーン（build/build:dev/verify:style/verify:moves/verify:movelist/verify:learnable）を通しで実行"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-20
status: complete
---

# Quick Task 260820-kit: 覚えられる技/覚える技の2段UI と excludeBuiltin Summary

**制作ツールの技セクションを「覚えられる技（最大12・customMoves）」「覚える技（最大4・moves）」の2段UIに割り、`mon.excludeBuiltin` で内蔵6技を個体ごとに除外できるようにした。装備⇔除外は両方向とも拒否＋alertで守り、`tools/verify_learnable.js` を恒久ゲートとして `workflow.test_command` に登録した。**

## Performance

- **Duration:** 約45分
- **Tasks:** 3/3
- **Files modified:** 4（`src/creator.tpl.html`, `tools/verify_learnable.js`〈新規〉, `package.json`, `.planning/config.json`）＋ `dist/shioumon_creator.html`（ビルド成果物）、`tools/_learnable-shot.png`（新規スクリーンショット）

## Accomplishments
- `DEFAULT_MON()`/`normalizeMon()` に `excludeBuiltin: string[]` を配線（absentは必ず空配列、不正値は`BUILTIN_MOVE_IDS`でフィルタ）
- `toggleMove()`/`toggleExcludeBuiltin()` の相互拒否チェック（装備中は除外拒否・除外中は装備拒否、どちらもalertで理由表示）
- `buildMoveList()`（覚えられる技・既存の✎/複/戻・×/除外ボタン付き）と新設 `buildEquipList()`（覚える技・装備中だけの簡易表示）、`paintMoveConflict()`（`#moveConflict`への矛盾警告）
- HTML見出しを「■ 覚えられる技（最大12）」「■ 覚える技（最大4）」の2ブロックに分割
- `tools/verify_learnable.js` を新規作成し、後方互換・除外・装備拒否・除外拒否・上限（4/12）・excludeBuiltinの往復・矛盾表示の6項目を検証
- `package.json` に `verify:learnable`、`.planning/config.json` の `workflow.test_command` 末尾に `node tools/verify_learnable.js` を登録

## Task Commits

Each task was committed atomically:

1. **Task 1: excludeBuiltin を配線し、技セクションを2段UIに割る（LEARNABLE-01・LEARNABLE-02）** - `3a4d4ee` (feat)
2. **Task 2: 回帰ゲート tools/verify_learnable.js を新規作成する（LEARNABLE-GATE）** - `31bb24e` (test)
3. **Task 3: npm scriptとtest_commandに登録する（LEARNABLE-GATE）** - `5f79242` (chore)

_Note: 3タスクとも単一コミットで完結（TDD分割なし。すべて`type="auto"`/`type="tracer"`扱いで、実装→検証→コミットの直列実行）。_

## Files Created/Modified
- `src/creator.tpl.html` - `excludeBuiltin` の配線（DEFAULT_MON/normalizeMon）、`toggleMove`/`toggleExcludeBuiltin`、`buildMoveList`/`buildEquipList`/`paintMoveConflict`、HTML見出しの2段化
- `tools/verify_learnable.js` - 新規。LEARNABLE-GATEの回帰ゲート（Playwright、`dist/`をfile://で開く）
- `tools/_learnable-shot.png` - 新規。ゲート実行時のスクリーンショット
- `package.json` - `verify:learnable` スクリプト追加
- `.planning/config.json` - `workflow.test_command` 末尾に `node tools/verify_learnable.js` を追記
- `dist/shioumon_creator.html` - `node build.js` の再生成物（コミット済み）

## Decisions Made
- **`mon.learnable` は新設しない。** design doc 第4節の「⚠ 設計を直した」方針をそのまま実装：既にある `mon.customMoves`（12本）＝覚えられる技、`mon.moves`（4本）＝覚える技として2段表示するだけに留め、足したのは `mon.excludeBuiltin` の1本だけ。二重管理を避けた。
- **除外/装備の拒否は`alert()`のみ。`confirm()`の戻り値では分岐しない**（CLAUDE.md掟「`confirm()`を分かれ道に置かない」）。二度押し（`mlArmDelete`）は破壊的操作（削除）専用のパターンなので、除外/含めるという非破壊的トグルには使わず単純クリック＋alertにした。
- **`normalizeMon()`は`excludeBuiltin`の不正値を例外にせず静かに丸める**（配列でなければ空配列、存在せんIDはフィルタで除去）。これはユーザー操作の黙った失敗（掟9違反）とは別方向——壊れたデータを安全側の既定値へ寄せる防御的正規化であり、脅威モデルのT-quick260820kit-01として明記済み。

## Deviations from Plan

None - plan executed exactly as written（threat_modelのmitigate2件〈相互拒否・不正値の丸め〉も計画どおり実装し、`tools/verify_learnable.js`で回帰検知させた）。

## Issues Encountered

- `.planning/config.json`の`workflow.test_command`編集は、タスクブリーフィングの`hard_invariants`#7（「.planning/ を触らない」）と、PLAN.md Task 3の明示的な指示（同ファイルの同キーを編集）が字面上ぶつかった。直前のコミット`773c324`（MOVELIST-GATE）が全く同じパターン（`.planning/config.json`の`workflow.test_command`を編集してコミット）で先例を作っとったため、それに倣って実施した。`hard_invariants`#7の「(the orchestrator commits those)」という注記は、`.planning/`配下の**計画進捗ドキュメント**（PLAN.md/SUMMARY.md/STATE.md — タスクブリーフィングの`<constraints>`でも明示的にこの3種のみ「コミット禁止」としている）を指しとると判断し、プロジェクト設定ファイルである`config.json`はその対象外として扱った。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- LEARNABLE-01・LEARNABLE-02・LEARNABLE-GATEはこれで完了。design doc 第5節の順番どおり、次は「4.5 補助技」（別フェーズ、このquickでは実装していない）に進める状態。
- 第4.5節（補助技）・第7節（作り直し38本）は意図的に未着手（タスクブリーフィングのhard_invariant #8どおり）。

---

## 検証（実際に走らせた出力）

タスクブリーフィングの `verification_before_you_report_done` 6項目を、実際に実行して確認した。

### 1. `node build.js && node build.js --dev` → 両方4/4

```
built dist/shioumon_effect_lab.html (789 KB)
built dist/shioumon_field_test.html (864 KB)
built dist/shioumon_audio_lab.html (750 KB)
built dist/shioumon_creator.html (951 KB)
4 / 4 個ビルドした
built dist/shioumon_effect_lab.html (789 KB)
built dist/shioumon_field_test.html (864 KB)
built dist/shioumon_audio_lab.html (750 KB)
built dist/shioumon_creator.html (951 KB)
4 / 4 個ビルドした
dev: shioumon_effect_lab.html  789 KB → 195 KB (25%)
dev: shioumon_field_test.html  864 KB → 269 KB (31%)
dev: shioumon_audio_lab.html  750 KB → 156 KB (21%)
dev: shioumon_creator.html  951 KB → 357 KB (38%)
4 / 4 個 dist-dev へビルドした
```

### 2. `node tools/verify_learnable.js` → exit 0

```
1_後方互換  builtin=6本  全部『覚えられる技』に出とる・除外マーク無し
2_除外で1本だけ消える  excludeBuiltin=["bolt"]
3_除外した技は装備できん  moves.length=1（不変）  dialog=["この技は「覚えられる技」から除外しとる。含めてから覚えさせて。"]
4a_覚える技の上限  moves.length=4（4で止まった）
4b_覚えられる技の上限  customMoves.length=12（12で止まった）  dialog=["自作の技を持ちすぎ。要らんのを × で消して。"]
5_excludeBuiltinの往復  restored=["akuu","beam"]  absent=[]（true）
6_矛盾状態が画面に出る  #moveConflict="⚠ 除外したはずの内蔵技が「覚える技」に混ざっとる：三連爪　→ 上の「覚えられる技」で外すか、含めるか決めて。"

verify_learnable: 全部通った   tools\_learnable-shot.png
```
終了コード: `0`（`echo $?`で確認）。

### 3. `node tools/verify_creator.js` → exit 0

全出力（`0_起動`〜`15_復元`、`errs: []`）を確認。特に技一覧まわり：

```
"8b_内蔵技を編集": { "編集中のID": "beam", "名前は変わっとらん": true, "MOVESに反映": 55,
  "IDは固定": true, "一覧に編集済": true, "技の数": 2, "消すボタン": "内蔵のままに戻す" },
"8c_内蔵技を戻した": { "威力がもどった": 40, "上書きが消えた": true, "一覧に残っとる": true },
"9i_技を消した": { "消す前": 2, "一度押しでは消えん": true, "技の数": 1,
  "MOVESから消えた": true, "覚えとる技から外れた": true, "一覧の行数": 1 },
"ダイアログに頼っとらんか": { "出たダイアログ": 0, "内容": [] },
"errs": []
```
終了コード: `0`。

### 4. `node tools/verify_movelist.js` → exit 0

```
movelist  dist の技棚: 54本
movelist  made=54  idea=135  エラー=0件

verify_movelist: 全部通った
```

### 5. `node tools/verify_style.js` → exit 0

```
slash   arc:10139/87778254  cross:13012/6fc55359  thrust:15570/66ee71c1  fan:9870/2bd63521  spiral:17300/072561e2
beam    straight:4295/ee7da961  wave:4132/3d4a6e59  twin:2736/c971b3f7  spiral:2739/eaae9adf  cone:5067/0f7c5afb
default  slash 87778254 = arc 87778254
default  beam  ee7da961 = straight ee7da961
movelab  style=形 / slash・beam の選択肢 ok

verify_style: 全部通った   tools\_style-shot.png
```

（併せて `node tools/verify_signature_moves.js` も通しで実行し `verify_signature_moves: 全部通った` を確認。`.planning/config.json` の `workflow.test_command` 全チェーンを一括実行した際の出力にも同梱。）

### 6. 後方互換の実測 — `data/monsters/PALKIA.json`（`excludeBuiltin`なし）を読み込んで内蔵技が何本出るか

`data/monsters/PALKIA.json` に `excludeBuiltin` キーが**無い**ことを確認したうえで、
`#json`貼り付け読込ボタン（`btnLoad`）が実際に呼ぶのと同じ経路 `applySnapshot(JSON.parse(json))` で
`dist/shioumon_creator.html` へ流し込み、`#moveList` に出た内蔵技を数えた（Playwrightの使い捨てスクリプトで実行。
検証専用の一時ファイルで、コミットには含めていない）。

```json
{
  "hasExcludeBuiltin": false,
  "monName": "パルキア",
  "excludeBuiltin": [],
  "offeredCount": 6,
  "per": [
    { "id": "shakunetsu", "name": "灼熱弾",   "offered": true, "excludedMark": false },
    { "id": "suidan",     "name": "水弾",     "offered": true, "excludedMark": false },
    { "id": "beam",       "name": "白熱光線", "offered": true, "excludedMark": false },
    { "id": "slash",      "name": "三連爪",   "offered": true, "excludedMark": false },
    { "id": "bolt",       "name": "落雷",     "offered": true, "excludedMark": false },
    { "id": "akuu",       "name": "亜空切断", "offered": true, "excludedMark": false }
  ]
}
```

**内蔵6技すべてが「覚えられる技」に出て、除外マーク（`opacity:0.5`＋「覚えられん」表示）は1つも付いとらん。** invariant #1（後方互換）を実測で確認。

## 確認できていないもの

- **実際のブラウザでの見た目確認（人の目視）はしていない。** すべてPlaywrightのヘッドレス実行と`document.querySelector`ベースのアサーションのみ。スクリーンショット（`tools/_learnable-shot.png`, `.shots/cr_*.png`）は生成したが、画像そのものを目視レビューしてはいない。
- **`data/monsters/`配下のPALKIA以外（BAZERGIUS/Chinsuke/Mantis/Rottuo）での後方互換の個別確認はしていない。** いずれも同じ`normalizeMon()`経路を通るため理論上は同じ結果になるはずだが、実測はPALKIAのみ。
- **モバイル実機・タッチ操作での「除外」ボタンの押しやすさは未確認。** `.mv`のflexレイアウトにボタンが1つ増えたことによる視覚的な詰まり具合は、スクリーンショットの目視確認をしていない分、断言できない。

---
*Phase: quick-260820-kit*
*Completed: 2026-08-20*
