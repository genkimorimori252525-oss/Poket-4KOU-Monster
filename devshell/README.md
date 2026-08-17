# devshell — 持ち出せる開発シェル

`devshell/` は「アイコン一発でダッシュボードが専用ウィンドウに出て、そこから開発中の画面へ入れる」
ための一式。**Bun のサーバー・起動スクリプト・ダッシュボード・検証ランナー**が入っている。

## 何が入っているか

| ファイル | 役割 |
|---|---|
| `shell.config.json` | **プロジェクト固有の値はここだけ**。詳細は下の表 |
| `server.js` | Bun のサーバー。`127.0.0.1` だけで待ち受け、ダッシュボードと静的ファイルを配る |
| `dashboard.html` | 専用ウィンドウで開くダッシュボード本体（単体HTML） |
| `launch.js` | ブラウザ探索＋サーバー起動＋専用ウィンドウ（`--app`）起動 |
| `launch.cmd` | ダブルクリックできる入口。`npm run dev` と同じことをする |
| `install-shortcut.ps1` | デスクトップに起動用ショートカット（`.lnk`）を作る |
| `verify-report.js` | 検証チェーン（`verifyStages`）を順に走らせ、結果を JSON に残す |

## プロジェクト固有なのは `shell.config.json` 1ファイルだけ

`server.js` / `dashboard.html` / `launch.js` / `launch.cmd` / `install-shortcut.ps1` /
`verify-report.js` はどれもプロジェクト名や画面名を直接書いていない。すべて
`shell.config.json` から読む。だから**このフォルダをまるごとコピーして設定を書き換えるだけ**で
別のプロジェクトでも同じ手順が動く。

## 次のプロジェクトへの持ち出し手順

1. `devshell/` フォルダをまるごと新しいプロジェクトのルートへコピーする
2. `shell.config.json` の `projectName` / `port` / `roots` / `screens` / `verifyStages` / `storage`
   を、そのプロジェクトのものに書き換える
3. `package.json` の `scripts` に `dev` / `dev:serve` / `dev:icon` / `verify` の4行を足す

   ```json
   "dev": "bun devshell/launch.js",
   "dev:serve": "bun devshell/server.js",
   "dev:icon": "powershell -NoProfile -ExecutionPolicy Bypass -File devshell/install-shortcut.ps1",
   "verify": "node devshell/verify-report.js"
   ```

4. `.gitignore` に `.devshell/` と `.verify-status.json` を足す（検証結果とブラウザプロファイルは
   「今このマシンで起きとること」であって、リポジトリの状態やない）
5. `npm run dev`

## 実際にやって確かめた（2026-08-18）

上の手順は「動くはず」やのうて、**一時フォルダへ本当にコピーして動かした記録**。

置いたのは `devshell/` 一式と、次の2つだけ。このプロジェクトの `dist/` も保存データも持っていっとらん。

`package.json`（これだけで足りた）:

```json
{ "name": "pt", "private": true, "scripts": { "dev:serve": "bun devshell/server.js" } }
```

`site/index.html`（配る中身が1つあればよい）:

```html
<!doctype html><meta charset=utf-8><title>見本</title><h1>ok</h1>
```

`shell.config.json` の書き換えはこの5か所だけ:

```json
{
  "projectName": "べつのプロジェクト",
  "port": 8795,
  "roots":   [{ "prefix": "/", "dir": "site" }],
  "screens": [{ "label": "見本", "file": "index.html" }],
  "storage": [],
  "verifyStages": []
}
```

`bun devshell/server.js` で立てた結果:

```
/                     -> 200
/index.html           -> 200
/__shell/config.json  -> 200
/__shell/status       -> 200
ダッシュボードの見出し: べつのプロジェクト
```

**`storage` と `verifyStages` を空配列にしても壊れん**ことをここで確かめとる。次のプロジェクトには
四皇モンも `verify_*.js` も無いけん、空で成立せんかったら持ち出せんことになる。空のときは
`verify=null` / `build=null` が返って、ダッシュボードは数字を出さずに「まだ無い」と書く
（0 や「-」でごまかさん）。

## 前提

- **Bun**（サーバーと起動スクリプトを走らせる）
- **Node**（検証ランナー `verify-report.js` を走らせる。素の CommonJS のみで書いてあり、
  Bun 専用の API は使わない）
- **新しい npm パッケージは要らない。** `devshell/` はどのファイルも `fs` / `path` /
  `child_process` といった標準モジュールと、Bun の組み込み API（`Bun.serve` / `Bun.spawn`）しか
  使っていない

## `shell.config.json` の各キー

| キー | 意味 |
|---|---|
| `projectName` | ダッシュボードの見出しと、デスクトップショートカットの名前に使う |
| `port` | サーバーの待ち受けポート（`127.0.0.1` のみ） |
| `profileDir` | 専用ブラウザウィンドウの `--user-data-dir`。リポジトリルートからの相対パス |
| `verifyStatus` | 検証結果 JSON の出力先パス（`verify-report.js` が書く） |
| `buildInfo` | 軽量ビルドの実測値 JSON パス（無ければダッシュボードは `null` 扱いで無視する） |
| `roots` | 静的配信するディレクトリの一覧。`{prefix, dir}` の配列。**長いプレフィックス優先**で照合する |
| `screens` | ダッシュボードの入口に並べる画面。`{label, file}` の配列。`file` は `roots` の該当ディレクトリ直下のファイル名 |
| `verifyStages` | 検証チェーンの各段。`{name, label, cmd}` の配列。`cmd` は `spawnSync` にそのまま渡す配列 |
| `storage` | ダッシュボードが `localStorage` から読む項目の一覧。`{key, label, shape, countFields?}`。`shape` は `map-of-json-strings` / `map-of-objects` / `array` / `object` の4種類。`countFields` は1件あたりの内訳（配列の長さ）を数えるためのフィールド名の並び |

## 既知の制約

- **`roots` に登録したディレクトリが軽量ビルド（音声を外出しした版）の場合、`file://` で単体で
  開いても音が鳴らない。** 音声がファイル参照に変わるため、`devshell/server.js` 経由でしか
  音は鳴らない。焼き込み済みで単体でも開けるのは、音声をインライン化したビルド（例:
  このプロジェクトの `dist/`）のほうだけ
- 検証結果ファイル（`verifyStatus` が指すもの）はこのシェルの外では git 追跡しない前提。
  持ち出し先の `.gitignore` にも必ず追加すること
- ダッシュボードは開いたときに1回読むだけで、自動更新やリアルタイム監視はしない
