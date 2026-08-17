# Requirements: ポケット四皇モンスター（開発基盤）

**Defined:** 2026-08-17
**Core Value:** にーくらが作ったもの（四皇モン・技・音）が、容量を気にせず保存でき、実際の戦闘に出てくること

## v1 Requirements

### 保存層（SAVE）

- [ ] **SAVE-01**: にーくらが保存した四皇モンが `data/` 以下のファイルとして書き出され、容量上限にぶつからずに何体でも保存できる
- [ ] **SAVE-02**: 技ライブラリがファイルとして保存され、1技1ファイルまたは1JSONとして Claude が直接読み書きできる
- [ ] **SAVE-03**: 音設定・草むらプール・シーン効果音・自動保存の各データがファイルへ移る
- [ ] **SAVE-04**: サーバーが起動していない状態で `dist/` の単体HTMLを開いた場合、localStorage にフォールバックして今まで通り動く
- [ ] **SAVE-05**: 保存データが git で追跡され、壊した保存を `git checkout` で戻せる
- [ ] **SAVE-06**: `file://` で開いても `http://localhost` で開いても、同じ保存データが見える
- [ ] **SAVE-07**: 今 localStorage に入っている既存データ（四皇モン・技・音設定）が、1件も失われずファイルへ移行される

### 制作ツール→戦闘の配線（WIRE）

- [ ] **WIRE-01**: にーくらが保存した四皇モンを、戦闘テスト画面のロスターに選んで出場させられる
- [ ] **WIRE-02**: 出場させた個体の自作技（`mon.customMoves`）が、実戦でコスト計算も音も内蔵技と同じ道を通って使われる
- [ ] **WIRE-03**: 戦闘画面が `mon.shadow` を読んで、制作ツールで調整した影がそのまま出る
- [ ] **WIRE-04**: 戦闘画面が `mon.cry` を読んで、出現時と戦闘不能時に鳴き声が鳴る
- [ ] **WIRE-05**: 草むらプールに放流した個体が、戦闘側から読める形式で保存されている（Phase 19 の土台）

### 起動と軽量化（SHELL）

- [ ] **SHELL-01**: デスクトップのアイコンをダブルクリックすると、タブもURLバーも無い専用ウィンドウで制作ツールが開く
- [ ] **SHELL-02**: 開発用の軽量ビルドが `dist-dev/` に出る。`src/sfx_bank.js` と `dist/` の4ファイルは1バイトも変わらない
- [ ] **SHELL-03**: 開発用ビルドの各HTMLが現状（693〜864KB）から大幅に軽くなり、音は鳴らす分だけ後から読まれる
- [ ] **SHELL-04**: サーバーの起動が1コマンドで済み、この土台一式を次のプロジェクトへコピーして使える

### 技の分類とモーション（MOVE）

- [ ] **MOVE-01**: 技データに「近接 / 遠距離 / 遠隔」の分類フィールドがあり、定義は「実体が空間を進むか」で判定できる
- [ ] **MOVE-02**: `starter_moves.js` の44技と内蔵技すべてに分類が付いている
- [ ] **MOVE-03**: 相殺判定が「遠距離か否か」でまず門前払いし、既存の弾↔弾／光線↔光線／貫通の力関係は変わらない
- [ ] **MOVE-04**: `fx.motions[]` が空の技に、分類ごとの既定モーションが割り当たる（近接=踏み込む／遠距離=前へ出す／遠隔=その場で溜める）
- [ ] **MOVE-05**: 個別の技が `fx.motions[]` を書けば既定を上書きでき、技クリエーターからその上書きができる
- [ ] **MOVE-06**: `CLAUDE.md` と `docs/開発計画_v6.md` の掟から「近接と雷は迎撃不可」という技名混じりの記述が消え、分類による定義に置き換わる

### 掃除（FIX）

- [x] **FIX-01**: `src/fx_audio.js`（完全にデッドな15KB）が削除され、`build.js` のトークンも外れる
- [x] **FIX-02**: `audiolab.tpl.html:359` の `confirm()` が二度押し方式に置き換わる（掟：ダイアログを分かれ道に置かない）
- [x] **FIX-03**: `verify_audio.js` と `verify_ui.js` が、エラーを検出したときに非ゼロで終了する
- [x] **FIX-04**: `audiolab.tpl.html` から未使用の `ANIMS` インクルードが外れる
- [x] **FIX-05**: `CLAUDE.md:216` の「鳴き声は読み込み時に自動で圧縮」という記述が、実装（手動・意図的）に合わせて訂正される
- [x] **FIX-06**: Google Fonts の外部ロードが解消される、または「外部参照ゼロ」の例外として明示的に記録される
- [x] **FIX-07**: `battle.tpl.html:474` と `creator.tpl.html:464` の `resolve()` 重複が解消される、または食い違いを検出できる仕組みが入る

## v2 Requirements

将来のマイルストーン。今回のロードマップには含めない。

### 技の見た目（FX）

- **FX-01**: 44技が6ジェネレータの使い回しから脱し、技ごとに見分けがつく見た目になる（HANDOFF.md の最優先の不満）
- **FX-02**: 分類に応じた戦闘ルールの拡張（例：遠隔は防御を貫通する）

### 保存の拡張（SAVE2）

- **SAVE2-01**: 保存データのバックアップと世代管理
- **SAVE2-02**: 別マシンへの持ち出しと取り込み

## Out of Scope

| Feature | Reason |
|---------|--------|
| ChromiumOS の導入 | OS を替えても保存制限は変わらず、ファイルI/Oは悪化する。3条件はローカルサーバーで全部満たせる |
| `dist/` の単体HTML形式の廃止 | 掟「外部ファイル参照はゼロ」。軽量版は `dist-dev/` として別に出す |
| `src/sfx_bank.js` の解体・再生成 | CC0元素材がこのマシンに無く、616KB のこれが79音の唯一の実体。復元手段がない |
| ゲーム本編 Phase 15「コスト経済」以降 | `docs/開発計画_v6.md` が正典。GSD は開発基盤だけ見る |
| 既存44技の一斉目視確認 | 後からいつでも直せる。前もって全部見るコストに見合わない（にーくら判断） |
| 画像ファイルを増やすこと | 掟4。エフェクトも背景もコードが描く |
| 認証・課金・マルチユーザー | 配布しない個人プロジェクト |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 1 | Complete |
| FIX-02 | Phase 1 | Complete |
| FIX-03 | Phase 1 | Complete |
| FIX-04 | Phase 1 | Complete |
| FIX-05 | Phase 1 | Complete |
| FIX-06 | Phase 1 | Complete |
| FIX-07 | Phase 1 | Complete |
| SHELL-01 | Phase 2 | Pending |
| SHELL-02 | Phase 2 | Pending |
| SHELL-03 | Phase 2 | Pending |
| SHELL-04 | Phase 2 | Pending |
| SAVE-01 | Phase 3 | Pending |
| SAVE-02 | Phase 3 | Pending |
| SAVE-03 | Phase 3 | Pending |
| SAVE-04 | Phase 3 | Pending |
| SAVE-05 | Phase 3 | Pending |
| SAVE-06 | Phase 3 | Pending |
| SAVE-07 | Phase 3 | Pending |
| WIRE-01 | Phase 3 | Pending |
| WIRE-02 | Phase 3 | Pending |
| WIRE-03 | Phase 3 | Pending |
| WIRE-04 | Phase 3 | Pending |
| WIRE-05 | Phase 3 | Pending |
| MOVE-01 | Phase 4 | Pending |
| MOVE-02 | Phase 4 | Pending |
| MOVE-03 | Phase 4 | Pending |
| MOVE-04 | Phase 4 | Pending |
| MOVE-05 | Phase 4 | Pending |
| MOVE-06 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 29 total
- Mapped to phases: 29 ✓
- Unmapped: 0

**Phase 別内訳:**

| Phase | 名前 | 要件 | 件数 |
|-------|------|------|------|
| Phase 1 | 足場の地ならし | FIX-01〜07 | 7 |
| Phase 2 | 開発シェル | SHELL-01〜04 | 4 |
| Phase 3 | ファイル保存と戦闘への配線 | SAVE-01〜07, WIRE-01〜05 | 12 |
| Phase 4 | 技の分類と既定モーション | MOVE-01〜06 | 6 |

---
*Requirements defined: 2026-08-17*
*Last updated: 2026-08-17 after roadmap creation (traceability filled)*
