---
phase: 03-five-support-moves
verified: 2026-08-21
verifier: orchestrator-inline
verdict: PASS
plans: 3
requirements-verified: [MOVE-01, MOVE-02, MOVE-03, MOVE-04, MOVE-05, VER-01, VER-02, VER-03]
regression-chain: green（11段）
---

# Phase 3（補助技を入れる）検証

**判定: PASS**

## ROADMAP 成功条件の照合

| # | 条件 | 判定 | 証拠 |
|---|---|---|---|
| 1 | 補助技が5本あり、`atk`/`def`/`eva`/`spd` の4つと自分掛け／相手掛けの両方を通っとる | ✓ | 技棚を直接数えた —— りゅうのまい(atk+22/16秒/self)・どくどく(atk−20/18秒/foe)・うずしお(spd−20/18秒/foe)・すなかけ(eva−20/16秒/foe)・斎藤尻隠れ(def+22/16秒/self)。stat 網羅 `atk,def,eva,spd` / target `foe,self`。`verify_support` 段1 が `>= 5` と網羅を assert（`== 5` にせず、将来の追加を殺さん形） |
| 2 | 5本とも `delta × dur ≳ 270` | ✓ | 352 / 360 / 360 / 320 / 352。**名目値で判定**（`statOf` の1〜100天井があるけん、技の合否を個体の都合で決めん。実効は較正場面で測って記録へ回す） |
| 3 | **AI が実際に5本とも撃つ** | ✓ | 2シード実走行（60×90フレーム・両者 stats/per を全50に pin）。発動回数 **りゅうのまい 1/4・どくどく 3/2・うずしお 5/6・すなかけ 5/6・斎藤尻隠れ 5/1** —— 5本とも両シードで発動。棚に載っとることやのうて `applySupportEffect` の呼び出しを `m.id` 別に数えた実測 |
| 4 | 新規2本は専用FXクラスを持ち、既存素材の流用が無い | ✓ | `SandAttackMoveFX` / `SaitoButtHideMoveFX` を新造。`verify_rebuilt_moves` が **41 generator/class・非流用（parts=0）** を検査して緑。**新規画像は0件**（掟4・コードで描いた） |
| 5 | 全部 `CostCalculator` を通って値段が付く | ✓ | `src/cost.js` に `supportPart()` を新設（`\|delta\|×dur ÷ supportPivot(270) × supportRefPower(26)` を等価威力へ換算）。前は5本とも `mv=0`＝**タダやった**。後は `mv≈3.70〜4.16`、コスト 26→30 |
| 6 | 恒久ゲートに載り `workflow.test_command` から毎回走る | ✓ | 11段（`verify_support` / `verify_cost` / `verify_rebuilt_moves` / `check_untouched` を含む）。**読み直した文字列そのものを実行して exit 0** を確認 |

## 梯子と降り口は使わずに済んだ

plan-check B1 で作った「0回なら `dur→20` → `\|delta\|→25` → それでも0回なら にーくらへ差し戻す」の
梯子は **一段も登らんかった**。`data/moves/library.json` は無改修で、
**にーくらが決めた表の数字が1つも曲げられずに通った**。

## 道中で見つかった別件（解決済み・コミット `4ef5972`）

`verify_cost.js` が着手前から赤やった。原因は Phase 3 とは無関係で、
**`a544b64`（Codex のデータ移行をオーケストレータが git へ入れたコミット）が
にーくらの保存個体2体を書き換えとった**こと:

```
BAZERGIUS  装備技 1本 → 3本、覚えられる技 2本 → 3本    コスト 20→24
PALKIA     本数は同じ・中身が移行（beam→hyper_beam_move）コスト 26→28
```

掟は「保存個体と自作技には指1本触れん」。**BAZERGIUS は明確に触られとった。**

見逃した理由は **`verify_cost.js` が回帰チェーンに入っとらんかった**こと（掟7・空振りゲート）。
`npm run verify:cost` として存在するのに誰も鳴らさんけん、赤のまま通った。

にーくら判断で **BAZERGIUS は原型へ復元**（`6364722` 時点＝`3caafcf` 以来ずっと同じ。git 上で完全一致を確認）、
**PALKIA は変更を受け入れて `cost-baseline.json` を生成器で焼き直し**（動いたのは
`saved:PALKIA` の `cost 26→28` と `mv 6.8→8.8` の2項目のみ／2406通り中）。
性質が違うけん扱いを分けた —— PALKIA は「同じ技が専用FXで描かれるようになった」だけで
にーくらが組んだ構成は変わっとらんが、BAZERGIUS は「知らん間に技を装備された」。

**executor が止まったのが正しかった。** `cost-baseline.json` を焼き直せば緑になる、と
知っとったうえで、プランがそれを禁じとったけん止めて差し戻した。あそこで焼き直されとったら、
保存個体が書き換えられた事実は永久に埋もれとった。

## 掟7 の棚卸し（別途 triage の値打ちあり）

`tools/` の検査24本のうち、着手時に**鳴っとったのは6本だけ**やった。
このフェーズで `verify_support` / `verify_cost` / `verify_rebuilt_moves` / `check_untouched` が
加わって **9/24**。まだ15本が鳴っとらん:

```
verify_audio  verify_bar  verify_butt_animation  verify_dev  verify_econ
verify_look   verify_ma   verify_migration  verify_power_scale  verify_range
verify_resolve  verify_stance  verify_store  verify_ui  verify_wire
```

**一律登録は違う** —— `verify_migration` のように役目を終えたものもあり、
Playwright 主体を24本毎回回すと回帰が長すぎる。**どれが今の不変条件を守っとるか**で
選り分ける作業が別途要る。
