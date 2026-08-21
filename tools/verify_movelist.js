#!/usr/bin/env node
/* 技一覧（data/moves/library.json）の恒久的な回帰ゲート。design doc §6の1〜5を数える。
   使い方: node tools/verify_movelist.js        （NGなら終了コード1） */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');
const { isMade } = require('./gen_starter.js');

const ROOT = path.join(__dirname, '..');
const LIB_PATH = path.join(ROOT, 'data', 'moves', 'library.json');
/* 亜空切断・灼熱弾・専用14本・爆撃。1本も欠けとらんかを見張る。 */
const MUST_SURVIVE = [
  '亜空切断', '灼熱弾', '10まんボルト', '１００万ボルト', '２ボルト', 'ハイドロポンプ',
  'インファイト', 'ブラックキック', 'ブラックパンチ', 'ブラックショット', 'ビック尻ドロップ',
  'かえんほうしゃ', 'ソーラービーム', 'エレキボール', 'サイコキネシス', 'ときのほうこう', '爆撃'
];
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

    const library = JSON.parse(fs.readFileSync(LIB_PATH, 'utf8'));

    /* 2. made数の一致（design doc §6-2） */
    const madeCount = Object.values(library).filter(isMade).length;
    ok(distCount === madeCount,
      'dist/ の技棚数が library.json の status:made の数と一致せん: ' + distCount + ' vs ' + madeCount);

    /* 4. 生存確認（design doc §6-4） */
    const names = Object.keys(library);
    for (const name of MUST_SURVIVE) {
      ok(names.includes(name), name + ' が library.json から消えとる');
    }

    /* 3. status別の必須項目（design doc §6-3） */
    let ideaCount = 0;
    for (const rec of Object.values(library)) {
      const status = rec.status || 'made';
      if (status === 'made') {
        ok(!!rec.name, '(made) name が無いレコードがある');
        ok(!!rec.fx, rec.name + ' (made) に fx が無い');
        ok(!!(rec.battle && rec.battle.type), rec.name + ' (made) に battle.type が無い');
        ok(!!(rec.battle && rec.battle.power !== undefined), rec.name + ' (made) に battle.power が無い');
        ok(!!(rec.battle && rec.battle.cast !== undefined), rec.name + ' (made) に battle.cast が無い');
        ok(!!(rec.battle && rec.battle.cooldown !== undefined), rec.name + ' (made) に battle.cooldown が無い');
      } else if (status === 'idea') {
        ideaCount++;
        ok(!!rec.name, '(idea) name が無いレコードがある');
        ok(!!(rec.battle && rec.battle.type), rec.name + ' (idea) に battle.type が無い');
        ok(!('fx' in rec), rec.name + ' (idea) が fx を持っとる（ネタの段階で数値を捏造しとる）');
      }
    }

    /* idempotence（design doc §6-5）：tools/migrate_movelist.js を連続で走らせても
       library.json のバイト列が変わらん（技ネタ帳が既に廃止された定常状態でも成立する）。
       Playwright 不要、Node側だけ。 */
    const before = fs.readFileSync(LIB_PATH);
    execFileSync('node', [path.join(ROOT, 'tools', 'migrate_movelist.js')]);
    const after = fs.readFileSync(LIB_PATH);
    ok(before.equals(after), 'tools/migrate_movelist.js の再実行で library.json が変わっとる（idempotenceが崩れとる）');

    console.log('movelist  made=' + madeCount + '  idea=' + ideaCount + '  エラー=' + errs.length + '件');

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
