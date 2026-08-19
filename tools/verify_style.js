#!/usr/bin/env node
/* slash / beam の5形が描けて、互いに見分けが付き、既定形も変わっとらんか。
   使い方: node tools/verify_style.js        （NGなら終了コード1） */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const ROOT = path.join(__dirname, '..');
const DIST_URL = 'file://' + path.join(ROOT, 'dist-dev') + '/';
const SHOT = path.join(__dirname, '_style-shot.png');
const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

(async () => {
  const errs = [];
  const ok = (c, w) => { if (!c) errs.push(w); };
  let b;
  try {
    b = await chromium.launch(LAUNCH);
    offlineFonts(b);
    const pg = await b.newPage({ viewport: { width: 760, height: 560 } });
    pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await pg.goto(DIST_URL + 'shioumon_effect_lab.html');
    await pg.waitForTimeout(500);

    const result = await pg.evaluate(() => {
      const slashStyles = ['arc', 'cross', 'thrust', 'fan', 'spiral'];
      const beamStyles = ['straight', 'wave', 'twin', 'spiral', 'cone'];
      const bytes = (cv) => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const measure = (canvases) => {
        let hash = 2166136261, pixels = 0;
        for (const cv of canvases) {
          const d = bytes(cv);
          for (let i = 0; i < d.length; i++) {
            hash ^= d[i]; hash = Math.imul(hash, 16777619);
            if (i % 4 === 3 && d[i]) pixels++;
          }
        }
        return { hash: (hash >>> 0).toString(16).padStart(8, '0'), pixels };
      };
      const slash = (style, omitted) => {
        const sp = makeSpec('slash', 4242, 'style verify', '鋼');
        sp.size = 112; sp.arcDeg = 175; sp.thickness = 14; sp.count = 4;
        sp.hollow = 0; sp.jitter = 0.18; sp.specks = 10;
        if (omitted) delete sp.style; else sp.style = style;
        const frames = genSlashFrames(sp);
        return { frames, metric: measure(frames) };
      };
      const beam = (style, omitted) => {
        const sp = makeSpec('beam', 4242, 'style verify', '水');
        sp.width = 13; sp.segments = 16; sp.waver = 4; sp.impact = null;
        if (omitted) delete sp.style; else sp.style = style;
        const cv = mkCv(250, 100), g = cv.getContext('2d');
        const fx = new BeamFX(sp, { x: 18, y: 50 }, { x: 232, y: 50 }, buildEffect(sp), null);
        fx.time = sp.charge + sp.fire + sp.sustain * 0.45;
        fx.draw(g);
        return { canvas: cv, metric: measure([cv]) };
      };

      const slashRuns = slashStyles.map((style) => ({ style, ...slash(style, false) }));
      const beamRuns = beamStyles.map((style) => ({ style, ...beam(style, false) }));
      const slashOmitted = slash('arc', true).metric;
      const beamOmitted = beam('straight', true).metric;

      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0;background:#10141c;color:#e8edf5;font:14px sans-serif';
      const root = document.createElement('main');
      root.id = 'style-verify';
      root.style.cssText = 'box-sizing:border-box;width:740px;padding:18px;background:#10141c';
      const title = document.createElement('h1');
      title.textContent = 'slash / beam style verification';
      title.style.cssText = 'font-size:18px;margin:0 0 14px';
      root.appendChild(title);
      const addRow = (name, runs, getCanvas) => {
        const h = document.createElement('h2');
        h.textContent = name; h.style.cssText = 'font-size:14px;margin:12px 0 6px'; root.appendChild(h);
        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:8px';
        runs.forEach((run) => {
          const cell = document.createElement('section');
          cell.style.cssText = 'background:#181e29;border:1px solid #313b4b;padding:6px;text-align:center';
          const label = document.createElement('div');
          label.textContent = run.style + ' · ' + run.metric.pixels + ' px';
          label.style.cssText = 'font-size:11px;margin-bottom:4px';
          const cv = getCanvas(run);
          cv.style.cssText = 'display:block;width:100%;height:112px;object-fit:contain;image-rendering:pixelated;background:#0b0e14';
          cell.append(label, cv); row.appendChild(cell);
        });
        root.appendChild(row);
      };
      addRow('slash', slashRuns, (run) => run.frames[7]);
      addRow('beam', beamRuns, (run) => run.canvas);
      document.body.appendChild(root);

      return {
        slash: slashRuns.map((r) => ({ style: r.style, ...r.metric })),
        beam: beamRuns.map((r) => ({ style: r.style, ...r.metric })),
        registration: {
          label: LABEL.style,
          slash: SCHEMA.slash.find((x) => x[0] === 'style'),
          beam: SCHEMA.beam.find((x) => x[0] === 'style')
        },
        defaults: {
          slash: { omitted: slashOmitted.hash, explicit: slashRuns[0].metric.hash },
          beam: { omitted: beamOmitted.hash, explicit: beamRuns[0].metric.hash }
        }
      };
    });

    for (const kind of ['slash', 'beam']) {
      const runs = result[kind];
      runs.forEach((r) => ok(r.pixels > 0, kind + '.' + r.style + ' が1画素も描かれとらん'));
      for (let i = 1; i < runs.length; i++) {
        ok(runs[i - 1].hash !== runs[i].hash,
          kind + '.' + runs[i - 1].style + ' と ' + runs[i].style + ' の画素が一致しとる');
      }
      console.log(kind.padEnd(6) + '  ' + runs.map((r) => r.style + ':' + r.pixels + '/' + r.hash).join('  '));
    }
    ok(result.defaults.slash.omitted === result.defaults.slash.explicit,
      'style 未指定の slash が arc と一致せん');
    ok(result.defaults.beam.omitted === result.defaults.beam.explicit,
      'style 未指定の beam が straight と一致せん');
    ok(result.registration.label === '形', '技ラボに style の日本語ラベルが無い');
    ok(JSON.stringify(result.registration.slash) === JSON.stringify(['style', 'sel', ['arc', 'cross', 'thrust', 'fan', 'spiral']]),
      '技ラボの slash.style 選択肢が発注と違う');
    ok(JSON.stringify(result.registration.beam) === JSON.stringify(['style', 'sel', ['straight', 'wave', 'twin', 'spiral', 'cone']]),
      '技ラボの beam.style 選択肢が発注と違う');
    console.log('default  slash ' + result.defaults.slash.omitted + ' = arc ' + result.defaults.slash.explicit);
    console.log('default  beam  ' + result.defaults.beam.omitted + ' = straight ' + result.defaults.beam.explicit);
    console.log('movelab  style=' + result.registration.label + ' / slash・beam の選択肢 ok');

    await pg.locator('#style-verify').screenshot({ path: SHOT });
    await pg.close();
  } catch (e) {
    errs.push(e.stack || e.message || String(e));
  } finally {
    if (b) await b.close();
  }

  if (errs.length) {
    console.error(String.fromCharCode(10) + 'verify_style: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(String.fromCharCode(10) + 'verify_style: 全部通った   ' + path.relative(ROOT, SHOT));
  process.exit(0);
})();
