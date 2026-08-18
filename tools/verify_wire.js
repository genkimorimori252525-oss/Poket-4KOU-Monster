/* 制作ツールで作った四皇モンが本当に戦闘に出るか（WIRE-01〜05）。
   使い方:  node tools/verify_wire.js        （NGなら終了コード1）

   これまで戦闘に出られたのはベタ書きの個体だけで、保存した個体の影も鳴き声も自作技も
   一度も読まれとらんかった。それが直ったことを、主張やのうて実行で示す。 */
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8799;
const BASE = 'http://127.0.0.1:' + PORT;
const ROOT = path.join(__dirname, '..');
const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const errs = [];
  const out = {};
  const srv = spawn('bun', [path.join('devshell', 'server.js'), String(PORT)],
                    { cwd: ROOT, stdio: 'ignore', shell: process.platform === 'win32' });
  let b = null;
  try {
    let up = false;
    for (let i = 0; i < 30; i++) {
      try { const r = await fetch(BASE + '/__shell/config.json'); if (r.ok) { up = true; break; } } catch (e) {}
      await wait(300);
    }
    if (!up) { console.error('verify_wire: サーバーが立たんかった'); process.exit(1); }

    b = await chromium.launch(LAUNCH);

    offlineFonts(b);
    const pg = await b.newPage({ viewport: { width: 420, height: 900 } });
    const perr = [];
    pg.on('pageerror', e => perr.push('PAGEERROR ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') perr.push('CONSOLE ' + m.text()); });
    await pg.goto(BASE + '/shioumon_field_test.html');
    await pg.waitForTimeout(1800);

    /* 1. 保存済みの個体が戦闘画面から見えるか */
    const seen = await pg.evaluate(() => {
      const m = (typeof ROSTER !== 'undefined') ? ROSTER.saved() : [];
      return { count: m.length, names: m.map(x => x._slot || x.name || x.id) };
    });
    out['保存済みが見えるか'] = seen;
    if (seen.count !== 5) errs.push('戦闘画面から見える保存個体が ' + seen.count + '体（5体のはず）');

    /* 2. 実際に編成して出す。影・鳴き声・自作技が積まれとるか */
    const fought = await pg.evaluate(async () => {
      const mons = ROSTER.saved();
      const by = {}; mons.forEach(m => { by[m._slot || m.name || m.id] = m; });
      const pick = (n) => ROSTER.toDef(by[n]);
      const a = pick('バゼルギウス'), e = pick('パルキア');
      const ok = rosterApply([a], [e]);
      await new Promise(r => setTimeout(r, 900));
      const f = partyA[0], g = partyB[0];
      return {
        applied: ok,
        手前: f.name, 奥: g.name,
        手前の影: f.shadow ? { scale: f.shadow.scale, alpha: f.shadow.alpha, follow: f.shadow.follow } : null,
        手前の鳴き声: f.cry ? f.cry.id : null,
        手前の技: f.moves.map(m => m && m.id),
        自作技がMOVESに入ったか: !!(MOVES['Bomb']),
        手前のcost: f.cost,
        写真が積まれたか: !!(f.imgs && (f.imgs.back || f.imgs.normal)),
      };
    });
    out['編成して出した'] = fought;
    if (!fought.applied) errs.push('編成の適用に失敗した');
    if (fought.手前 !== 'バゼルギウス') errs.push('手前が ' + fought.手前 + '（バゼルギウスのはず）');
    if (!fought.手前の影) errs.push('影が積まれとらん（WIRE-03）');
    if (!fought.手前の鳴き声) errs.push('鳴き声が積まれとらん（WIRE-04）');
    if (!fought.自作技がMOVESに入ったか) errs.push('自作技が MOVES に入っとらん（WIRE-02）');
    if (!fought.写真が積まれたか) errs.push('写真が積まれとらん');

    /* 3. 決定論が壊れとらんか（掟1）。保存個体を出した状態で確かめる */
    await pg.waitForTimeout(500);
    const det = await pg.evaluate(() => {
      const r = determinismTest();
      return { ok: r.ok, len: r.len, at: r.at };
    });
    out['決定論'] = det;
    if (!det.ok) errs.push('保存個体を出したら決定論チェックが落ちた（掟1）at=' + det.at);

    /* 4. 草むらが戦闘側から読める形で置かれとるか（WIRE-05） */
    const wild = await fetch(BASE + '/data/wild-pool.json');
    out['草むら'] = { status: wild.status, 中身: await wild.json() };
    if (wild.status !== 200) errs.push('草むらのファイルが読めん（WIRE-05）');

    perr.forEach(e => errs.push('[戦闘] ' + e));
    await pg.close();
    console.log(JSON.stringify(out, null, 2));
  } finally {
    if (b) await b.close().catch(() => {});
    srv.kill();
    if (process.platform === 'win32') {
      try {
        require('child_process').execSync(
          'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ' + PORT +
          ' -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"',
          { stdio: 'ignore' });
      } catch (e) {}
    }
  }

  if (errs.length) {
    console.error('verify_wire: ' + errs.length + '件のエラー');
    errs.forEach(e => console.error('  ' + e));
  }
  process.exit(errs.length ? 1 : 0);
})();
