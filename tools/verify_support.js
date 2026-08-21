#!/usr/bin/env node
/* 補助技（docs/整理_技一覧の一本化.md §4.5）の検証。数値・構造の検証が中心で、
   絵は見ん（SC1のダメージ着弾だけ launch() 経由の hp 減少で確かめる）。
   使い方:  node tools/verify_support.js        （NGなら終了コード1）

   house style は tools/verify_look.js に合わせる（chromium.launch / offlineFonts /
   PW_CHROMIUM / pageerror・console のエラー収集 / ok(cond,msg) の蓄積 / 非ゼロ終了）。

   ⚠ 後始末の作法（tools/verify_look.js が既にコメントしとる通り）：
   合成技・一時的な stats/per/actionTimer/hp/phaseLeft の書き換えは、必ず元の値を
   save して finally で戻す。「戻す先を定数で決め打ち」しない —— にーくらの既定ロスター
   （パルキア atk92 等）は全50やないけん、決め打ちの復元は個体を壊したまま後続の検査へ
   持ち越す（見た目には出らんまま、determinismTest すら2回とも同じ壊れ方で緑になる）。
   「検証が検証自身の後始末で失敗するんは、いちばん質の悪い赤や」。 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const ROOT = path.join(__dirname, '..');
const DIST_URL = 'file://' + path.join(ROOT, 'dist') + '/';
const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

(async () => {
  const errs = [];
  const ok = (c, w) => { if (!c) errs.push(w); };

  const b = await chromium.launch(LAUNCH);
  offlineFonts(b);
  const pg = await b.newPage({ viewport: { width: 420, height: 900 } });
  pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.goto(DIST_URL + 'shioumon_field_test.html');
  await pg.waitForTimeout(1500);

  /* =========================================================
     Task 1: statOf() スイープ単体 —— kind/effect/採点は一切存在せん段階で、
     「素早さで何も変わっとらん」ことを数値で証明する。
     ========================================================= */

  /* ---- 1a. 決定論（掟1）。補助技はまだ何も無いけん、スイープが挙動を
     1ミリも変えとらんならここは今まで通り緑になるはず ---- */
  const det = await pg.evaluate(() => { const r = determinismTest(); return { ok: r.ok, at: r.at }; });
  ok(det.ok, 'statOf() スイープ後、決定論チェックが落ちた（掟1）at=' + det.at);
  console.log('決定論        ' + (det.ok ? 'ok' : 'NG'));

  /* ---- 1b. byte-identical サンプル ----
     ページの実際の既定ロスター（パルキア/ルギアもどき、全50やない）のまま、
     statOf() が「バフが無いときは f.stats を素通しする」こと、そして
     damageOf() が手計算と完全一致することを、生の値がいくつであっても確かめる。 */
  const sample = await pg.evaluate(() => {
    resetBattle(4242);
    const out = {};
    for (const id of ['shakunetsu', 'slash', 'akuu']) {
      const mv = MOVES[id];
      const atkStat = statOf(ally, 'atk'), defStat = statOf(enemy, 'def');
      const hand = mv.power * (0.5 + atkStat / 100) * (100 / (100 + defStat))
        * quarterBonus() * stabOf(ally, mv);
      const real = damageOf(ally, enemy, mv);
      out[id] = {
        hand: +hand.toFixed(6), real: +real.toFixed(6),
        statEcho: statOf(ally, 'atk') === ally.stats.atk && statOf(enemy, 'def') === enemy.stats.def
      };
    }
    return out;
  });
  for (const id of ['shakunetsu', 'slash', 'akuu']) {
    const s = sample[id];
    ok(Math.abs(s.hand - s.real) < 1e-9,
       id + ' の damageOf() が手計算とズレた: hand=' + s.hand + ' real=' + s.real);
    ok(s.statEcho, id + ' の statOf() がバフ無しで f.stats を素通ししとらん');
  }
  console.log('byte-identical  ' + Object.entries(sample)
    .map(([k, v]) => k + ' hand=' + v.hand + ' real=' + v.real).join(' / '));

  /* ---- 1c. statOf() の 1〜100 クランプ。パルキアの atk は 92（全50やない）——
     「50 に戻す」と書くと個体を壊したまま持ち越すけん、必ず元の値を save/restore する。 */
  const clamp = await pg.evaluate(() => {
    resetBattle(4242);
    const original = ally.stats.atk;
    let result;
    try {
      ally.stats.atk = 150;
      result = statOf(ally, 'atk');
    } finally {
      ally.stats.atk = original;
    }
    return { result, restored: ally.stats.atk === original, original };
  });
  ok(clamp.result === 100, 'statOf() の天井クランプが効いとらん: 150 → ' + clamp.result + '（期待 100）');
  ok(clamp.restored, 'statOf() クランプ検証が元の atk（' + clamp.original + '）へ戻し損ねた');
  console.log('天井クランプ  atk150 → ' + clamp.result + '（元 ' + clamp.original + ' へ復元 ' + clamp.restored + '）');

  /* ---- 1d. 決定論を「補助技が実際にキャストされる」状態で証明する（02.1-03、SUP-06）----
     determinismTest() 自身がやる resetBattle(90210) は f.moves を触らんけん、ここで
     一時的に上書きした動きは determinismTest() が回す2本の40秒ランの両方に残る。
     「movelistに載っとるだけ」を「実際にキャストされた」の証拠にせん —— applySupportEffect
     を一時的にカウンタ付きへ差し替え、直接呼び出し回数で確かめる（round-2 R2チェックの
     effDelta モンキーパッチと同じ手口）。後始末は他の合成技と同じ finally で必ず戻す。 */
  const detSupport = await pg.evaluate(() => {
    const f = partyA[0], foe = partyB[0];
    const savedMoves = f.moves, savedCd = f.cd;
    const origApply = applySupportEffect;
    let castCount = 0;
    let result;
    try {
      const supportMove = {
        id: 'det_buff_test', name: '決定論試験バフ', power: 0, cast: 0.3, cooldown: 3.0,
        /* B7のprobeと同じく makeSpec() を使う —— launch()を実際に踏む（scoreMoveだけの
           2a/2b/2c等と違い、determinismTest()はstepBattle経由でAuraFXまで実体化する）けん、
           palette等を欠いた素の {generator:'aura'} だと AuraFX.update が s.palette.length で落ちる。 */
        fx: makeSpec('aura', 918274, '決定論試験バフ', '闇'), type: '闇', tags: [],
        kind: 'support', effect: { stat: 'atk', delta: 20, dur: 10, target: 'self' }
      };
      f.moves = [supportMove];
      f.cd = {};
      applySupportEffect = function (...args) { castCount++; return origApply.apply(this, args); };
      result = determinismTest();
    } finally {
      f.moves = savedMoves;
      f.cd = savedCd;
      applySupportEffect = origApply;
    }
    return { ok: result.ok, at: result.at, castCount };
  });
  ok(detSupport.ok === true,
     '補助技が実際にキャストされる状態で決定論チェックが落ちた（掟1）at=' + detSupport.at);
  ok(detSupport.castCount > 0,
     '補助技が movelist に載っとるだけで一度もキャストされんかった（applySupportEffect 呼び出し0回）: '
     + detSupport.castCount);
  console.log('決定論(補助技実働)  ok=' + detSupport.ok
    + '  applySupportEffect呼び出し回数=' + detSupport.castCount + '（40秒×2ランの合計）');

  /* =========================================================
     Task 2: kind / effect / buffValue / ゲート —— 順位を「直接比較」で証明する
     ========================================================= */

  /* 較正シナリオの共通の後始末（plan-checker round-2 R1 の是正）。
     パルキア(atk92/int88・per非50)/ルギアもどき(def58) が実際の既定やけん、
     「50に戻す」と決め打ちしたら個体を壊したまま持ち越す。必ず save/restore。
     window に生やして、以降の各チェックから使い回す。 */
  await pg.evaluate(() => {
    window.__pin = function (f, foe) {
      const save = {
        fStats: { ...f.stats }, fPer: { ...f.per }, fAT: f.actionTimer,
        foeStats: { ...foe.stats }, foePer: { ...foe.per }, foeAT: foe.actionTimer
      };
      for (const k of ['atk', 'def', 'hp', 'spd', 'eva', 'int']) { f.stats[k] = 50; foe.stats[k] = 50; }
      for (const k of ['aggr', 'caut', 'loyal', 'self']) { f.per[k] = 50; foe.per[k] = 50; }
      /* foeBusy(foe) を foe.charging に触らず真にする —— scoreMove の R('割り込み',26) は
         foe.charging がある時だけ発火し、詠唱が速い側（=攻撃技）だけを常に利するけん、
         charging 経由で foeBusy を作ると比較そのものが汚れる（round-2 R1 の本題）。 */
      foe.actionTimer = 1.0;
      return save;
    };
    window.__unpin = function (f, foe, save) {
      f.stats = save.fStats; f.per = save.fPer; f.actionTimer = save.fAT;
      foe.stats = save.foeStats; foe.per = save.foePer; foe.actionTimer = save.foeAT;
    };
  });

  /* ---- 2a. 好都合／不都合の順位＋較正の数値（round-2 R1 是正込み） ---- */
  const ordering = await pg.evaluate(() => {
    resetBattle(4242);
    const f = enemy, foe = ally;   // f.side!=='ally' やけん TACTIC_BIAS を丸ごと避けられる
    const save = window.__pin(f, foe);
    const savedMoves = f.moves, savedCd = f.cd, savedFoeHp = foe.hp;
    const out = {};
    try {
      out.foeBusyOk = foeBusy(foe) === true;
      out.phaseLeftAtReset = phaseLeft;

      const supportMove = {
        id: 'buff_test', name: '試験バフ', power: 0, cast: 0.4, cooldown: 5.0,
        fx: { generator: 'aura', motions: [] }, type: 'ノーマル', tags: [],
        kind: 'support', effect: { stat: 'atk', delta: 25, dur: 20, target: 'self' }
      };
      f.moves = [supportMove, MOVES.shakunetsu];
      f.cd = {};

      /* 好都合：foe.hp は満タンのまま */
      const favSupport = scoreMove(f, foe, supportMove);
      const favAttack = scoreMove(f, foe, MOVES.shakunetsu);
      out.favSupportTotal = favSupport.total;
      out.favAttackTotal = favAttack.total;
      const term = favSupport.terms.find((t) => t.n === '補助の値打ち');
      out.favSupportValueTerm = term ? term.v : null;

      /* 不都合：とどめが見える体力まで削る */
      foe.hp = 10;
      const unfSupport = scoreMove(f, foe, supportMove);
      const unfAttack = scoreMove(f, foe, MOVES.shakunetsu);
      out.unfSupportTotal = unfSupport.total;
      out.unfAttackTotal = unfAttack.total;
    } finally {
      f.moves = savedMoves; f.cd = savedCd; foe.hp = savedFoeHp;
      window.__unpin(f, foe, save);
    }
    return out;
  });
  ok(ordering.foeBusyOk, 'foeBusy(foe) が actionTimer=1.0 だけで真にならんかった');
  ok(ordering.phaseLeftAtReset === 20, 'resetBattle() 直後の phaseLeft が 20 やない: ' + ordering.phaseLeftAtReset);
  ok(Math.abs(ordering.favAttackTotal - 22.33) < 0.5,
     '較正（攻撃・好都合）が計画の22.33からズレとる: ' + ordering.favAttackTotal);
  ok(Math.abs(ordering.favSupportValueTerm - 37.45) < 0.5,
     '較正（補助の値打ち項）が計画の37.45からズレとる: ' + ordering.favSupportValueTerm);
  ok(Math.abs(ordering.favSupportTotal - 32.87) < 0.5,
     '較正（補助・好都合）が計画の32.87からズレとる: ' + ordering.favSupportTotal);
  ok(ordering.favSupportTotal > ordering.favAttackTotal,
     '好都合な場面で補助技が攻撃技に勝っとらん: 補助=' + ordering.favSupportTotal + ' 攻撃=' + ordering.favAttackTotal);
  ok(ordering.unfAttackTotal > ordering.unfSupportTotal,
     'とどめが見える場面で攻撃技が補助技に勝っとらん（順位が逆転しとらん）: '
     + '攻撃=' + ordering.unfAttackTotal + ' 補助=' + ordering.unfSupportTotal);
  console.log('好都合順位    補助 ' + ordering.favSupportTotal + ' > 攻撃 ' + ordering.favAttackTotal
    + '（補助の値打ち項 ' + ordering.favSupportValueTerm + '）');
  console.log('不都合順位    攻撃 ' + ordering.unfAttackTotal + ' > 補助 ' + ordering.unfSupportTotal);

  /* ---- 2b. 単調性：delta とdur が大きいほど値打ちが上がる ---- */
  const mono = await pg.evaluate(() => {
    resetBattle(4242);
    const f = enemy, foe = ally;
    const save = window.__pin(f, foe);
    try {
      const v1 = buffValue(f, foe, { stat: 'atk', delta: 10, dur: 8, target: 'self' });
      const v2 = buffValue(f, foe, { stat: 'atk', delta: 20, dur: 8, target: 'self' });
      const v3 = buffValue(f, foe, { stat: 'atk', delta: 20, dur: 16, target: 'self' });
      return { v1, v2, v3 };
    } finally {
      window.__unpin(f, foe, save);
    }
  });
  ok(mono.v1 < mono.v2, '単調性が崩れとる（delta 10→20）: ' + mono.v1 + ' → ' + mono.v2);
  ok(mono.v2 < mono.v3, '単調性が崩れとる（dur 8→16）: ' + mono.v2 + ' → ' + mono.v3);
  console.log('単調性        ' + mono.v1 + ' < ' + mono.v2 + ' < ' + mono.v3);

  /* ---- 2c. B3：相手掛けの弱化は自分にとってプラス ---- */
  const b3 = await pg.evaluate(() => {
    resetBattle(4242);
    const f = enemy, foe = ally;
    const save = window.__pin(f, foe);
    try {
      return buffValue(f, foe, { stat: 'atk', delta: -20, dur: 8, target: 'foe' });
    } finally {
      window.__unpin(f, foe, save);
    }
  });
  ok(b3 > 0, 'B3：相手への弱化がマイナス点になっとる（符号が逆）: ' + b3);
  console.log('B3符号        相手弱化 atk-20 → ' + b3 + '（プラスが正しい）');

  /* ---- 2d. round-2 R2：statOf の天井を勘定に入れとるか（実際の既定ロスターで） ----
     パルキア(atk92)基準。effDelta を一時的に恒等関数へ差し替えて「天井を見んかった場合」を
     同じ式で測り、実装の clamped 値と比べる —— 較正の手計算をそのまま数値で貼るより、
     天井そのものが効いとることを直接証明できる。 */
  const r2 = await pg.evaluate(() => {
    resetBattle(4242);
    const effect = { stat: 'atk', delta: 25, dur: 20, target: 'self' };
    const clamped = buffValue(ally, enemy, effect);
    const origEffDelta = effDelta;
    let unclamped;
    try {
      effDelta = (base, delta) => delta;   // クランプ無しの比較対象
      unclamped = buffValue(ally, enemy, effect);
    } finally {
      effDelta = origEffDelta;
    }
    return { clamped, unclamped, allyAtk: ally.stats.atk, effDeltaRestored: effDelta(92, 25) === 8 };
  });
  ok(r2.allyAtk === 92, 'R2：既定ロスターのパルキアの atk が92やない: ' + r2.allyAtk);
  ok(r2.effDeltaRestored, 'R2：effDelta の後始末が効いとらん（モンキーパッチが残った）');
  ok(r2.clamped < r2.unclamped * 0.5,
     'R2：天井クランプが効いとらん（clamped=' + r2.clamped + ' unclamped=' + r2.unclamped + '）');
  ok(Math.abs(r2.clamped / r2.unclamped - 8 / 25) < 0.01,
     'R2：クランプ後/クランプ前の比が想定（statOfの実効+8 / 名目+25 = 0.32）からズレとる: '
     + (r2.clamped / r2.unclamped).toFixed(4));
  ok(r2.clamped > 5 && r2.clamped < 25,
     'R2：天井クランプ後の値打ちが想定範囲外（≈13点のはず）: ' + r2.clamped);
  ok(r2.unclamped > 30 && r2.unclamped < 55,
     'R2：天井を見んかった場合の値打ちが想定範囲外（≈41点のはず、AIログが嘘をつく側）: ' + r2.unclamped);
  console.log('R2天井        clamped=' + r2.clamped.toFixed(2) + ' unclamped=' + r2.unclamped.toFixed(2)
    + '（比 ' + (r2.clamped / r2.unclamped).toFixed(3) + '）');

  /* ---- 2e. round-2 R3：休憩に食われる時間を割り引くか ----
     phaseLeft=3 のときの dur:20 は、通常時（phaseLeft=20）の dur:3 と同じ値打ちになるはず
     （usable=Math.min(dur,phaseLeft) が両方とも3に丸まるけん）。 */
  const r3 = await pg.evaluate(() => {
    resetBattle(4242);
    const f = enemy, foe = ally;
    const save = window.__pin(f, foe);
    try {
      const savedPhaseLeft = phaseLeft;
      let withDiscount;
      try {
        phaseLeft = 3;
        withDiscount = buffValue(f, foe, { stat: 'atk', delta: 25, dur: 20, target: 'self' });
      } finally {
        phaseLeft = savedPhaseLeft;
      }
      const equivalent = buffValue(f, foe, { stat: 'atk', delta: 25, dur: 3, target: 'self' });
      const undiscounted = buffValue(f, foe, { stat: 'atk', delta: 25, dur: 20, target: 'self' });
      return { withDiscount, equivalent, undiscounted, restoredPhaseLeft: phaseLeft };
    } finally {
      window.__unpin(f, foe, save);
    }
  });
  ok(r3.restoredPhaseLeft === 20, 'R3：phaseLeft の後始末が効いとらん: ' + r3.restoredPhaseLeft);
  ok(Math.abs(r3.withDiscount - r3.equivalent) < 1e-6,
     'R3：phaseLeft=3 の dur:20 が、通常時の dur:3 と一致せん（休憩の割引が効いとらん）: '
     + r3.withDiscount + ' vs ' + r3.equivalent);
  ok(r3.withDiscount < r3.undiscounted,
     'R3：休憩直前に撃った値打ちが、通常時より低くなっとらん: ' + r3.withDiscount + ' vs ' + r3.undiscounted);
  console.log('R3休憩割引    phaseLeft=3時のdur20=' + r3.withDiscount.toFixed(2)
    + ' = 通常時のdur3=' + r3.equivalent.toFixed(2) + '（通常時のdur20=' + r3.undiscounted.toFixed(2) + '）');

  /* ---- 2f. B7：aura/kind無し技が launch() 経由で実際に foe.hp を減らすか ----
     damageOf() だけを見る空検査（第1回の穴）を避け、startAttack→launch の
     経路をそのまま踏ませて hp を確認する。回避は本物の確率つき挙動やけん、
     何本か種を試す（determinismTest の 90210 のように、既知の種を1個に決め打ちしない）。 */
  const b7 = await pg.evaluate((seedList) => {
    const f = partyA[0], foe = partyB[0];
    const savedMoves = f.moves, savedCd = f.cd;
    const attempts = [];
    let winner = null;
    let isSupport = null;
    try {
      const probe = {
        id: 'probe', name: '試験', power: 20, cast: 0.1, cooldown: 5,
        fx: makeSpec('aura', 918273, '試験', '闇'), type: '闇', tags: []
        /* tags:[] は本題やない後始末 —— 300フレーム回す間に cooldown が明けると
           stepFighter の自然なAIループが pickMove→scoreMove(probe) を呼び直すけん、
           TACTIC_BIAS 等の m.tags.includes(...) が undefined で落ちる（実際に踏んだ）。 */
      };
      isSupport = isSupportMove(probe);
      for (const seed of seedList) {
        resetBattle(seed);
        f.moves = [probe]; f.cd = {};
        const maxHp = foe.maxHP;
        startAttack(f, foe, probe);
        for (let i = 0; i < 300; i++) { stepBattle(1 / 60); f.update(1 / 60); foe.update(1 / 60); }
        const damaged = foe.hp < maxHp;
        attempts.push({ seed, hpAfter: +foe.hp.toFixed(2), maxHp, damaged });
        if (damaged) { winner = seed; break; }
      }
    } finally {
      f.moves = savedMoves; f.cd = savedCd;
      resetBattle(4242);
    }
    return { isSupport, attempts, winner };
  }, [90210, 4242, 13579, 24680, 11111]);
  ok(b7.isSupport === false, 'B7：kind無しの aura 技が isSupportMove()===true になっとる（後方互換が壊れとる）');
  ok(b7.winner !== null,
     'B7：どの種でも kind無し(aura) 技が foe.hp を減らさんかった（launch経由でapplyHitに届いとらん）: '
     + JSON.stringify(b7.attempts));
  console.log('B7 SC1        isSupportMove=' + b7.isSupport + '  種' + b7.winner + 'で着弾を確認  '
    + JSON.stringify(b7.attempts));

  /* =========================================================
     Task 3: def/eva/spd の検証カバレッジ、no-stack の証明、hp/int拒否
     新しい本番コードは無い（Task 2 の rawFlow/offenseFlow/evaFlow/buffValue が
     ディスパッチ表で4stat全部を既に汎用対応しとる）。ここは検証カバレッジと、
     Task 2 が意図的に後回しにした2点（spdの「次の技から」注記の確認）だけ。
     ========================================================= */

  /* ---- 3a. def/eva/spd も atk と同じ物差しで正の有限値を返すか ---- */
  const statCoverage = await pg.evaluate(() => {
    resetBattle(4242);
    const f = enemy, foe = ally;
    const save = window.__pin(f, foe);
    try {
      return {
        def: buffValue(f, foe, { stat: 'def', delta: 15, dur: 8, target: 'self' }),
        eva: buffValue(f, foe, { stat: 'eva', delta: 15, dur: 8, target: 'self' }),
        spd: buffValue(f, foe, { stat: 'spd', delta: 15, dur: 8, target: 'self' })
      };
    } finally {
      window.__unpin(f, foe, save);
    }
  });
  for (const stat of ['def', 'eva', 'spd']) {
    const v = statCoverage[stat];
    ok(Number.isFinite(v), stat + ' の buffValue が有限やない: ' + v);
    ok(v > 0, stat + ' の buffValue が正やない（自分掛けの強化なのにマイナス）: ' + v);
  }
  console.log('stat網羅      def=' + statCoverage.def.toFixed(2) + ' eva=' + statCoverage.eva.toFixed(2)
    + ' spd=' + statCoverage.spd.toFixed(2));

  /* ---- 3b. no-stack：先着のdeltaが残り、untilは長い方だけが勝つ（縮まん） ----
     B4 の1規則（Task 2の applySupportEffect と文言をそろえとる）を、
     「短い掛け直し→据え置き」「長い掛け直し→伸びる」の両方向で確かめる。 */
  const noStack = await pg.evaluate(() => {
    resetBattle(4242);
    const f = enemy, foe = ally;
    const mk = (delta, dur) => ({
      id: 'buff_' + delta + '_' + dur, name: '試験', power: 0, cast: 0.1, cooldown: 1,
      fx: { generator: 'aura', motions: [] }, type: 'ノーマル', tags: [], kind: 'support',
      effect: { stat: 'atk', delta, dur, target: 'self' }
    });
    applySupportEffect(f, foe, mk(10, 5));
    const step1 = { delta: f.buffs.atk.delta, until: f.buffs.atk.until };
    applySupportEffect(f, foe, mk(20, 2));    // 短い掛け直し → until は据え置き
    const step2 = { delta: f.buffs.atk.delta, until: f.buffs.atk.until };
    applySupportEffect(f, foe, mk(30, 10));   // 長い掛け直し → until は伸びる
    const step3 = { delta: f.buffs.atk.delta, until: f.buffs.atk.until };
    return { step1, step2, step3 };
  });
  ok(noStack.step1.delta === 10 && noStack.step1.until === 5,
     'no-stack：初回掛けの結果がおかしい: ' + JSON.stringify(noStack.step1));
  ok(noStack.step2.delta === 10,
     'no-stack：短い掛け直しで delta が変わっとる（先着維持のはず）: ' + noStack.step2.delta);
  ok(noStack.step2.until === 5,
     'no-stack：短い掛け直しで until が縮んどる（据え置きのはず）: ' + noStack.step2.until);
  ok(noStack.step3.delta === 10,
     'no-stack：長い掛け直しで delta が変わっとる（先着維持のはず）: ' + noStack.step3.delta);
  ok(noStack.step3.until === 10,
     'no-stack：長い掛け直しで until が伸びとらん: ' + noStack.step3.until);
  console.log('no-stack      delta=' + noStack.step1.delta + '（据え置き） until '
    + noStack.step1.until + ' → ' + noStack.step2.until + '(据置) → ' + noStack.step3.until + '(伸長)');

  /* ---- 3c. hp/int/未知statは真のno-op（既定へ読み替えず、何も起きん） ---- */
  const rejected = await pg.evaluate(() => {
    resetBattle(4242);
    const f = enemy, foe = ally;
    const mk = (stat) => ({
      id: 'buff_' + stat, name: '試験', power: 0, cast: 0.1, cooldown: 1,
      fx: { generator: 'aura', motions: [] }, type: 'ノーマル', tags: [], kind: 'support',
      effect: { stat, delta: 15, dur: 8, target: 'self' }
    });
    const before = JSON.stringify(f.buffs);
    applySupportEffect(f, foe, mk('hp'));
    const afterHp = JSON.stringify(f.buffs);
    applySupportEffect(f, foe, mk('int'));
    const afterInt = JSON.stringify(f.buffs);
    applySupportEffect(f, foe, mk('foo'));
    const afterBogus = JSON.stringify(f.buffs);
    return { before, afterHp, afterInt, afterBogus };
  });
  ok(rejected.before === rejected.afterHp, 'hp効果がno-opやない: f.buffs が変化しとる: ' + rejected.afterHp);
  ok(rejected.before === rejected.afterInt, 'int効果がno-opやない: f.buffs が変化しとる: ' + rejected.afterInt);
  ok(rejected.before === rejected.afterBogus, '未知statがno-opやない: f.buffs が変化しとる: ' + rejected.afterBogus);
  console.log('hp/int拒否    3種とも f.buffs 不変（' + rejected.before + '）');

  /* ---- 3d. resetBattle() は4stat分すべてクリアするか（atkだけやない） ---- */
  const clearAll = await pg.evaluate(() => {
    resetBattle(4242);
    const f = enemy, foe = ally;
    for (const stat of ['atk', 'def', 'eva', 'spd']) {
      applySupportEffect(f, foe, {
        id: 'buff_' + stat, name: '試験', power: 0, cast: 0.1, cooldown: 1,
        fx: { generator: 'aura', motions: [] }, type: 'ノーマル', tags: [], kind: 'support',
        effect: { stat, delta: 10, dur: 8, target: 'self' }
      });
    }
    const hasAllFour = ['atk', 'def', 'eva', 'spd'].every((s) => !!f.buffs[s]);
    const beforeReset = Object.keys(f.buffs).length;
    resetBattle(4242);
    const afterReset = Object.keys(f.buffs).length;
    return { hasAllFour, beforeReset, afterReset };
  });
  ok(clearAll.hasAllFour, 'resetBattle前提の下ごしらえが崩れとる（4stat分のバフが立っとらん）: ' + clearAll.beforeReset);
  ok(clearAll.afterReset === 0,
     'resetBattle() が f.buffs を全stat分クリアしとらん（atkだけ残っとる等）: 残り' + clearAll.afterReset + '件');
  console.log('resetBattleクリア  4stat分バフ後 ' + clearAll.beforeReset + '件 → resetBattle後 ' + clearAll.afterReset + '件');

  /* ---- 3e. spd効果のAILogに「次の技から」の注記があるか（Task 2で実装済み、ここは確認だけ） ---- */
  const spdNote = await pg.evaluate(() => {
    resetBattle(4242);
    const f = enemy, foe = ally;
    applySupportEffect(f, foe, {
      id: 'buff_spd_note', name: '試験', power: 0, cast: 0.1, cooldown: 1,
      fx: { generator: 'aura', motions: [] }, type: 'ノーマル', tags: [], kind: 'support',
      effect: { stat: 'spd', delta: 10, dur: 8, target: 'self' }
    });
    const entry = AILog.entries[AILog.entries.length - 1];
    return { text: entry && entry.text };
  });
  ok(spdNote.text && spdNote.text.includes('次の技から'),
     'spd効果のAILogに「次の技から」の注記が無い: ' + JSON.stringify(spdNote.text));
  console.log('spd注記       ' + spdNote.text);

  /* =========================================================
     03-01/02: 棚の補助技を拾い、実走行で発動を数える。
     03-03: ここで初めて発動回数を根拠にした ok(...) を足す（B2の是正どおり、
     合否を持つのはこの段だけ。03-01/03-02のブロックには回数ベースのassertは無い）。

     拾う本数・名前は決め打ちせん（>=5で見る。将来6本目が増えても無改修で追随する）。 */
  const library = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'moves', 'library.json'), 'utf8'));
  const supportRecords = Object.values(library).filter((rec) => rec.battle && rec.battle.kind === 'support');

  /* ---- 段1「棚の補助技(構造)」 ----
     本数は >= 5 で見る（MOVE-01。===5にせん —— にーくらが6本目を足した日に赤くならんため）。
     技名で決め打ちせん。「補助技やない技が kind を持っとらんこと」のような否定の全走査は書かん。 */
  ok(supportRecords.length >= 5,
     '棚の kind:\'support\' レコードが5件未満（MOVE-01）: ' + supportRecords.length
     + '件（今ある技名: ' + supportRecords.map((r) => r.name).join('、') + '）');
  const SUPPORT_STATS_SET = new Set(['atk', 'def', 'eva', 'spd']);
  const GENERIC_GENERATORS = new Set(['projectile', 'beam', 'slash', 'lightning', 'aura', 'shatter']);
  console.log('\n段1「棚の補助技(構造)」  ' + supportRecords.length + '件: '
    + supportRecords.map((r) => r.name).join('、'));
  for (const rec of supportRecords) {
    const label = rec.name;
    const e = rec.battle.effect;
    ok(e && SUPPORT_STATS_SET.has(e.stat),
       label + '：effect.stat が atk/def/eva/spd のどれでもない: ' + (e && e.stat));
    ok(e && (e.target === 'self' || e.target === 'foe'),
       label + '：effect.target が self/foe のどちらでもない: ' + (e && e.target));
    ok(e && e.delta >= -25 && e.delta <= 25,
       label + '：effect.delta が applySupportEffect の再クランプ範囲(-25〜25)の外: ' + (e && e.delta));
    ok(e && e.dur >= 3 && e.dur <= 20,
       label + '：effect.dur が applySupportEffect の再クランプ範囲(3〜20)の外: ' + (e && e.dur));
    ok(rec.battle.power === 0, label + '：battle.power が 0やない（期待ダメージの嘘の点になる）: ' + rec.battle.power);
    const nominal = e ? Math.abs(e.delta) * e.dur : 0;
    ok(nominal >= 270, label + '：|effect.delta|×effect.dur が270未満（名目値・MOVE-02の線）: ' + nominal);
    ok(rec.fx && !GENERIC_GENERATORS.has(rec.fx.generator),
       label + '：fx.generatorが汎用6種のまま（掟3。専用generatorを使うこと）: ' + (rec.fx && rec.fx.generator));
    console.log('  ' + label + '  stat=' + (e && e.stat) + ' target=' + (e && e.target)
      + ' delta=' + (e && e.delta) + ' dur=' + (e && e.dur) + ' |delta|×dur=' + nominal
      + ' power=' + rec.battle.power + ' generator=' + (rec.fx && rec.fx.generator));
  }

  /* ---- MOVE-01：網羅assert（件数だけやのうて、stat/targetの集合を見る） ----
     件数は上のok()で>=5を見た。ここは「4stat全部揃うか」「self/foe両方あるか」。
     失敗メッセージには「今ある集合」を出す（何が足りんかが1行で分かるように）。 */
  const REQUIRED_STATS = ['atk', 'def', 'eva', 'spd'];
  const observedStats = new Set(supportRecords.map((r) => r.battle.effect && r.battle.effect.stat));
  const missingStats = REQUIRED_STATS.filter((s) => !observedStats.has(s));
  ok(missingStats.length === 0,
     'MOVE-01：effect.stat が atk/def/eva/spd の4つを網羅しとらん。今ある集合={'
     + [...observedStats].sort().join(',') + '} 足りんのは={' + missingStats.join(',') + '}');

  const REQUIRED_TARGETS = ['self', 'foe'];
  const observedTargets = new Set(supportRecords.map((r) => r.battle.effect && r.battle.effect.target));
  const missingTargets = REQUIRED_TARGETS.filter((t) => !observedTargets.has(t));
  ok(missingTargets.length === 0,
     'MOVE-01：effect.target が self/foe の両方を網羅しとらん。今ある集合={'
     + [...observedTargets].sort().join(',') + '} 足りんのは={' + missingTargets.join(',') + '}');

  console.log('MOVE-01網羅   件数=' + supportRecords.length + '（>=5必要）  stat集合={'
    + [...observedStats].sort().join(',') + '}  target集合={' + [...observedTargets].sort().join(',') + '}');

  /* 棚の入れ子形（battle:{...}）を、実行時の平らなオブジェクトへ詰め替える
     （02.1で確認済みの設計・03-01-PLAN.md <context>）。tagsは必ず配列（02.1-01 Deviation 2と同じ罠）。 */
  const flatSupportMoves = supportRecords.map((rec) => ({
    id: rec.fx.id,
    name: rec.name,
    type: rec.battle.type,
    power: rec.battle.power,
    cast: rec.battle.cast,
    cooldown: rec.battle.cooldown,
    range: rec.battle.range,
    tags: Array.isArray(rec.battle.tags) ? rec.battle.tags : [],
    kind: rec.battle.kind,
    effect: rec.battle.effect,
    fx: rec.fx,
  }));

  /* ---- 段2「補助の値打ち(較正実測表)」 ----
     window.__pin(f,foe) の較正シナリオ（f=enemy・foe=ally・両者stats/per全50・
     foe.actionTimer=1.0）で、拾った補助技それぞれについて buffValue と scoreMove().total を
     直に呼んで測り、参照の scoreMove(f,foe,shakunetsu).total と並べて表に出す。
     assertは「実際に落ちうる」4つだけ（scoreHold比較は03-PLAN-CHECK.md W2で外した空振り）。
     f.moves には測る補助技と shakunetsu を載せる —— refAtkMove が物差しを f.moves から
     選ぶけん、載せんと refAtkMove が null になって値打ちが 0 になる。 */
  const calibration = await pg.evaluate(({ moves }) => {
    resetBattle(4242);
    const f = enemy, foe = ally;
    const save = window.__pin(f, foe);
    const savedMoves = f.moves, savedCd = f.cd;
    const rows = [];
    let refTotal = null;
    try {
      for (const m of moves) {
        f.moves = [m, MOVES.shakunetsu];
        f.cd = {};
        const bv = buffValue(f, foe, m.effect);
        const scored = scoreMove(f, foe, m);
        const refScored = scoreMove(f, foe, MOVES.shakunetsu);
        refTotal = refScored.total;

        const buffTerm = scored.terms.find((t) => t.n === '補助の値打ち');
        const dmgTerm = scored.terms.find((t) => t.n === '期待ダメージ');

        /* 3. 向きが偶然やない：targetだけ裏返した版で測って負になること */
        const flippedEffect = Object.assign({}, m.effect, { target: m.effect.target === 'foe' ? 'self' : 'foe' });
        const bvFlipped = buffValue(f, foe, flippedEffect);

        /* 4. 較正シナリオが天井の外にある：effDeltaを一時的に恒等関数へ差し替えて
           同じbuffValueを測る（R2チェックと同じモンキーパッチの手口）。finallyで必ず戻す。 */
        const origEffDelta = effDelta;
        let bvIdentity;
        try {
          effDelta = (base, delta) => delta;
          bvIdentity = buffValue(f, foe, m.effect);
        } finally {
          effDelta = origEffDelta;
        }

        rows.push({
          id: m.id, name: m.name, stat: m.effect.stat, delta: m.effect.delta, dur: m.effect.dur,
          buffValue: bv, total: scored.total,
          hasBuffTerm: !!buffTerm, hasDmgTerm: !!dmgTerm,
          bvFlipped, bvIdentity, effDeltaRestored: effDelta(92, 25) === 8,
        });
      }
    } finally {
      f.moves = savedMoves; f.cd = savedCd;
      window.__unpin(f, foe, save);
      resetBattle(4242);
    }
    return { rows, refTotal };
  }, { moves: flatSupportMoves });

  console.log('\n段2「補助の値打ち(較正実測表)」  参照(灼熱弾) scoreMove().total = ' + calibration.refTotal.toFixed(2));
  console.log('技名'.padEnd(12) + 'stat'.padEnd(6) + 'delta'.padEnd(7) + 'dur'.padEnd(6)
    + 'delta×dur'.padEnd(11) + '補助の値打ち'.padEnd(14) + '総合点'.padEnd(10) + '対灼熱弾の差');
  for (const r of calibration.rows) {
    const nominal = Math.abs(r.delta) * r.dur;
    const diff = r.total - calibration.refTotal;
    console.log(
      r.name.padEnd(12) + r.stat.padEnd(6) + String(r.delta).padEnd(7) + String(r.dur).padEnd(6)
      + String(nominal).padEnd(11) + r.buffValue.toFixed(2).padEnd(14) + r.total.toFixed(2).padEnd(10)
      + (diff >= 0 ? '+' : '') + diff.toFixed(2)
    );
    ok(r.buffValue > 0, r.name + '：buffValue(f,foe,effect) が正やない（符号）: ' + r.buffValue);
    ok(r.hasBuffTerm, r.name + '：scoreMove().terms に「補助の値打ち」項が出とらん');
    ok(!r.hasDmgTerm, r.name + '：scoreMove().terms に「期待ダメージ」項が出とる（power=0にし忘れとらんか）');
    ok(r.bvFlipped < 0, r.name + '：target反転版のbuffValueが負やない（向きが偶然やないことを確かめられん）: ' + r.bvFlipped);
    ok(Math.abs(r.bvIdentity - r.buffValue) < 1e-9,
       r.name + '：effDeltaを恒等関数へ差し替えたらbuffValueが変わった（較正シナリオが天井の外にない）: '
       + r.bvIdentity + ' vs ' + r.buffValue);
    ok(r.effDeltaRestored, r.name + '：effDelta の後始末が効いとらん（モンキーパッチが残った）');
  }
  console.log('（「灼熱弾に総合点で勝つこと」はassertせん —— spd/eva/defはatkの6〜7割しか換算率が無く（02.1-PLAN-CHECK.md:76-84）、'
    + '勝ち負けをassertするとにーくらが決めたspd/eva/defの技が数字を上限まで膨らませんと緑にならん。'
    + 'AIが実際に撃つかはPlan 03の実走行ゲートで測る（softmaxはint50でT=18.2と熱い）。）');

  /* ---- 段3「実効と名目の食い違い」 ----
     ページの素のロスターのまま（__pinせん・resetBattle(4242)直後）、拾った補助技それぞれの
     effDelta(statOf(対象,stat), effect.delta) を測り、名目 effect.delta と並べてログに出す。
     assertはせん、記録だけ —— 「名目で線を引いた」ことが誰にでも見えるようにする、というのが
     この段の唯一の役目（パルキア atk92 に atk+22 を掛けたときの実効が +8 と出るのが正常）。 */
  const nominalVsEffective = await pg.evaluate(({ moves }) => {
    resetBattle(4242);
    const caster = partyA[0], foe = partyB[0];
    const rows = moves.map((m) => {
      const target = m.effect.target === 'foe' ? foe : caster;
      const baseStat = statOf(target, m.effect.stat);
      const eff = effDelta(baseStat, m.effect.delta);
      return {
        name: m.name, targetName: target.name, stat: m.effect.stat, targetStat: baseStat,
        nominal: m.effect.delta, effective: eff,
      };
    });
    resetBattle(4242);
    return rows;
  }, { moves: flatSupportMoves });

  console.log('\n段3「実効と名目の食い違い」  （assertなし・記録のみ）');
  console.log('技名'.padEnd(12) + '対象個体'.padEnd(18) + '名目delta'.padEnd(12) + '実効delta');
  for (const r of nominalVsEffective) {
    console.log(r.name.padEnd(12) + (r.targetName + '(素の' + r.stat + '=' + r.targetStat + ')').padEnd(18)
      + String(r.nominal).padEnd(12) + String(r.effective));
  }

  /* 実走行本体。1回の呼び出しで1通り分（pinnedかどうか・seed）を回す。
     f=partyA[0]、foe=partyB[0]（03-01-PLAN.md Task 1の指定どおり）。
     毎ステップ両者のhpをmaxHPへ戻す —— 戦闘不能で交代が挟まると測っとる個体が
     入れ替わって数が嘘になる（書き換え自体は決定的やけん決定論は壊れん）。 */
  const runActivation = async (seed, pinned) => pg.evaluate(({ moves, seed, pinned }) => {
    const f = partyA[0], foe = partyB[0];
    const savedMoves = f.moves, savedCd = f.cd;
    const origApply = applySupportEffect;
    const counts = {};
    for (const m of moves) counts[m.id] = 0;
    let ryuunomaiWiringOk = true;   // 真空で真。撃たれたときだけ判定を持つ（配線の正しさ、回数と無関係）
    let pinSave = null;
    try {
      resetBattle(seed);
      if (pinned) pinSave = window.__pin(f, foe);
      for (const m of moves) MOVES[m.id] = m;
      f.moves = moves.map((m) => MOVES[m.id]).concat([MOVES.shakunetsu]);
      f.cd = {};
      applySupportEffect = function (caster, targetFoe, mv) {
        const r = origApply.apply(this, arguments);
        if (Object.prototype.hasOwnProperty.call(counts, mv.id)) counts[mv.id]++;
        if (mv.id === 'ryuunomai') {
          if (!(caster.buffs && caster.buffs.atk)) ryuunomaiWiringOk = false;
        }
        return r;
      };
      for (let i = 0; i < 60 * 90; i++) {
        stepBattle(1 / 60); ally.update(1 / 60); enemy.update(1 / 60);
        ally.hp = ally.maxHP; enemy.hp = enemy.maxHP;
      }
    } finally {
      f.moves = savedMoves; f.cd = savedCd; applySupportEffect = origApply;
      for (const m of moves) delete MOVES[m.id];
      if (pinned && pinSave) window.__unpin(f, foe, pinSave);
      resetBattle(4242);
    }
    return { counts, ryuunomaiWiringOk };
  }, { moves: flatSupportMoves, seed, pinned });

  const runCal31337 = await runActivation(31337, true);
  const runCal90210 = await runActivation(90210, true);
  const runDefault = await runActivation(4242, false);

  const wiringOk = runCal31337.ryuunomaiWiringOk && runCal90210.ryuunomaiWiringOk && runDefault.ryuunomaiWiringOk;
  ok(wiringOk, 'りゅうのまいが撃たれたのに f.buffs.atk が立っとらんかった（配線の正しさ。回数と無関係に落ちる）');

  /* ---- 段4「実走行(5本とも発動)」 ----
     ここで初めて発動回数を根拠にしたok(...)を足す（03-03-PLAN.md Task 1。
     このフェーズで発動回数の合否を持つんはこの段だけ）。
     assert：拾った補助技すべてが、較正(全50)の2シード(31337/90210)の
     少なくとも片方で発動回数1以上（MOVE-03）。3列目（既定ロスター）は記録のみ・合否に使わん。
     落ちたときのメッセージには、技名／2シードぶんの回数／その技の補助の値打ちと総合点／
     参照(灼熱弾)との差を全部入れる（段2のcalibration.rowsから引く）。 */
  console.log('\n段4「実走行(5本とも発動)」  MOVE-03：較正2シード(31337/90210)の少なくとも片方で発動回数1以上');
  console.log('技名'.padEnd(12) + '較正seed31337'.padEnd(16) + '較正seed90210'.padEnd(16) + '既定ロスター');
  for (const m of flatSupportMoves) {
    const c1 = runCal31337.counts[m.id];
    const c2 = runCal90210.counts[m.id];
    const c3 = runDefault.counts[m.id];
    console.log(m.name.padEnd(12) + String(c1).padEnd(16) + String(c2).padEnd(16) + String(c3));

    const calRow = calibration.rows.find((r) => r.id === m.id);
    const diff = calRow ? (calRow.total - calibration.refTotal) : null;
    ok(c1 >= 1 || c2 >= 1,
       m.name + '：較正2シード(31337/90210)のどちらでも発動回数が0（MOVE-03）。'
       + '段2の上限(dur→20 / |delta|→25)まで上げてもなお2本とも0なら降り口——'
       + '実装を止めて にーくら へ報告する（数字を膨らませ続けて撃たせん）: '
       + 'seed31337=' + c1 + ' seed90210=' + c2
       + '　補助の値打ち=' + (calRow ? calRow.buffValue.toFixed(2) : 'N/A')
       + '　総合点=' + (calRow ? calRow.total.toFixed(2) : 'N/A')
       + '　対灼熱弾(' + calibration.refTotal.toFixed(2) + ')の差='
       + (diff !== null ? (diff >= 0 ? '+' : '') + diff.toFixed(2) : 'N/A'));
  }
  console.log('（既定ロスター列は記録のみ・合否に使わん。wiringOk=' + wiringOk + '）');

  /* ---- うずしお：「次の技から」に合わせた検査（03-01 Task 2） ----
     f.cd[m.id]=m.cooldown*f.cdScale（src/battle.tpl.html:1768）は撃った瞬間に確定するけん、
     今走っとる相手の反動は縮まらん。「撃った瞬間に相手のactionTimer/cdが縮む」を
     assertしたら必ず落ちる。代わりに確かめるんは次の2つ:
     (a) applySupportEffect のあと foe.buffs.spd が立っとる（delta負・untilが未来）
     (b) その状態で statOf(foe,'spd') が素の値より小さい
     —— つまり「次に撃つときのcdScaleが重うなる」ことをステータス側で示す。 */
  const uzushioFlat = flatSupportMoves.find((m) => m.id === 'uzushio');
  if (uzushioFlat) {
    const uzushioCheck = await pg.evaluate((mv) => {
      resetBattle(4242);
      const f = enemy, foe = ally;
      const beforeSpd = statOf(foe, 'spd');
      applySupportEffect(f, foe, mv);
      const buff = foe.buffs.spd;
      const afterSpd = statOf(foe, 'spd');
      const untilFuture = !!buff && battleTime < buff.until;
      resetBattle(4242);
      return {
        buffPresent: !!buff,
        delta: buff ? buff.delta : null,
        untilFuture,
        beforeSpd, afterSpd,
      };
    }, uzushioFlat);
    ok(uzushioCheck.buffPresent, 'うずしお：applySupportEffect後、foe.buffs.spd が立っとらん');
    ok(uzushioCheck.delta < 0, 'うずしお：foe.buffs.spd.delta が負やない: ' + uzushioCheck.delta);
    ok(uzushioCheck.untilFuture, 'うずしお：foe.buffs.spd.until が未来やない（撃った瞬間に切れとる）');
    ok(uzushioCheck.afterSpd < uzushioCheck.beforeSpd,
       'うずしお：statOf(foe,\'spd\') が素の値より小さくなっとらん: before='
       + uzushioCheck.beforeSpd + ' after=' + uzushioCheck.afterSpd);
    console.log('うずしお(次の技から)  素のspd=' + uzushioCheck.beforeSpd
      + ' → buffs.spd適用後のstatOf=' + uzushioCheck.afterSpd
      + '（delta=' + uzushioCheck.delta + '、次に撃つときのcdScaleが重うなる）');
  }

  /* ---- 段5「値段」（03-03-PLAN.md Task 2。MOVE-05）----
     src/cost.js の supportPart(ids) が effect から等価威力を出すようになったことを、
     拾った補助技それぞれについて実測する。
     assert：棚から拾った補助技それぞれで costOf({stats:全50, moves:[id]}).mv が0より大きい
     （N5の申し送り＝補助技が実質タダで通っとった穴が塞がったことの本体）。
     加えて、その技を1本持つ個体のコストが、技を持たん同じ個体のコストより高いことも見る。
     攻撃技（shakunetsu）だけの個体のコストが前後で変わっとらんことは
     node tools/verify_cost.js が基準値と突き合わせて見る——ここでは二重に書かん。 */
  const pricing = await pg.evaluate(({ moves }) => {
    const stats = { atk: 50, def: 50, hp: 50, spd: 50, eva: 50, int: 50 };
    const baseline = costOf({ stats, moves: [] });
    const rows = [];
    try {
      for (const m of moves) {
        MOVES[m.id] = m;
        const withMove = costOf({ stats, moves: [m.id] });
        rows.push({
          id: m.id, name: m.name, stat: m.effect.stat, delta: m.effect.delta, dur: m.effect.dur,
          mv: withMove.mv, cost: withMove.cost, baselineCost: baseline.cost,
        });
      }
    } finally {
      for (const m of moves) delete MOVES[m.id];
    }
    return { baseline, rows };
  }, { moves: flatSupportMoves });

  console.log('\n段5「値段」  MOVE-05：補助技もCostCalculatorを通って値段が付く（技を持たん基準コスト='
    + pricing.baseline.cost + '）');
  console.log('技名'.padEnd(12) + 'stat'.padEnd(6) + 'delta×dur'.padEnd(11)
    + '等価威力(mv)'.padEnd(14) + 'コスト'.padEnd(8) + '基準コストとの差');
  for (const r of pricing.rows) {
    const nominal = Math.abs(r.delta) * r.dur;
    console.log(
      r.name.padEnd(12) + r.stat.padEnd(6) + String(nominal).padEnd(11)
      + r.mv.toFixed(2).padEnd(14) + String(r.cost).padEnd(8)
      + '+' + (r.cost - r.baselineCost)
    );
    ok(r.mv > 0, r.name + '：costOf().mv が0より大きくない（MOVE-05。補助技がタダで通っとる）: ' + r.mv);
    ok(r.cost > r.baselineCost,
       r.name + '：この技を1本持つ個体のコストが、持たん同じ個体（' + r.baselineCost
       + '）より高くない: ' + r.cost);
  }
  console.log('（攻撃技だけの個体のコストが前後で1も動いとらんことは node tools/verify_cost.js が別途見る）');

  /* ---- 段6「能力変化の見せ方」（BUFFVIS）----
     にーくら「能力値が上がる際、エフェクトがあった方がわかりやすくない？」（2026-08-22）
     粒＝色がstat・向きが上下、告知＝掛かった瞬間、札＝効いとる間ずっと。

     ⚠ #cv やのうて fieldCv を読む。drawField() が描くんは裏のキャンバスで、
        #cv へは loop() が後から合成する（verify_bar.js:38 が踏んだ失敗をなぞらん）。
     ⚠ 座標は決め打ちせず f.L から取る。置き場所を動かしても検証が追従する。
     ⚠ 背景や個体の絵にも赤い画素はあり得るけん、**バフ無しの絵を基準に取って差分で数える**。
        絶対値で数えたら「もともと在った赤」を数えて嘘が出る。 */
  const buffVis = await pg.evaluate(() => {
    /* 枠は粒の範囲（±0.38w）ぴったり。札は +0.40w から出しとるけん枠外——
       広く取ると札の文字を粒として数えて、重心が札の位置に釘付けになる（実際にやった）。 */
    const rect = (f) => {
      const w = f.L.size, h = f.L.size;
      return { x: Math.max(0, Math.round(f.L.cx - w*0.38)),
               y: Math.max(0, Math.round(f.L.platY + 10 - h*1.35)),
               w: Math.round(w*0.76), h: Math.round(h*1.45) };
    };
    const grab = (f) => {
      const r = rect(f);
      return { r, d: Array.from(fieldCv.getContext('2d').getImageData(r.x,r.y,r.w,r.h).data) };
    };
    /* **差分で測る。** 粒は加算合成（lighter）で背景へ足すけん、出来上がりの画素値は
       背景の色に左右される。「R>150 かつ G<115」みたいな絶対値の判定は、明るい背景の上では
       成立せん（実際に赤も青も緑も検出できんかった）。どの色が"増えたか"だけを見る。 */
    const diff = (base, cur) => {
      const hit = { red:0, blue:0, yellow:0, green:0 };
      let sumY = 0, n = 0;
      const W = cur.r.w, H = cur.r.h;
      for(let yy=0; yy<H; yy++) for(let xx=0; xx<W; xx++){
        const i = (yy*W+xx)*4;
        const dR = cur.d[i]-base.d[i], dG = cur.d[i+1]-base.d[i+1], dB = cur.d[i+2]-base.d[i+2];
        let k = null;
        if(dR>55 && dG>55 && dB < 0.45*Math.min(dR,dG)) k='yellow';        /* 黄は先に見る（赤と紛れる） */
        else if(dR>55 && dG < 0.55*dR && dB < 0.55*dR) k='red';
        else if(dB>55 && dR < 0.55*dB) k='blue';
        else if(dG>55 && dR < 0.65*dG && dB < 0.65*dG) k='green';
        if(k){ hit[k]++; sumY += yy; n++; }
      }
      return { ...hit, cy: n ? sumY/n/H : -1, n };
    };
    const shot = (setup) => {
      resetBattle(777); const f = enemy;
      f.buffs = {}; f.callouts = []; if(setup) setup(f);
      drawField();
      return grab(f);
    };
    const rawBase = shot(null);
    const zero    = diff(rawBase, rawBase);
    const atkUp   = diff(rawBase, shot((f)=>{ f.buffs.atk={delta: 22,until:battleTime+16}; }));
    const atkDown = diff(rawBase, shot((f)=>{ f.buffs.atk={delta:-22,until:battleTime+16}; }));
    const defUp   = diff(rawBase, shot((f)=>{ f.buffs.def={delta: 22,until:battleTime+16}; }));
    const spdUp   = diff(rawBase, shot((f)=>{ f.buffs.spd={delta: 22,until:battleTime+16}; }));
    const evaUp   = diff(rawBase, shot((f)=>{ f.buffs.eva={delta: 22,until:battleTime+16}; }));
    const held    = diff(rawBase, shot((f)=>{ f.buffs.atk={delta: 22,until:battleTime+16}; }));
    const cleared = diff(rawBase, shot(null));
    resetBattle(777);
    return { base: zero, atkUp, atkDown, defUp, spdUp, evaUp, held, cleared };
  });

  const bv = buffVis;
  console.log('\n段6「能力変化の見せ方」  BUFFVIS：粒の色=stat／向き=上下（差分で数える）');
  console.log('  基準(バフ無し)  赤=' + bv.base.red + ' 青=' + bv.base.blue
              + ' 黄=' + bv.base.yellow + ' 緑=' + bv.base.green);
  console.log('  攻撃↑          赤=' + bv.atkUp.red + '（+' + (bv.atkUp.red - bv.base.red) + '）重心y=' + bv.atkUp.cy.toFixed(2));
  console.log('  攻撃↓          赤=' + bv.atkDown.red + '（+' + (bv.atkDown.red - bv.base.red) + '）重心y=' + bv.atkDown.cy.toFixed(2));
  console.log('  防御↑          青=' + bv.defUp.blue + '（+' + (bv.defUp.blue - bv.base.blue) + '）');
  console.log('  素早さ↑        黄=' + bv.spdUp.yellow + '（+' + (bv.spdUp.yellow - bv.base.yellow) + '）');
  console.log('  回避↑          緑=' + bv.evaUp.green + '（+' + (bv.evaUp.green - bv.base.green) + '）');

  ok(bv.atkUp.red   - bv.base.red    > 8, 'BUFFVIS-a: 攻撃バフで赤い粒が出とらん（差分 ' + (bv.atkUp.red - bv.base.red) + '）');
  ok(bv.defUp.blue  - bv.base.blue   > 8, 'BUFFVIS-b: 防御バフで青い粒が出とらん（差分 ' + (bv.defUp.blue - bv.base.blue) + '）');
  ok(bv.spdUp.yellow- bv.base.yellow > 8, 'BUFFVIS-c: 素早さバフで黄の粒が出とらん（差分 ' + (bv.spdUp.yellow - bv.base.yellow) + '）');
  ok(bv.evaUp.green - bv.base.green  > 8, 'BUFFVIS-d: 回避バフで緑の粒が出とらん（差分 ' + (bv.evaUp.green - bv.base.green) + '）');
  /* 向きが逆であること。強化は上へ昇るけん重心が上（y小）、弱化は下へ落ちるけん重心が下（y大）。 */
  ok(bv.atkUp.cy >= 0 && bv.atkDown.cy >= 0 && bv.atkDown.cy - bv.atkUp.cy > 0.08,
     'BUFFVIS-e: 強化と弱化で粒の向きが分かれとらん（強化の重心y=' + bv.atkUp.cy.toFixed(2)
     + ' 弱化の重心y=' + bv.atkDown.cy.toFixed(2) + '／弱化の方が下＝y大 であるべき）');
  /* 消したら基準へ戻る＝バフが在るときだけ描いとる証明。
     『基準に赤が少ない』では証明にならん —— 青は基準に1721もあるけん、
     色ごとに基準が違う。同じ絵で「掛けた／消した」を測るのが唯一の対比。 */
  console.log('  掛けた→消した  赤 ' + bv.held.red + ' → ' + bv.cleared.red + '（基準 ' + bv.base.red + '）');
  ok(bv.held.red - bv.base.red > 20 && Math.abs(bv.cleared.red - bv.base.red) <= 2,
     'BUFFVIS-f: バフを消しても粒が残っとる（掛けた ' + bv.held.red + ' → 消した ' + bv.cleared.red
     + ' ／基準 ' + bv.base.red + '）——バフが在るときだけ描く、になっとらん');

  await pg.close();
  await b.close();

  if (errs.length) {
    console.error('\nverify_support: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log('\nverify_support: 全部通った');
  process.exit(0);
})();
