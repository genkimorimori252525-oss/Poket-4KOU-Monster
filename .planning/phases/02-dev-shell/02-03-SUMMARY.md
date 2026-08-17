# 02-03-SUMMARY: ダッシュボードの中身

**完了:** 2026-08-18
**要件:** SHELL-04, SHELL-05（02-01 との共同達成。骨組みが 02-01、中身がここ）

## ダッシュボードに載ったもの

5パネル、1画面。開いた時に1回読むだけで、自動更新もポーリングも入れていない。

| パネル | 中身 | データの出どころ |
|---|---|---|
| 画面 | 4画面それぞれに「軽い版」「焼き込み版」の2ボタン | `config.screens` |
| 検証 | 4段の合否＋**古さ**（1日超で色が変わる） | サーバー（`.verify-status.json`） |
| 保存したもの | 保存した個体の名前・KB・技の本数／技の棚の件数 | **クライアント側で localStorage** |
| 置き場 | 合計 KB・上限に対する割合・キーごとの内訳・バー | クライアント側で localStorage |
| 軽量ビルド | 4画面の before/after と削減率・音の本数・**古さ** | サーバー（`BUILD-INFO.json`） |

**サーバーは保存データを見られない。** 個体も技もまだ localStorage の中でファイルではないので、
そこだけダッシュボードの JS がクライアント側で読む。Phase 3 でファイルになったら統一される。

## 嘘をつかないための3つの仕掛け

このフェーズで一番気を遣ったのは、**数字が出ないときに黙らないこと**。

1. **一覧が空のとき、空に見える理由を出す。**
   > 何も見つからんときは、こわれとるんやなくて「開き方（オリジン）が違う箱」を見とる可能性がある。
   > この画面は `http://localhost` の箱しか見えん。`file://` で開いて保存した分は別の箱に
   > 入っとって、こっちからは見えん（消えとるわけやない）。Phase 3 でファイル保存に移したら1つにまとまる。

   出典は CLAUDE.md「保存データは開き方ごとに別の箱」。にーくらがこれまで `file://` で開いて
   いたなら**一覧は正当に空になる**。説明が無ければ「作ったものが消えた」と読まれる。

2. **繰り延べた項目を、繰り延べたと書く。** 「最終更新」は Phase 3 送り。保存データに時刻の欄が
   無く、ここで足すと SAVE-07 が移行する直前に保存の形を変えることになるため。画面にその旨を
   1行出しているので、後から見て「作り忘れ」と読まれない。

3. **無いものを 0 や「-」でごまかさない。** 軽量ビルドが未実行なら数字を出さず
   「まだ作っとらん。`npm run build:dev`」と出し、**「軽い版」ボタンを無効にする**
   （押しても404になるボタンを出さない）。検証もビルドも**必ず古さを添える** ——
   3日前に通った記録は「通っている」ではない。

## 持ち出しの実演（SHELL-04）

「動くはず」ではなく、**実際に別フォルダへコピーして起動した記録**。

持っていったのは `devshell/` 一式と、`package.json` 1ファイル（`dev:serve` の1行だけ）、
`site/index.html` 1枚。このプロジェクトの `dist/` も保存データも持っていっていない。

書き換えたのは `shell.config.json` の5か所（`projectName` / `port` / `roots` / `screens` /
`storage` と `verifyStages` を**空配列**に）。

```
/                     -> 200
/index.html           -> 200
/__shell/config.json  -> 200
/__shell/status       -> 200
ダッシュボードの見出し: べつのプロジェクト
storage=[] verifyStages=[] でも壊れず（verify=null / build=null → 「まだ無い」と表示）
```

**空で成立することを確かめたのが肝。** 次のプロジェクトには四皇モンも `verify_*.js` も無い。
空で落ちるなら持ち出せない。実演の手順・使った最小の設定・応答コードは
`devshell/README.md` にそのまま貼ってある（次に持ち出す人が写すだけで済むように）。

## ダッシュボードの実表示

開発シェルのサーバーを立てて実際に描画を確認：

```
dashboard http=200  13,977 bytes
status:  verify=true  build=4画面
build:   技ラボ 83%減 / 戦闘テスト 78%減 / 音ラボ 87%減 / 制作ツール 69%減
/dev/shioumon_creator.html -> 200  247,061 bytes
/shioumon_creator.html     -> 200  855,713 bytes
```

**保存した個体は 0体。** ただしこれは故障ではなく、`http://localhost` のオリジンに保存データが
無いという正当な 0（にーくらがこれまで `file://` で開いていた場合にこうなる）。画面にはその
説明が出る。**Phase 3 の移行前に、にーくら本人による localStorage のバックアップが要る。**

## 分離の機械的な確認（SHELL-04）

`devshell/dashboard.html` に固有語（`四皇` / `shioumon`）の直書きは**ゼロ**。キーもラベルも
`shell.config.json` 経由。`localStorage` への書き込み呼び出しも**ゼロ**（`setItem` /
`removeItem` / `clear` / 添字代入のいずれも無し。「見る」操作でデータを書き換えない掟）。
`setInterval` / WebSocket も無し。`package.json` は触っていない（新規パッケージ0件が構造的に保証）。

## フェーズ終了時点の確認

```
npm run check:untouched   不可触 5件すべて HEAD と一致
npm run verify（4段）      exit=0   食い違い 0 / JSエラー 0
git status --porcelain    クリーン
CLAUDE.md の既存の掟       決定論・playSys()・画像・保存データの箱・音の決定権 —— 全部無傷
```

## 人の目で確かめてほしいこと

自動では確認できない：

1. `npm run dev` で専用ウィンドウが開き、**タブと URL バーが無い**か
2. 5パネルが 780x900 のウィンドウにおおむね収まるか
3. 「軽い版」で開いた画面が**体感で明らかに速い**か、そして音が鳴るか

## コミット

- `4285df2` feat(02-03): fill dashboard with saved items, storage usage, and measured build sizes
- `d63dd28` docs(02-03): record the portability run that actually booted devshell elsewhere
- `c93e133` docs(02-03): document dev shell, dist-dev file:// caveat, and the new verify commands
