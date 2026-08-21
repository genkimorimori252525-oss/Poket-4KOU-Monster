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
