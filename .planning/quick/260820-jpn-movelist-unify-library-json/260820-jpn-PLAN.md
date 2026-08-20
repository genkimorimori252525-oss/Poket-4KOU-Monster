---
phase: quick-260820-jpn
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - build.js
  - tools/gen_starter.js
  - tools/migrate_movelist.js
  - tools/verify_movelist.js
  - tools/verify_signature_moves.js
  - data/moves/library.json
  - docs/技演出マニュアル.md
  - docs/欲しい素材リスト.md
  - docs/整理_技一覧の一本化.md
  - CLAUDE.md
  - package.json
  - .planning/config.json
autonomous: true
requirements: [MOVELIST-01, MOVELIST-02, MOVELIST-03, MOVELIST-GATE]

estimate:
  tokens: 95000
  raw_tokens: 55000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "dist/shioumon_creator.html を file:// で単体で開いても、技の棚（STARTER_MOVES）が0本にならん（verified_facts#5の事故の再発防止・#1のリスク）"
    - "src/starter_moves.js は存在せん。/*__STARTER__*/ の中身は build.js が data/moves/library.json だけから組み立てる（正が1つになる）"
    - "data/moves/library.json のうち dist へ焼き込まれ・技棚に出るのは status:\"made\"（または status 省略）のレコードだけ。status:\"idea\" は焼かれん"
    - "技ネタ帳180個ぶんの名前が全部 data/moves/library.json の中にある：既存の45個は元のレコードを一切触らず、残りの新規ぶんは status:\"idea\" として name / battle.type / hint / note だけを持ち、fx も power/cast/cooldown も持たん（作り込みの数値を捏造せん）"
    - "docs/技ネタ_タイプ別.md は存在せん。docs/技演出マニュアル.md・docs/欲しい素材リスト.md・docs/整理_技一覧の一本化.md・CLAUDE.md のどこにもこのファイルへの生きた参照が残っとらん"
    - "亜空切断・灼熱弾・Codexの14本（10まんボルト・１００万ボルト・２ボルト・ハイドロポンプ・インファイト・ブラックキック・ブラックパンチ・ブラックショット・ビック尻ドロップ・かえんほうしゃ・ソーラービーム・エレキボール・サイコキネシス・ときのほうこう）が1本も欠けとらん"
    - "tools/migrate_movelist.js を2回続けて走らせても data/moves/library.json のバイト列が変わらん（技ネタ帳が既に削除された定常状態でも、まだある状態でも both）"
    - "node tools/verify_movelist.js がグリーンで、npm run verify:movelist と .planning/config.json の workflow.test_command の両方から呼べる"
  artifacts:
    - tools/gen_starter.js（新規・library.json→STARTER_MOVES変換の唯一の関数）
    - tools/migrate_movelist.js（新規・技ネタ帳180個の追加専用マイグレーション）
    - tools/verify_movelist.js（新規・回帰ゲート）
    - build.js（/*__STARTER__*/の生成元差し替え）
    - tools/verify_signature_moves.js（読み込み元をgen_starter.js経由に差し替え）
    - data/moves/library.json（既存54本は無傷・新規idea群を追加）
    - package.json（verify:movelistスクリプト）
    - .planning/config.json（workflow.test_command に追記）
  key_links:
    - "build.js の MODULES['/*__STARTER__*/'] ← tools/gen_starter.js の genStarterSource() ← data/moves/library.json（status:madeフィルタ）。ここが唯一の生成点で、通常ビルド・--devビルドの両方に自動で効く"
    - "tools/verify_signature_moves.js の addScriptTag ← 同じ genStarterSource()（削除された src/starter_moves.js への直接パス参照をやめる）"
    - "tools/verify_movelist.js の idempotence チェック ← tools/migrate_movelist.js を2回起動してバイト差分を見る（技ネタ帳が居るときも居らんときも成立する設計）"
    - "creator.tpl.html の「ネタ帳の技を棚に入れる」ボタン（STARTER_MOVES.length / for...of ループ、コード変更なし）← 中身だけが library.json 経由に差し替わる"
---

<objective>
`docs/整理_技一覧の一本化.md` 第5節の工程1〜3（にーくら決定・2026-08-20）を実施する。
技一覧の正を `data/moves/library.json` 1つに一本化し、技ネタ帳（`docs/技ネタ_タイプ別.md`）を廃止する。
設計doc第4節（learnable・覚える表）と第4.5節（補助技）はこの quick では実装しない —— 別フェーズ。

**MOVELIST-01（工程1・二重管理を潰す）**：`build.js` が `/*__STARTER__*/` を
`src/starter_moves.js` から読むのをやめ、`data/moves/library.json` から組み立てる形に変える。
`src/starter_moves.js` を削除する。生成物をファイルに落とす必要は無い
（`build.js` が文字列を組んでそのまま差し込むけん）。

**MOVELIST-02（工程2・status を足す）**：`library.json` の各レコードに `status`
（`made`/`idea`/`retired`）という概念を持たせる。`status` を書いとらん技は `made` 扱い
（後方互換。今の54本は1つも触らんで済む）。`build.js` は `made`（または省略）だけを焼き込む。

**MOVELIST-03（工程3・技ネタ帳を技一覧へ移して廃止）**：`docs/技ネタ_タイプ別.md` の180個を
`data/moves/library.json` へ追加専用（additive）で移す。既に居る45個（52本の元ネタ帳ぶんのうち
技ネタ帳の表と名前が一致する45個）は一切触らず、残りは `status:"idea"` として
`name`・`battle.type`・ヒント（作り方から導いた generator・パレット名）・`note`（ねらい本文）
だけを持つ（`fx` も威力・溜め・CDの数値も持たせん —— 決めたのか未定なのか見分けが付かんくなる
ため。design doc §6-3）。移したあと `docs/技ネタ_タイプ別.md` を削除し、参照しとるdocsを直す。

**MOVELIST-GATE（回帰ゲート）**：`tools/verify_movelist.js` を house style（Playwright・
screenshot・`PW_CHROMIUM`対応・NGで終了コード1）で作り、design doc §6の1〜5を数える。
`npm run verify:movelist` として登録し、`.planning/config.json` の `workflow.test_command` に足す。

Purpose: 52本と38本の作り直しに入る前に、同じ技データが2箇所（コードとJSON）に分かれとる状態を
消しておく。放置すると38本の作り直しぶん、二重管理の手間が倍になる。技ネタ帳180個が文書の中だけに
眠っとる状態も、技一覧に一本化して「一覧を見れば技も種も両方わかる」形にする。

Output: `data/moves/library.json` が技（作った・ネタのまま・使わん）の唯一の一覧になり、
`dist/` は今までどおり file:// で単体で開けて技棚が空にならん。`tools/verify_movelist.js` が
この不変条件を恒久的に見張る。
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@docs/整理_技一覧の一本化.md
@CLAUDE.md
@.claude/CLAUDE.md
@build.js
@src/store_bridge.js
@src/move_range.js
@src/creator.tpl.html
@data/moves/library.json
@docs/技ネタ_タイプ別.md
@tools/verify_style.js
@tools/verify_signature_moves.js
</context>

<tasks>

<task type="tracer">
  <name>Task 1: library.json → STARTER_MOVES の生成点を1本化し、starter_moves.js を消す（MOVELIST-01・MOVELIST-02）</name>
  <files>tools/gen_starter.js, build.js, tools/verify_signature_moves.js, tools/verify_movelist.js, src/starter_moves.js（削除）</files>
  <action>
Per MOVELIST-01・MOVELIST-02（design doc §2・§3・§5工程1〜2）。「library.json が唯一の正で、
dist は file:// で単体でも技棚が空にならん」を最初に end-to-end で通す。

1. `tools/gen_starter.js` を新規作成する。CommonJSモジュールで、`fs`/`path` は使わず
   （呼び出し側が読み込んだ library オブジェクトを受け取る形にする——build.js と
   tools/verify_signature_moves.js の両方から使い回すため、ファイルI/Oはこのモジュールに
   持たせない）、次の3つを `module.exports` する。
   - `isMade(rec)`：`const status = (rec && rec.status) || 'made'; return status === 'made';`
     という判定を返す関数（`status` が無い・空文字・null のときは `made` 扱いにする後方互換の
     唯一の実装点。他の場所にこの判定を重複させない）。
   - `genStarterEntries(library)`：`Object.values(library)` を `isMade` でフィルタし、各レコード
     から `{ name: rec.name, battle: rec.battle, audio: rec.audio || [], fx: rec.fx }` という
     `STARTER_MOVES` の要素形にマップした配列を返す（元の `src/starter_moves.js` のエントリ形
     `{ name, battle:{...}, audio:[], fx:{...} }` と同じ形。`battle` オブジェクトは
     library レコードのものをそのまま渡す——`range` が入っとるレコードはそのまま伝わり、
     入っとらんレコードは `MOVE_RANGE.rangeOf()` が generator から導く。今の library.json の
     52本は元々 `battle.range` を持っとるけん、この違いで挙動が変わることは無い）。
   - `genStarterSource(library)`：`genStarterEntries(library)` を呼び、
     `'const STARTER_MOVES = ' + JSON.stringify(entries) + ';\n'` の前に「これは生成物。
     手で編集せん。正は data/moves/library.json（tools/gen_starter.js 経由）」という趣旨の
     日本語コメント（`/* ... */`）を1行足した文字列を返す。

2. `build.js` を編集する。ファイル冒頭の `const path = require('path');` の直後あたりに
   `const { genStarterSource } = require('./tools/gen_starter.js');` を追加する。
   `MODULES` オブジェクトを組み立てる直前（`const read = f => {...};` の後）に、
   `data/moves/library.json` を `path.join(ROOT, 'data', 'moves', 'library.json')` で読み、
   `JSON.parse` した結果を変数（例：`library`）に入れる。`MODULES` オブジェクト内の
   `'/*__STARTER__*/' : read('starter_moves.js'),` の行を
   `'/*__STARTER__*/' : genStarterSource(library),` に置き換える。**1〜54行の他の行は
   一切触らない**（`tools/check_untouched.js` がハッシュで見張っとる範囲の意図——構造で
   dist不変を保証する既存の方針は崩さない。今回はSTARTERの中身が実際に変わる意図的な変更やが、
   MODULESの他のトークンや`--dev`ブロックのロジックには触れない）。

3. `src/starter_moves.js` を削除する。

4. `tools/verify_signature_moves.js` を編集する。冒頭の `const fs = require('fs');` の下あたりに
   `const { genStarterSource } = require('./gen_starter.js');` を追加する。
   `await pg.addScriptTag({ path: path.join(ROOT, 'src', 'starter_moves.js') });` の行を、
   まず `data/moves/library.json` を読んで `JSON.parse` し（`ROOT` は既にこのファイルの
   スコープにある）、`await pg.addScriptTag({ content: genStarterSource(library) });` に
   差し替える（`path:` オプションではなく `content:` オプションに変える——ファイルはもう存在せん）。

5. `tools/verify_movelist.js` を新規作成する。house style は `tools/verify_style.js` を手本に
   （`chromium`/`_pw_offline.js` の `offlineFonts`/`PW_CHROMIUM` 環境変数対応/`ok()`収集器/
   スクリーンショット/エラーがあれば終了コード1）する。このタスクでは design doc §6 の
   チェック1つだけを実装する：`dist/shioumon_creator.html` を `'file://' + path.join(ROOT,'dist')`
   経由（`ROOT` は `path.join(__dirname, '..')`）で開き、`pg.on('pageerror', ...)` で
   JSエラーを拾い、`pg.evaluate(() => STARTER_MOVES.length)` で件数を取り、
   `ok(n > 0, 'dist/shioumon_creator.html の技棚（STARTER_MOVES）が0本になっとる')` を assert する。
   スクリーンショットは `document.body` 全体でよい（専用のUIは組まん）。ファイルの末尾、
   `await pg.close();` の直前に、あとのタスクが追記の目印にする以下のコメント行を
   そのまま（一字一句）残す：
   `/* MOVELIST-GATE: 残りのチェック（made数の一致・生存確認・status別必須項目・idempotence）はここに続けて足す（別タスクで拡張） */`
   `package.json` への登録・`.planning/config.json` への追記はまだしない（Task 3で行う）。
  </action>
  <verify>
    <automated>node build.js && node build.js --dev && node tools/verify_signature_moves.js && node tools/verify_movelist.js</automated>
  </verify>
  <done>
`src/starter_moves.js` が存在せん。`tools/gen_starter.js` が上記3関数をexportしとる。
`build.js` の `/*__STARTER__*/` が `genStarterSource(library)` から組まれ、`node build.js` と
`node build.js --dev` が両方エラー無く完走する。`tools/verify_signature_moves.js` が
`gen_starter.js` 経由で14技を検証し通る。`tools/verify_movelist.js` が新規に存在し、
`dist/shioumon_creator.html` を `file://` で開いて `STARTER_MOVES.length > 0` を確認し、
指定のマーカーコメントを末尾（`pg.close()` の直前）に残して終了コード0で通る。
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: 技ネタ帳180個を追加専用で移し、技ネタ帳を廃止する（MOVELIST-03）</name>
  <files>tools/migrate_movelist.js, data/moves/library.json, docs/技ネタ_タイプ別.md（削除）, docs/技演出マニュアル.md, docs/欲しい素材リスト.md, docs/整理_技一覧の一本化.md, CLAUDE.md, tools/verify_movelist.js</files>
  <action>
Per MOVELIST-03（design doc §3・§5工程3・§6-5）。技ネタ帳の180個を `library.json` へ
追加専用（additive）で移し、既存の54本（うち45個は技ネタ帳と名前が一致する）は一切触らん。

1. `tools/migrate_movelist.js` を新規作成する。`fs`/`path` を使う実行スクリプト。
   `DOC_PATH = path.join(__dirname, '..', 'docs', '技ネタ_タイプ別.md')`、
   `LIB_PATH = path.join(__dirname, '..', 'data', 'moves', 'library.json')` を定数にする。
   - `DOC_PATH` が存在せん場合：「技ネタ帳は既に廃止済み。何もせん。」という趣旨のログを出し、
     `library.json` に一切触れず終了する（これが恒久的な idempotence の土台——技ネタ帳を
     削除したあと何度実行してもこの分岐で即座に無害な no-op になる）。
   - 存在する場合：`DOC_PATH` を読み、`## <見出し>` を型（type）の切り替わりとして走査する。
     見出しが `ノーマル・ほのお・みず・でんき・くさ・こおり・かくとう・どく・じめん・ひこう・
     エスパー・むし・いわ・ゴースト・ドラゴン・あく・はがね・フェアリー` の18種類のどれかの
     ときだけ、その下の `| 技名 | 作り方 | パレット | ねらい |` 形式のテーブル行を対象にする
     （`読み方`・`作りはじめの10個（generator を一巡できる）`・`メモ` の見出し配下は無視する）。
     テーブル行は先頭が `|` で始まり `|` で4分割できる行のうち、1列目が `技名` でも `---` でも
     ない行を1レコードとしてパースする（`type`＝直前の見出し、`name`＝1列目、`method`＝2列目、
     `palette`＝3列目、`aim`＝4列目。前後の空白は trim する）。180行パースできることを
     開発時に確認済み（18型×10）。
   - `作り方`（method）→ generator のマップ：`飛び道具→projectile`、`光線→beam`、
     `斬撃→slash`、`雷→lightning`、`オーラ→aura`、`空間割れ→shatter`（design doc §3の
     verified_facts と一致。180行はこの6つのどれかで尽くされとる——マップに無い値が来たら
     `throw` して止める。黙って無視しない）。
   - `LIB_PATH` を読み `JSON.parse` する。既存キー集合（`Object.keys(library)`）に**既に
     居る名前の行はスキップ**する（触らない・上書きしない・ログにも出さんでよい）。
     居らん名前だけ、次の形で新しいレコードを組む：
     `{ name, status:"idea", battle:{type}, hint:{generator, palette}, note:aim }`
     （`type`/`generator`/`palette`/`aim` は上のパース結果。**`fx` キーを持たせない**。
     **`power`・`cast`・`cooldown`・`range`・`tags` などの数値/戦闘フィールドを一切作らない**
     ——design doc §6-3「いい加減な数字を入れる方が危ない」を厳守する）。
   - 追加0件なら（＝全部既存）「追加なし」ログを出して `LIB_PATH` に書き込まず終了する。
   - 追加が1件以上あれば、`Object.assign({}, library, additions)`（`additions` は上で組んだ
     新規レコード群、パース順のキー）で新しいオブジェクトを作り、`JSON.stringify(merged)`
     （**整形しない**——今の `library.json` はミニファイ済みの1行JSONやけん、同じ書式を保つ。
     `null, 2` を渡さない）で `LIB_PATH` に書き込み、追加件数をログに出す。

2. `node tools/migrate_movelist.js` を実行する（本番の1回目——`docs/技ネタ_タイプ別.md` が
   まだ存在する状態で行う）。追加件数がログに出ることを確認する。

3. `data/moves/library.json` の内容ハッシュ（例：`sha256sum`）を取り、もう一度
   `node tools/migrate_movelist.js` を実行し、再度ハッシュを取って**一致**することを確認する
   （2回目は「追加なし」ログになり、ファイルへ書き込まれん設計なので一致するはず）。

4. `tools/verify_movelist.js` に、Task 1が残したマーカーコメント
   `/* MOVELIST-GATE: 残りのチェック（made数の一致・生存確認・status別必須項目・idempotence）はここに続けて足す（別タスクで拡張） */`
   の直後・`await pg.close();` より前に、design doc §6-5 の idempotence チェックを追記する
   （Playwright 不要、Node側だけでよい）：`child_process.execFileSync('node', ['tools/migrate_movelist.js'])`
   を呼ぶ前後で `LIB_PATH`（`fs.readFileSync`）のバイト列を比較し、
   `ok(before.equals(after), 'tools/migrate_movelist.js の再実行で library.json が変わっとる（idempotenceが崩れとる）')`
   を assert する（この時点で `docs/技ネタ_タイプ別.md` は既に削除済み——このチェックは
   「技ネタ帳が居らん定常状態でも migrate スクリプトは無害」を恒久的に見張る形になる）。
   マーカーコメントは新しい内容の後ろに残し直し、Task 3が続けて拡張できるようにする。

5. `docs/技ネタ_タイプ別.md` を削除する。

6. 参照しとるdocsを直す：
   - `docs/技演出マニュアル.md`：「関連」の行（`docs/技ネタ_タイプ別.md`（タイプ別の技ネタ180個）／
     を含む行）から、その `docs/技ネタ_タイプ別.md` への言及部分だけを取り除く（前後の
     他ドキュメントへの言及はそのまま残す）。
   - `docs/欲しい素材リスト.md`：`docs/技ネタ_タイプ別.md` の技ネタ180個を、割り当てられた
     素材で数えた。という行を、180個のネタは今 `data/moves/library.json` の
     `status:"idea"` レコードとして持たれとる、という趣旨の一文に書き換える（具体的な
     残数など新しい主張は作らない——ファイルの場所が変わったことだけを伝える）。
     末尾付近の「関連」の行からも `docs/技ネタ_タイプ別.md`（技ネタ180個）／ への言及部分を
     取り除く。
   - `docs/整理_技一覧の一本化.md`：冒頭の `**状態**：設計だけ。未実装。...` の行に、
     「1〜3は実施済み（2026-08-20、quick 260820-jpn）。技ネタ帳は
     `data/moves/library.json` の `status:"idea"` へ移行し、`docs/技ネタ_タイプ別.md` は
     削除した。」という趣旨の一文を追記する（§1〜3・§7の歴史的な記述そのものは書き換えない
     ——そのときの問題認識として正しい記録なので触らない）。第5節の表の1〜3行目の右端の列
     （なんで先か／のセル）の末尾に「✅実施済み」のような短い印を追記する。
   - `CLAUDE.md`：§3の構成図から `starter_moves.js      ネタ帳から起こした技データ28個
     （棚へ入れる種）` の行を削除する（ファイルが無くなったけん）。§5「四皇モン制作ツール」の
     `**ネタ帳の技（44個）**は \`src/starter_moves.js\`。18タイプ全部に行き渡っとる。...` の
     一文を、`data/moves/library.json` の `status:"made"`（省略も含む）レコードを `build.js` が
     `/*__STARTER__*/` へ焼き込む（生成物・手で編集せん・正は library.json）という趣旨に
     書き換える。**具体的な本数はハードコードしない**（今回のようにレコード数が今後も
     動くけん、数を書くと今回と同じ理由でまた古くなる）。「同じ名前が既にあったら触らん」
     「音は空にしてある」の2文は事実として変わっとらんので残す。

7. `node build.js && node build.js --dev` を実行し、dist/・dist-dev/ を最新化する（idea追加は
   `made` の集合を変えんけん技棚の内容自体は変わらんはずやが、library.json が変わったので
   常に再ビルドしておく）。
  </action>
  <verify>
    <automated>node tools/migrate_movelist.js && H1=$(sha256sum data/moves/library.json) && node tools/migrate_movelist.js && H2=$(sha256sum data/moves/library.json) && [ "$H1" = "$H2" ] && node build.js && node build.js --dev && node tools/verify_movelist.js</automated>
  </verify>
  <done>
`data/moves/library.json` に技ネタ帳180個ぶんの名前が全部揃っとる（既存45個は無傷、残りは
`status:"idea"` で `fx` を持たん）。`docs/技ネタ_タイプ別.md` が存在せん。`docs/技演出マニュアル.md`・
`docs/欲しい素材リスト.md`・`docs/整理_技一覧の一本化.md`・`CLAUDE.md` に生きた参照が残っとらん。
`tools/migrate_movelist.js` を連続2回走らせても `data/moves/library.json` のバイト列が変わらん。
`tools/verify_movelist.js` が idempotence チェックを含めて通る。
  </done>
</task>

<task type="auto">
  <name>Task 3: 回帰ゲートを完成させ、test_command に登録する（MOVELIST-GATE）</name>
  <files>tools/verify_movelist.js, package.json, .planning/config.json</files>
  <action>
Per MOVELIST-GATE（design doc §6の残り2・3・4）。`tools/verify_movelist.js` に、Task 2が
残したマーカーコメントの直後・`await pg.close();` より前へ、次の3チェックを追記する
（Task 1で既に開いとる `dist/shioumon_creator.html` のページ・`pg.evaluate` の戻り値
（`STARTER_MOVES.length`）と、Node側で読んだ `data/moves/library.json` を使い回す）。

1. **made数の一致（design doc §6-2）**：Node側で `data/moves/library.json` を読み、
   `tools/gen_starter.js` の `isMade` を使って `made`（省略含む）のレコード数を数え、
   `ok(distCount === madeCount, 'dist/ の技棚数が library.json の status:made の数と一致せん: ' + distCount + ' vs ' + madeCount)`
   を assert する（`distCount` はTask 1で取った `STARTER_MOVES.length`）。

2. **生存確認（design doc §6-4）**：`['亜空切断','灼熱弾','10まんボルト','１００万ボルト',
   '２ボルト','ハイドロポンプ','インファイト','ブラックキック','ブラックパンチ',
   'ブラックショット','ビック尻ドロップ','かえんほうしゃ','ソーラービーム','エレキボール',
   'サイコキネシス','ときのほうこう']`（18本）を配列で持ち、`library.json` の
   `Object.keys(library)` に全部含まれることを1本ずつ `ok(...)` で assert する
   （欠けとる名前をエラーメッセージに具体的に出す）。

3. **status別の必須項目（design doc §6-3）**：`Object.values(library)` を1件ずつ走査し、
   `status`（無ければ `'made'`）で分岐する。
   - `made`：`name`・`fx`（truthy）・`battle.type`・`battle.power`・`battle.cast`・
     `battle.cooldown` が全部存在することを assert（欠けとるキーを名前と一緒にログへ出す）。
   - `idea`：`name`・`battle.type` が存在すること、かつ **`'fx' in rec` が false**
     （`fx` キー自体を持たん）ことを assert する。

チェック追記のあと、`console.log` で件数サマリ（made数・idea数・エラー件数）を出す一行を足す。
最後に `package.json` の `"scripts"` ブロック、`"verify:moves": "node tools/verify_signature_moves.js",`
の行の直後に `"verify:movelist": "node tools/verify_movelist.js",` を追加する
（既存行の末尾カンマはそのまま、新しい行にもカンマを付ける——後続の `"verify:butt"` 等の
行順はそのまま動かさない）。

最後に `.planning/config.json` の `workflow.test_command` の文字列
（`"node build.js && node build.js --dev && node tools/verify_style.js && node tools/verify_signature_moves.js"`）
の末尾に ` && node tools/verify_movelist.js` を追記する（既存チェーンの直接 `node tools/...`
呼び出しのスタイルに合わせる——`npm run` 経由にしない。この文字列以外の `.planning/config.json`
のキーには一切触らない）。
  </action>
  <verify>
    <automated>node build.js && node build.js --dev && node tools/verify_movelist.js && npm run verify:movelist && node tools/verify_signature_moves.js && node tools/verify_style.js</automated>
  </verify>
  <done>
`tools/verify_movelist.js` が design doc §6の1〜5全部（技棚0本にならん／made数の一致／
18本の生存確認／status別必須項目／migrate の idempotence）を数え、終了コード0で通る。
`npm run verify:movelist` が動く。`.planning/config.json` の `workflow.test_command` に
`node tools/verify_movelist.js` が追記されとる。既存の `npm run verify:moves`・
`npm run verify:style` も引き続きグリーン。
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| なし（新規の外部境界は無い） | ビルドスクリプト（`build.js`）とデータ移行スクリプト（`tools/migrate_movelist.js`）はどちらも開発者のマシン上で `node` から手で実行するローカルツール。ネットワーク・認証・外部ユーザー入力の新しい境界は増えん。個人プロジェクトで配布せず、外部ユーザーも居らん（CLAUDE.md §1・.claude/CLAUDE.md Constraints）。 |
| `data/moves/library.json` の内容 | `devshell` 経由で `localStorage['shioumon_move_lib_v1']` と同期される（`src/store_bridge.js`）。今回は人が保存したデータを信頼して読むだけで、新しい入力経路は増えん。 |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick260820jpn-01 | Tampering | `build.js` の `JSON.parse(fs.readFileSync(library.json))` | medium | mitigate | `library.json` が壊れとる（不正JSON）と `node build.js` が例外で落ちる——これは意図した挙動（掟9「黙って失敗させない」）。verify_movelist.js が checkマークまで通らんことでビルド不能を即座に検知する（CIやverifyチェーンで気づける）。 |
| T-quick260820jpn-02 | Tampering | `tools/migrate_movelist.js` のMarkdown表パース（`作り方`列の想定外の値） | low | mitigate | 6つの既知値以外が来たら `throw` して即止める（design doc §3の実測どおり180行は6値で尽くされとる。想定外があれば静かに `undefined` generator を書き込むのではなく落とす）。 |
| T-quick260820jpn-03 | Repudiation | `tools/gen_starter.js` が生成した `/*__STARTER__*/` が構文エラーを含む | medium | mitigate | `tools/verify_movelist.js` の `pg.on('pageerror', ...)` が `dist/` を実際に `file://` で開いてロード時例外を拾う（Task1の#1チェックが唯一の実地検証）。 |
| T-quick260820jpn-04 | Tampering | Package legitimacy | n/a | accept | 新規npm/pip/cargoパッケージのインストールは無い（既存の `playwright` のみを使う新しいスクリプトを足すだけ）。package-legitimacy gateは対象外。 |
</threat_model>

<verification>
1. `node build.js` と `node build.js --dev` が警告・例外なく完走し、`dist/`・`dist-dev/` の
   4画面が最新化される。
2. `node tools/verify_movelist.js`（および `npm run verify:movelist`）が終了コード0で、
   design doc §6の1〜5すべてをログにパス表示する。
3. `node tools/verify_signature_moves.js` と `node tools/verify_style.js` が引き続きグリーン
   （STARTER_MOVES の生成元が変わっても14技・slash/beamの5形は壊れとらん）。
4. `src/starter_moves.js` と `docs/技ネタ_タイプ別.md` がどちらも存在せん。
5. `data/moves/library.json` に亜空切断・灼熱弾・Codexの14本・元々の技ネタ帳45個・
   新規idea群（180-45個ぶん）が過不足なく揃っとる。
</verification>

<success_criteria>
- MOVELIST-01: `src/starter_moves.js` が削除され、`/*__STARTER__*/` は `data/moves/library.json`
  だけから `build.js` が組み立てる。二重管理が構造的に消える。
- MOVELIST-02: `status` の有無で made/idea/retired を分け、`made`（省略含む）だけが
  `dist/` と技棚に出る。既存54本は無傷。
- MOVELIST-03: 技ネタ帳180個が `library.json` に `status:"idea"` として（数値を捏造せず）
  移り、`docs/技ネタ_タイプ別.md` と参照docsが整理される。
- MOVELIST-GATE: `tools/verify_movelist.js` が恒久的な回帰ゲートとして存在し、
  `npm run verify:movelist` と `workflow.test_command` の両方から呼べてグリーン。
- `dist/shioumon_creator.html` を file:// で単体で開いても技棚が0本にならん
  （このタスク全体の存在理由そのもの）。
</success_criteria>

<output>
Create `.planning/quick/260820-jpn-movelist-unify-library-json/260820-jpn-SUMMARY.md` when done
</output>
