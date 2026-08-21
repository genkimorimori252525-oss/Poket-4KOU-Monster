# Phase 1: 足場の地ならし - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

掟違反とデッドコードを片付け、**検証ツールが壊れを見逃さない状態**にする。

このフェーズは Phase 3（保存先の移動＋既存データ移行、このプロジェクトで一番危ない作業）の
安全網を先に用意することが目的。`verify_*.js` が常に exit 0 を返し、`resolve()` が二重実装のまま
では、Phase 3 の「通った」が信用できない。

対象は FIX-01〜07 の7件。いずれも独立した小さい修正で、互いに依存しない。

**含まない**: 保存層の変更、`dist-dev/` の生成、技分類。それぞれ Phase 3 / 2 / 4。

</domain>

<decisions>
## Implementation Decisions

### 外部依存とドキュメントの整合（FIX-05, FIX-06）
- **Google Fonts (DotGothic16) の外部ロードは残し、「外部参照ゼロ」の明示的な例外として
  `CLAUDE.md` に記録する。** 日本語フォントを base64 で焼き込むと数MBになり、四皇モンの名前が
  動的なので使用文字を絞ったサブセット化もできない。フォールバック指定
  （`"DotGothic16","MS Gothic","Hiragino Kaku Gothic ProN",monospace`）が既にあり、
  オフラインでも MS ゴシックに落ちるだけで壊れない。無理に消して見た目を落とすより例外を1つ認める。
- **`CLAUDE.md:216` の鳴き声圧縮の記述を実装に合わせて訂正する。** 現在「読み込み時に自動」と
  書かれているが、実装（`creator.tpl.html:1309`）は手動であり、それは掟8（音の決定権は100%鴨川）
  の徹底による意図的な設計。**実装が正しく、ドキュメントが誤り。** 「1体21KB」も手動圧縮後の
  値である旨を明記する。

### `resolve()` の二重実装（FIX-07）
- **共通関数への抜き出し（物理的な統一）はしない。検証で食い違いを検出できるようにする。**
  `battle.tpl.html:474` は「自分側は背面／相手側は正面」を判断し、`creator.tpl.html:464` は
  プレビュー文脈で判断しており、見ている状況が違う。雑に1つへまとめると掟4が要求する
  「必ず同じ判断」をかえって壊す危険がある。まず**食い違いが見える状態**を作るのが先。
- 検出方法は Claude の裁量。同一入力に対する両者の出力を突き合わせる形が素直。

### 検証スクリプトの厳しさ（FIX-03）
- **`verify_creator.js` と同じ基準に揃える** —— ページの JS エラーを捕捉したら非ゼロで終了する。
  動いている実装が既に1つあるので、新しい基準を発明せずそれに合わせる。
- **コンソールの `warn` は失敗扱いにしない。** 誤検知で「狼少年」になると、せっかく直した
  検証がまた信用されなくなる。

### デッドコードの扱い（FIX-01, FIX-04）
- **`src/fx_audio.js` は削除する**（`archive/` へ退避しない）。`CLAUDE.md:64` が「消してよい」と
  明言し、`/*__FX_AUDIO__*/` トークンがどのテンプレートにも存在しないことを確認済み。
  git 履歴に残るので失われはしない。`build.js` の `MODULES` からも該当行を外す。
- **`audiolab.tpl.html` の未使用 `ANIMS` インクルードを外す。** 音ラボはキャラアニメを使わない。

### Claude's Discretion
- FIX-02（`audiolab.tpl.html:359` の `confirm()` → 二度押し）の具体的な実装。
  `CLAUDE.md:186-190` が既に規約を定めており（`mlArmDelete()` の二度押し、1回目でボタンが
  「消す？」に変わる）、`movelab.js` に動いている実装がある。**それに倣う。**
- `resolve()` 食い違い検出の実装形式。
- 7件をどう plan に分割するか（依存が無いので並列化できる）。

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `movelab.js` の `mlArmDelete()` —— 二度押し削除の動いている実装。FIX-02 はこれに倣う
- `tools/verify_creator.js` —— 唯一エラーで `process.exit` する検証スクリプト。FIX-03 の手本
- `build.js` の `MODULES` テーブル（トークン→ファイル）—— FIX-01/04 はここを編集する

### Established Patterns
- ビルドは `build.js` による単純な文字列置換。`src/*.tpl.html` の `/*__TOKEN__*/` を
  `src/*.js` の中身で差し替えて `dist/` に4ファイル出す
- 検証は Playwright を使う**単体の node スクリプト**であって、テストランナー上のスイートではない
- コメントと識別子は日本語と英語が混在する。既存の書き方に合わせる

### Integration Points
- `build.js:22-31` の `MODULES` —— FIX-01（`/*__FX_AUDIO__*/` 行の削除）
- `src/audiolab.tpl.html` —— FIX-02（`confirm()`）と FIX-04（`ANIMS`）の両方がここ
- `tools/verify_audio.js` / `tools/verify_ui.js` —— FIX-03
- `src/battle.tpl.html:474` / `src/creator.tpl.html:464` —— FIX-07

### 触ってはいけないもの（全フェーズ共通）
- **`src/sfx_bank.js`** —— 自動生成物だが CC0元素材がこのマシンに無く復元不可。616KB が79音の唯一の実体
- **決定論** —— 戦闘で `Math.random()` を使わない。固定タイムステップ `STEP=1/60` を崩さない

</code_context>

<specifics>
## Specific Ideas

- **`dist/` は再生成してよい。** FIX-02/04 はテンプレートを変えるので `node build.js` による
  焼き直しが必然的に伴う。「`dist/` がバイト単位で不変」という制約は Phase 2（`dist-dev/` を
  作る作業が `dist/` を汚さないことの確認）に限った話であり、このフェーズには適用しない。
  維持するのは `dist/` の**形式**（単体HTML・外部参照ゼロ、ただしフォントは上記の明示的な例外）。
- 成功基準1は「**わざと壊した** `dist/` に対して検証が非ゼロで落ちる」ことを要求している。
  直したと主張するだけでなく、**故意に壊して落ちることを実際に確かめる**こと。

</specifics>

<deferred>
## Deferred Ideas

- `resolve()` の物理的な共通化 —— 検出を入れて食い違いの実態が見えてから、必要なら別途判断する
- 44技の見た目の多様化（FX-01）—— v2。HANDOFF.md にあるにーくらの最優先の不満だが、基盤工事とは別テーマ

</deferred>
