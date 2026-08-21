# Phase 3: ファイル保存と戦闘への配線 - Context

**Gathered:** 2026-08-18
**Status:** Ready for planning

<domain>
## Phase Boundary

**このマイルストーンの本丸。** PROJECT.md の Core Value そのもの ——
「にーくらが作ったものが、容量を気にせず保存でき、実際の戦闘に出てくること」。

対象は SAVE-01〜07 と WIRE-01〜05 の12件。SAVE と WIRE を分けないのはオーナー判断
（ファイル保存が配線の前提。分けるとファイル形式を二度決めることになる）。

**含まない**: 技の分類（Phase 4）。ゲーム本編の Phase 15 以降（`docs/開発計画_v6.md` が正典）。

</domain>

<real_data>
## 実データ（2026-08-18・にーくらのバックアップから実測）

移行対象は既に手元にある: `shioumon_backup_file_1787042077836.json`（リポジトリ内・5.9MB）。
**推測ではなく実物を見て設計している。**

### 四皇モン 5体（`shioumon_creator_slots`・合計 171KB）

| スロット名 | id | 容量 | 技 | 写真 | 鳴き声 |
|---|---|---:|---:|---|---:|
| バゼルギウス | `BAZERGIUS` | 66 KB | 3本 | normal + summon（webp 各13KB） | 38 KB (mp3) |
| パルキア | `PALKIA` | 32 KB | 3本 | あり | 24 KB |
| ロッツォ | `Rottuo` | 29 KB | 2本 | あり | 11 KB |
| ちんすけ | `Chinsuke` | 25 KB | 2本 | あり | 15 KB |
| かまきり | `Mantis` | 17 KB | 1本 | あり | 4 KB |

**5体とも `id` が ASCII のみ** → そのままファイル名に使える。

### 1体の構造（実測・バゼルギウス）

```
id, name, types[2], stats{atk,def,hp,spd,eva,int}, per{aggr,caut,loyal,self},
moves[]          … 内蔵技のID配列（例 ["shakunetsu"]）
customMoves[]    … 技の実体（id,name,type,power,cast,cooldown,tags,fx,audio）
cry{id,vol,rate,data,label}          … data が base64（mp3）
scale, dy, idleMotion,
summon{style,cryDelay,land[]},
shadow{scale,flat,dx,dy,alpha,follow},
img{normal,attack,hurt,back,summon}  … 各 {scale,dy}（表示倍率。写真ではない）
derived{...}                          … その枠が複製かどうかの真偽値
images{normal,attack,hurt,back,summon} … ★ここが写真の実体（base64 webp / 複製枠は null）
```

**容量の内訳が確定した。** バゼルギウス 66KB ＝ 鳴き声38KB ＋ 写真26KB ＋ **設計データ2KB**。
CLAUDE.md の「設計データは1体2KB」は正確だった。

### その他

- `shioumon_move_lib_v1`（2KB）… 技の棚 **2本**（亜空切断・灼熱弾）。どちらも `battle` を持つ
- `shioumon_audio_cfg_v1`（2KB）… 技9件・システム15件の音割り当て
- `shioumon_creator_auto`（26KB）… 自動保存（編集中の1体）
- `shioumon_crydelay_050`（0KB）
- **`shioumon_wild_pool_v1` は存在しない** … まだ1体も放流していない
- **`shioumon_scene_sfx_v1` は存在しない**

### 保存制限の真因（重要）

`file://` で開いたページは**マシン上の全ローカルHTMLで localStorage を共有する**。
実測では 5MB 枠の **96%** が埋まっていたが、その内訳は:

```
4,699 KB  betgame4 / betgame4B 系（別プロジェクト・17キー）
  201 KB  四皇モン関連ぜんぶ
```

**四皇モンは被害者だった。** 保存できなくなっていた原因は他所のプロジェクトの占領。
にーくらは「もう使っていない」と回答済みだが、**削除しても上限5MBは消えない**
（にーくら自身の指摘）。壁を消すのはこのフェーズ。

</real_data>

<decisions>
## Implementation Decisions

### ファイル配置（オーナー承認）
**写真と鳴き声は JSON の外へ出す。**

```
data/
  monsters/
    BAZERGIUS.json          … 設計データのみ。約2KB
    BAZERGIUS/
      normal.webp           … images.normal を実ファイルへ
      summon.webp
      cry.mp3               … cry.data を実ファイルへ
  moves/library.json        … 技の棚
  audio/config.json         … 音の割り当て
  wild-pool.json            … 草むら（今は空）
```

**理由:** `BAZERGIUS.json` が 66KB → 2KB になり、**git の差分が人間に読める**。
「攻撃力を60から55に下げた」が1行の差分になる。base64 を埋めたままだと1文字の変更で
66KB の塊が丸ごと差し替わって差分が読めず、にーくらの「全キャラの攻撃力を見直したい」が成立しない。

- **ファイル名は `id`（ASCII）** を使う。表示名 `name` は JSON の中に持つ。
  日本語ファイル名を避けて、どの環境でも壊れないようにする。
- メディアの拡張子は data URI の MIME から決める（webp / mp3 など実物に従う）。
- **制作ツールの「■ JSON」書き出し（1体まるごと自己完結）はそのまま残す。**
  あれは持ち出し・共有用で、ファイル保存とは別の役割。

### 戦闘への出し方（オーナー承認）
**戦闘テスト画面に選択UIを足す。** `data/monsters/` にある個体から手前・奥を選んで開始する。
画面を移らずに何度でも組み直せるので、AIの調整に一番向く（このプロジェクトの主目的）。

### サーバー不在時のふるまい（SAVE-04）
`dist/` の単体HTMLを `file://` で開いたときは、**今までどおり localStorage へ保存する**。
掟「単体で開ける」を壊さない。保存先の判定は「保存APIが応答するか」で行い、
**どちらに保存したかを画面に必ず出す**（黙って別の箱に入れない）。

### 移行（SAVE-07）— 最優先の安全要件
**保存先を変える作業より前に、移行経路が存在すること。**

- 移行元は**手元のバックアップJSON**（実物・検証済み）。localStorage を直接読む経路も用意するが、
  バックアップを正とする方が安全（ブラウザの状態に依存しない）。
- **1件も失わないことを機械で確認する** —— 移行前後で個体数・技の本数・鳴き声と写真のバイト数を
  突き合わせ、1つでも合わなければ止まる。
- 移行は**冪等**にする（二度流しても壊れない）。
- **元の localStorage は移行では消さない。** 消すかどうかは、にーくらが動作を確認してから決める。

### Claude's Discretion
- 保存APIの形（エンドポイントの切り方、書き込みの粒度）
- 350ms デバウンスの扱い（現行の localStorage 書き込みと同じ間隔を保つのが素直）
- 戦闘側のロスター選択UIの見た目
- `wild_pool` / `scene_sfx` が存在しない場合の初期化

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `devshell/server.js` … Bun のサーバー（8766）。**ここに保存APIを足す**。パス封じ込め済み
- `devshell/shell.config.json` の `storage` … キーと形（shape）の定義が既にある
- `tools/check_untouched.js` … 不可触物件のゲート。このフェーズでも回す
- `npm run verify`（4段）… Phase 1 で嘘をつかなくなった安全網。**このフェーズが乗る土台**
- 制作ツールの `loadSlots()` … localStorage 読みの try/catch idiom

### Integration Points
- `src/creator.tpl.html` … 保存/読込の口（`SLOT_KEY` / `AUTO_KEY` / `WILD_KEY` 周辺）
- `src/movelab.js` … 技ライブラリの保存（`MOVE_LIB_KEY`）
- `src/sfx_bank.js` の下半分 … 音設定（`AUDIO_CFG_KEY`）※上半分のデータ表は不可触
- `src/battle.tpl.html:769-796` … `ROSTER_A`/`ROSTER_B` のベタ書き。**ここを置き換える**
- `src/battle.tpl.html` … `mon.shadow` / `mon.cry` / `mon.customMoves` を読む配線（WIRE-03/04/02）

### 触ってはいけないもの（全フェーズ共通）
- **`src/sfx_bank.js`** … 616KB・79音の唯一の実体。CC0元素材がこのマシンに無い
- **決定論** … 戦闘で `Math.random()` を使わない。固定タイムステップを崩さない
- **掟8** … 音の決定権は100%にーくら。`playSys()`/`playMovePhase()` を通す
- `dist/` は単体HTML・外部参照ゼロを維持（Google Fonts が唯一の例外）

</code_context>

<specifics>
## Specific Ideas

- **`git status` を不変判定に使わない。** Windows の `core.autocrlf` で偽陽性が出る（Phase 1 で2回）。
  `tools/check_untouched.js` のハッシュ比較を使う。
- **バックアップJSONは移行の検証にも使う。** 移行後のファイル群から復元した内容が、
  バックアップの中身と一致することを確かめられる。
- 検証は「主張」ではなく**実行記録**で残す（Phase 1・2 と同じ流儀）。

</specifics>

<deferred>
## Deferred Ideas

- **走っているゲームへのライブ流し込み**（パラメータを変えたら即反映）… 配線が通ってから
- **保存データのバックアップと世代管理**（v2・SAVE2-01）
- **草むら（Phase 19）の本実装** … ここでは「戦闘側から読める形式で置かれている」までが範囲
- `betgame4` 系の削除 … にーくらの判断待ち。**このフェーズの作業とは無関係**
  （ファイルへ移れば5MB枠は四皇モンにとって無関係になる）

</deferred>
