/* ============================================================
   技の分類：近接 / 遠距離 / 遠隔（MOVE-01）

   もともと掟にはこう書いてあった —— 「近接と雷は迎撃不可」。
   これは分類の中に**技の名前**が混ざっとって、一般化に失敗しとる。
   「足元から棘が生える」技を作ったとき、雷やないけん相殺される、では明らかにおかしい。

   分ける基準は速さやのうて、**実体が空間を進むかどうか**:

     近接 melee   触れて当てる。間に空間が無いけん割り込めん
     遠距離 ranged 実体が空間を進む（弾・光線）。**進んどる実体を叩けるけん相殺が成立する**
     遠隔 remote   実体が進まん。発生した瞬間もう当たっとる。叩く対象が空間に存在せん

   これなら新しい技も一意に決まる:
     岩を飛ばす → 遠距離     足元から棘 → 遠隔     直接凍らせる → 遠隔     落雷 → 遠隔
   「雷は迎撃不可」が結論やのうて、定義から**導かれる結果**になる。

   相殺から見ると実は2分類でよい（遠距離か、それ以外か）。
   既存の力関係（弾↔弾で相殺／光線↔光線で押し合い／光線は弾を貫通）は
   全部「遠距離」の内側の話で、そこは1行も変えとらん。
   ============================================================ */
var MOVE_RANGE = (function () {

  var LABEL = { melee: '近接', ranged: '遠距離', remote: '遠隔' };

  /* ジェネレータ → 分類。
     この対応は勝手に決めたもんやのうて、**相殺の実装が既に使っとる区別そのもの**。
     相殺は isBullet()=ProjectileFX / isBeam()=BeamFX でしか成立せんけん、
     projectile と beam ＝ 遠距離。それが「実体が空間を進む」の実装上の姿。 */
  var BY_GENERATOR = {
    projectile: 'ranged',   // 弾。飛んでいく実体がある
    beam:       'ranged',   // 光線。伸びていく実体がある
    slash:      'melee',    // 斬る。触れて当てる
    lightning:  'remote',   // 落ちる。空間を横切らん
    aura:       'remote',   // 自分から出る。飛ばさん
    shatter:    'remote'    // 着弾点で割れる。進まん
  };

  /* 技の分類を返す。技データに range が明示されとればそっちが勝つ
     （新しいジェネレータを足したときや、例外を作りたいとき用）。 */
  function rangeOf(move) {
    if (!move) return 'ranged';
    if (move.range && LABEL[move.range]) return move.range;
    var g = move.fx && move.fx.generator;
    return BY_GENERATOR[g] || 'ranged';
  }

  function labelOf(move) { return LABEL[rangeOf(move)] || '遠距離'; }

  /* 相殺の門番。遠距離だけが相殺の土俵に乗る。
     近接と遠隔は「迎撃不可」やのうて、**叩く対象が空間に無い**けん土俵に上がらん。 */
  function isRanged(move) { return rangeOf(move) === 'ranged'; }

  /* 分類ごとの既定モーション（MOVE-04）。
     fx.motions[] を書いとらん技に割り当たる。書いてあればそっちが勝つ（MOVE-05）。

     動きの向きが分類ごとに違う:
       近接   大きく踏み込む —— 距離を詰めるんが技の本体
       遠距離 前へ出す（控えめ） —— 撃ち出す先がある
       遠隔   その場で溜める —— 撃ち出す先が無い。力は自分の内側から出る

     遠隔で腕を前に振ると「何かを飛ばした」ように見えて、実体が飛ばんという
     分類の意味と絵が食い違う。だから溜める。
     新しい絵は作らん（掟4：画像を増やさん）。既存の anim の使い分けと長さだけで出す。 */
  var MOTION = {
    melee:  { anim: 'attack', dur: 0 },      // dur:0 = 既定の長さ。今までどおりの踏み込み
    ranged: { anim: 'attack', dur: 0.42 },   // 短く。前へ出すだけの控えめな動き
    /* ⚠ dur を与えた（2026-08-19）。前は 0＝既定の長さ（0.9秒）やった。
     cast のあと**撃ち終わっとるのに溜めのポーズが0.9秒残る**けん、
     にーくらに「何度も上下に動く」と言われた。撃った後は余韻やけん短くてよい。
     遠距離（0.42）に揃える。**anim名は変えとらん** —— 分類→動きの対応は据え置き。 */
  remote: { anim: 'charge', dur: 0.42 }       // その場で溜める
  };
  function motionOf(move) { return MOTION[rangeOf(move)] || MOTION.ranged; }

  return {
    LABEL: LABEL,
    BY_GENERATOR: BY_GENERATOR,
    rangeOf: rangeOf,
    labelOf: labelOf,
    isRanged: isRanged,
    motionOf: motionOf
  };
})();
