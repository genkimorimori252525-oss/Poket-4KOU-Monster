#!/usr/bin/env node
/* ビック尻ドロップ専用の本体アニメーションが、実フィールド描画まで届くか。 */
const path = require('path');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const ROOT = path.join(__dirname, '..');
const DIST_URL = 'file://' + path.join(ROOT, 'dist') + '/shioumon_field_test.html';
const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

(async () => {
  const errs = [];
  const ok = (c, w) => { if (!c) errs.push(w); };
  let b;
  try {
    b = await chromium.launch(LAUNCH);
    offlineFonts(b);
    const pg = await b.newPage({ viewport: { width: 420, height: 900 } });
    pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await pg.goto(DIST_URL);
    await pg.waitForTimeout(1500);

    const out = await pg.evaluate(() => {
      const hashCanvas = () => {
        const d = fieldCv.getContext('2d').getImageData(0, 0, fieldCv.width, fieldCv.height).data;
        let h = 2166136261, ink = 0;
        for (let i = 0; i < d.length; i++) {
          h ^= d[i]; h = Math.imul(h, 16777619);
          if (i % 4 === 3 && d[i]) ink++;
        }
        return { hash: (h >>> 0).toString(16).padStart(8, '0'), ink };
      };
      const pose = (t) => {
        resetBattle(4242); autoBattle = false;
        const f = partyA[0];
        f.play('big_butt_drop', 1.65); f.t = t;
        drawField();
        return { t, anim: f.anim, transform: sampleAnim(ANIMS.big_butt_drop, t), ...hashCanvas() };
      };
      const poses = [0.08, 0.39, 0.64, 0.82].map(pose);
      resetBattle(4242); autoBattle = true;
      return {
        keyCount: ANIMS.big_butt_drop && ANIMS.big_butt_drop.keys.length,
        poses
      };
    });

    ok(out.keyCount >= 10, '専用キーが足りん: ' + out.keyCount);
    ok(out.poses.every((p) => p.anim === 'big_butt_drop' && p.ink > 0),
      '実フィールドで専用アニメーションを描けん: ' + JSON.stringify(out.poses));
    ok(new Set(out.poses.map((p) => p.hash)).size === out.poses.length,
      '沈み込み・跳躍・着地・反動の絵が変化しとらん: ' + out.poses.map((p) => p.hash).join(', '));
    const land = out.poses.find((p) => p.t === 0.64).transform;
    ok(land.sx >= 1.6 && land.sy <= 0.55 && land.dx >= 90,
      '尻着地のつぶれ・踏み込みが足りん: ' + JSON.stringify(land));

    for (const p of out.poses)
      console.log('t=' + p.t.toFixed(2) + '  ' + p.hash + '  dx=' + Math.round(p.transform.dx)
        + ' dy=' + Math.round(p.transform.dy) + ' sx=' + p.transform.sx.toFixed(2));
    await pg.close();
  } catch (e) {
    errs.push(e.stack || e.message || String(e));
  } finally {
    if (b) await b.close();
  }

  if (errs.length) {
    console.error(String.fromCharCode(10) + 'verify_butt_animation: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(String.fromCharCode(10) + 'verify_butt_animation: 全部通った');
  process.exit(0);
})();
