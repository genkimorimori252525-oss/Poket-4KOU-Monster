#!/usr/bin/env node
/* コスト経済が計画どおり動いとるか（ECON-01〜07・WIN-01〜05）。
   使い方:  node tools/verify_econ.js        （NGなら終了コード1）

   軸は計画18.3 の**計算例3つ**。あれが合わんかったら経済ごと嘘になる:

     コスト20が コスト140を倒す → +140
     コスト50が コスト50を倒す  → +25
     コスト140が コスト20を倒す → +1.4

   「格上を食うほど大きく増え、格下を潰してもほとんど増えん」が
   低コスト編成の存在理由やけん、ここがズレたら遊びが1つ消える。 */
const path = require('path');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const DIST_URL = 'file://' + path.join(__dirname, '..', 'dist') + '/';
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

  /* ---- 1. 定数が1箇所に揃っとるか（ECON-07）---- */
  const cfg = await pg.evaluate(() => {
    if (typeof COST === 'undefined' || !COST.ECON) return { err: 'COST.ECON が居らん' };
    return { e: COST.ECON, max: COST.maxOwn(), hasGain: typeof COST.gainOn === 'function' };
  });
  if (cfg.err) { errs.push(cfg.err); }
  else {
    ok(cfg.e.start === 150, '初期値が150やない: ' + cfg.e.start);
    ok(cfg.max === 300, '上限が300やない: ' + cfg.max);
    ok(cfg.e.k === 0.5, '係数kが0.5やない: ' + cfg.e.k);
    ok(cfg.e.ratioCap === 2.0, '比率上限が2.0やない: ' + cfg.e.ratioCap);
    ok(cfg.e.judgeAfter === 8, '判定に移るクォーターが8やない: ' + cfg.e.judgeAfter);
    ok(cfg.hasGain, 'COST.gainOn が居らん');
    console.log('定数          初期' + cfg.e.start + ' 上限' + cfg.max + ' k=' + cfg.e.k
      + ' 比率上限' + cfg.e.ratioCap + ' 判定' + cfg.e.judgeAfter + 'Q');
  }

  /* ---- 2. 計画18.3 の計算例（ECON-03・ECON-04）---- */
  const ex = await pg.evaluate(() => ([
    { name: '20が140を倒す',  got: COST.gainOn(20, 140),  want: 140 },
    { name: '50が50を倒す',   got: COST.gainOn(50, 50),   want: 25 },
    { name: '140が20を倒す',  got: COST.gainOn(140, 20),  want: 1.4 }
  ]));
  ex.forEach((e) => {
    const near = Math.abs(e.got - e.want) < 0.05;
    ok(near, '計画18.3 と合わん「' + e.name + '」 期待 ' + e.want + ' 実際 ' + e.got.toFixed(3));
    console.log('計算例        ' + e.name.padEnd(16) + ' → +' + e.got.toFixed(2) + '（計画 +' + e.want + '）');
  });

  /* 「格上を食うほど大きい」が本当に成り立つか。3例だけやと偶然かもしれん */
  const mono = await pg.evaluate(() => {
    const victim = 100, out = [];
    for (const killer of [10, 25, 50, 100, 200, 400]) out.push({ killer, gain: COST.gainOn(killer, victim) });
    return out;
  });
  for (let i = 1; i < mono.length; i++) {
    ok(mono[i].gain <= mono[i - 1].gain + 1e-9,
       '倒す側が高コストなのに取り分が増えとる: C' + mono[i - 1].killer + '→' + mono[i - 1].gain.toFixed(2)
       + ' / C' + mono[i].killer + '→' + mono[i].gain.toFixed(2));
  }
  ok(mono[0].gain > mono[mono.length - 1].gain * 5,
     '格上食いと格下潰しの差が小さすぎる（刺客が成立せん）');
  console.log('単調性        コスト100を倒したときの取り分: '
    + mono.map((m) => 'C' + m.killer + '→' + m.gain.toFixed(1)).join(' '));

  /* ---- 3. 上限と下限で止まるか（ECON-01）---- */
  const clamp = await pg.evaluate(() => {
    resetBattle(4242);
    const before = TEAM.ally.own;
    addCost('ally', 9999, '試験');
    const hi = TEAM.ally.own;
    addCost('ally', -99999, '試験');
    const lo = TEAM.ally.own;
    resetBattle(4242);
    return { before, hi, lo, afterReset: TEAM.ally.own, dealt: TEAM.ally.dealt };
  });
  ok(clamp.before === 150, '試合開始時の所持コストが150やない: ' + clamp.before);
  ok(clamp.hi === 300, '上限で止まっとらん: ' + clamp.hi);
  ok(clamp.lo === 0, '下限で止まっとらん: ' + clamp.lo);
  ok(clamp.afterReset === 150 && clamp.dealt === 0, '仕切り直しで経済が戻っとらん');
  console.log('上限下限      開始' + clamp.before + ' → 上限' + clamp.hi + ' → 下限' + clamp.lo
    + ' → 仕切り直し' + clamp.afterReset);

  /* ---- 4. 決着の三本道（WIN-01・WIN-05）---- */
  const ends = await pg.evaluate(() => {
    const r = {};
    /* コスト枯渇 */
    resetBattle(4242);
    TEAM.enemy.own = 0.4;
    addCost('enemy', -1, '試験');
    checkCostOut();
    r.costOut = { over, reason: endReason };
    /* 判定（残コストが多い側が勝つ） */
    resetBattle(4242);
    TEAM.ally.own = 120; TEAM.enemy.own = 80;
    judge();
    r.judgeByCost = { over, reason: endReason };
    /* 判定（同率なら与ダメ） */
    resetBattle(4242);
    TEAM.ally.own = 100; TEAM.enemy.own = 100;
    TEAM.ally.dealt = 500; TEAM.enemy.dealt = 100;
    judge();
    r.judgeByDamage = { over, reason: endReason };
    resetBattle(4242);
    return r;
  });
  ok(ends.costOut.over && ends.costOut.reason === 'コスト枯渇',
     'コストが尽きても決着せん: ' + JSON.stringify(ends.costOut));
  ok(ends.judgeByCost.over && ends.judgeByCost.reason === '判定',
     '判定に移らん: ' + JSON.stringify(ends.judgeByCost));
  ok(ends.judgeByDamage.over && ends.judgeByDamage.reason === '判定',
     '同率のとき判定が働かん: ' + JSON.stringify(ends.judgeByDamage));
  console.log('決着          コスト枯渇 ✓ ／ 判定(残コスト) ✓ ／ 判定(与ダメ) ✓');

  /* ---- 5. 実戦。試合を最後まで回して、経済が動いて決着するか ---- */
  const run = await pg.evaluate(() => {
    resetBattle(4242);
    /* determinismTest と同じ回し方。描画（rAF）に頼らんのは、
       検証が画面の都合で揺れんようにするため */
    const LIMIT = 60 * 60 * 12;   // 12分ぶん。8Q判定より十分長い
    let i = 0;
    for (; i < LIMIT && !over; i++) { stepBattle(1 / 60); ally.update(1 / 60); enemy.update(1 / 60); }
    return {
      over, reason: endReason, quarter, frames: i,
      ally: TEAM.ally.own, enemy: TEAM.enemy.own,
      dealtA: TEAM.ally.dealt, dealtE: TEAM.enemy.dealt
    };
  });
  ok(run.over, '12分ぶん回しても決着せん（quarter=' + run.quarter + '）');
  ok(run.ally !== 150 || run.enemy !== 150, '試合が終わったのに所持コストが1も動いとらん');
  ok(run.dealtA > 0 || run.dealtE > 0, '与ダメ総量が数えられとらん（判定の2番目の基準・WIN-04）');
  console.log('実戦          ' + run.reason + ' / ' + run.quarter + 'Q / 所持 味方'
    + run.ally.toFixed(1) + ' 相手' + run.enemy.toFixed(1)
    + ' / 与ダメ ' + run.dealtA.toFixed(0) + ':' + run.dealtE.toFixed(0));

  /* ---- 6. 決定論（掟1・ECON-06）----
     経済を入れても、同じ種で同じ結果になるか。**ここが落ちたら経済は使えん** */
  const det = await pg.evaluate(() => { const r = determinismTest(); return { ok: r.ok, at: r.at, len: r.len }; });
  ok(det.ok, '経済を入れたら決定論が落ちた（掟1）at=' + det.at);

  /* 経済の数字まで再現するか。determinismTest が見とらん所やけん自分で見る */
  const twice = await pg.evaluate(() => {
    const play = () => {
      resetBattle(777);
      for (let i = 0; i < 30000 && !over; i++) { stepBattle(1/60); ally.update(1/60); enemy.update(1/60); }
      return { a: TEAM.ally.own, e: TEAM.enemy.own, da: TEAM.ally.dealt, de: TEAM.enemy.dealt, r: endReason, q: quarter };
    };
    const x = play(), y = play();
    resetBattle(4242);
    return { x, y, same: JSON.stringify(x) === JSON.stringify(y) };
  });
  ok(twice.same, '同じ種で経済の結果が変わる: ' + JSON.stringify(twice.x) + ' vs ' + JSON.stringify(twice.y));
  console.log('決定論        戦闘 ' + (det.ok ? 'ok' : 'NG') + ' ／ 経済も2回とも同じ: ' + twice.same
    + '（' + twice.x.r + ' 味方' + twice.x.a.toFixed(1) + ' 相手' + twice.x.e.toFixed(1) + '）');

  await pg.close();
  await b.close();

  if (errs.length) {
    console.error(String.fromCharCode(10) + 'verify_econ: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(String.fromCharCode(10) + 'verify_econ: 全部通った');
  process.exit(0);
})();
