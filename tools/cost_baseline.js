#!/usr/bin/env node
/* コスト算出の**基準値**を控える。剥がす前に走らせて、剥がした後に verify_cost.js で突き合わせる。
   使い方:  node tools/cost_baseline.js        → tools/fixtures/cost-baseline.json

   なんで要るか —— Phase 1 の約束は「`costOf` を `src/cost.js` へ剥がすが、
   **挙動は1ミリも変えん**」。それを言葉やのうて数字で示すため。
   剥がす前の答えを控えとかんかったら、後から「変わっとらん」と言うても
   ただの主張にしかならん。

   入力は**決め打ちで生成する**（乱数を使わん）。同じ手順を踏めば誰が走らせても同じ表が出る。 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const ROOT = path.join(__dirname, '..');
const DIST_URL = 'file://' + path.join(ROOT, 'dist') + '/';
const OUT = path.join(__dirname, 'fixtures', 'cost-baseline.json');
const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

/* 保存されとる本物の個体も混ぜる。作り物の格子だけやと、
   実データにしか無い形（技が MOVES に無い自作技など）を取りこぼす。 */
function savedMonsters() {
  const dir = path.join(ROOT, 'data', 'monsters');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        return { key: 'saved:' + f.replace(/\.json$/, ''), stats: j.stats, moves: j.moves };
      } catch (e) { return null; }
    })
    .filter((m) => m && m.stats);
}

(async () => {
  const saved = savedMonsters();
  const b = await chromium.launch(LAUNCH);
  offlineFonts(b);
  const pg = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await pg.goto(DIST_URL + 'shioumon_field_test.html');
  await pg.waitForTimeout(1500);

  const table = await pg.evaluate((savedIn) => {
    if (typeof costOf !== 'function') return { err: 'costOf が居らん' };
    const ids = Object.keys(MOVES).sort();
    const out = {};

    /* 格子。刻みは決め打ち。境目（1・上限付近）も踏む */
    const axis = [1, 10, 45, 80, 115, 150, 200];
    for (const a of axis) {
      for (const d of axis) {
        for (const h of axis) {
          /* 残り3つは前3つから決める —— 全6軸を総当りすると膨れるが、
             決め打ちの導出やと再現性は保てる */
          const stats = {
            atk: a, def: d, hp: h,
            spd: ((a + d) % 149) + 1,
            eva: ((d + h) % 149) + 1,
            int: ((a + h) % 149) + 1
          };
          for (let k = 0; k <= ids.length; k++) {
            const moves = ids.slice(0, k);
            out['grid:' + a + '/' + d + '/' + h + '/' + k] = costOf({ stats, moves });
          }
        }
      }
    }

    /* 保存されとる本物 */
    for (const m of savedIn) {
      out[m.key] = costOf({ stats: m.stats, moves: m.moves || [] });
    }

    /* 内蔵の相手（battle.tpl.html の定義） */
    if (typeof FOES !== 'undefined' && Array.isArray(FOES)) {
      FOES.forEach((f, i) => {
        if (f && f.stats) out['foe:' + i + ':' + (f.name || '')] = costOf({ stats: f.stats, moves: f.moves || [] });
      });
    }

    return { ids, count: Object.keys(out).length, out };
  }, saved);

  await pg.close();
  await b.close();

  if (table.err || errs.length) {
    console.error('基準値が取れんかった: ' + (table.err || errs.join(' / ')));
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    note: 'costOf の基準値。src/cost.js へ剥がす前に控えたもの。verify_cost.js が突き合わせる',
    takenFrom: 'dist/shioumon_field_test.html',
    moveIds: table.ids,
    savedMonsters: saved.map((m) => m.key),
    entries: table.out
  }, null, 2) + '\n', 'utf8');

  console.log('基準値を控えた: ' + table.count + ' 通り');
  console.log('  技ID: ' + table.ids.join(' '));
  console.log('  保存個体: ' + (saved.length ? saved.map((m) => m.key.replace('saved:', '')).join(' ') : 'なし'));
  console.log('  → ' + path.relative(ROOT, OUT));
})();
