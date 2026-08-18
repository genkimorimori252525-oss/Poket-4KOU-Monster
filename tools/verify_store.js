/* 保存がファイルへ行っとるか、file:// では今までどおりか（SAVE-01〜06）。
   使い方:  node tools/verify_store.js        （NGなら終了コード1）

   見るのは3つ:
   1. サーバー経由で開いたら、data/ の個体が読み込まれとるか（STORE_MODE='files'）
   2. 保存すると data/ のファイルが実際に変わるか
   3. file:// で開いたら今までどおり localStorage か（掟「単体で開ける」を壊しとらんか） */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 8798;
const BASE = 'http://127.0.0.1:' + PORT;
const ROOT = path.join(__dirname, '..');
const FILE_URL = 'file://' + path.join(ROOT, 'dist') + '/';
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
    if (!up) { console.error('verify_store: サーバーが立たんかった'); process.exit(1); }

    b = await chromium.launch(LAUNCH);

    /* ---- 1. サーバー経由：ファイルから読めとるか ---- */
    const pg = await b.newPage({ viewport: { width: 420, height: 900 } });
    const perr = [];
    pg.on('pageerror', e => perr.push('PAGEERROR ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') perr.push('CONSOLE ' + m.text()); });
    await pg.goto(BASE + '/shioumon_creator.html');
    await pg.waitForTimeout(1500);

    const served = await pg.evaluate(() => {
      const raw = localStorage.getItem('shioumon_creator_slots') || '{}';
      let slots = {}; try { slots = JSON.parse(raw); } catch (e) {}
      const names = Object.keys(slots);
      let imgIsUrl = null, cryIsUrl = null;
      if (names.length) {
        const m = JSON.parse(slots[names[0]]);
        const im = m.images && m.images.normal;
        imgIsUrl = typeof im === 'string' ? im.slice(0, 5) !== 'data:' : null;
        cryIsUrl = m.cry && typeof m.cry.data === 'string' ? m.cry.data.slice(0, 5) !== 'data:' : null;
      }
      return { mode: window.STORE_MODE, note: window.STORE_NOTE, count: names.length, names, imgIsUrl, cryIsUrl,
               libCount: Object.keys(JSON.parse(localStorage.getItem('shioumon_move_lib_v1') || '{}')).length };
    });
    out['サーバー経由'] = served;
    if (served.mode !== 'files') errs.push('サーバー経由なのに STORE_MODE=' + served.mode);
    if (served.count !== 5) errs.push('個体が ' + served.count + '体（5体のはず）');
    if (served.libCount !== 2) errs.push('技の棚が ' + served.libCount + '本（2本のはず）');
    if (served.imgIsUrl === false) errs.push('写真が data URI のまま（URL で渡すはず。容量を食う）');
    if (served.cryIsUrl === false) errs.push('鳴き声が data URI のまま（URL で渡すはず）');
    perr.forEach(e => errs.push('[制作ツール] ' + e));

    /* ---- 2. 保存するとファイルが変わるか ---- */
    const target = path.join(ROOT, 'data', 'monsters', 'Mantis.json');
    const before = JSON.parse(fs.readFileSync(target, 'utf8'));
    const newAtk = (before.stats.atk === 41) ? 42 : 41;
    await pg.evaluate((atk) => {
      const raw = localStorage.getItem('shioumon_creator_slots');
      const slots = JSON.parse(raw);
      const key = Object.keys(slots).find(k => JSON.parse(slots[k]).id === 'Mantis');
      const m = JSON.parse(slots[key]);
      m.stats.atk = atk;
      slots[key] = JSON.stringify(m);
      localStorage.setItem('shioumon_creator_slots', JSON.stringify(slots));   /* 既存の保存経路と同じ */
    }, newAtk);
    let after = null;
    for (let i = 0; i < 30; i++) {
      await wait(200);
      after = JSON.parse(fs.readFileSync(target, 'utf8'));
      if (after.stats.atk === newAtk) break;
    }
    out['ファイルへ書けたか'] = { before: before.stats.atk, after: after && after.stats.atk, 期待: newAtk };
    if (!after || after.stats.atk !== newAtk) errs.push('保存してもファイルが変わらん（atk ' + (after && after.stats.atk) + '）');
    /* 元に戻す（検証で中身を変えっぱなしにせん） */
    if (after) { after.stats.atk = before.stats.atk; fs.writeFileSync(target, JSON.stringify(after, null, 2) + '\n'); }
    await pg.close();

    /* ---- 3. file:// では今までどおりか ---- */
    const pg2 = await b.newPage({ viewport: { width: 420, height: 900 } });
    const perr2 = [];
    pg2.on('pageerror', e => perr2.push('PAGEERROR ' + e.message));
    pg2.on('console', m => { if (m.type() === 'error') perr2.push('CONSOLE ' + m.text()); });
    await pg2.goto(FILE_URL + 'shioumon_creator.html');
    await pg2.waitForTimeout(1200);
    const local = await pg2.evaluate(() => ({ mode: window.STORE_MODE, note: window.STORE_NOTE }));
    out['file:// 直開き'] = local;
    if (local.mode !== 'localStorage') errs.push('file:// なのに STORE_MODE=' + local.mode);
    perr2.forEach(e => errs.push('[file://] ' + e));
    await pg2.close();

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
    console.error('verify_store: ' + errs.length + '件のエラー');
    errs.forEach(e => console.error('  ' + e));
  }
  process.exit(errs.length ? 1 : 0);
})();
