const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const DIST_URL = 'file://' + path.join(__dirname, '..', 'dist') + '/';
const SHOTS = path.join(__dirname, '..', '.shots');
if(!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS,{recursive:true});
const shot = n => path.join(SHOTS, n);
/* Chromium が見つからんときは PW_CHROMIUM に実行ファイルのパスを入れる */
const LAUNCH = { args:['--autoplay-policy=no-user-gesture-required'] };
if(process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const results = {};
  const allErrs = [];
  for (const [name, file] of [
    ['音ラボ',   'shioumon_audio_lab.html'],
    ['技ラボ',   'shioumon_effect_lab.html'],
    ['戦闘',     'shioumon_field_test.html'],
    ['クリエーター','shioumon_creator.html'],
  ]) {
    const pg = await b.newPage({ viewport: { width: 420, height: 900 } });
    const errs = [];
    pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await pg.goto(DIST_URL + file);
    await pg.waitForTimeout(1200);
    // 音の解禁＋デコード
    let decoded = null;
    try {
      decoded = await pg.evaluate(async () => {
        if (typeof SND === 'undefined') return 'no SND';
        return await SND.resume();
      });
    } catch (e) { decoded = 'ERR ' + e.message; }
    await pg.waitForTimeout(4000);
    const info = await pg.evaluate(() => {
      if (typeof SND === 'undefined') return {};
      return {
        bank: Object.keys(SFX_SRC).length,
        decoded: Object.keys(SND.buf).length,
        cfgMoves: Object.keys(AUDIO_CFG.moves).length,
        cfgSys: Object.keys(AUDIO_CFG.system).length,
        ctx: SND.ctx ? SND.ctx.state : 'none',
      };
    });
    await pg.screenshot({ path: shot('v_' + file.replace(/\.html$/, '') + '.png'), fullPage: false });
    results[name] = { decoded, ...info, errs: errs.slice(0, 6) };
    // 表示用の errs.slice(...) は見た目の切り詰め。終了判定は切り詰めていない errs を allErrs へ移して行う
    errs.forEach(e => allErrs.push('[' + name + '] ' + e));
    await pg.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await b.close();
  if (allErrs.length) {
    console.error('verify_audio: ' + allErrs.length + '件のエラー');
    allErrs.forEach(e => console.error(e));
  }
  // 表示用に切り詰めた errs.slice(...) は終了判定に使わない（全件は allErrs で判定する）
  process.exit(allErrs.length ? 1 : 0);
})();
