/* =========================================================
   CostCalculator —— 独立モジュール

   なんで独立させたか（計画 18.5 の警告）:

     「コストは**損失額と獲得額の両方**を決めるようになった。
      もしある四皇モンのコストが不当に安く見積もられていた場合、その個体は
      『強い』と『死んでも痛くない』と『刺客ボーナスが大きい』を**三重取り**する。
      確実に壊れる。」

   だからコスト経済（Phase 2）を載せる前に、式を1箇所へ集めて
   **差し替えられる形**にしておく。ここを書き換えても呼び出し側は1行も触らんでよい。

   掟6: コストは編成枠やない。**試合中の陣営の体力**。上限で編成を縛らん。
   掟9: 内訳が見えん実装をしない。だから costOf は数字1つやのうて内訳ごと返す。

   ⚠ この式は**仮のまま**でよい。計画18.5 が「仮の式でよいので早い段階で入れ、
   実戦で検証する」と指示しとる。本採用は実戦のあと。
   ========================================================= */
var COST = (function () {

  /* ステータスの重み。
     賢さ(int)が低いんは、**有利にも不利にも働く**けん単純な線形評価が
     適さんから（計画18.5）。回避(eva)も似た理由で低め。 */
  var W = { atk: 1.15, def: 0.95, hp: 1.00, spd: 1.05, eva: 0.90, int: 0.85 };

  /* 式の定数。**触って試すのはここ** —— 実戦で歪みが見えたらこの表を動かす。
     コードの中に数字を散らかさんこと（散らかしたら次に触る者が式を追えん）。 */
  var K = {
    statScale:  27,    // 基礎コストの倍率
    statPivot:  50,    // この平均値を「並」とみなす
    statCurve:  2.45,  // 上に行くほど急に高くなる。線形やと格上が安すぎる
    movePower:  0.12,  // 技の威力の合計にかける
    moveExtra:  2,     // 2本目以降の技1本あたり
    floor:      1      // どんなに弱くてもコスト0にはせん（0除算とタダ乗りを防ぐ）
  };

  /* 技IDの取り出し。文字列でも {id:...} でも受ける */
  function moveIds(m) {
    return (m.moves || []).map(function (x) { return typeof x === 'string' ? x : x.id; });
  }

  /* 技の威力の合計。MOVES に無い技（自作技など）は 0 として扱う。
     ⚠ ここは Phase 2 以降で効いてくる —— 自作技が0点のままやと、
     強い自作技を積んだ個体が**不当に安くなる**（＝三重取りの入口）。
     今は仮式のまま置くが、実戦で歪みが出たら真っ先に疑う場所。 */
  function movePart(ids) {
    var sum = 0;
    for (var i = 0; i < ids.length; i++) {
      var mv = (typeof MOVES !== 'undefined') ? MOVES[ids[i]] : null;
      sum += mv ? mv.power : 0;
    }
    return sum * K.movePower + Math.max(0, ids.length - 1) * K.moveExtra;
  }

  /* 本体。**内訳ごと返す**（掟9）。cost だけ欲しいときは .cost を見ればよい */
  function of(m) {
    var sum = 0;
    for (var k in W) sum += ((m.stats && m.stats[k]) || 0) * W[k];
    var avg = sum / 6;
    var base = K.statScale * Math.pow(Math.max(1, avg) / K.statPivot, K.statCurve);
    var mv = movePart(moveIds(m));
    return { cost: Math.max(K.floor, Math.round(base + mv)), avg: avg, base: base, mv: mv };
  }

  /* ---------------------------------------------------------
     コスト経済（計画18章・本作の中核仕様）

     掟6: **コストは編成枠やない。試合中の陣営の体力。**
     編成を上限で縛らん。銀河軍団を組んでもよい —— ただし経済が悪い。

     ここに全部の定数を並べとる理由: 実戦で「守りのゲーム／攻めのゲーム」に
     なっとらんかったとき、**動かす場所が1箇所に揃っとる**ようにするため。
     計画18.5 が「仮の式でよいので早い段階で入れ、実戦で検証する」と指示しとる。
     --------------------------------------------------------- */
  var ECON = {
    start:    150,   // 所持コストの初期値（両陣営とも同じ）
    maxMul:   2,     // 上限は初期値の2倍 → 300
    k:        0.5,   // 撃破時の係数
    ratioCap: 2.0,   // 比率の上限。ここが「刺客」の取り分を決める
    judgeAfter: 8    // 8クォーターを超えても決着せんかったら判定へ（計画20章）
  };

  function maxOwn() { return ECON.start * ECON.maxMul; }

  /* 撃破で入る額。計画18.2:

       相手のコスト × min(比率上限, 相手のコスト ÷ 倒した個体のコスト) × 係数k

     **格上を食うほど大きく増え、格下を潰してもほとんど増えん。**
     これが「安い個体で格上に刺しにいく」を成立させとる唯一の仕掛けやけん、
     ここを緩めると低コスト編成の存在理由が消える。

     倒した側のコストで割るけん 0 除算に注意 —— cost.js の floor が
     1 を保証しとるが、外から 0 が来ても割れんように max(1,…) を挟む。 */
  function gainOn(killerCost, victimCost) {
    var ratio = Math.min(ECON.ratioCap, victimCost / Math.max(1, killerCost));
    return victimCost * ratio * ECON.k;
  }

  return { W: W, K: K, of: of, moveIds: moveIds, ECON: ECON, maxOwn: maxOwn, gainOn: gainOn };
})();

/* 既存の呼び出しをそのまま生かす薄い皮。
   これがあるけん `costOf(...)` と書いとる5箇所（battle 1・creator 4）を
   1行も触らんで済む。Phase 1 の約束「挙動は1ミリも変えん」はここで守られる。 */
function costOf(m) { return COST.of(m); }
