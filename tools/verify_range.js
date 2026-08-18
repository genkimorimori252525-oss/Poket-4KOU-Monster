/* 技の分類が本当に効いとるか（MOVE-01〜06）。
   使い方:  node tools/verify_range.js        （NGなら終了コード1）

   見るのは4つ:
   1. 全部の技に分類が付いとって、定義（実体が空間を進むか）と食い違わんか
   2. 相殺の門番が「遠距離か」で門前払いしとるか
   3. motions を書いとらん技に、分類ごとの既定モーションが割り当たるか
   4. motions を書いた技は、その上書きが勝つか（MOVE-05） */
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');
const path = require('path');
const DIST_URL = 'file://' + path.join(__dirname, '..', 'dist') + '/';
const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

(async () => {
  const errs = [];
  const out = {};
  const b = await chromium.launch(LAUNCH);
  offlineFonts(b);
  const pg = await b.newPage({ viewport: { width: 420, height: 900 } });
  pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.goto(DIST_URL + 'shioumon_field_test.html');
  await pg.waitForTimeout(1500);

  /* ---- 1. 分類が全技に付いとって、定義と食い違わんか ---- */
  const cls = await pg.evaluate(() => {
    if (typeof MOVE_RANGE === 'undefined') return { err: 'MOVE_RANGE が無い' };
    const BY = MOVE_RANGE.BY_GENERATOR;
    const rows = [];
    const all = [];
    for (const id in MOVES) all.push(MOVES[id]);
    if (typeof STARTER_MOVES !== 'undefined') {
      STARTER_MOVES.forEach(m => all.push({ id: m.name, name: m.name, fx: m.fx, range: m.battle && m.battle.range }));
    }
    const count = { melee: 0, ranged: 0, remote: 0 };
    let mismatch = 0, missing = 0;
    all.forEach(m => {
      const derived = BY[m.fx && m.fx.generator];
      const got = MOVE_RANGE.rangeOf(m);
      count[got] = (count[got] || 0) + 1;
      if (!m.range) missing++;
      if (derived && got !== derived) { mismatch++; rows.push(m.name + ' gen=' + m.fx.generator + ' range=' + got); }
    });
    return { total: all.length, count, mismatch, missing, rows };
  });
  out['分類'] = cls;
  if (cls.err) errs.push(cls.err);
  else {
    if (cls.mismatch) errs.push('定義と食い違う技が ' + cls.mismatch + '件: ' + cls.rows.join(' / '));
    if (cls.missing) errs.push('range が明示されとらん技が ' + cls.missing + '件（導出はできるが正典に書くべき）');
  }

  /* ---- 2. 相殺の門番 ---- */
  const gate = await pg.evaluate(() => {
    const mk = (gen) => ({ id: 'x', name: 'x', fx: { generator: gen } });
    const r = {};
    ['projectile', 'beam', 'slash', 'lightning', 'aura', 'shatter'].forEach(g => {
      r[g] = { range: MOVE_RANGE.rangeOf(mk(g)), 相殺の土俵: MOVE_RANGE.isRanged(mk(g)) };
    });
    /* 明示指定が導出より強いか */
    r['明示が勝つか'] = MOVE_RANGE.rangeOf({ range: 'remote', fx: { generator: 'projectile' } }) === 'remote';
    return r;
  });
  out['相殺の門番'] = gate;
  if (!gate.projectile.相殺の土俵 || !gate.beam.相殺の土俵) errs.push('遠距離が相殺の土俵に上がっとらん');
  ['slash', 'lightning', 'aura', 'shatter'].forEach(g => {
    if (gate[g].相殺の土俵) errs.push(g + ' が相殺の土俵に上がっとる（上がったらいかん）');
  });
  if (!gate['明示が勝つか']) errs.push('技データの range より導出が優先されとる（明示が勝つべき）');

  /* ---- 3&4. 既定モーションと、上書きが勝つか ---- */
  const mo = await pg.evaluate(() => {
    const mk = (gen, motions) => ({ id: 'x', name: 'x', fx: { generator: gen, motions: motions || [] } });
    const f = partyA[0];
    const cap = () => ({ anim: f.anim, dur: f.durOv });
    const r = {};
    ['slash', 'projectile', 'lightning'].forEach(g => {
      f.anim = 'idle'; f.durOv = null;
      f.scheduleMotions(mk(g).fx, 'fire');
      r[MOVE_RANGE.rangeOf(mk(g))] = cap();
    });
    /* 上書き: motions を書いた技は既定へ来ん */
    f.anim = 'idle'; f.durOv = null;
    f.scheduleMotions(mk('projectile', [{ anim: 'jump', at: 'fire', off: 0, dur: 1.25 }]).fx, 'fire');
    r['上書き'] = cap();
    return r;
  });
  out['既定モーション'] = mo;
  if (mo.melee && mo.melee.anim !== 'attack') errs.push('近接の既定が attack やない: ' + mo.melee.anim);
  if (mo.remote && mo.remote.anim !== 'charge') errs.push('遠隔の既定が charge やない: ' + mo.remote.anim);
  if (mo.ranged && !(mo.ranged.dur > 0)) errs.push('遠距離の既定に短い持続が入っとらん（近接と同じ動きになる）');
  if (mo['上書き'] && mo['上書き'].anim !== 'jump') errs.push('motions の上書きが効いとらん（MOVE-05）: ' + mo['上書き'].anim);

  /* ---- 5. 決定論（掟1）---- */
  const det = await pg.evaluate(() => { const r = determinismTest(); return { ok: r.ok, len: r.len, at: r.at }; });
  out['決定論'] = det;
  if (!det.ok) errs.push('分類を入れたら決定論が落ちた（掟1）at=' + det.at);

  await pg.close();
  await b.close();
  console.log(JSON.stringify(out, null, 2));
  if (errs.length) {
    console.error('verify_range: ' + errs.length + '件のエラー');
    errs.forEach(e => console.error('  ' + e));
  }
  process.exit(errs.length ? 1 : 0);
})();
