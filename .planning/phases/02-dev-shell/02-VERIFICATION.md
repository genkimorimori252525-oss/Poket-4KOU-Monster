---
phase: 02-dev-shell
verified: 2026-08-18T00:00:00Z
status: human_needed
score: 4/5 must-haves verified (1 は目視が要る)
behavior_unverified: 1
overrides_applied: 0
---

# Phase 2: 開発シェル Verification Report

**Phase Goal:** アイコン一発でダッシュボードが専用ウィンドウに出て、そこから開く開発用の画面が軽く立ち上がる
**Verified:** 2026-08-18
**Status:** human_needed —— 機械で確かめられる範囲はすべて通過。**ウィンドウが実際に開く様子だけは人の目が要る**
**検証者:** オーケストレーター（Claude）が直接実行。サブエージェントは使っていない

## 成功基準ごとの結果

### 1. アイコン一発で、タブも URL バーも無い専用ウィンドウが Chromium で開く — ⚠ 一部のみ

機械で確かめられたところ:

```
findBrowser() の解決結果:
  C:\Users\genki\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe
  → Playwright 同梱の本物の Chromium。新規インストールなし
起動フラグ: --app= / --user-data-dir= / --window-size=780,900  すべて存在
```

`--app=` がタブと URL バーを消し、`--user-data-dir` が普段の Edge/Chrome のプロファイルから
完全に切り離す。探索は `chromium-`（ハイフン）の glob を降順で見るので、Playwright が更新されて
ディレクトリ名が変わっても壊れない。`fs.existsSync` だけで判定し、**ブラウザを一切起動しない**
（このマシンではバージョン照会が2分返ってこない実測がある）。

**確かめられていないこと:** 実際にウィンドウが現れ、タブと URL バーが無い状態で表示されること。
これは画面を見ないと分からない。→ **にーくらの確認待ち**（`npm run dev`）。

### 2. `dist-dev/` が大幅に軽く、音は鳴らした瞬間に読まれる — ✓（体感のみ人の目）

実測（`dist-dev/BUILD-INFO.json`、機械が書いた値）:

| 画面 | dist/ | dist-dev/ | 削減 |
|---|---:|---:|---:|
| 音ラボ | 686 KB | 92 KB | **87%減** |
| 技ラボ | 717 KB | 123 KB | **83%減** |
| 戦闘テスト | 764 KB | 169 KB | **78%減** |
| 制作ツール | 864 KB | 270 KB | **69%減** |

最悪でも `dist/` の31%。ゲート（60%未満）に対して倍近い余裕。音は79本 / 446 KB を外出し。

遅延ロードは `npm run verify:dev` が exit=0 で証明:

```
音ラボ・技ラボ・クリエーター   起動直後 0件 → 1音鳴らして 1件
戦闘                          起動直後 3件 → 鳴らして増加（試合が走っとるけん正常）
custom（鳴き声）経路           全画面 ok    se の MIME  audio/ogg
JSエラー                      全画面 0件
```

`dist/` なら同じ操作で79件すべてデコードされる。**「体感で明らかに速い」だけは人の目が要る。**

### 3. `dist/` の4ファイルと `src/sfx_bank.js` が1バイトも変わっていない — ✓ 通過

```
npm run check:untouched  →  不可触 5件すべて HEAD と一致
```

`git status` ではなく `git hash-object` と `git rev-parse HEAD:<path>` の突き合わせ。
Windows の `core.autocrlf` による偽陽性（Phase 1 で2回発生）を原理的に踏まない方式。

ゲート自体が効くことも往復で確認済み: 健全 0 → `sfx_bank.js` に1行足して **1** → 戻して 0。

構造的な保証も入っている: 新しい `build.js` が**旧 `build.js` の全文で始まる**（追記のみ・+5,720文字）。
分岐を挟まないので、`dist/` の不変が注意力ではなく構造で担保されている。

### 4. サーバーが1コマンドで立ち、別フォルダへコピーしても同じ手順で動く — ✓ 通過

`npm run dev:serve` の1コマンド。持ち出しは**実際にやって確かめた**（主張ではない）:

```
一時フォルダへ devshell/ をコピー、shell.config.json の5か所だけ書き換え
  /                     -> 200
  /index.html           -> 200
  /__shell/config.json  -> 200
  /__shell/status       -> 200
  ダッシュボードの見出し: べつのプロジェクト
  storage=[] verifyStages=[] でも壊れず（verify=null / build=null → 「まだ無い」と表示）
```

分離は機械的にも確認: `devshell/dashboard.html` に固有語（`四皇` / `shioumon`）の直書きゼロ。
実演の手順と使った最小の設定は `devshell/README.md` にそのまま貼ってある。

### 5. ダッシュボードに一覧・技の本数・保存容量・検証状態が出て、4画面へ入れる — ✓ 通過（1項目は明示的に繰り延べ）

実際に立てて描画を確認:

```
dashboard http=200  13,977 bytes
status:  verify=true（4段）  build=4画面
/dev/shioumon_creator.html -> 200  247,061 bytes
/shioumon_creator.html     -> 200  855,713 bytes
```

5パネル（画面・検証・保存したもの・置き場・軽量ビルド）。各画面に「軽い版」と「焼き込み版」の
2つの入口。`localStorage` への書き込み経路ゼロ（見るだけ）。`setInterval`・WebSocket なし。

**「最終更新」は Phase 3 へ明示的に繰り延べ**（黙って欠けた項目ではない）。保存データに時刻の欄が
無く、ここで足すと SAVE-07 が移行する直前に保存の形を変えることになるため。**画面にもその旨が
1行出ている**ので、後から「作り忘れ」と読まれない。

## 表示された内容についての重要な注記

**保存した個体は 0体と表示された。** これは故障ではない。`http://localhost` のオリジンに保存
データが無いという正当な 0 で、にーくらがこれまで `file://` で開いていた場合にこうなる
（CLAUDE.md「保存データは開き方ごとに別の箱」）。ダッシュボードにはその説明が1行出る。

## 人の目が要る3点

1. `npm run dev` でウィンドウが開き、**タブと URL バーが無い**か
2. 5パネルが 780x900 のウィンドウにおおむね収まるか
3. 「軽い版」で開いた画面が**体感で明らかに速い**か、そして音が鳴るか

## 副次的に直したもの（Phase 1 の積み残し）

`tools/verify_resolve.js` が**間欠的に落ちていた**（3回中2回 exit=1）。原因は検査が制作ツールの
生きた `ph`（描画で使う仮画像）へ文字列を入れたまま戻していなかったこと。同じ同期ブロックの
`finally` で必ず返すよう修正し、**5回連続 exit=0** を確認。制作ツール本体は正常だった。

間欠的に落ちる検証は、Phase 1 が殺した「嘘をつく検証」と同じ穴になる。Phase 3 はこの網に乗る。

## フェーズ終了時点

```
npm run verify（4段）      exit=0   食い違い 0 / JSエラー 0
npm run check:untouched    不可触 5件すべて HEAD と一致
git status --porcelain     クリーン
CLAUDE.md の既存の掟        決定論・playSys()・画像・保存データの箱・音の決定権 —— 全部無傷
新規 npm パッケージ          0件（devDependencies は playwright のみ）
```
