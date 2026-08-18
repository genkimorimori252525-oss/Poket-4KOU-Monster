# Roadmap: ポケット四皇モンスター（開発基盤）

## Overview

このマイルストーンが直すのは、**にーくらが作ったものが残らない／出てこない**という一点。
まず嘘をつく検証ツールと掟違反を片付けて足場を固め（Phase 1）、次に保存の器になる
ローカルサーバーと軽い開発用ビルドを立てる（Phase 2）。その上で保存を localStorage の
5MB 枠からファイルへ出し、同じフェーズで制作ツール→戦闘の配線を通す（Phase 3、ここが本丸）。
最後に、技に「近接／遠距離／遠隔」の分類を入れて相殺と既定モーションをそこから導く（Phase 4）。

ゲーム本編（`docs/開発計画_v6.md`）には触らない。`src/sfx_bank.js` は全フェーズを通して不可触。
`dist/` の「外部ファイル参照ゼロ・単体で開ける」は最後まで壊さない。

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: 足場の地ならし** - 掟違反・デッドコード・嘘をつく検証ツールを片付け、後続2フェーズを安全に走らせる土台にする ✓ 2026-08-18（検証 5/5 passed）
- [x] **Phase 2: 開発シェル** - ローカルサーバー＋`--app` 専用ウィンドウ＋`dist-dev/` 軽量ビルドで、起動と読み込みの痛みを取る
- [x] **Phase 3: ファイル保存と戦闘への配線** - 保存を `data/` 以下のファイルへ移し、作った四皇モンを戦闘に出す（本丸）
- [x] **Phase 4: 技の分類と既定モーション** - 技に「近接／遠距離／遠隔」を入れ、相殺と既定の動きをそこから導く

## Phase Details

### Phase 1: 足場の地ならし

**Goal**: 掟違反とデッドコードが消え、検証ツールが壊れを見逃さなくなる
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07
**Success Criteria** (what must be TRUE):

  1. わざと壊した `dist/` に対して `node tools/verify_ui.js` と `node tools/verify_audio.js` を走らせると、エラーを表示して**非ゼロで落ちる**（今はどちらも常に「通った」ように見える）
  2. 音ラボの削除操作で OS のダイアログが出なくなり、同じボタンをもう一度押す形で消える
  3. `src/fx_audio.js` と `build.js` のトークン、`audiolab.tpl.html` の未使用 `ANIMS` が消えた状態で `node build.js` が通り、4画面が今まで通り開く
  4. `battle.tpl.html` と `creator.tpl.html` の `resolve()` が食い違ったとき、検証がそれを検出して落ちる（今は黙って絵と倍率が入れ替わる）
  5. `CLAUDE.md` と掟の記述が実装と一致している——鳴き声の圧縮は「手動・意図的」と書かれ、Google Fonts の外部ロードは解消されるか「外部参照ゼロ」の明示的な例外として記録されている

**Plans**: 3/3 plans executed

Plans:

- [x] 01-01-PLAN.md — 検証の網を張る（FIX-03）。`verify_audio.js` / `verify_ui.js` を JS エラーで非ゼロ終了させ、故意に壊して落ちることを実証する【wave 1・tracer】
- [x] 01-02-PLAN.md — 掟違反とデッドコードを消す（FIX-01 / FIX-02 / FIX-04）。旧音源の削除、未使用インクルードの除去、初期化ボタンの二度押し化【wave 2】
- [x] 01-03-PLAN.md — `resolve()` の食い違い検出と掟の記述の訂正（FIX-05 / FIX-06 / FIX-07）【wave 3】

**このフェーズを最初に置く理由**: Phase 3 はこのプロジェクトで一番危ない作業（保存先の移動＋既存データ移行）で、
その安全網が `verify_*.js` と `resolve()` の一致。両方が今は壊れている。先に直しておかないと、
Phase 3 の「通った」が信用できない。7件とも独立した小さい修正なので、ここで足止めにはならない。

### Phase 2: 開発シェル

**Goal**: アイコン一発でダッシュボードが専用ウィンドウに出て、そこから開く開発用の画面が軽く立ち上がる
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05
**Success Criteria** (what must be TRUE):

  1. デスクトップのアイコンをダブルクリックすると、タブも URL バーも無い専用ウィンドウが Chromium で開く
  2. `dist-dev/` の各画面が現状（693〜864KB）から大幅に軽くなり、体感で明らかに速く開く。音は鳴らした瞬間に初めて読み込まれる
  3. `dist-dev/` を作った後も、`dist/` の4ファイルと `src/sfx_bank.js` が**1バイトも変わっていない**（`git status` に出てこない）
  4. サーバーが1コマンドで立ち上がり、この土台一式を別のプロジェクトフォルダへコピーしても同じ手順で動く
  5. その専用ウィンドウにダッシュボードが出て、作った四皇モンの一覧と最終更新・技の本数・保存容量・検証が通っているかが一目で分かり、そこから4画面それぞれへ入れる

**Plans**: 3/3 plans executed

Plans:

- [x] 02-01-PLAN.md — シェルの貫通線。Bun サーバー＋`--app` 専用ウィンドウ＋ダッシュボードの骨格、検証結果ファイル（SHELL-01 / SHELL-04 / SHELL-05）【wave 1・tracer】
- [x] 02-02-PLAN.md — 軽い開発ビルド。`build.js --dev` で音を `dist-dev/se/` へ外出しし遅延デコードへ。`dist/` と `src/sfx_bank.js` の不変ゲート（SHELL-02 / SHELL-03）【wave 2】
- [x] 02-03-PLAN.md — ダッシュボードの中身（一覧・技の本数・保存容量・軽量化の実測）と持ち出しの実証（SHELL-05 / SHELL-04）【wave 3】

**制約**: 軽量化は `src/sfx_bank.js` を触らずに達成する（元素材が無く、616KB のこれが79音の唯一の実体）。
`dist/` は単体HTMLのまま、外部ファイル参照ゼロを維持する。軽い版は `dist-dev/` に**別に**出す。

### Phase 3: ファイル保存と戦闘への配線

**Goal**: 作った四皇モン・技・音がファイルとして残り、その個体が戦闘に出てくる
**Mode:** mvp
**Depends on**: Phase 2（ファイル保存にはローカルサーバーが要る）
**Requirements**: SAVE-01, SAVE-02, SAVE-03, SAVE-04, SAVE-05, SAVE-06, SAVE-07, WIRE-01, WIRE-02, WIRE-03, WIRE-04, WIRE-05
**Success Criteria** (what must be TRUE):

  1. 制作ツールで保存した四皇モンが `data/` 以下のファイルとして現れ、容量の警告を出さずに何体でも保存できる。技ライブラリ・音設定・草むらプール・シーン音・自動保存も同じくファイルになり、Claude が直接読み書きできる
  2. 今 localStorage に入っている四皇モン・技・音設定が**1件も欠けずに**ファイルへ移り、移行後も同じものが画面に並ぶ
  3. サーバーを止めて `dist/` の単体HTMLを `file://` で開いても今まで通り保存でき、サーバーを立てて開けば `file://` で作ったものと同じ保存データが見える
  4. 保存を壊しても `git checkout` で元に戻せる
  5. 戦闘テスト画面のロスターで保存済みの四皇モンを選んで出場させると、その個体の影・鳴き声・自作技が実戦でそのまま出る（自作技はコストも音も内蔵技と同じ道を通る）。草むらへ放流した個体も、戦闘側から読める形式で置かれている

**Plans**: 1/1 plans executed
**UI hint**: yes

**このフェーズが本丸**: PROJECT.md の Core Value そのもの。SAVE-\* と WIRE-\* を分けないのは
オーナー判断——ファイル保存が配線の前提であり、分けるとファイル形式を二度決めることになる。
SAVE-07（既存データの無損失移行）は、保存先を変える作業と**同じか、それより前**に必ず入れる。

### Phase 4: 技の分類と既定モーション

**Goal**: 技に「近接／遠距離／遠隔」の分類が入り、相殺も動きもそこから決まる
**Mode:** mvp
**Depends on**: Phase 1（Phase 2・3 とは独立に進められる）
**Requirements**: MOVE-01, MOVE-02, MOVE-03, MOVE-04, MOVE-05, MOVE-06
**Success Criteria** (what must be TRUE):

  1. 技データに分類フィールドがあり、「実体が空間を進むか」だけで新しい技も迷わず分類できる。`starter_moves.js` の44技と内蔵技すべてに分類が付いている
  2. 相殺が「遠距離か否か」でまず門前払いされ、既存の弾↔弾／光線↔光線／貫通の力関係は戦闘テストで今までと同じ結果になる
  3. `fx.motions[]` が空の技を戦闘で出すと、近接は踏み込み、遠距離は前へ出し、遠隔はその場で溜める。棒立ちの技が無くなる
  4. 個別の技が `fx.motions[]` を書けば既定を上書きでき、その上書きを技クリエーターの画面からできる
  5. `CLAUDE.md` と `docs/開発計画_v6.md` から「近接と雷は迎撃不可」という技名混じりの記述が消え、分類による定義に置き換わっている（迎撃不可が結論ではなく導出結果になる）

**Plans**: 1/1 plans executed
**UI hint**: yes

**やらないこと**: 既存44技の一斉目視確認（にーくら判断）。既定モーションで見た目が変わっても、
分岐1箇所と技クリエーターの上書きで後からいつでも直せる。44技の見た目を作り直す話は v2（FX-01）。

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 足場の地ならし | 3/3 | Complete | 2026-08-18 |
| 2. 開発シェル | 3/3 | Complete | 2026-08-18 |
| 3. ファイル保存と戦闘への配線 | 1/1 | Complete | 2026-08-18 |
| 4. 技の分類と既定モーション | 1/1 | Complete | 2026-08-18 |

## Coverage

v1 requirements: **30/30 マップ済み**（孤児なし・重複なし）

| カテゴリ | 件数 | Phase |
|---|---|---|
| FIX-01〜07 | 7 | Phase 1 |
| SHELL-01〜05 | 5 | Phase 2 |
| SAVE-01〜07 | 7 | Phase 3 |
| WIRE-01〜05 | 5 | Phase 3 |
| MOVE-01〜06 | 6 | Phase 4 |

---
*Roadmap created: 2026-08-17*
