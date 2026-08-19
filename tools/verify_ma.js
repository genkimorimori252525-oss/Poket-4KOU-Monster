#!/usr/bin/env node
/* 「間」が本当に選ばれとるか（MA-01〜05）。
   使い方:  node tools/verify_ma.js        （NGなら終了コード1）

   一番大事なんは **MA-04（極端に寄らん）**。
   「間が実装できた」だけなら、常に間を取る実装でも通ってしまう。
   それは読み合いやのうてただの棒立ちや。
   **取る個体と取らん個体の両方が出る**ことを数えて示す。 */
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

  /* ---- 1. 「間」が候補として並ぶか（MA-01）---- */
  const shape = await pg.evaluate(() => {
    if (typeof scoreHold !== 'function') return { err: 'scoreHold が居らん' };
    if (typeof HOLD_W === 'undefined') return { err: 'HOLD_W（重みの表）が居らん' };
    resetBattle(4242);
    const s = scoreHold(partyA[0], partyB[0]);
    return { keys: Object.keys(HOLD_W), name: s.move.name, hold: !!s.hold,
             terms: s.terms.map((t) => t.n) };
  });
  if (shape.err) { errs.push(shape.err); }
  else {
    ok(shape.hold, '間の候補に hold の印が無い');
    ok(shape.name === '間（様子見）', '間の名前が違う: ' + shape.name);
    console.log('重みの表      ' + shape.keys.join(' '));
    console.log('内訳          ' + shape.terms.join(' / '));
  }

  /* ---- 2. 理由ごとに点数が動くか（MA-02）----
     **条件を作って、点が動くことを確かめる。** 動かんなら理由が効いとらん。 */
  const react = await pg.evaluate(() => {
    resetBattle(4242);
    const f = partyA[0], foe = partyB[0];
    const base = scoreHold(f, foe).total;
    const out = { base };
    /* 相手が溜め中 */
    foe.charging = { t: 1, move: foe.moves[0] };
    out.foeCharging = scoreHold(f, foe).total;
    foe.charging = null;
    /* 相手が反動中（全技CD） */
    foe.moves.forEach((m) => { foe.cd[m.id] = 3; });
    out.foeRecoil = scoreHold(f, foe).total;
    foe.cd = {};
    /* こっちが瀕死 */
    const hp = f.hp; f.hp = f.maxHP * 0.2;
    out.lowHP = scoreHold(f, foe).total;
    f.hp = hp;
    resetBattle(4242);
    return out;
  });
  ok(react.foeCharging > react.base, '相手が溜めても間の点が上がらん: ' + react.base + ' → ' + react.foeCharging);
  ok(react.foeRecoil < react.base, '相手が撃てんのに間の点が下がらん（好機のはず）: ' + react.base + ' → ' + react.foeRecoil);
  ok(react.lowHP > react.base, '瀕死でも間の点が上がらん: ' + react.base + ' → ' + react.lowHP);
  console.log('理由の効き    素' + react.base + ' / 相手が溜め ' + react.foeCharging
    + ' / 相手が反動 ' + react.foeRecoil + ' / 瀕死 ' + react.lowHP);

  /* ---- 3. 賢さと性格が効くか（MA-03）---- */
  const per = await pg.evaluate(() => {
    resetBattle(4242);
    const f = partyA[0], foe = partyB[0];
    foe.charging = { t: 1, move: foe.moves[0] };   // 間を取るべき場面を作る
    const snapI = f.stats.int, snapC = f.per.caut, snapA = f.per.aggr;
    const at = (int, caut, aggr) => { f.stats.int = int; f.per.caut = caut; f.per.aggr = aggr;
                                      return scoreHold(f, foe).total; };
    const out = {
      馬鹿で好戦: at(10, 20, 90),
      並:         at(50, 50, 50),
      賢くて慎重: at(95, 90, 20)
    };
    f.stats.int = snapI; f.per.caut = snapC; f.per.aggr = snapA;
    foe.charging = null;
    resetBattle(4242);
    return out;
  });
  ok(per.賢くて慎重 > per.並 && per.並 > per.馬鹿で好戦,
     '賢さ・性格の効きが単調やない: ' + JSON.stringify(per));
  console.log('賢さと性格    馬鹿で好戦 ' + per.馬鹿で好戦 + ' < 並 ' + per.並
    + ' < 賢くて慎重 ' + per.賢くて慎重);

  /* ---- 4. 実戦で間が起きるか、そして**極端に寄っとらんか**（MA-04）----
     ここがこの検証の本題。 */
  const live = await pg.evaluate(() => {
    const runs = [];
    for (const seed of [4242, 777, 31337, 90210, 12345]) {
      resetBattle(seed);
      const stance = {}, held = {};
      let picks = 0, holds = 0;
      for (let i = 0; i < 60 * 60 * 2 && !over; i++) {
        stepBattle(1 / 60); ally.update(1 / 60); enemy.update(1 / 60);
        for (const f of [ally, enemy]) {
          const s = stanceOf(f);
          stance[s] = (stance[s] || 0) + 1;
          if (s === 'hold') held[f.name] = (held[f.name] || 0) + 1;
        }
      }
      AILog.entries.filter((e) => e.kind === 'dec' && e.pick >= 0).forEach((e) => {
        picks++; if (e.cands[e.pick].hold) holds++;
      });
      runs.push({ seed, stance, held, picks, holds,
                  holdRate: picks ? +(holds / picks * 100).toFixed(1) : 0 });
    }
    resetBattle(4242);
    return runs;
  });
  const rates = live.map((r) => r.holdRate);
  const totalHold = live.reduce((a, r) => a + (r.stance.hold || 0), 0);
  ok(totalHold > 0, '5戦回しても間が一度も起きん（MA-01 が効いとらん）');
  ok(rates.every((r) => r < 80), '間を取りすぎ（' + rates.join('/') + '%）—— 棒立ちになっとる');
  ok(rates.some((r) => r > 0.5), '間がほとんど選ばれとらん（' + rates.join('/') + '%）');
  console.log('実戦5戦       間を選んだ割合 ' + rates.map((r) => r + '%').join(' / '));
  live.forEach((r) => console.log('              種' + String(r.seed).padStart(5)
    + '  間 ' + String(r.stance.hold || 0).padStart(4) + 'フレーム'
    + '  取った個体: ' + (Object.keys(r.held).join(',') || 'なし')));

  /* 取る個体と取らん個体の両方が居るか */
  const takers = new Set(), all = new Set();
  await pg.evaluate(() => null);
  live.forEach((r) => { Object.keys(r.held).forEach((n) => takers.add(n)); });
  const names = await pg.evaluate(() => [...partyA, ...partyB].map((f) => f.name));
  names.forEach((n) => all.add(n));
  ok(takers.size > 0, '間を取る個体が1体も居らん');
  ok(takers.size < all.size, '全員が間を取っとる —— 性格の差が出とらん（' + [...takers].join(',') + '）');
  console.log('個体差        間を取る ' + takers.size + '体 / 全' + all.size + '体（'
    + [...takers].join(',') + '）');

  /* ---- 5. 間の最中に回避が起きるか（MA-05）---- */
  const dodge = await pg.evaluate(() => {
    let inHold = 0, total = 0;
    for (const seed of [4242, 777, 31337]) {
      resetBattle(seed);
      const holdAt = [];
      for (let i = 0; i < 60 * 60 * 2 && !over; i++) {
        stepBattle(1 / 60); ally.update(1 / 60); enemy.update(1 / 60);
        for (const f of [ally, enemy]) if (stanceOf(f) === 'hold') holdAt.push({ t: battleTime, who: f.name });
      }
      AILog.entries.filter((e) => e.kind === 'dg').forEach((e) => {
        total++;
        if (holdAt.some((h) => h.who === e.who && Math.abs(h.t - e.t) < 0.4)) inHold++;
      });
    }
    resetBattle(4242);
    return { inHold, total };
  });
  console.log('回避          全' + dodge.total + '回のうち、間の最中が ' + dodge.inHold + '回');
  ok(dodge.total > 0, '3戦回しても回避判断が一度も起きとらん（比べようが無い）');

  /* ---- 6. 決定論（掟1）---- */
  const det = await pg.evaluate(() => { const r = determinismTest(); return { ok: r.ok, at: r.at }; });
  ok(det.ok, '間を入れたら決定論が落ちた（掟1）at=' + det.at);
  const twice = await pg.evaluate(() => {
    const play = () => {
      resetBattle(31337);
      let n = 0;
      for (; n < 30000 && !over; n++) { stepBattle(1 / 60); ally.update(1 / 60); enemy.update(1 / 60); }
      return { n, r: endReason, a: TEAM.ally.own, e: TEAM.enemy.own,
               hp: [...partyA, ...partyB].map((f) => f.hp.toFixed(4)).join(',') };
    };
    const x = play(), y = play();
    resetBattle(4242);
    return { same: JSON.stringify(x) === JSON.stringify(y), x };
  });
  ok(twice.same, '同じ種で結果が変わる');
  console.log('決定論        戦闘 ' + (det.ok ? 'ok' : 'NG') + ' ／ 2回とも同じ: ' + twice.same);

  await pg.close();
  await b.close();

  if (errs.length) {
    console.error(String.fromCharCode(10) + 'verify_ma: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(String.fromCharCode(10) + 'verify_ma: 全部通った');
  process.exit(0);
})();
