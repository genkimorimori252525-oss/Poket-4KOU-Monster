#!/usr/bin/env node
/* コストを `src/cost.js` へ剥がしても、**答えが1つも変わっとらんか**（COST-01〜03）。
   使い方:  node tools/verify_cost.js        （NGなら終了コード1）

   基準値は tools/fixtures/cost-baseline.json —— 剥がす**前**に
   tools/cost_baseline.js で控えたもの。同じ入力を同じ手順で作って突き合わせる。

   なんで「同じはず」やのに数えるか ——
   Phase 1 の約束は「挙動は1ミリも変えん」。言葉で言うのは簡単やが、
   丸め・順序・既定値のどれか1つがズレただけでコストは動く。
   コストは**損失額と獲得額の両方**を決めるけん（計画18.5）、
   ここで1でもズレたら経済ごと歪む。だから数える。 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const ROOT = path.join(__dirname, '..');
const DIST_URL = 'file://' + path.join(ROOT, 'dist') + '/';
const FIX = path.join(__dirname, 'fixtures', 'cost-baseline.json');
const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

function savedMonsters() {
  const dir = path.join(ROOT, 'data', 'monsters');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      return { key: 'saved:' + f.replace(/\.json$/, ''), stats: j.stats, moves: j.moves };
    } catch (e) { return null; }
  }).filter((m) => m && m.stats);
}

(async () => {
  const errs = [];
  if (!fs.existsSync(FIX)) {
    console.error('基準値が無い。先に node tools/cost_baseline.js を走らせて');
    process.exit(1);
  }
  const fix = JSON.parse(fs.readFileSync(FIX, 'utf8'));
  const saved = savedMonsters();

  const b = await chromium.launch(LAUNCH);
  offlineFonts(b);
  const pg = await b.newPage({ viewport: { width: 420, height: 900 } });
  pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.goto(DIST_URL + 'shioumon_field_test.html');
  await pg.waitForTimeout(1500);

  /* ---- 1. 独立モジュールとして存在し、定数が表に出とるか（COST-01・COST-03）---- */
  const shape = await pg.evaluate(() => {
    if (typeof COST === 'undefined') return { err: 'COST が居らん（cost.js が読まれとらん）' };
    if (typeof costOf !== 'function') return { err: 'costOf が居らん' };
    const probe = costOf({ stats: { atk: 50, def: 50, hp: 50, spd: 50, eva: 50, int: 50 }, moves: [] });
    return {
      hasW: !!COST.W, hasK: !!COST.K, hasOf: typeof COST.of === 'function',
      kKeys: COST.K ? Object.keys(COST.K).sort() : [],
      wKeys: COST.W ? Object.keys(COST.W).sort() : [],
      breakdown: Object.keys(probe).sort(),
      /* 皮が本体を呼んどるか（別実装が二重に生きとらんか）*/
      wrapperDelegates: costOf({ stats: { atk: 77, def: 33, hp: 21, spd: 9, eva: 4, int: 60 }, moves: [] }).cost
                        === COST.of({ stats: { atk: 77, def: 33, hp: 21, spd: 9, eva: 4, int: 60 }, moves: [] }).cost
    };
  });
  if (shape.err) { errs.push(shape.err); }
  else {
    if (!shape.hasW || !shape.hasK || !shape.hasOf) errs.push('COST が W / K / of を出しとらん（差し替えられん形）');
    if (shape.breakdown.join(',') !== 'avg,base,cost,mv') errs.push('内訳が揃っとらん（掟9）: ' + shape.breakdown.join(','));
    if (!shape.wrapperDelegates) errs.push('costOf が COST.of を通っとらん（実装が二重に生きとる）');
    console.log('形            COST.W(' + shape.wKeys.length + ') COST.K(' + shape.kKeys.length + ') COST.of  内訳=' + shape.breakdown.join('/'));
    console.log('              定数: ' + shape.kKeys.join(' '));
  }

  /* ---- 2. 答えが1つも変わっとらんか（COST-02）----
     基準値と**同じ手順**で入力を作る。手順がズレたら比較にならんけん、
     cost_baseline.js と同じ格子をここにも書く（写しやのうて同じ規則）。 */
  const now = await pg.evaluate((savedIn) => {
    const ids = Object.keys(MOVES).sort();
    const out = {};
    const axis = [1, 10, 45, 80, 115, 150, 200];
    for (const a of axis) for (const d of axis) for (const h of axis) {
      const stats = {
        atk: a, def: d, hp: h,
        spd: ((a + d) % 149) + 1,
        eva: ((d + h) % 149) + 1,
        int: ((a + h) % 149) + 1
      };
      for (let k = 0; k <= ids.length; k++) {
        out['grid:' + a + '/' + d + '/' + h + '/' + k] = costOf({ stats, moves: ids.slice(0, k) });
      }
    }
    for (const m of savedIn) out[m.key] = costOf({ stats: m.stats, moves: m.moves || [] });
    if (typeof FOES !== 'undefined' && Array.isArray(FOES)) {
      FOES.forEach((f, i) => {
        if (f && f.stats) out['foe:' + i + ':' + (f.name || '')] = costOf({ stats: f.stats, moves: f.moves || [] });
      });
    }
    return { ids, out };
  }, saved);

  if (now.ids.join(' ') !== (fix.moveIds || []).join(' ')) {
    errs.push('技IDの顔ぶれが変わっとる。基準値と比べられん: ' + now.ids.join(' '));
  }

  const base = fix.entries || {};
  const keysB = Object.keys(base), keysN = Object.keys(now.out);
  const missing = keysB.filter((k) => !(k in now.out));
  const extra = keysN.filter((k) => !(k in base));
  if (missing.length) errs.push('基準値にあって今は無い入力が ' + missing.length + '件: ' + missing.slice(0, 3).join(' '));
  if (extra.length) errs.push('基準値に無い入力が ' + extra.length + '件: ' + extra.slice(0, 3).join(' '));

  let diff = 0;
  const shown = [];
  for (const k of keysB) {
    const a = base[k], z = now.out[k];
    if (!z) continue;
    /* cost は整数。内訳は浮動小数やけん、丸め差を拾わんよう桁を揃えて見る */
    const same = a.cost === z.cost
      && Math.abs(a.avg - z.avg) < 1e-9
      && Math.abs(a.base - z.base) < 1e-9
      && Math.abs(a.mv - z.mv) < 1e-9;
    if (!same) {
      diff++;
      if (shown.length < 5) shown.push(k + ' 前=' + a.cost + ' 後=' + z.cost);
    }
  }
  if (diff) errs.push('コストが変わった入力が ' + diff + '件: ' + shown.join(' / '));
  console.log('突き合わせ    ' + keysB.length + ' 通り中 ' + diff + ' 件が相違');
  if (fix.savedMonsters && fix.savedMonsters.length) {
    console.log('              保存個体 ' + fix.savedMonsters.length + '体も込み（' +
                fix.savedMonsters.map((s) => s.replace('saved:', '')).join(' ') + '）');
  }

  /* ---- 3. 決定論（掟1）。コストを剥がしても戦闘の再現性が落ちとらんか ---- */
  const det = await pg.evaluate(() => { const r = determinismTest(); return { ok: r.ok, at: r.at }; });
  if (!det.ok) errs.push('コストを剥がしたら決定論が落ちた（掟1）at=' + det.at);
  console.log('決定論        ' + (det.ok ? 'ok' : 'NG'));

  await pg.close();
  await b.close();

  if (errs.length) {
    console.error(String.fromCharCode(10) + 'verify_cost: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(String.fromCharCode(10) + 'verify_cost: 全部通った（挙動は1ミリも変わっとらん）');
  process.exit(0);
})();
