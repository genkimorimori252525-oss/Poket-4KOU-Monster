#!/usr/bin/env node
/* 技一覧（data/moves/library.json）の恒久的な回帰ゲート。design doc §6の1〜5を数える。
   使い方: node tools/verify_movelist.js        （NGなら終了コード1） */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const ROOT = path.join(__dirname, '..');
const LIB_PATH = path.join(ROOT, 'data', 'moves', 'library.json');
const DIST_URL = 'file://' + path.join(ROOT, 'dist') + '/';
const SHOT = path.join(__dirname, '_movelist-shot.png');
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
    await pg.goto(DIST_URL + 'shioumon_creator.html');
    await pg.waitForTimeout(500);

    const distCount = await pg.evaluate(() => STARTER_MOVES.length);
    ok(distCount > 0, 'dist/shioumon_creator.html の技棚（STARTER_MOVES）が0本になっとる');
    console.log('movelist  dist の技棚: ' + distCount + '本');

    /* idempotence（design doc §6-5）：tools/migrate_movelist.js を連続で走らせても
       library.json のバイト列が変わらん（技ネタ帳が既に廃止された定常状態でも成立する）。
       Playwright 不要、Node側だけ。 */
    const before = fs.readFileSync(LIB_PATH);
    execFileSync('node', [path.join(ROOT, 'tools', 'migrate_movelist.js')]);
    const after = fs.readFileSync(LIB_PATH);
    ok(before.equals(after), 'tools/migrate_movelist.js の再実行で library.json が変わっとる（idempotenceが崩れとる）');

    /* MOVELIST-GATE: 残りのチェック（made数の一致・生存確認・status別必須項目・idempotence）はここに続けて足す（別タスクで拡張） */

    await pg.locator('body').screenshot({ path: SHOT });
    await pg.close();
  } catch (e) {
    errs.push(e.stack || e.message || String(e));
  } finally {
    if (b) await b.close();
  }

  if (errs.length) {
    console.error(String.fromCharCode(10) + 'verify_movelist: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(String.fromCharCode(10) + 'verify_movelist: 全部通った');
  process.exit(0);
})();
