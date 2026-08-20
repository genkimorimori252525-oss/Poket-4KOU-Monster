---
phase: quick-260820-kit
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/creator.tpl.html
  - tools/verify_learnable.js
  - package.json
  - .planning/config.json
autonomous: true
requirements: [LEARNABLE-01, LEARNABLE-02, LEARNABLE-GATE]

estimate:
  tokens: 70000
  raw_tokens: 40000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "四皇モン制作ツールを開くと、技が「■ 覚えられる技（最大12）」と「■ 覚える技（最大4）」の2段に分かれて出る。両方に type chip・stat line・編集済マーカーが出る（既存のまま失われん）"
    - "excludeBuiltin を持たん個体（今までの全保存データ）は、内蔵6技が今までどおり全部『覚えられる技』に出る（後方互換。verified_facts#3のBUILTIN_MOVE_IDSは変えん）"
    - "『覚えられる技』で内蔵技を『除外』すると、その1本だけが覚えられんくなる。残り5本・自作技（customMoves）は無事なまま"
    - "除外した内蔵技を『覚える技』に入れようとする（toggleMove）と拒否され、alertで理由が画面に出る（黙って消えん・CLAUDE.md掟9）"
    - "今『覚える技』に入っとる技を『覚えられる技』から除外しようとする（toggleExcludeBuiltin）と拒否され、alertで理由が画面に出る（moves ⊆ 覚えられる技 を両方向から守る）"
    - "excludeBuiltin は snapshot()→normalizeMon() を経ても中身（要素の集合）が変わらん。excludeBuiltin を持たん/空のデータを normalizeMon した結果は必ず空配列になる（absentの扱いを統一）"
    - "UIを介さず mon.excludeBuiltin と mon.moves が矛盾した状態（除外したはずの技が装備されとる）になっても、#moveConflict に警告が出る（読み込んだ旧データ等の防御）"
    - "覚える技（最大4）・覚えられる技のcustomMoves上限（最大12、既存のshelf-load経路のみ）は今までどおり働く"
    - "tools/verify_learnable.js が上記を数えて確認し、npm run verify:learnable と .planning/config.json の workflow.test_command の両方から呼べてグリーン"
  artifacts:
    - src/creator.tpl.html（2段UI・excludeBuiltinの配線・#moveConflict）
    - tools/verify_learnable.js（新規・回帰ゲート）
    - package.json（verify:learnableスクリプト）
    - .planning/config.json（workflow.test_commandに追記）
  key_links:
    - "buildMoveList() 内の toggleMove()/toggleExcludeBuiltin() 相互拒否チェック ← mon.excludeBuiltin。ここが片方でも欠けると moves ⊆ 覚えられる技 の不変が崩れる"
    - "normalizeMon() の m.excludeBuiltin 正規化 ← applySnapshot() が使う全ロード経路（自動保存・スロット読込・JSON貼付け・草むら・相手プレビュー）。ここを漏らすと後方互換が壊れる"
    - "buildMoveList() 内の paintMoveConflict() ← #moveConflict。無いと『覚える技』に紛れ込んだ除外技が画面に出ん（掟9違反になる）"
---

<objective>
`docs/整理_技一覧の一本化.md` 第4節（にーくら決定・2026-08-20、「⚠ 設計を直した」版）を実装する。
新しい配列は作らん —— 既にある `mon.customMoves`（12本）を「覚えられる技」、
`mon.moves`（4本）を「覚える技」として、制作ツールのUIで2段に見せる（LEARNABLE-01）。
足りん1点だけを新設する：`mon.excludeBuiltin: string[]` で内蔵6技を個体ごとに除外できるようにする
（LEARNABLE-02）。書いてない個体は今までどおり全部覚えられる（後方互換）。
第4.5節（補助技）と第5〜7節はこのquickでは実装しない —— 別フェーズ。

Purpose: 「何を覚えられるか」と「今何を覚えとるか」が同じ1つのリストに混ざっとって、
にーくらが管理できん状態を直す。内蔵技を覚えさせたくない個体（例：灼熱弾を持たせん系統）を
表現する手段が今は無い。

Output: `src/creator.tpl.html` の技セクションが2段表示になり、`mon.excludeBuiltin` が
snapshot/normalizeMon/save系すべてを往復する。`tools/verify_learnable.js` がこの不変条件を
恒久的に見張る（LEARNABLE-GATE）。
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@docs/整理_技一覧の一本化.md
@CLAUDE.md
@.claude/CLAUDE.md
@src/creator.tpl.html
@src/movelab.js
@tools/verify_creator.js
@tools/verify_style.js
@tools/verify_movelist.js
</context>

<tasks>

<task type="tracer">
  <name>Task 1: excludeBuiltin を配線し、技セクションを2段UIに割る（LEARNABLE-01・LEARNABLE-02）</name>
  <files>src/creator.tpl.html</files>
  <action>
「除外→装備拒否／装備中→除外拒否」の相互チェックと2段表示を、データ層からUIまで一気通貫で通す。

1. `DEFAULT_MON()`（~line 361）の `customMoves:[],`（~line 366）の直後に `excludeBuiltin:[],`
   を足す（新規作成した `mon` が最初から配列を持つように。既存の `moves:[]`/`customMoves:[]` と
   同じ流儀）。

2. `normalizeMon(o)`（~line 1979）の中、`m.customMoves=...` の for ループ（~line 1992-2002）が
   終わった直後・`m.scale=+m.scale||1;`（~line 2003）より前に、`m.excludeBuiltin` の正規化を足す：
   `o.excludeBuiltin` が配列なら、各要素が文字列であり、かつ `BUILTIN_MOVE_IDS.includes(id)`
   が真であるものだけを残した配列にする。配列でない・存在せんときは空配列 `[]` にする
   （absent は必ず空配列に統一する —— `m.moves`/`m.customMoves` と同じ規約）。
   `BUILTIN_MOVE_IDS` は同じスクリプト内のトップレベル定数（~line 357）なので直接参照できる。

3. `toggleMove(id)`（~line 1614）を書き換える。今の実装は
   `mon.moves.indexOf(id)>=0` なら外す、そうでなければ `mon.moves.length<4` のとき足す、
   さもなくば `alert('技は4つまで。どれか外して。')` して return —— という分岐。
   **この cap チェックの条件とメッセージはそのまま残す。** 追加するのは「足す」枝の中、
   cap チェックより前に置く新しい分岐だけ：`isBuiltinId(id)` かつ
   `mon.excludeBuiltin.includes(id)` が真なら、`alert('この技は「覚えられる技」から除外しとる。含めてから覚えさせて。')`
   して return する（cap チェックへは進まない）。これで `toggleMove` が呼ばれるどの経路
   （UIクリック・他コードからの直接呼び出し）でも「除外した内蔵技は装備できん」が一箇所で保証される。

4. `toggleMove(id)` の直後に新しい関数 `toggleExcludeBuiltin(id)` を追加する。
   `isBuiltinId(id)` が偽なら何もせず return（自作技には適用せん）。
   `mon.excludeBuiltin` に `id` が既に入っとるなら、そこから取り除く（含める方向はいつでも許可 —
   除外を解除して困ることは無い）。入っとらんなら、まず `mon.moves.includes(id)` を見る。
   真なら `alert('この技は今「覚える技」に入っとる。先にそっちで外してから除外して。')` して
   return（黙って moves から消さない・CLAUDE.md掟9）。偽なら `mon.excludeBuiltin.push(id)`。
   どちらの分岐でも状態を変えた後は `buildMoveList(); refresh();` を呼んで終える
   （既存の `toggleMove`末尾と同じ形）。

5. `buildMoveList()`（~line 1621）を書き換える。今の実装は `BUILTIN_MOVE_IDS.concat(...)` で
   1本のリストを `#moveList` に描く。**この `ids` の組み立て方・ループの中身
   （`.tp`/`.nm`/`.st` の3スパン、✎ボタン、複ボタン、`edited` のとき戻/×ボタン、
   `fireSel` の組み立て）はそのまま残す** —— `tools/verify_creator.js` が
   `#moveList .mv`・`.mv.cus`・ボタン`[0]`が✎であることに依存しとるけん、既存の要素・
   クラス名・ボタン順序を崩さない。追加するのは2点だけ：
   (a) 各行の class 文字列に、`isBuiltinId(id) && mon.excludeBuiltin.includes(id)` が真のとき
       追加で `d.style.opacity='0.5'` を設定し、`.nm` の中身（编集済マーカーのすぐ後ろ）に
       `<span style="color:#e08080;font-size:9px"> 覚えられん</span>` を足す。
   (b) `isBuiltinId(id)` が真の行だけ、既存の✎・複・（あれば）戻/×ボタンの**あとに**
       （`d.appendChild(bx)` などの後、`ml.appendChild(d)` の前）新しいボタンを追加する：
       `excluded` なら文字は「含める」・title「また覚えられるようにする」、
       そうでなければ文字は「除外」・title「この四皇モンには覚えさせん」。
       `onclick` は `()=>toggleExcludeBuiltin(id)`。（ボタンを末尾に足すので既存の
       `querySelectorAll('button')[0]` が✎であることは崩れない）
   関数の最後（`fireSel` の組み立てが終わったあと）で `buildEquipList(); paintMoveConflict();`
   を呼ぶ。

6. `buildMoveList()` の直後に新関数 `buildEquipList()` を追加する。`#equipList` を
   `innerHTML=''` してから、`mon.moves` が空なら
   `<div class="hint" style="margin:0">まだ何も覚えとらん。上の「覚えられる技」から選んで。</div>`
   を入れて return。空でなければ `mon.moves` の各 `id` について（`MOVES[id]` が無ければ
   `continue`）、`buildMoveList()` の行と同じ見た目（`.tp`/`.nm`（編集済マーカー込み）/`.st`
   の3スパン、class は `'mv on'+(edited?' cus':'')`）の行を作り、`.nm`/`.tp` の `onclick` に
   `()=>toggleMove(id)` を割り当てて（クリックで外れる）`#equipList` に追加する。
   ✎・複・×/戻・除外ボタンはここには置かない（それらは「覚えられる技」側だけにある —
   同じ技は必ずそちらにも出とるので操作可能）。

7. その直後に新関数 `paintMoveConflict()` を追加する。`mon.moves.filter(id=>isBuiltinId(id)&&mon.excludeBuiltin.includes(id))`
   で矛盾している技（除外されとるのに装備されとる）の配列 `bad` を作る。`#moveConflict` の
   `innerHTML` に、`bad.length` が0なら空文字列、そうでなければ
   `'⚠ 除外したはずの内蔵技が「覚える技」に混ざっとる：'+bad.map(id=>(MOVES[id]&&MOVES[id].name)||id).join('・')+'　→ 上の「覚えられる技」で外すか、含めるか決めて。'`
   を `<b style="color:#e08080">...</b>` で包んで入れる。

8. HTMLマークアップ（~line 224-231）を書き換える。今の
   `<div class="sec"><h2><span>■ 覚える技（最大4つ）</span>...</div></div>` 1ブロック
   （`#moveList`・`#btnNewMove`・ヒント文を含む）を、次の2ブロックに置き換える：
   - 1つ目の `.sec`：見出しはリテラルで**「■ 覚えられる技（最大12）」**。中身は今までの
     `#moveList` の div と `#btnNewMove` のバーをそのまま残し、ヒント文の末尾に
     「除外を押すと、この四皇モンはその内蔵技を覚えられんくなる（覚えとる場合は先に
     『覚える技』から外す必要がある）。」という趣旨の一文を足す。
   - 2つ目の `.sec`：見出しはリテラルで**「■ 覚える技（最大4）」**。中身は
     `<div id="moveConflict" class="hint" style="margin:0 0 6px"></div>` と
     `<div id="equipList"></div>`、それに「名前を押すと外れる。技そのものの追加・編集・複製・
     除外は上の「覚えられる技」でやる。」という趣旨のヒント文を置く。
   2ブロックとも既存の `.sec` パターン（`<h2><span>見出し</span><span>▾</span></h2><div>...`）
   に揃える —— 折りたたみは `document.querySelectorAll('.sec>h2').forEach(...)` が起動時に
   汎用で配線しとるけん、追加のJSは要らん。
  </action>
  <verify>
    <automated>node build.js && node build.js --dev && grep -c "覚えられる技（最大12）" dist/shioumon_creator.html && grep -c "覚える技（最大4）" dist/shioumon_creator.html && grep -c "function toggleExcludeBuiltin(id)" dist/shioumon_creator.html && node tools/verify_creator.js</automated>
  </verify>
  <done>
`node build.js`/`--dev` が両方エラー無く完走する。`dist/shioumon_creator.html` に
「覚えられる技（最大12）」「覚える技（最大4）」の見出しと `toggleExcludeBuiltin` 関数が
存在する。`node tools/verify_creator.js` が既存の✎・複・×/戻・編集済マーカー・type chip・
stat lineを含めて引き続きグリーン（回帰なし）。
  </done>
  <reversibility rating="reversible">除外を「拒否＋alert」にする方針は、あとで「削除して知らせる」方式へ差し替えても
mon.excludeBuiltin/mon.movesのデータ形は変わらず、UI側の1関数を差し替えるだけで済む。</reversibility>
</task>

<task type="auto" tdd="false">
  <name>Task 2: 回帰ゲート tools/verify_learnable.js を新規作成する（LEARNABLE-GATE）</name>
  <files>tools/verify_learnable.js</files>
  <action>
house style は `tools/verify_style.js`／`tools/verify_movelist.js` を手本にする
（`chromium.launch`・`./_pw_offline.js` の `offlineFonts`・`PW_CHROMIUM` 環境変数対応・
`ok(cond,msg)` 収集器・`dist/`（`dist-dev`ではない）を `file://` で開く・末尾でエラーがあれば
終了コード1、無ければ0）。`tools/verify_creator.js` と同様、`pg.on('dialog', d=>{dialogs.push(d.message());d.dismiss();})`
で全ダイアログをつっぱねながら記録する（確認ダイアログに頼っとらんことの確認も兼ねる）。

`dist/shioumon_creator.html` を開き `localStorage.clear()` してから `reload()` する
（`tools/verify_creator.js` の起動手順と同じ）。以下を順に実施する。

1. **後方互換（design docの最大リスク）**：`mon.excludeBuiltin` が空配列であること、
   `BUILTIN_MOVE_IDS.length===6` であることを assert する。さらに `#moveList .mv` を
   `.nm` のテキストで `BUILTIN_MOVE_IDS` の各 `MOVES[id].name` と突き合わせ、対応する行の
   `style.opacity` が `'0.5'` でないことを6本とも assert する（除外マークが1本も付いとらん）。

2. **除外で1本だけ消える**：`pg.evaluate(id=>toggleExcludeBuiltin(id),'bolt')` を呼び、
   `mon.excludeBuiltin` が `['bolt']` ちょうどであること、`BUILTIN_MOVE_IDS` の残り5本が
   `mon.excludeBuiltin` に含まれとらんことを assert する。

3. **除外した技は装備できん**：装備前の `mon.moves.length` を控え、
   `pg.evaluate(id=>toggleMove(id),'bolt')` を呼ぶ。`mon.moves.includes('bolt')` が偽、
   `mon.moves.length` が変わっとらんことを assert する。加えて、この時点までに出た
   `dialogs` の中に「除外」または「含めて」を含む文言が1件以上あることを assert する
   （拒否理由が画面＝ダイアログに出とる証拠）。

4. **上限は今までどおり**：`mon.excludeBuiltin=[]` にリセットして `buildMoveList()` を
   呼び直す。`mon.moves=[]` にしてから `BUILTIN_MOVE_IDS.slice(0,5)` の5本へ順に
   `toggleMove(id)` を呼び、最終的に `mon.moves.length===4` であることを assert する
   （覚える技は4つ止まり）。次に、`mon.customMoves` を `id:'capfill0'`〜`'capfill11'` の
   12件のダミー技（各 `{id,name,type:'ノーマル',power:10,cast:0.2,cooldown:1,fx:makeSpec('projectile',i,'x'+i,'炎'),audio:[]}`）
   で上書きし `syncCustom()` を呼ぶ。`mlLibPut('容量テスト',{name:'容量テスト',fx:makeSpec('projectile',99,'容量テスト','炎'),battle:{type:'ノーマル',power:10,cast:0.2,cooldown:1,tags:[]},audio:[]})`
   で棚に1件置き、`buildMoveEditor()` を呼んで `#mvLib` を最新化する。`#mvLib .ml-ctl` の
   うち `label` のテキストが「容量テスト」の行を見つけ、その `querySelectorAll('button')[0]`
   （読込ボタン。`src/movelab.js` の `mlLibrary()` が `[bl,bx]=querySelectorAll('button')` の
   順で組んどるので `[0]` が読込）をクリックする。`mon.customMoves.length` が読込前後で
   `12` のまま変わっとらんこと、`dialogs` に「持ちすぎ」を含む文言が出とることを assert する
   （customMoves 12本上限の実際の強制点は shelf-load 経路だけなので、そこを通す）。

5. **excludeBuiltinの往復**：`mon.excludeBuiltin=['akuu','beam']` にしたあと
   `const snap=JSON.parse(JSON.stringify(snapshot()));` → `const restored=normalizeMon(snap);`
   を評価し、`restored.excludeBuiltin` をソートした配列が `['akuu','beam']` と一致することを
   assert する。続けて `normalizeMon({})`（＝excludeBuiltinが存在せんデータ）の結果が
   `Array.isArray(...)===true` かつ `length===0` であることを assert する。

6. **矛盾状態が画面に出る**：`mon.excludeBuiltin=['slash']; mon.moves=['slash']; buildMoveList();`
   をUIを介さず直接評価してから、`document.getElementById('moveConflict').textContent` を
   取り、`'⚠'` を含むことを assert する。

最後に `pg.screenshot({ path: path.join(__dirname,'_learnable-shot.png') })` を撮り、
`errs.length` が0なら成功メッセージとともに終了コード0、そうでなければ全エラーを
`console.error` してから終了コード1にする（`tools/verify_style.js` の末尾と同じ形）。
  </action>
  <verify>
    <automated>node tools/verify_learnable.js</automated>
  </verify>
  <done>
`tools/verify_learnable.js` が新規に存在し、上記6チェックすべてを実施して終了コード0で通る。
`tools/_learnable-shot.png` が生成される。`node tools/verify_learnable.js` を単体で実行して
再現する。
  </done>
</task>

<task type="auto">
  <name>Task 3: npm scriptとtest_commandに登録する（LEARNABLE-GATE）</name>
  <files>package.json, .planning/config.json</files>
  <action>
1. `package.json` の `"scripts"` ブロック内、`"verify:movelist": "node tools/verify_movelist.js",`
   の行の直後に `"verify:learnable": "node tools/verify_learnable.js",` を追加する
   （既存行の末尾カンマ・後続行の並びはそのまま動かさない）。

2. `.planning/config.json` の `workflow.test_command` の文字列
   （現在 `"node build.js && node build.js --dev && node tools/verify_style.js && node tools/verify_signature_moves.js && node tools/verify_movelist.js"`）
   の末尾に ` && node tools/verify_learnable.js` を追記する（既存チェーンの直接
   `node tools/...` 呼び出しのスタイルに合わせる。`npm run` 経由にしない。この文字列以外の
   `.planning/config.json` のキーには一切触らない）。
  </action>
  <verify>
    <automated>node build.js && node build.js --dev && node tools/verify_style.js && node tools/verify_signature_moves.js && node tools/verify_movelist.js && node tools/verify_learnable.js && npm run verify:learnable</automated>
  </verify>
  <done>
`npm run verify:learnable` が `node tools/verify_learnable.js` を実行してグリーンで通る。
`.planning/config.json` の `workflow.test_command` に `node tools/verify_learnable.js` が
末尾へ追記されとる。更新後の `workflow.test_command` の全チェーンを実行してもグリーン
（既存の verify:style・verify:moves・verify:movelist も引き続き通る＝回帰なし）。
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| なし（新規の外部境界は無い） | 制作ツールはローカルの `file://`／`localStorage` だけで完結する開発補助ツール。ネットワーク・認証・外部ユーザー入力の新しい境界は増えん（CLAUDE.md §1・.claude/CLAUDE.md Constraints、個人プロジェクトで配布せん）。 |
| 保存済み四皇モンデータ（自動保存・スロット・JSON貼付け・草むら・相手プレビュー） | `mon.excludeBuiltin` は人が保存した／貼り付けたデータから読み込まれる。壊れた値（配列でない・存在しないID文字列）が混ざっとっても、実行時エラーになったり不正なIDが後段のロジックへ漏れたりしてはならん。 |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick260820kit-01 | Tampering | 貼り付け/読込JSONの `excludeBuiltin` が配列でない・存在せんID文字列を含む | low | mitigate | `normalizeMon()` が `Array.isArray` チェックと `BUILTIN_MOVE_IDS.includes(id)` フィルタで無効値を静かに落とし、常に空配列以上の後方互換な既定値へ丸める（例外にせず、掟9の「黙って失敗」とは別方向——不正入力を安全側へ丸めるのは許容範囲）。`tools/verify_learnable.js` のチェック5がこの丸めを回帰検知する。 |
| T-quick260820kit-02 | Repudiation（掟9） | `toggleExcludeBuiltin()`/`toggleMove()` の相互拒否ロジックが片方だけ実装され、`moves ⊆ 覚えられる技` が黙って崩れる | medium | mitigate | 両関数それぞれに拒否チェックを実装し（装備中は除外拒否・除外中は装備拒否）、加えて `paintMoveConflict()` が UIを介さず作られた矛盾状態（旧データ読込等）も含めて常に画面へ警告を出す。`tools/verify_learnable.js` のチェック3・6が回帰を検知する。 |
| T-quick260820kit-03 | Tampering | Package legitimacy | n/a | accept | 新規npm/pip/cargoパッケージのインストールは無い（既存の `playwright` のみを使う `tools/verify_learnable.js` を足すだけ）。package-legitimacy gateは対象外。 |
</threat_model>

<verification>
1. `node build.js` と `node build.js --dev` が警告・例外なく完走し、`dist/`・`dist-dev/` の
   4画面が最新化される。
2. `node tools/verify_learnable.js`（および `npm run verify:learnable`）が終了コード0で、
   後方互換・除外・装備拒否・除外拒否・上限・往復・矛盾表示の6項目すべてをログにパス表示する。
3. `node tools/verify_creator.js` が既存の✎・複・×/戻・編集済マーカー・type chip・stat line・
   自動保存・スロット保存を含め引き続きグリーン（回帰なし）。
4. `node tools/verify_style.js`・`node tools/verify_signature_moves.js`・
   `node tools/verify_movelist.js` が引き続きグリーン（技棚まわりへの意図しない影響が無い）。
5. `.planning/config.json` の `workflow.test_command` に `node tools/verify_learnable.js` が
   末尾に追記されとる。
</verification>

<success_criteria>
- LEARNABLE-01: 制作ツールの技セクションが「■ 覚えられる技（最大12）」「■ 覚える技（最大4）」の
  2段表示になり、✎・複・×/戻・編集済マーカー・type chip・stat lineが全部今までどおり働く。
- LEARNABLE-02: `mon.excludeBuiltin` で内蔵技を個体ごとに除外でき、`moves ⊆ 覚えられる技` の
  不変が装備方向・除外方向の両方から拒否＋alertで守られ、矛盾状態は画面に出る（黙って消えん）。
  書いてない個体は今までどおり全部覚えられる（後方互換）。
- LEARNABLE-GATE: `tools/verify_learnable.js` が恒久的な回帰ゲートとして存在し、
  `npm run verify:learnable` と `workflow.test_command` の両方から呼べてグリーン。
</success_criteria>

<output>
Create `.planning/quick/260820-kit-learnable-table-learnable-ui/260820-kit-SUMMARY.md` when done
</output>
