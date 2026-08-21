#!/usr/bin/env node
/* 14技が専用 generator だけで描かれ、既存素材を参照しとらんか。
   使い方: node tools/verify_signature_moves.js        （NGなら終了コード1） */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');
const { genStarterSource } = require('./gen_starter.js');

const ROOT = path.join(__dirname, '..');
const SHOT = path.join(__dirname, '_signature-moves-shot.png');
const EXPECTED = {
  'ハイドロポンプ': { generator: 'hydro_pump', className: 'HydroPumpFX', range: 'ranged', contract: 'beam', scales: true },
  'インファイト': { generator: 'close_combat', className: 'CloseCombatFX', range: 'melee', contract: 'none', scales: true },
  'かえんほうしゃ': { generator: 'flamethrower', className: 'FlamethrowerFX', range: 'ranged', contract: 'beam', scales: true },
  'ときのほうこう': { generator: 'roar_time', className: 'RoarOfTimeFX', range: 'ranged', contract: 'beam', scales: false },
  'サイコキネシス': { generator: 'psychokinesis', className: 'PsychokinesisFX', range: 'remote', contract: 'none', scales: true },
  'エレキボール': { generator: 'electro_ball', className: 'ElectroBallFX', range: 'ranged', contract: 'bullet', scales: true },
  'ソーラービーム': { generator: 'solar_beam', className: 'SolarBeamFX', range: 'ranged', contract: 'beam', scales: true },
  'ビック尻ドロップ': { generator: 'big_butt_drop', className: 'BigButtDropFX', range: 'melee',
    contract: 'none', anim: 'big_butt_drop', scales: true },
  '10まんボルト': { generator: 'ten_thousand_volt', className: 'TenThousandVoltFX', range: 'remote', contract: 'none', scales: true },
  '１００万ボルト': { generator: 'million_volt', className: 'MillionVoltFX', range: 'remote', contract: 'none', scales: true },
  '２ボルト': { generator: 'two_volt', className: 'TwoVoltFX', range: 'ranged', contract: 'bullet', scales: true },
  'ブラックキック': { generator: 'black_kick', className: 'BlackKickFX', range: 'melee', contract: 'none', scales: true },
  'ブラックパンチ': { generator: 'black_punch', className: 'BlackPunchFX', range: 'melee', contract: 'none', scales: true },
  'ブラックショット': { generator: 'black_shot', className: 'BlackShotFX', range: 'ranged', contract: 'bullet', scales: true }
};
const OLD_GENERATORS = ['projectile', 'beam', 'slash', 'lightning', 'aura', 'shatter'];
const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

(async () => {
  const errs = [];
  const ok = (c, w) => { if (!c) errs.push(w); };
  const battleSource = fs.readFileSync(path.join(ROOT, 'src', 'battle.tpl.html'), 'utf8');
  /* Phase 2.1（補助技）で f.stats.atk の直読みを statOf(f,'atk') 経由へ寄せた（4.5-2c）。
     バフが乗っとらん間は statOf() が f.stats.atk をそのまま返す（byte-identical、
     tools/verify_support.js で確認済み）けん、威力連動そのものは1ミリも変わっとらん。
     ここは「使用者の atk が本演出へ渡っとるか」の配線チェックやけん、正規表現も
     現在の読み口に合わせて更新する。 */
  ok(/powerLevel:Math\.max\(0,Math\.min\(1,\(\+statOf\(f,'atk'\)\|\|0\)\/100\)\)/.test(battleSource),
    '使用者の atk が本演出へ渡っとらん');
  ok(/spawnSubFX\(m\.fx,'fire'/.test(battleSource) && !/spawnSubFX\(mainFx/.test(battleSource),
    '威力連動が parts や背景側へ漏れとる');
  let b;
  try {
    b = await chromium.launch(LAUNCH);
    offlineFonts(b);
    const pg = await b.newPage({ viewport: { width: 930, height: 1050 } });
    pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await pg.setContent('<!doctype html><html><body></body></html>');
    await pg.addScriptTag({ path: path.join(ROOT, 'src', 'fx_core.js') });
    await pg.addScriptTag({ path: path.join(ROOT, 'src', 'anims.js') });
    await pg.addScriptTag({ path: path.join(ROOT, 'src', 'move_range.js') });
    const library = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'moves', 'library.json'), 'utf8'));
    await pg.addScriptTag({ content: genStarterSource(library) });
    await pg.addScriptTag({ path: path.join(ROOT, 'src', 'movelab.js') });

    const result = await pg.evaluate(({ expected, oldGenerators }) => {
      const names = Object.keys(expected);
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
      const advance = (fx, sec) => {
        const dt = 1 / 60;
        for (let t = 0; t < sec && fx.state !== 'dead'; t += dt) fx.update(dt);
      };
      const pts = { from: { x: 42, y: 70 }, to: { x: 218, y: 70 } };
      const phaseCanvas = (sp, phase) => {
        const cv = mkCv(260, 140), fx = spawnFX(sp, pts.from, pts.to, buildEffect(sp), null);
        const mark = sp.hitAt === undefined ? (sp.squeeze === undefined ? sp.dropAt : sp.squeeze) : sp.hitAt;
        if (phase === 'cast') {
          const t = mark !== undefined ? mark * 0.22
            : fx instanceof ProjectileFX ? fx.dur * 0.12
            : sp.charge === undefined ? 0.06 : Math.max(0.08, sp.charge * 0.58);
          advance(fx, t);
        } else if (phase === 'fire') {
          const t = sp.generator === 'close_combat' ? sp.interval * 3.2
            : mark !== undefined ? mark * 0.68
            : fx instanceof ProjectileFX ? fx.dur * 0.56
            : sp.charge + sp.fire + Math.min(0.18, sp.sustain * 0.35);
          advance(fx, t);
        } else {
          const t = sp.generator === 'close_combat' ? sp.interval * Math.max(0, sp.hits - 1) + 0.10
            : mark !== undefined ? mark + 0.14
            : fx instanceof ProjectileFX ? fx.dur + (sp.burst || 0.30) * 0.30
            : sp.charge + sp.fire + 0.12;
          advance(fx, t); if (!fx.hit) fx.doHit(); fx.if_ = 8;
        }
        fx.draw(cv.getContext('2d'));
        return { cv, className: fx.constructor.name, isBeam: fx instanceof BeamFX,
          isBullet: fx instanceof ProjectileFX,
          source: fx.constructor.prototype.draw.toString(), builtKeys: Object.keys(buildEffect(sp)) };
      };
      const renderMove = (move) => {
        const phases = ['cast', 'fire', 'impact'].map((p) => phaseCanvas(move.fx, p));
        return {
          name: move.name, generator: move.fx.generator, parts: move.fx.parts || [],
          range: MOVE_RANGE.rangeOf({ fx: move.fx }), className: phases[0].className,
          isBeam: phases[0].isBeam, isBullet: phases[0].isBullet,
          source: phases[0].source, builtKeys: phases[0].builtKeys,
          metric: measure(phases.map((p) => p.cv)), canvases: phases.map((p) => p.cv)
        };
      };
      const timeline = (sp) => {
        let hits = 0, hitFrame = -1, deadFrame = -1;
        const fx = spawnFX(sp, pts.from, pts.to, buildEffect(sp), () => { hits++; });
        for (let i = 0; i < 360; i++) {
          fx.update(1 / 60);
          if (fx.hit && hitFrame < 0) hitFrame = i;
          if (fx.state === 'dead') { deadFrame = i; break; }
        }
        return { hits, hitFrame, deadFrame, p: fx.p === undefined ? null : +fx.p.toFixed(4),
          time: +fx.time.toFixed(4) };
      };
      const moves = names.map((name) => STARTER_MOVES.find((m) => m.name === name)).filter(Boolean);
      const rows = moves.map(renderMove);
      const rerun = moves.map(renderMove);
      const low = moves.map((m) => renderMove({ ...m, fx: { ...m.fx, powerLevel: 0 } }).metric);
      const high = moves.map((m) => renderMove({ ...m, fx: { ...m.fx, powerLevel: 1 } }).metric);
      const lowTimeline = moves.map((m) => timeline({ ...m.fx, powerLevel: 0 }));
      const highTimeline = moves.map((m) => timeline({ ...m.fx, powerLevel: 1 }));
      const uses = {};
      for (const g of Object.values(expected).map((x) => x.generator))
        uses[g] = STARTER_MOVES.filter((m) => m.fx && m.fx.generator === g).map((m) => m.name);
      const registration = {};
      for (const g of Object.values(expected).map((x) => x.generator))
        registration[g] = { schema: !!SCHEMA[g], label: GEN_JP[g] || '', desc: GEN_DESC[g] || '',
          defaultGenerator: DEFAULTS[g] && DEFAULTS[g].generator };
      const animations = {};
      for (const [name, exp] of Object.entries(expected)) {
        if (!exp.anim) continue;
        const def = ANIMS[exp.anim];
        const sig = def && JSON.stringify(def.keys);
        animations[exp.anim] = {
          exists: !!def, label: ANIM_JP[exp.anim] || '', keyCount: def ? def.keys.length : 0,
          unique: !!def && !Object.entries(ANIMS).some(([key, other]) => key !== exp.anim && JSON.stringify(other.keys) === sig),
          users: STARTER_MOVES.filter((m) => (m.fx.motions || []).some((x) => x.anim === exp.anim)).map((m) => m.name),
          minDy: def ? Math.min(...def.keys.map((k) => k.dy)) : 0,
          maxDx: def ? Math.max(...def.keys.map((k) => k.dx)) : 0,
          maxSx: def ? Math.max(...def.keys.map((k) => k.sx)) : 0
        };
      }

      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0;background:#10141c;color:#e8edf5;font:14px sans-serif';
      const root = document.createElement('main');
      root.id = 'signature-moves-verify';
      root.style.cssText = 'box-sizing:border-box;width:910px;padding:18px;background:#10141c';
      const title = document.createElement('h1');
      title.textContent = '14技専用 generator（既存素材なし）';
      title.style.cssText = 'font-size:19px;margin:0 0 12px;color:#ffd170'; root.appendChild(title);
      for (const row of rows) {
        const h = document.createElement('h2');
        h.textContent = row.name + '  ·  ' + row.generator + '  ·  ' + row.className;
        h.style.cssText = 'font-size:13px;margin:10px 0 5px'; root.appendChild(h);
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px';
        row.canvases.forEach((cv, i) => {
          const cell = document.createElement('section');
          cell.style.cssText = 'background:#181e29;border:1px solid #313b4b;padding:5px;text-align:center';
          const label = document.createElement('div');
          label.textContent = ['構え', '発射', '着弾'][i]; label.style.cssText = 'font-size:11px;margin-bottom:3px';
          cv.style.cssText = 'display:block;width:100%;height:112px;image-rendering:pixelated;background:#0b0e14';
          cell.append(label, cv); grid.appendChild(cell);
        });
        root.appendChild(grid);
      }
      document.body.appendChild(root);

      return {
        found: moves.map((m) => m.name), uses, registration, animations,
        rows: rows.map((r, i) => ({ name: r.name, generator: r.generator, parts: r.parts.length,
          range: r.range, className: r.className, isBeam: r.isBeam, isBullet: r.isBullet, source: r.source,
          builtKeys: r.builtKeys, metric: r.metric, rerunHash: rerun[i].metric.hash,
          low: low[i], high: high[i], lowTimeline: lowTimeline[i], highTimeline: highTimeline[i],
          powerVisual: moves[i].fx.powerVisual || null,
          oldGeneratorInParts: r.parts.filter((p) => oldGenerators.includes(p.generator)).map((p) => p.generator) }))
      };
    }, { expected: EXPECTED, oldGenerators: OLD_GENERATORS });

    ok(result.found.length === Object.keys(EXPECTED).length,
      '14技のどれかが STARTER_MOVES に無い: ' + result.found.join(', '));
    for (const row of result.rows) {
      const exp = EXPECTED[row.name];
      ok(row.generator === exp.generator, row.name + ' が専用 generator ではない: ' + row.generator);
      ok(row.className === exp.className, row.name + ' が専用クラスではない: ' + row.className);
      ok(row.range === exp.range, row.name + ' の分類が違う: ' + row.range);
      ok(row.parts === 0, row.name + ' が既存 parts を使っとる');
      ok(row.oldGeneratorInParts.length === 0, row.name + ' が既存 generator を parts で参照しとる');
      ok(result.uses[row.generator].length === 1 && result.uses[row.generator][0] === row.name,
        row.generator + ' が他の技にも使い回されとる: ' + result.uses[row.generator].join(', '));
      const reg = result.registration[row.generator];
      ok(reg && reg.schema && reg.label && reg.desc && reg.defaultGenerator === row.generator,
        row.generator + ' の技ラボ登録が揃っとらん: ' + JSON.stringify(reg));
      ok(row.builtKeys.length === 0, row.name + ' が既存の焼き素材を持っとる: ' + row.builtKeys.join(', '));
      ok(!/super\.draw|drawImpact|ShatterFX|AuraFX|SlashFX|ProjectileFX|spawnSubFX/.test(row.source),
        row.name + ' の draw() が既存素材を呼んどる');
      ok(row.metric.pixels > 0, row.name + ' が1画素も描かれとらん');
      ok(row.metric.hash === row.rerunHash, row.name + ' の描画が同一条件で一致せん（決定論）');
      if (exp.contract === 'beam') ok(row.isBeam, row.name + ' が光線相殺の契約に乗っとらん');
      if (exp.contract === 'bullet') ok(row.isBullet && !row.isBeam, row.name + ' が弾相殺の契約に乗っとらん');
      if (exp.contract === 'none') ok(!row.isBeam && !row.isBullet, row.name + ' が不要な遠距離契約に乗っとる');
      if (exp.scales) {
        ok(row.powerVisual && row.powerVisual.size && row.powerVisual.amount,
          row.name + ' に威力連動範囲が設定されとらん');
        ok(row.low.hash !== row.high.hash && row.high.pixels > row.low.pixels,
          row.name + ' の本演出が攻撃0→100で増えとらん: ' + JSON.stringify({ low: row.low, high: row.high }));
      } else {
        ok(!row.powerVisual && row.low.hash === row.high.hash,
          row.name + ' は例外なのに威力で見た目が変わっとる');
      }
      ok(JSON.stringify(row.lowTimeline) === JSON.stringify(row.highTimeline),
        row.name + ' の威力連動が命中・寿命・移動へ影響しとる: '
          + JSON.stringify({ low: row.lowTimeline, high: row.highTimeline }));
      if (exp.anim) {
        const a = result.animations[exp.anim];
        ok(a && a.exists && a.label, row.name + ' の専用アニメーションが未登録');
        ok(a && a.keyCount >= 10 && a.unique, row.name + ' のアニメーションが独立したキー列ではない');
        ok(a && a.users.length === 1 && a.users[0] === row.name,
          exp.anim + ' が他の技にも使い回されとる: ' + (a ? a.users.join(', ') : 'missing'));
        ok(a && a.minDy <= -80 && a.maxDx >= 80 && a.maxSx >= 1.6,
          exp.anim + ' に跳躍・踏み込み・尻着地の変形が揃っとらん: ' + JSON.stringify(a));
      }
      console.log(row.name.padEnd(10) + ' ' + row.generator + '/' + row.className + '  '
        + row.metric.pixels + '/' + row.metric.hash + '  atk0=' + row.low.pixels + ' atk100=' + row.high.pixels
        + '  parts=0  range=' + row.range);
    }
    for (let i = 1; i < result.rows.length; i++)
      ok(result.rows[i - 1].metric.hash !== result.rows[i].metric.hash,
        result.rows[i - 1].name + ' と ' + result.rows[i].name + ' の画素が一致しとる');

    await pg.locator('#signature-moves-verify').screenshot({ path: SHOT });
    await pg.close();
  } catch (e) {
    errs.push(e.stack || e.message || String(e));
  } finally {
    if (b) await b.close();
  }

  if (errs.length) {
    console.error(String.fromCharCode(10) + 'verify_signature_moves: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(String.fromCharCode(10) + 'verify_signature_moves: 全部通った   ' + path.relative(ROOT, SHOT));
  process.exit(0);
})();
