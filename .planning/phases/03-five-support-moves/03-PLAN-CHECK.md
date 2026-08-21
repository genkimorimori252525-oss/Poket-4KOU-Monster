# Phase 3（補助技を入れる）plan check

**判定: NEEDS REVISION** — BLOCKER 1 / WARNING 3 / NOTE 2
対象: `03-01-PLAN.md` / `03-02-PLAN.md` / `03-03-PLAN.md`

---

## 0. 検算の前提

`rawFlow`/`offenseFlow`/`evaFlow`/`buffValue`/`scoreMove`/`scoreHold`/`statOf`/`effDelta`
を `src/battle.tpl.html` から書き写して Node で独立に再実装し、較正シナリオ（`__pin`：
両者 stats/per 全50・`foe.actionTimer=1.0`、`f.moves=[技,shakunetsu]`、`foe.moves` は
Roster の実個体のまま）で `攻撃(灼熱弾) total=22.334` を再現できることを確かめたうえで
（期待値 22.33 と一致）、5本ぶんの `補助の値打ち`／`総合点` を計算した。

`src/moves.js`（`shakunetsu`/`suidan`/`bolt`/`slash`/`akuu`/`beam` の実数値）、
`ROSTER_A`/`ROSTER_B`（`src/battle.tpl.html:928-955`）も実ソースから直接取っとる。
数字を貼らず、この検査のためにその都度計算し直した。

---

## 1. planner の中心的主張（highest_value_checks #1）— 検算の結果、正しい

主張:「R4 の 270 は `atk`・自分掛けの一般形から出た線で、`spd`/`eva`/`def` は換算率が
`atk` の6〜7割しか無い。だから 270 を満たしても灼熱弾に総合点で勝つとは限らん」（03-01-PLAN.md
`<numbers>` 「分かったこと（重要）」）。

検算（`__pin` 較正シナリオ、`f=enemy`・`foe=ally` の実装どおりの非対称を含めて計算）:

| 技 | delta×dur | 補助の値打ち（検算） | 総合点（検算） | 総合点（プランの投影） | 一致 | 対灼熱弾(22.33)の差 |
|---|---|---|---|---|---|---|
| りゅうのまい | 352 | 26.364 | 23.339 | 23.3 | 一致 | +1.0（勝つ） |
| どくどく | 360 | 28.819 | 23.545 | 23.6 | 一致 | +1.2（勝つ） |
| うずしお | 360 | 18.916 | 20.387 | 20.4 | 一致 | -1.9（負ける） |
| すなかけ | 320 | 14.860 | 16.330 | 16.3 | 一致 | -6.0（負ける） |
| 斎藤尻隠れ | 352 | 16.383 | 13.935 | 13.9 | 一致 | -8.4（負ける） |

5本すべてでプランの投影値と小数第1位まで一致した。主張は正しい —— 5本中3本
（うずしお／すなかけ／斎藤尻隠れ）は `delta×dur≧270` を満たしても較正シナリオで
灼熱弾に総合点で負ける。だから Task 3 が「灼熱弾に勝つ」を assert せず、
`buffValue>0` と `対 scoreHold` の2つに留めた判断は正当（後述 W2 で別の指摘あり）。

ただし「6〜7割」という一括りの表現は正確やない。`buffValue` のディスパッチ
（`src/battle.tpl.html:1483-1499`）は `target==='foe'` の atk/def 効果を計算するとき
`refAtkMove(foe)`（相手個体の実際の持ち技から最短cooldownを選ぶ、`:1462`）を使う。
較正シナリオでは `foe.moves` を上書きしとらんけん、`foe=ally=パルキア` の実技
（`akuu`/`suidan`/`beam`）のうち `suidan`（cd1.9・威力22）が選ばれる —— `f` 側の
`shakunetsu`（cd2.4）より短い。この結果、`どくどく`（atk・相手掛け）は
`delta×dur` あたりの換算率が `りゅうのまい`（atk・自分掛け）より高くなる
（26.364/352=0.0749 対 28.819/360=0.0801、107%）。「6〜7割」に当てはまるんは
`斎藤尻隠れ`（def自分掛け、62%）・`うずしお`（spd相手掛け、70%）・`すなかけ`
（eva相手掛け、62%）の3本だけで、`どくどく`は例外。gate のどこにもこの比率を
ハードコードしとらんけん実害は無いが、`<numbers>` の説明文を読んだ人が
「foe掛けの技は全部弱い」と誤解する余地がある（→ N1）。

---

## 2. ゲート設計（highest_value_checks #2）

### 2a. `scoreHold` 比較は事実上の空振りに近い（→ W2）

較正シナリオ（stats/per全50、`foe.charging`なし、`f.ratio=1`、`per.aggr=50`）で
`scoreHold(f,foe)` を検算すると、効く項が `HOLD_W.base=-34` だけで他の条件
（`foe.charging`／`f.ratio<0.35`／`TEAM`のコスト比率／`per.aggr`のズレ）が
どれも発火せず、total は -34 前後にしかならん。5本の総合点（13.9〜23.5）は
すでに正の値やけん、`buffValue>0` の assert が通っとる時点で
`scoreMove(補助).total > scoreHold(f,foe).total` はほぼ自動的に真になる —— 別の
情報を足さん、実質2つ目の同じ主張の言い換えに近い。gate としては無害（誤って
落ちることは無い）やが、「間を取るに勝つ＝撃つ理由がある」を主張する割に
検査力が薄い。

### 2b. Plan 03 Task 1 の実走行（90秒・全50 pin・5本まとめて）— ぶれ幅は小さい

較正済みの5本＋灼熱弾の総合点（りゅうのまい23.339／どくどく23.545／うずしお20.387／
すなかけ16.330／斎藤尻隠れ13.935／灼熱弾22.334）を使い、`softmax` の温度
`T=1.2+(100-50)*0.34=18.2` で選択確率を検算すると:

| 技 | 選択確率（1回の意思決定あたり） |
|---|---|
| どくどく | 19.9% |
| りゅうのまい | 19.7% |
| shakunetsu | 18.6% |
| うずしお | 16.7% |
| すなかけ | 13.4% |
| 斎藤尻隠れ | 11.7% |

いちばん不利な斎藤尻隠れでも11.7%あり、90秒のあいだに意思決定は cooldown
（3.375〜6.75秒＝ `cd×cdScale=1.125`）から見て少なくとも20回前後は回る計算になるけん、
1回も選ばれん確率は無視できる水準（(1-0.117)^20≈8%止まり、実際は cooldown で
他候補が塞がる時間帯にさらに相対確率が上がるけんもっと低い）。highest_value_checks #2
が懸念した「シード依存でぶれて偶然赤くなる」リスクは、この5本の実数値では低いと判断する
（「複数シードで最低1回」への変更は不要 —— 提案はするが N2 に留める）。

この検算は `scoreMove` の静的な比較までで、`stepBattle` の実際のRNG消費・
`phaseLeft` の減衰・`foe.charging` の動的な発生までは追えとらん（ブラウザを
起動して実走行させることはこの検査の権限外）。数値的な裏付けが取れた範囲での
判断であることを明記しておく。

### 2c. Plan 01 Task 1/2 の実走行（40秒・pin なし・実個体）— 数値的に危うい（→ W1）

Plan 03 Task 1 とは違い、`03-01-PLAN.md` Task 1/2 の「実走行(発動を数える)」は
`window.__pin` を呼ばん。`f = partyA[0]`（パルキア、`atk92/int88`、実stats）が
そのまま使われる（Task 1手順4・Task 2手順4、`__pin` の呼び出しは一切無い）。

`__pin` 無しで同じ式を検算すると（`f=パルキア` 実stats、`foe=ルギアもどき` 実stats、
`T=1.2+(100-88)*0.34=5.28`——プランの `<numbers>` が明言する `T=18.2` とは別物）:

| 技 | 補助の値打ち | 総合点（foeBusy不成立時） | 総合点（foeBusy成立時） | 対 灼熱弾（25.9〜32.9）の差 |
|---|---|---|---|---|
| りゅうのまい | 10.384 | 5.455 | 13.613 | -12.3〜-20.5 |
| どくどく | 17.579 | 9.598 | 18.921 | -6.99〜-16.32 |
| うずしお | 12.193 | 13.369 | 19.196 | -6.72〜-13.71 |

原因は `effDelta` の天井（`src/battle.tpl.html:1414`）—— パルキアの `atk92` に
`atk+22` を掛けても実効は `+8` にしかならん（02.1-PLAN-CHECK.md の R2 とまったく同じ形の
食い違い）。ギャップは 7〜20点、しかも温度は `T=5.28` と Plan 03 の較正（`T=18.2`）より
はるかに冷たい（1位からの乖離に敏感で下位候補が選ばれにくい）。

ただし致命的とまでは言えん理由がある: Task 1/2 は `f.moves` を
`[補助技(たち), shakunetsu]` の最小構成へ差し替える。`shakunetsu` が cooldown 中の
あいだ（`2.4×0.87≈2.09秒`）、`f` にとって「間」以外の実質選べる技は補助技だけになる
（`pickMove` の候補は `ready` な技＋`hold` のみ）。この「cooldown で強制的に選ばされる」
構造がある限り、40秒のあいだに shakunetsu が何度も撃たれれば、その裏で補助技が
撃たれる機会も同じだけ生まれる。総合点で負けとることは「絶対に撃たれん」を
意味せん —— ただし `hold`（間）の総合点が高くなる局面（`foe.charging` 中など）では
補助技より `hold` が優先されうるけん、「必ず1回は撃たれる」の保証には ならん。

この節の数値（スコアのギャップ）は数えて確かめた。「40秒・seed 31337 で実際に
0回になるか」はブラウザの `stepBattle`＋`battleRng` を回さんと確定せん —— ここは
「読んだうえでの推定」であって実測やないことを明記する。プランの `<numbers>`
「ここでどう振る舞うか」節が明言する前提（`T=18.2`、int50）と、Task 1/2 が実際に
使う個体（`T=5.28`、int88）が食い違っとる、という構造上の事実が W1 の本体。

---

## 3. 段上げルールの収束性（highest_value_checks #3）— BLOCKER

`03-01-PLAN.md` `<numbers>`「ここでどう振る舞うか」4:
「実走行で1度も撃たれん技があったときだけ、その技の数字を段階的に上げる:
段1: `dur` を20へ（上限） 段2: `|delta|`を25へ（上限）。緑になった段で止める。」

`03-03-PLAN.md` Task 1 手順4もこれをそのまま踏襲する。が、「段2まで上げても
0回のまま」だった場合にどうするかが、3プランのどこにも書かれとらん。
`delta×dur` を270未満へ下げることは明示的に禁止（`<numbers>` 5、Plan 03 の `<context>`）
されとるけん、その禁じ手にも逃げられん。にーくらへ差し戻す・cast/cooldownを調整する・
複数シードで確認する、といった次の一手が1つも用意されとらん。

highest_value_checks #3 で明示されたとおり、逃げ道が書かれとらんケースは BLOCKER。
実際に発生する確率は §1/§2 の検算からすると低い（5本とも較正シナリオでの選択確率が
11%台以上）が、低い確率でも実際に0回のまま詰んだとき、実行者が取れる行動が
プランに定義されとらん —— これは「実行して確かめれば分かる」という性質の欠落やない、
プランの記述そのものの欠落なので閉じずに残す。

直し方: `03-03-PLAN.md` Task 1 の手順4末尾に、たとえば次を足す:
「段2まで上げても0回のままなら、`cast`/`cooldown` の値を見直す
（`<numbers>`の投影表の値を疑い、Task内で再計算して1段だけ調整してよい。
`delta×dur`の下限は変えん）。それでも0回なら実行を止めて、実測値（total比較・
選択確率）を添えて にーくら へ差し戻す。」のように、有限回の手段と、
尽きたときの停止条件を明記すること。

---

## 4. library.json の直列構成（highest_value_checks #4）— 問題なし

`03-01`→`03-02`→`03-03` は `depends_on` と `wave`（1→2→3）が整合しとって循環も無い。
3プランとも「`JSON.parse` で全体を読み → 該当レコードだけ書き換え →
`JSON.stringify(lib)` で全体を書き戻す」という同じ作法を踏んどるけん、
逐次実行である限り前段の変更を後段が握り潰すことは無い。現物を確認した:
`すなかけ`（`status:'idea'`、`hint`がprojectile前提の古い下書き）・
`斎藤尻隠れ`（未存在）・`made=56/idea=135/total=191` —— プランの前提（技棚191件・
`kind:'support'`が現在0本）と一致する。この観点は正当、指摘なし。

---

## 5. 空振りするゲート（highest_value_checks #5）

`tools/verify_rebuilt_moves.js` の `===39`→`===ALL.length` 変更は、`ALL` が
（`names`という既存の独立したリスト）＋（`SUPPORT_NAMES`という新しい独立したリスト）
から作られとって、`meta`/`reg`の実際の登録数と付き合わせる形になっとるけん
同語反復にならん（メタデータの登録漏れ・二重登録を実際に検出できる）。
`renderSignature` の署名一意性・`ops>=12`・`hits===1` 等の閾値も緩めとらん。
本数系のassertは全部 `>=` で将来の技追加を殺さん形になっとる
（プラン自身が `<context>` で明示的に禁じとる）。

見つかった空振りは §2a の `scoreHold` 比較（W2）だけ。他に「テストをテストしとるだけ」
「常に真になる assert」「否定の全走査」は見当たらんかった。

---

## 6. 掟の遵守（highest_value_checks #6）

- `src/sfx_bank.js` 不可触: 3プランとも `node tools/check_untouched.js` を毎タスク走らせる。OK
- 新しい絵を増やさん: `SandAttackMoveFX`/`SaitoButtHideMoveFX` は `drawMaterial` を
  `rmPoly`/`pxDisc`/`rmDiamond`/`pxRing`/`rmStar` 等の既存の低水準canvas関数だけで組む
  設計（画像読み込みは仕様に一切登場せん）。Plan 02 の `<verification>` に
  `git status --short` での新規画像ゼロ確認も入っとる。OK
- にーくらの自作技（亜空切断・灼熱弾）・保存個体: どのプランの `files_modified` にも
  `data/monsters/*` や `MOVE_AKUU`/`MOVE_SHAKUNETSU` の変更が無い。OK
- 音ID直書き: 新規2レコードは `audio:[]`（掟8どおり空で置く）。OK
- 内蔵6技の既定挙動: `src/moves.js` の `MOVES` テーブル（`shakunetsu`/`suidan`/`beam`/
  `slash`/`bolt`/`akuu`）はどのプランでも編集対象に無い。`tools/fixtures/cost-baseline.json`
  の基準技6本（`akuu`/`beam`/`bolt`/`shakunetsu`/`slash`/`suidan`）が
  この6技と一致することも確認した。OK

指摘なし。

---

## 7. 構造チェック（highest_value_checks #7）

- 全9タスク（3プラン×3）に `<read_first>`/`<action>`/`<verify>`/`<acceptance_criteria>`/
  `<done>` が揃っとる。OK
- `must_haves.truths` は全プランでファイル:行番号を指す形（例:
  「`src/battle.tpl.html:1784`」）で、本文を引用しとらん。OK
- 3プランとも `<artifacts_produced>` 節あり、しかも「どのプランが持つか」まで
  フェーズ全体で1枚にまとめとる（03-01 のものを03-02/03-03が参照）。OK
- `requirements` frontmatter の和集合: Plan01={MOVE-01,02,VER-01,02,03}、
  Plan02={MOVE-01,02,04,VER-02,03}、Plan03={MOVE-01,03,05,VER-01,02,03}
  → MOVE-01〜05・VER-01〜03 の8つ全部がどこかのプランに現れる。
  ROADMAP.md の Phase 3 「Requirements: MOVE-01〜05, VER-01, VER-02, VER-03」と一致。OK

指摘なし。

---

## 8. スコープ（Dimension 5・付随チェック）

タスク数は3プランとも3（目標2〜3のやや上限）。`estimate-check --calibrated` の結果:

| Plan | tokens | budget比 | confidence |
|---|---|---|---|
| 03-01 | 85,000 | 85% | low |
| 03-02 | 95,000 | 95% | low |
| 03-03 | 80,000 | 80% | low |

3プランとも `over_budget:false`（smart-zone判定はブロッカー化しない、ADR-2629どおり
WARNINGに留める）。ただし `confidence:low`（実績3件未満）で、直近の類似規模プラン
（`02.1-01`、3タスク・statOf/buffValue系の同種の作業）の実績は 11,765トークン
（`02.1-01-SUMMARY.md` frontmatter `actuals.tokens`）—— 今回の見積り(80k〜95k)の
1/7程度しか使っとらん。Plan 02 は特に新規FXクラス2本＋広い `<read_first>` を抱えとって
実測が跳ねる可能性がある。ブロッカーにはせんが（→ W3）、実行時に文脈予算を意識すること。

---

## YAML

```yaml
verdict: NEEDS_REVISION
counts: { blocker: 1, warning: 3, note: 2 }
issues:
  - id: B1
    severity: BLOCKER
    plan: 03-03-PLAN.md
    location: "Task 1 手順4（段上げルール）。03-01-PLAN.md <numbers> の同項も同根"
    dimension: goal_achievement
    gap: >
      実走行で0回のままの補助技が出たとき、dur→20→|delta|→25 まで上げる段は書いてあるが、
      それでも0回のままだった場合に何をするか（cast/cooldownの見直し・複数シード確認・
      にーくらへの差し戻し等）がプランのどこにも書かれとらん。delta×durを270未満へ下げる
      ことは明示的に禁止されとるけん、この禁じ手にも逃げられん。逃げ道が無い状態で
      acceptance_criteriaが「較正(全50)の列で全補助技が発動回数1以上」を要求しとるけん、
      この状況が発生すると実行者は完了条件を満たす手段を持たん。
    fix: >
      03-03-PLAN.md Task 1 の手順4末尾に、段2を尽くしても0回のときの有限の次の手
      （例: cast/cooldownの1段調整・複数シードでの再確認）と、それも尽きたときの
      停止条件（にーくらへ差し戻し、実測値を添える）を明記する。
  - id: W1
    severity: WARNING
    plan: 03-01-PLAN.md
    location: "Task 1 手順(実走行)・Task 2 手順4"
    dimension: verification_derivation
    gap: >
      「実走行(発動を数える)」がwindow.__pinを呼ばず、partyA[0]=パルキア(atk92/int88)の
      実statsをそのまま使う。<numbers>節が明言する前提（int50・T=18.2）とT=5.28で大きく
      食い違い、独立に検算した総合点は3本とも灼熱弾より7〜20点低い（effDeltaの天井で
      atk+22の実効が+8に落ちるため、02.1-PLAN-CHECK R2と同型の食い違い）。cooldown中は
      補助技しか選べん構造があるけん0回になる確率は高くはないと見るが、__pinしとる
      Plan 03 Task1（T=18.2、選択確率11.7%以上）と比べて有意にリスクが高い状態のまま
      実行することになる。
    fix: >
      Task 1/2の実走行ブロックでもwindow.__pin(f,foe)を呼んで較正シナリオに揃える
      （既にtools/verify_support.jsに定義済みの関数を呼ぶだけで済む、追加実装不要）。
  - id: W2
    severity: WARNING
    plan: 03-01-PLAN.md
    location: "Task 3 段2（assertするんは2つだけ）"
    dimension: task_completeness
    gap: >
      scoreMove(補助).total > scoreHold(f,foe).total のassertは、較正シナリオでの
      scoreHold総計が-34前後（foe.charging等の加点条件が1つも発火しないため）にしかならず、
      buffValue>0のassertが通っている時点でほぼ自動的に真になる。実質的な追加の検査力が薄い。
    fix: >
      緩い比較のままでよいと判断するならその理由を検査コメントに残すか、
      より意味のある閾値（例：手数・発生の隙だけの技より一定以上勝つ）に強化する。
  - id: W3
    severity: WARNING
    plan: 03-02-PLAN.md
    dimension: scope_sanity
    gap: >
      estimate.tokens=95000（budget比95%、confidence:low）。直近の類似規模プラン
      （02.1-01、3タスク・同系統の作業）の実績は11,765トークンで、今回の見積りの
      1/7程度。over_budgetではないためブロッカーにはしないが、新規FXクラス2本＋
      広いread_firstを抱えるPlan 02は実測が見積りを超える可能性がある。
    fix: 実行時に文脈予算を監視し、必要ならチェックポイント/分割を検討する。
  - id: N1
    severity: NOTE
    plan: 03-01-PLAN.md
    gap: >
      <numbers>「spd/eva/defはatkの6〜7割」という要約は、foe掛けのatk効果（どくどく）には
      当てはまらない（検算では107%、atk自分掛けより高い）。buffValueがfoe側の実際の
      持ち技（refAtkMove(foe)）を参照する非対称設計のため。gateにこの比率はハードコード
      されておらず実害はないが、説明文が将来の読者に誤解を与えうる。
    fix: "「foe掛けのatk効果は例外」である旨を1行足す。"
  - id: N2
    severity: NOTE
    plan: 03-03-PLAN.md
    gap: >
      highest_value_checks#2の「複数シードで最低1回」提案について、Plan 03 Task1の
      5本の較正済み選択確率（11.7%〜19.9%、静的scoreMove比較による検算）を見る限り
      単一シードでの実務上のリスクは低いと判断する。念のための複数シード確認は
      コストが低いなら追加してもよい、という程度の提案に留める。
    fix: 任意。余力があればTask1にseed違いの再走行を1本足すと頑健性が上がる。
```

---

## まとめ

highest_value_checks #1（planner の中心的主張）は独立に検算して正しいと確認できた
—— 5本の投影値は小数第1位まで一致し、3/5本（うずしお・すなかけ・斎藤尻隠れ）は
`delta×dur≧270`を満たしても較正シナリオで灼熱弾に負ける。だから Task 3 が
「勝つこと」を assert せず実走行の発動回数へゲートを寄せた設計判断は正しい。

highest_value_checks #4〜#7（library.json直列構成・空振りゲート・掟遵守・構造チェック）
は指摘なし —— 現物のソース（`data/moves/library.json`・`src/cost.js`・
`tools/verify_rebuilt_moves.js`・`tools/fixtures/cost-baseline.json`）と付き合わせて
確認した。

残った B1（段上げの逃げ道が無い）は文言を数行足すだけで閉じる。
W1（Plan 01 の実走行が pin なしで T=5.28 になっとる）は `window.__pin` を1行呼ぶだけの
修正で解消できる、既に存在する仕組みを使い忘れとるだけの話。W2/W3 は軽微。

この4件（B1・W1・W2・W3）を閉じれば承認できる水準。
