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
  const allErrs = [];

  /* ---------- 音ラボ ---------- */
  {
    const pg = await b.newPage({ viewport: { width: 420, height: 1000 } });
    const errs = [];
    pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION/.test(m.text())) errs.push('C ' + m.text()); });
    await pg.goto(DIST_URL + 'shioumon_audio_lab.html');
    await pg.waitForTimeout(800);
    await pg.click('#play');
    await pg.waitForTimeout(2000);
    await pg.screenshot({ path: shot('ui_audiolab_play.png') });
    // 音を追加 → ピッカーが開く
    await pg.click('.aui-add');
    await pg.waitForTimeout(400);
    const pickerOpen = await pg.locator('.aui-ov').count();
    await pg.screenshot({ path: shot('ui_picker.png') });
    // カテゴリを切り替えて1つえらぶ
    await pg.locator('.aui-cats button').nth(4).click();
    await pg.waitForTimeout(200);
    await pg.locator('.aui-item button').nth(1).click();
    await pg.waitForTimeout(500);
    const nEntries = await pg.locator('#timeline .aui-card').count();
    const saved = await pg.evaluate(() => {
      const s = localStorage.getItem('shioumon_audio_cfg_v1');
      const o = s && JSON.parse(s);
      return o ? { moves: Object.keys(o.moves).length, akuu: (o.moves.akuu || []).length } : null;
    });
    await pg.screenshot({ path: shot('ui_audiolab_added.png'), fullPage: true });
    // システム音の割り当てUI
    const nSys = await pg.locator('#sysMap .aui-sys').count();
    console.log('■ 音ラボ', JSON.stringify({ pickerOpen, nEntries, saved, nSys, errs }));
    errs.forEach(e => allErrs.push('[音ラボ] ' + e));
    await pg.close();
  }

  /* ---------- 技ラボ ---------- */
  {
    const pg = await b.newPage({ viewport: { width: 420, height: 1000 } });
    const errs = [];
    pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION/.test(m.text())) errs.push('C ' + m.text()); });
    await pg.goto(DIST_URL + 'shioumon_effect_lab.html');
    await pg.waitForTimeout(700);
    await pg.click('#sndOn');
    await pg.waitForTimeout(2500);
    await pg.click('#mFire');
    await pg.waitForTimeout(1500);
    const st = await pg.evaluate(() => ({ sndOn, sndMove, tl: document.querySelectorAll('#sndTL .aui-card').length }));
    await pg.screenshot({ path: shot('ui_lab_sound.png'), fullPage: true });
    console.log('■ 技ラボ', JSON.stringify({ ...st, errs }));
    errs.forEach(e => allErrs.push('[技ラボ] ' + e));
    await pg.close();
  }

  /* ---------- 戦闘 ---------- */
  {
    const pg = await b.newPage({ viewport: { width: 420, height: 1400 } });
    const errs = [];
    pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION/.test(m.text())) errs.push('C ' + m.text()); });
    await pg.goto(DIST_URL + 'shioumon_field_test.html');
    await pg.waitForTimeout(600);
    await pg.click('#sndOn');
    await pg.waitForTimeout(3000);
    // 30秒ぶんの試合を早送りではなく実時間で少しだけ回す
    await pg.waitForTimeout(6000);
    const det = await pg.evaluate(() => { const r = determinismTest(); return { ok: r.ok, len: r.len, at: r.at }; });
    const info = await pg.evaluate(() => ({
      stat: document.getElementById('sndStat').textContent,
      master: AUDIO_CFG.master,
      moves: Object.keys(AUDIO_CFG.moves),
      sys: Object.keys(AUDIO_CFG.system).length,
    }));
    await pg.screenshot({ path: shot('ui_battle_sound.png') });
    console.log('■ 戦闘', JSON.stringify({ det, info, errs: errs.slice(0, 5) }));
    errs.forEach(e => allErrs.push('[戦闘] ' + e));
    // 決定論チェック（D-08）：det.ok が false なら、JSエラーが無くても allErrs へ積む
    if (!det.ok) allErrs.push('[戦闘] 決定論チェック失敗 len=' + det.len + ' at=' + det.at);
    await pg.close();
  }

  await b.close();
  if (allErrs.length) {
    console.error('verify_ui: ' + allErrs.length + '件のエラー');
    allErrs.forEach(e => console.error(e));
  }
  // 表示用に切り詰めた errs.slice(...) は終了判定に使わない（全件は allErrs で判定する）
  process.exit(allErrs.length ? 1 : 0);
})();
