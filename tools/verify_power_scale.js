#!/usr/bin/env node
/* 威力連動：**絵と当たり判定が同じ倍率で動いとるか**を数える。
   使い方: node tools/verify_power_scale.js        （NGなら終了コード1）

   目視やと「なんとなく太くなった」で終わる。それやと当たり判定だけ等倍のまま
   取り残されても気付けん —— 実際それが起きとった（docs/設計メモ_威力連動.md §3-4・§3-5）。
   だから **描かれた画素を数えて、判定の値と比を取る**。

   a … 攻撃0/50/100 で描画画素が単調に増える（本演出が伸縮しとる証拠）
   b … halfWidth ÷ 実際に描かれた帯の半幅 が3段でほぼ一定（絵と判定がズレとらん証拠）
   補助 … ProjectileFX.radius が fxVisualScale と完全に同じ式で動く
   決定論 … 掟1。powerLevel はステータスから決まる純関数やが、必ず確かめる */
const path = require('path');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const ROOT = path.join(__dirname, '..');
const DIST_URL = 'file://' + path.join(ROOT, 'dist') + '/';
const SHOT = path.join(__dirname, '_power-scale-shot.png');
const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

/* 攻撃 0 / 50 / 100 に相当する powerLevel（launch() の Math.max(0,Math.min(1,atk/100))） */
const LEVELS = [0, 0.5, 1];

(async () => {
  const errs = [];
  const ok = (c, w) => { if (!c) errs.push(w); };
  let b;
  try {
    b = await chromium.launch(LAUNCH);
    offlineFonts(b);
    const pg = await b.newPage({ viewport: { width: 820, height: 700 } });
    pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await pg.goto(DIST_URL + 'shioumon_field_test.html');
    await pg.waitForTimeout(1200);

    const scale = await pg.evaluate((levels) => {
      const CW = 300, CH = 200, CY = 100, PROBE_X = 140;
      const opaque = (cv) => {
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
        return n;
      };
      /* 実際に描かれた帯の半幅。パレットの一番外側の色だけを数える ——
         圧力脈も気泡も P[0]/P[1] しか使わんけん、最後の添字は核の帯の専用色になる。
         つまりノイズ抜きで「絵の太さ」だけを抜き出せる。 */
      const drawnHalf = (cv, rgb) => {
        const d = cv.getContext('2d').getImageData(PROBE_X, 0, 1, cv.height).data;
        let max = -1;
        for (let y = 0; y < cv.height; y++) {
          const i = y * 4;
          if (d[i + 3] === 255 && d[i] === rgb[0] && d[i + 1] === rgb[1] && d[i + 2] === rgb[2]) {
            const dist = Math.abs(y - CY);
            if (dist > max) max = dist;
          }
        }
        return max;
      };

      /* ---- 光線側（hydro_pump）：絵と halfWidth ---- */
      const beam = levels.map((level) => {
        const sp = makeSpec('hydro_pump', 4242, '威力連動 verify', '水');
        sp.powerLevel = level;
        const cv = mkCv(CW, CH), g = cv.getContext('2d');
        const fx = new HydroPumpFX(sp, { x: 40, y: CY }, { x: 240, y: CY }, buildEffect(sp), null);
        fx.time = 0.7;                       // charge+fire を過ぎ、fade の前
        fx.draw(g);
        const P = sp.palette;
        const half = drawnHalf(cv, hexRGB(P[P.length - 1]));
        return { level, canvas: cv, pixels: opaque(cv), halfWidth: fx.halfWidth,
                 drawn: half, sz: fxVisualScale(sp, 'size') };
      });

      /* ---- 弾側（electro_ball）：radius が fxVisualScale とぴったり同じか ---- */
      const ball = levels.map((level) => {
        const sp = makeSpec('electro_ball', 4242, '威力連動 verify', '雷');
        sp.powerLevel = level;
        const fx = new ElectroBallFX(sp, { x: 40, y: CY }, { x: 240, y: CY }, buildEffect(sp), null);
        const sz = fxVisualScale(sp, 'size');
        return { level, radius: fx.radius, sz, expect: Math.max(3, 32 / 2) * sz };
      });

      /* ---- 見た目を1枚残す（人が後から見られるように） ---- */
      const old = document.getElementById('power-verify');
      if (old) old.remove();
      const root = document.createElement('main');
      root.id = 'power-verify';
      root.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;box-sizing:border-box;'
        + 'width:800px;padding:18px;background:#10141c;color:#e8edf5;font:14px sans-serif';
      const title = document.createElement('h1');
      title.textContent = 'power scale — hydro_pump（絵と当たり判定）';
      title.style.cssText = 'font-size:18px;margin:0 0 14px';
      root.appendChild(title);
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px';
      beam.forEach((r) => {
        const cell = document.createElement('section');
        cell.style.cssText = 'background:#181e29;border:1px solid #313b4b;padding:6px;text-align:center';
        const label = document.createElement('div');
        label.textContent = 'atk' + Math.round(r.level * 100) + ' · ' + r.pixels + ' px · '
          + 'halfWidth ' + r.halfWidth.toFixed(2) + ' · 実測 ' + r.drawn;
        label.style.cssText = 'font-size:11px;margin-bottom:4px';
        r.canvas.style.cssText = 'display:block;width:100%;height:150px;object-fit:contain;'
          + 'image-rendering:pixelated;background:#0b0e14';
        cell.append(label, r.canvas); row.appendChild(cell);
      });
      root.appendChild(row);
      document.body.appendChild(root);

      return {
        beam: beam.map((r) => ({ level: r.level, pixels: r.pixels, halfWidth: r.halfWidth,
                                 drawn: r.drawn, sz: r.sz })),
        ball
      };
    }, LEVELS);

    /* ---- a：本演出が伸縮しとるか（画素が単調に増える） ---- */
    for (let i = 1; i < scale.beam.length; i++) {
      ok(scale.beam[i].pixels > scale.beam[i - 1].pixels,
        'a: hydro_pump の描画画素が増えとらん atk' + Math.round(scale.beam[i - 1].level * 100)
        + '=' + scale.beam[i - 1].pixels + ' → atk' + Math.round(scale.beam[i].level * 100)
        + '=' + scale.beam[i].pixels);
    }
    console.log('a 画素    ' + scale.beam.map((r) => 'atk' + Math.round(r.level * 100) + ':' + r.pixels).join('  '));

    /* ---- b：halfWidth ÷ 実測半幅 が3段で一定（絵と判定が同じ倍率） ---- */
    scale.beam.forEach((r) => ok(r.drawn > 0,
      'b: atk' + Math.round(r.level * 100) + ' で帯の色が1画素も見つからん（測り方が壊れとる）'));
    const ratios = scale.beam.map((r) => r.halfWidth / r.drawn);
    const rMin = Math.min.apply(null, ratios), rMax = Math.max.apply(null, ratios);
    /* 許容幅は pxLine 内部の Math.round() による画素丸めのためだけ。
       式が別物になっとる不具合（判定だけ等倍）は 0.25 では到底収まらん。 */
    const spread = (rMax - rMin) / rMin;
    ok(spread < 0.25, 'b: halfWidth と絵の幅の比が揃っとらん（ズレ ' + (spread * 100).toFixed(1)
      + '%）比=' + ratios.map((v) => v.toFixed(3)).join(' '));
    console.log('b 比      ' + scale.beam.map((r, i) => 'atk' + Math.round(r.level * 100) + ':'
      + r.halfWidth.toFixed(2) + '/' + r.drawn + '=' + ratios[i].toFixed(3)).join('  ')
      + '   ズレ ' + (spread * 100).toFixed(1) + '%');

    /* ---- 補助：ProjectileFX.radius が fxVisualScale と完全一致 ---- */
    for (let i = 1; i < scale.ball.length; i++) {
      ok(scale.ball[i].radius > scale.ball[i - 1].radius,
        '補助: electro_ball の radius が増えとらん atk' + Math.round(scale.ball[i].level * 100));
    }
    scale.ball.forEach((r) => ok(Math.abs(r.radius - r.expect) < 0.01,
      '補助: radius が fxVisualScale と別の式で動いとる atk' + Math.round(r.level * 100)
      + ' radius=' + r.radius + ' 期待=' + r.expect));
    console.log('補助 判定 ' + scale.ball.map((r) => 'atk' + Math.round(r.level * 100) + ':radius '
      + r.radius.toFixed(2) + '(sz ' + r.sz.toFixed(2) + ')').join('  '));

    /* ---- 決定論（掟1） ---- */
    const det = await pg.evaluate(() => { const r = determinismTest(); return { ok: r.ok, at: r.at }; });
    ok(det.ok, '威力連動を触ったら決定論が落ちた（掟1）at=' + det.at);
    console.log('決定論    ' + (det.ok ? 'ok' : 'NG'));

    await pg.locator('#power-verify').screenshot({ path: SHOT });
    /* defect2（movelab.jsのトグル）と c/d/e のチェックはここに続けて足す（別タスクで拡張） */
    await pg.close();
  } catch (e) {
    errs.push(e.stack || e.message || String(e));
  } finally {
    if (b) await b.close();
  }

  if (errs.length) {
    console.error(String.fromCharCode(10) + 'verify_power_scale: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(String.fromCharCode(10) + 'verify_power_scale: 全部通った   ' + path.relative(ROOT, SHOT));
  process.exit(0);
})();
