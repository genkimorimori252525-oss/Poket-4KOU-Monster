# 02-01-SUMMARY: シェルの貫通線

**完了:** 2026-08-18
**要件:** SHELL-01, SHELL-04, SHELL-05（SHELL-04 / SHELL-05 は 02-03 との共同達成。本プランは骨組みまで）

## 何ができたか

`devshell/` 一式。**サーバーが立ち、Chromium の専用ウィンドウが開き、ダッシュボードが出る**ところまで。

| ファイル | 役割 |
|---|---|
| `devshell/server.js` | Bun の静的配信（8766）。`/` → `dist/`、`/dev/` → `dist-dev/`、`/__shell/*` が設定と検証結果を返す |
| `devshell/launch.js` | Chromium を探して `--app` ＋専用プロファイルで起動 |
| `devshell/launch.cmd` | デスクトップのショートカットが叩く入口 |
| `devshell/install-shortcut.ps1` | デスクトップにショートカットを作る |
| `devshell/dashboard.html` | ダッシュボード本体（現時点では「画面」と「検証」の2パネル） |
| `devshell/verify-report.js` | 既存の検証チェーンを起動し、段ごとの合否と時刻を記録する外側のラッパー |
| `devshell/shell.config.json` | **プロジェクト固有のものはすべてここに隔離**（名前・ポート・画面一覧・localStorage キー・検証の段） |
| `devshell/README.md` | 持ち出し手順 |

`package.json` に `dev` / `dev:serve` / `dev:icon` を追加。`verify` はラッパー経由になり、
**旧チェーンは `verify:raw` として一字一句そのまま残した**。

## 検証（オーケストレーター側で独立に実施）

サーバーを実際に起動して全エンドポイントを叩いた結果：

```
config      projectName=ポケット四皇モンスター  screens=4  storageKeys=5
status      verify: 4段 ok=true（実行記録あり・古さも算出できている）
dashboard   http=200  5,532 bytes  title=開発シェル
creator     http=200  855,713 bytes（dist/ の画面が配信される）
path escape http=404  ← `/../CLAUDE.md` への脱出を弾いている
404         http=404
```

不可侵物件のハッシュ照合（`git hash-object` と `git rev-parse HEAD:<path>` の比較。
`git status` は Windows の `core.autocrlf` による偽陽性があるため不使用）：

```
OK  src/sfx_bank.js
OK  dist/shioumon_creator.html
OK  dist/shioumon_field_test.html
OK  dist/shioumon_effect_lab.html
OK  dist/shioumon_audio_lab.html
```

持ち出しゲート：`devshell/` 配下に `四皇` / `shioumon` の文字列は
`shell.config.json` と `README.md` 以外に**1件も無い**（コメント内も含めて確認）。

パッケージ：`dependencies` 無し、`devDependencies` は `{"playwright":"^1.62.1"}` のまま。**新規導入ゼロ。**

## 判断の記録

- **検証結果の記録は、4本の `verify_*.js` を編集せずに外側のラッパーで行った。** Phase 1 で作った
  安全網を「気をつけて守る」のではなく、**構造的に触らない**形にしている（`build.js` の追記方式と同じ）。
- **`tools/serve.js` は無改変。** 当初 PLAN には「Phase 1 の検証もそこに乗っている」と書いていたが、
  計画検査で**事実誤り**と判明（検証4本は `DIST_URL = 'file://' + ...` の直読みで、サーバーに依存しない）。
  訂正済み。触らないという結論は変わらず、実態は記述より安全側だった。
- 検証パネルは**合否だけでなく古さを必ず出す**（1日超で色が変わる）。古さの見えない「通過」は、
  このフェーズの前身である Phase 1 が殺した「嘘をつく検証」と同じ穴になる。

## 未達・次へ送るもの

- **四皇モンの一覧／技の本数／保存容量のパネルは 02-03 の担当。** 現時点のダッシュボードは
  「画面」と「検証」の2パネルのみ。
- したがって**「一覧が空のときの説明文」もまだ入っていない**。02-03 で必ず入れること
  —— 保存データは開き方（オリジン）ごとに別の箱なので、`file://` で作ったデータは
  `http://localhost` からは見えない。説明が無いと「作ったものが消えた」と誤解される。
- 「最終更新」は Phase 3 へ送り済み（保存データに時刻フィールドが存在しないため。
  Phase 3 で保存がファイルになればファイルの更新時刻がそのまま使える）。

## 人の目で確かめてほしいこと

自動では確認できない。にーくらが実際に見る必要がある：

1. `npm run dev` でウィンドウが開くか
2. そのウィンドウに**タブと URL バーが無い**か
3. ダッシュボードから4画面それぞれに入れるか

## コミット

- `daa8b46` feat(02-01): tracer — devshell server, launch, and dashboard entry panel
- `436274b` feat(02-01): desktop shortcut and portability docs for devshell
- `60643cc` feat(02-01): wire verify chain to write status, show it on dashboard with staleness

**注記:** 本 SUMMARY は実行エージェントが中断されたため、オーケストレーター（Claude）が
リポジトリの実状態を直接検証して作成した。上記の数値はすべて実測値。
