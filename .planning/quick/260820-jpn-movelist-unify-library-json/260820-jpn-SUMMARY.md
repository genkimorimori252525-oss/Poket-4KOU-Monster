---
status: complete
phase: quick-260820-jpn
plan: 1
subsystem: build-tooling / move-data
tags: [movelist, library-json, build, regression-gate]
dependency-graph:
  requires: []
  provides: [tools/gen_starter.js, tools/migrate_movelist.js, tools/verify_movelist.js]
  affects: [build.js, tools/verify_signature_moves.js, data/moves/library.json, package.json, .planning/config.json]
tech-stack:
  added: []
  patterns:
    - "library.json → STARTER_MOVES の唯一の変換点を tools/gen_starter.js に一本化（build.js とverifyの両方から使い回す）"
    - "status:made/idea/retired で dist焼き込み対象を分ける後方互換フィールド（省略=made）"
key-files:
  created:
    - tools/gen_starter.js
    - tools/migrate_movelist.js
    - tools/verify_movelist.js
  modified:
    - build.js
    - tools/verify_signature_moves.js
    - data/moves/library.json
    - docs/技演出マニュアル.md
    - docs/欲しい素材リスト.md
    - docs/整理_技一覧の一本化.md
    - CLAUDE.md
    - package.json
    - .planning/config.json
  deleted:
    - src/starter_moves.js
    - docs/技ネタ_タイプ別.md
decisions:
  - "genStarterSource は fs/path を持たず、呼び出し側が読んだ library オブジェクトを受け取る形にした（build.js と verify_signature_moves.js の両方から使い回すため）"
  - "migrate_movelist.js は docs/技ネタ_タイプ別.md が存在せんときは即no-opにする分岐を先頭に置き、これを恒久的なidempotenceの土台にした"
metrics:
  duration: "約35分（Task1〜3、検証込み）"
  completed: "2026-08-20"
actuals:
  tokens: 42000
  tasks: 3
  commits: 3
---

# Phase quick-260820-jpn Plan 1: 技一覧を library.json へ一本化 Summary

`data/moves/library.json` を技一覧の唯一の正にし、`src/starter_moves.js`（二重管理の片割れ）と
`docs/技ネタ_タイプ別.md`（180個のネタが文書の中だけに眠っていた技ネタ帳）を廃止した。
`status:"made"/"idea"` で dist への焼き込み対象を分け、`tools/verify_movelist.js` を
恒久的な回帰ゲートとして `npm run verify:movelist` と `workflow.test_command` の両方に登録した。

## What Was Built

### Task 1 — library.json → STARTER_MOVES の生成点を1本化（MOVELIST-01・MOVELIST-02）

- `tools/gen_starter.js` を新規作成。`isMade(rec)`（status省略=made扱いの唯一の判定点）・
  `genStarterEntries(library)`・`genStarterSource(library)` の3関数をexport。fs/pathは持たず、
  呼び出し側が読み込んだ library オブジェクトを受け取る（build.js とverifyの両方から使い回す）。
- `build.js` の `MODULES['/*__STARTER__*/']` を `read('starter_moves.js')` から
  `genStarterSource(library)` に差し替え。`library` は `data/moves/library.json` を
  ビルド時に読んで `JSON.parse` したもの。既存の他の行（STORE/FX_CORE/SFX_BANK/RANGE/MOVES/
  COST/ANIMS/AUDIO_UI/MOVELAB/ROSTER の各read呼び出し・TARGETS配列・dev用の下部ブロック）は
  一切触っていない。
- `src/starter_moves.js` を削除。
- `tools/verify_signature_moves.js` の `addScriptTag({ path: ... starter_moves.js })` を、
  `data/moves/library.json` を読んで `genStarterSource()` した文字列を `content:` で渡す形に
  差し替え。
- `tools/verify_movelist.js` を新規作成。`dist/shioumon_creator.html` を `file://` で開き、
  `STARTER_MOVES.length > 0` を確認する（design doc §6-1）。

### Task 2 — 技ネタ帳180個を追加専用で移し、技ネタ帳を廃止（MOVELIST-03）

- `tools/migrate_movelist.js` を新規作成。`docs/技ネタ_タイプ別.md` が存在せんければ即no-op
  （これが恒久的なidempotenceの土台）。存在すれば18タイプの見出し配下のテーブル行だけを対象に
  パースし（`読み方`／`作りはじめの10個`／`メモ` は無視）、「作り方」列を6種の generator へ
  マップ（未知の値は `throw`）。`library.json` に既に居る名前は一切触らず、居らん名前だけ
  `{name, status:"idea", battle:{type}, hint:{generator, palette}, note}` で追加
  （`fx`・威力・溜め・CDは一切持たせない）。整形（`JSON.stringify(merged)`、`null,2`なし）を
  保って書き込む。
- 実行結果：180行パース → 135件を新規追加（既存45個は無傷）。
- `data/moves/library.json` の既存54キーはHEAD（`dbb47f6`、プラン投入前のコミット）と
  バイト単位で0件不一致（検証済み、下記参照）。
- `tools/verify_movelist.js` に idempotence チェックを追記（`migrate_movelist.js` を
  execFileSync で走らせ、前後のバイト列を比較）。
- `docs/技ネタ_タイプ別.md` を削除。
- `docs/技演出マニュアル.md`・`docs/欲しい素材リスト.md`・`docs/整理_技一覧の一本化.md`・
  `CLAUDE.md` の生きた参照を除去・書き換え（詳細はDeviationsの下ではなく本節に記載——
  すべて計画どおりの通常タスクなので逸脱ではない）。

### Task 3 — 回帰ゲートを完成させ、test_command に登録（MOVELIST-GATE）

- `tools/verify_movelist.js` に made数の一致（dist技棚数 == library.jsonのstatus:madeの数）・
  生存確認（亜空切断・灼熱弾・Codexの14本＝16個の配列を1本ずつ assert）・status別必須項目
  （made: name/fx/battle.type/power/cast/cooldown、idea: name/battle.typeのみ かつ
  `'fx' in rec` が false）を追記。件数サマリ（made/idea/エラー件数）を出力。
- `package.json` に `"verify:movelist": "node tools/verify_movelist.js"` を追加。
- `.planning/config.json` の `workflow.test_command` 末尾に
  ` && node tools/verify_movelist.js` を追記（既存チェーンのスタイルに合わせ、
  他のキーには一切触っていない）。

## Deviations from Plan

None — plan executed exactly as written. Task 1 の tracer検証（`node build.js && node build.js --dev
&& node tools/verify_signature_moves.js && node tools/verify_movelist.js`）は自律実行のためコミット直後に
再実行して確認し、失敗なしでTask 2へ進んだ（interactive checkpointではなくautonomous gate扱い）。

## Verification (observed output)

すべて実際に実行し、以下は生の出力（要約せず貼り付け）。

### 1. `node build.js && node build.js --dev` → 両方4/4

```
built dist/shioumon_effect_lab.html (789 KB)
built dist/shioumon_field_test.html (864 KB)
built dist/shioumon_audio_lab.html (750 KB)
built dist/shioumon_creator.html (947 KB)
4 / 4 個ビルドした
built dist/shioumon_effect_lab.html (789 KB)
built dist/shioumon_field_test.html (864 KB)
built dist/shioumon_audio_lab.html (750 KB)
built dist/shioumon_creator.html (947 KB)
4 / 4 個ビルドした
dev: 効果音 79 件を取り出した
dev: shioumon_effect_lab.html  789 KB → 195 KB (25%)
dev: shioumon_field_test.html  864 KB → 269 KB (31%)
dev: shioumon_audio_lab.html  750 KB → 156 KB (21%)
dev: shioumon_creator.html  947 KB → 353 KB (37%)
dev: se/ 79 本 / 446 KB
4 / 4 個 dist-dev へビルドした
EXIT_BUILD=0 / EXIT_BUILD_DEV=0
```

### 2. `node tools/verify_movelist.js` → exit 0

```
movelist  dist の技棚: 54本
movelist  made=54  idea=135  エラー=0件

verify_movelist: 全部通った
EXIT_MOVELIST=0
```

### 3. `node tools/verify_signature_moves.js` → exit 0

```
（14技それぞれの generator/className/atk0/atk100/range が一致した行が14行、省略）
ブラックキック    black_kick/BlackKickFX  11595/82ccccf4  atk0=6664 atk100=20822  parts=0  range=melee
ブラックパンチ    black_punch/BlackPunchFX  9466/9276a102  atk0=5907 atk100=20931  parts=0  range=melee
ブラックショット   black_shot/BlackShotFX  5733/5bd35eb6  atk0=2960 atk100=13494  parts=0  range=ranged

verify_signature_moves: 全部通った   tools\_signature-moves-shot.png
EXIT_SIG=0
```

### 4. `node tools/verify_style.js` → exit 0

```
slash   arc:10139/87778254  cross:13012/6fc55359  thrust:15570/66ee71c1  fan:9870/2bd63521  spiral:17300/072561e2
beam    straight:4295/ee7da961  wave:4132/3d4a6e59  twin:2736/c971b3f7  spiral:2739/eaae9adf  cone:5067/0f7c5afb
default  slash 87778254 = arc 87778254
default  beam  ee7da961 = straight ee7da961
movelab  style=形 / slash・beam の選択肢 ok

verify_style: 全部通った   tools\_style-shot.png
EXIT_STYLE=0
```

### 5. `node tools/verify_power_scale.js` → exit 0

```
a 画素    atk0:3849  atk50:5583  atk100:10611
b 比      atk0:8.64/8=1.080  atk50:12.00/12=1.000  atk100:21.00/21=1.000   ズレ 8.0%
補助 判定 atk0:radius 12.00(sz 0.75)  atk50:radius 16.00(sz 1.00)  atk100:radius 25.60(sz 1.60)
決定論    ok
c 既定slash   c12c9221  atk0:904  atk50:904  atk100:904
d shatter   ead19dd3  atk0:17834  atk50:17834  atk100:17834
d roar_time 1e95fd23  atk0:3706  atk50:3706  atk100:3706
e 連動OFF     cec63e33  atk0:5583  atk50:5583  atk100:5583
e 判定     halfWidth 12.00 / 12.00 / 12.00
defect2    遠距離 ON→false / 近接 対象外（押せん:true）

verify_power_scale: 全部通った   tools\_power-scale-shot.png
EXIT_POWER=0
```

### 6. 不変条件#1の実証（既存54キーが1バイトも変わっとらんか）

`git show dbb47f6:data/moves/library.json`（プランをこのquickへ投入した直前のコミット＝作業前の
基準）を `JSON.parse` し、現在の `data/moves/library.json` と同じキーで `JSON.stringify` を
比較した。

```
base commit: dbb47f6 (the plan commit, before this quick task)
pre-existing keys checked: 54  changed: 0
total: 189  made: 54  idea: 135  retired: 0
```

**変わった既存キー: 0件。** 54本すべてバイト単位で無傷。

### 7. 最終レコード件数

| 区分 | 件数 |
|---|---|
| 総数 | 189 |
| made（status省略含む） | 54 |
| idea | 135 |
| retired | 0 |

内訳：既存54本（亜空切断・灼熱弾・元技ネタ帳45個相当・Codex14本含む） + 技ネタ帳から移した
135個（180個中、既存と名前が一致した45個を除いた残り）。

## Could Not Verify

- design doc §6-5「`learnable` を持つ個体で `moves ⊆ learnable` が成り立っとる」チェックは
  **未実装**。design doc第4節（`learnable`・覚える表）はこのquickのスコープ外（objectiveに
  明記のとおり、別フェーズで実装予定）。現時点でどの四皇モン個体データも `learnable` を
  持っていないため、このチェック自体が対象データを持たない。

## Known Stubs

なし。idea レコードは意図的に `fx`/数値フィールドを持たない設計（design doc §6-3で明示された
仕様どおりで、スタブではなく「未着手を明示するための空欄」）。

## Self-Check: PASSED

- `tools/gen_starter.js` — FOUND
- `tools/migrate_movelist.js` — FOUND
- `tools/verify_movelist.js` — FOUND
- `src/starter_moves.js` — CONFIRMED ABSENT（削除どおり）
- `docs/技ネタ_タイプ別.md` — CONFIRMED ABSENT（削除どおり）
- commit `802e065`（refactor(build): 技の棚を library.json から組む） — FOUND in `git log`
- commit `c971f9b`（feat(data): 技ネタ帳180個をlibrary.jsonへ移し） — FOUND in `git log`
- commit `773c324`（test(build): 技一覧の回帰ゲートを完成させ） — FOUND in `git log`
- `git status --short` — クリーン（コミット漏れなし）
