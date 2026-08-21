# 02-02-SUMMARY: 軽い開発ビルド

**完了:** 2026-08-18
**要件:** SHELL-02, SHELL-03

## 軽量化の実測（主張やのうて数字）

`node build.js --dev` の出力そのもの。`dist-dev/BUILD-INFO.json` に機械が書いた値。

| 画面 | dist/ | dist-dev/ | 比率 |
|---|---:|---:|---:|
| 音ラボ | 702,568 B | **92 KB** | **13%** |
| 技ラボ | 734,616 B | **123 KB** | **17%** |
| 戦闘テスト | 781,838 B | **169 KB** | **22%** |
| 制作ツール | 884,781 B | **270 KB** | **31%** |

`dist-dev/se/` に **79本 / 446 KB**。ゲートは「60%未満」だったので、一番重い制作ツールでも
倍近い余裕がある。効きが一番大きいのは音ラボの **87%減**。

`distBytes` は PATTERNS 第5節の実測値と全件一致 —— **`dist/` が動いていない別証明**にもなっている。

## 不可触ゲートの往復記録

```
健全時                              exit=0   不可触 5件すべて HEAD と一致
src/sfx_bank.js に1行足す           exit=1   変わっとる src/sfx_bank.js
                                             作業ツリー 44b7ddd6...  HEAD c80eedb6...
戻す                                exit=0   不可触 5件すべて HEAD と一致
```

`git status` ではなく `git hash-object` と `git rev-parse HEAD:<path>` の突き合わせ。
Phase 1 で Windows の `core.autocrlf` による偽陽性を2回踏んでいるので、
**見た目やのうて中身で判定する**。

## 遅延ロードの実行記録（`npm run verify:dev`）

```
se の MIME    audio/ogg
音ラボ        起動直後 0 件 → 鳴らして 0 → 1     custom経路 ok
技ラボ        起動直後 0 件 → 鳴らして 0 → 1     custom経路 ok
戦闘          起動直後 3 件 → 鳴らして 3 → 6     custom経路 ok
クリエーター  起動直後 0 件 → 鳴らして 0 → 1     custom経路 ok
JSエラー      全画面 0 件                        exit=0
```

`dist/` なら同じ操作で79件すべてがデコードされる。そこが決定的な差。

**戦闘だけ0件でない理由（正常）:** あの画面は開いた瞬間からAI自動戦闘が走り、実際に音が鳴る。
鳴った分だけ遅延デコードが進むのは設計どおりの動き。79件には程遠い。

## 掟8をどう守ったか

変えたのは**いつ読むか**だけ。**どの音を鳴らすか**を決める層には触っていない。

- `playSys()` / `playMovePhase()` / `playAt()` / `AUDIO_CFG` —— 無変更（4画面すべてで健在を確認）
- `play()` は元から未デコードなら `false` を返して黙って諦めていた。その「諦める」を
  「1つ読んでから鳴らし直す」に変えただけ。判断の主体は `AUDIO_CFG`＝にーくらのまま
- この形は `playCry()` が既に手作業でやっていたことの**一般化**であって、新しい仕組みの発明ではない

**引き換え:** その音の初回だけ、デコードのぶん再生が遅れる。`dist/` 側は `resume()` で
先に全部読むのでこの遅れが無い。CONTEXT で受け入れ済みのトレードオフ。

## 途中で見つけた本物の不具合（Phase 1 の積み残し）

**`tools/verify_resolve.js` が間欠的に落ちていた。** 同じコマンドで結果が変わる。

```
修正前  1回目 exit=1 / 2回目 exit=0 / 3回目 exit=1   （食い違いは毎回0件）
修正後  5回連続 exit=0・JSエラー0件
```

**原因:** 検査が制作ツールの生きた状態を汚していた。`ph`（本体が毎フレームの描画で使う
仮画像オブジェクト）へ `'pN'` などの**文字列**を入れ、**元に戻していなかった**。
evaluate が返ってから `pg2.close()` までの間に描画が1フレーム走ると
`drawImage('pN')` が TypeError を投げる —— 挟まるかどうかはタイミング次第。

**制作ツール本体は正常だった。** `drawMon` には `if(!img) return;` のガードがあり、
渡っていたのは「偽の値」ではなく「真だが画像でない値」だった。

**修正:** 借りた状態を同じ同期ブロックの `finally` で必ず返す。この関数には `await` が
1つも無いので、汚れた状態を描画フレームが観測することは原理的に起きなくなった。

**なぜ Phase 2 で直したか:** 間欠的に落ちる検証は、Phase 1 が殺したはずの「嘘をつく検証」と
同じ穴になる。「たまに落ちるから気にしない」を覚えた瞬間、Phase 3 が乗る土台が消える。

## 最終確認

```
node build.js（フラグ無し）  出力5行が今までと同じ・末尾「4 / 4 個ビルドした」
build.js の追記のみ           新ファイルが旧ファイルの全文で始まる（+5,720文字）
npm run verify（4段）         exit=0  音✓ UI・決定論✓ 制作ツール✓ resolve一致✓
npm run check:untouched       不可触 5件すべて HEAD と一致
dist/ の base64               残っている（単体で開ける掟は健在）
dist-dev/ の base64           1つも無い・se/ 参照あり
新規パッケージ                 0件（devDeps は playwright のみ）
```

## dist-dev/ の性質（明文化）

音がファイル参照になったので、**`dist-dev/` の画面は `file://` では音が鳴らない**（`fetch` が通らない）。
サーバー経由で開くのが前提。**単体で開ける・外部参照ゼロの掟を守るのは `dist/` の役目**で、
そちらは無変更のまま。

## コミット

- `daf45d5` feat(02-02): add --dev build that extracts 79 sounds to dist-dev/se and lazy-decodes them
- `deb38d0` feat(02-02): add untouchable gate that compares blob hashes against HEAD
- `efbc4f4` feat(02-02): add verify_dev to prove sounds decode only when played
- `486d96e` fix(02-02): stop verify_resolve leaking string placeholders into the live creator page
