/* =========================================================
   四皇モン制作ツールの UI 検証
   影 / 写真の自動複製 / 初期化 / 技クリエーター / 鳴き声 / 草むら放流 を実際に触る。
   使い方: node tools/verify_creator.js
   ========================================================= */
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');
const path = require('path');
const fs = require('fs');
const DIST = 'file://' + path.join(__dirname, '..', 'dist') + '/';
const PNG  = path.join(__dirname, '..', 'assets', 'sprites', 'palkia_front.png');
const PNG2 = path.join(__dirname, '..', 'assets', 'sprites', 'palkia_back.png');
const SHOTS = path.join(__dirname, '..', '.shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const shot = n => path.join(SHOTS, n);

const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

/* 検証用の短いWAVをその場で作る（鳴き声アップロードのテスト用） */
function makeWav(sec, hz) {
  const rate = 8000, n = Math.floor(rate * sec);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const env = 1 - i / n;
    buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / rate) * 12000 * env), 44 + i * 2);
  }
  return buf;
}

/* range スライダは playwright では動かしにくいけん、値を入れて input を投げる */
async function setRange(pg, sel, n, v) {
  await pg.evaluate(([sel, n, v]) => {
    const r = document.querySelectorAll(sel)[n];
    if (!r) throw new Error('range が無い: ' + sel + '[' + n + ']');
    r.value = v;
    r.dispatchEvent(new Event('input', { bubbles: true }));
  }, [sel, n, v]);
}

(async () => {
  const b = await chromium.launch(LAUNCH);
  offlineFonts(b);
  const pg = await b.newPage({ viewport: { width: 420, height: 1100 } });
  const errs = [];
  /* 明示アサーション。tools/verify_support.js の ok(cond,msg) と同じ形で、
     同じ errs 配列へ積む（この配列が pageerror/console と一緒に最終的な終了コードを決める）。
     このファイルはもともと「値を出す→人が読む」だけやったが、02.1-02（補助技UI）の
     B5/B8 回帰は grep で捕まえられんかった経緯があるけん、実際にDOMを動かして
     assert する形に足す（plan-check N5）。 */
  const ok = (c, w) => { if (!c) errs.push(w); };
  pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/ERR_/.test(m.text())) errs.push('C ' + m.text()); });
  /* ダイアログは「表示できん端末」を想定して全部つっぱねる。
     それでも消せる・読み込めることを確かめる（confirm に頼っとらんかの確認） */
  const dialogs = [];
  pg.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });

  const out = {};
  await pg.goto(DIST + 'shioumon_creator.html');
  await pg.evaluate(() => localStorage.clear());
  await pg.reload();
  await pg.waitForTimeout(600);

  out['0_起動'] = await pg.evaluate(() => ({
    mon: typeof mon, preview: typeof previewKey, moves: mon.moves.length,
    shadow: !!mon.shadow, cry: !!mon.cry
  }));

  /* ---- 1. 影 ---- */
  await setRange(pg, '#shadowCtl input[type=range]', 0, 1.8);   // 大きさ
  await setRange(pg, '#shadowCtl input[type=range]', 2, 12);    // 横位置
  await setRange(pg, '#shadowCtl input[type=range]', 4, 0.5);   // 濃さ
  out['1_影'] = await pg.evaluate(() => ({ ...mon.shadow }));

  /* ---- 2. 写真：通常を入れたら未設定のスロットへ配られる ---- */
  await pg.setInputFiles('#imgFile', PNG);
  await pg.waitForTimeout(600);
  out['2_通常を入れた'] = await pg.evaluate(() => ({
    ...Object.fromEntries(SLOT_KEYS.map(k => [k, !!imgs[k]])),
    derived: { ...derived },
    背面は通常と同じ: imgs.back === imgs.normal
  }));
  /* 背面だけ別の写真にする → derived が外れる */
  await pg.evaluate(() => { slot = 'back'; buildSlots(); });
  await pg.setInputFiles('#imgFile', PNG2);
  await pg.waitForTimeout(600);
  out['3_背面を差し替え'] = await pg.evaluate(() => ({
    derived: { ...derived }, 背面は別物: imgs.back !== imgs.normal
  }));
  /* 「通常の写真にもどす」 */
  await pg.click('#btnSameAsNormal');
  await pg.waitForTimeout(200);
  out['4_通常へもどした'] = await pg.evaluate(() => ({
    derivedBack: derived.back, 同じ: imgs.back === imgs.normal
  }));
  await pg.screenshot({ path: shot('cr_image.png') });

  /* ---- 2.5 味方側は何をしても背面 ---- */
  out['4b_味方は常に背面'] = await pg.evaluate(() => {
    previewKey = null;
    const st = { anim: 'attack', t: 0.5 };
    const r = {};
    for (const k of ['normal', 'attack', 'hurt']) {
      r['味方_' + k] = resolve(k, true, st).key;
      r['敵_' + k]  = resolve(k, false, st).key;
    }
    previewKey = 'normal';
    return r;
  });

  /* ---- 2.6 待機モーションを切る ---- */
  await pg.evaluate(() => { sideA.anim = 'idle'; sideE.anim = 'idle'; });
  const 待機の動き = async () => {
    const a = await pg.evaluate(() => {
      const s = sampleAnim(ANIMS.idle, (sideE.anim === 'idle' && mon.idleMotion === false) ? 0 : sideE.t);
      return s.dy;
    });
    await pg.waitForTimeout(500);
    const b = await pg.evaluate(() => {
      const s = sampleAnim(ANIMS.idle, (sideE.anim === 'idle' && mon.idleMotion === false) ? 0 : sideE.t);
      return s.dy;
    });
    return Math.abs(a - b);
  };
  const 動く幅 = await 待機の動き();
  await pg.evaluate(() => { document.querySelectorAll('#baseCtl button')[0].click(); });
  await pg.waitForTimeout(200);
  const 止めた幅 = await 待機の動き();
  out['4c_待機モーション'] = {
    切る前の揺れ: +動く幅.toFixed(2), 切った後の揺れ: 止めた幅,
    ボタン: await pg.evaluate(() => document.querySelectorAll('#baseCtl button')[0].textContent),
    データ: await pg.evaluate(() => mon.idleMotion)
  };
  await pg.evaluate(() => { document.querySelectorAll('#baseCtl button')[0].click(); });

  /* ---- 2.7 出現：トレーナー戦は上から、草むらは下から。鳴き声は 0.5 秒あと ---- */
  await pg.evaluate(() => { mon.cry.id = 'hurt1'; });
  const 出方 = async (style) => {
    await pg.evaluate((st) => { mon.summon.style = st; buildSummon(); playAppear(); }, style);
    await pg.waitForTimeout(120);
    const a = await pg.evaluate(() => ({
      anim: sideE.anim, dy: Math.round(sampleAnim(ANIMS[sideE.anim], sideE.t).dy),
      鳴くまで残り: cryTimer == null ? null : +cryTimer.toFixed(2)
    }));
    await pg.waitForTimeout(150);
    const b = await pg.evaluate(() => ({ 鳴いた: cryTimer == null }));
    await pg.waitForTimeout(800);
    const c = await pg.evaluate(() => ({ 鳴いた: cryTimer == null }));
    return { ...a, '0.27秒では鳴いとらん': !b.鳴いた, '1.07秒後には鳴いた': c.鳴いた };
  };
  out['4d_出現トレーナー'] = await 出方('trainer');
  await pg.screenshot({ path: shot('cr_appear.png') });
  out['4e_出現草むら'] = await 出方('wild');
  await pg.evaluate(() => { mon.summon.style = 'trainer'; buildSummon(); });

  /* ---- 2.8 着地モーション（コマ割り＋振動） ---- */
  await pg.click('#landTab');
  await pg.waitForTimeout(200);
  await pg.click('#landSample');
  await pg.waitForTimeout(300);
  out['4f_着地モーション'] = await pg.evaluate(() => ({
    コマ数: mon.summon.land.length,
    合計秒: +landTotal().toFixed(2),
    並び: mon.summon.land.map(s => s.img + ':' + s.dur + (s.shake ? '/揺' + s.shake : '')),
    行UI: document.querySelectorAll('#landList .step').length,
    長さスライダの範囲: (()=>{ const r=document.querySelector('#landList .step input[type=range]');
      return r ? r.min+'〜'+r.max+' 刻み'+r.step : null; })()
  }));
  /* 着地したらコマ割りが流れて、写真が召喚に切り替わるか */
  let sawSummonImg = false, sawShake = false;
  for (let i = 0; i < 40 && !(sawSummonImg && sawShake); i++) {
    const r = await pg.evaluate(() => {
      const st = sideE.seqT != null ? landStepAt(sideE.seqT) : null;
      return { img: st && st.img, shake: st && st.shake, seq: sideE.seqT };
    });
    if (r.img === 'summon') sawSummonImg = true;
    if (r.shake > 0) sawShake = true;
    await pg.waitForTimeout(100);
  }
  out['4g_コマ割りが流れた'] = { 召喚写真になった: sawSummonImg, 振動した: sawShake };

  /* 見るだけで並びが書き換わらんこと（前は「見本を入れる」しか再生手段が無くて、
     見るたびに震え4/7・長さ0.30へ戻っとった） */
  await pg.evaluate(() => {
    mon.summon.land.forEach(s => { s.shake = 0; s.dur = 0.05; });
    buildLand(); refresh();
  });
  await pg.waitForTimeout(200);
  await pg.click('#landPlay');                       // ▶ いまの並びで見る
  await pg.waitForTimeout(400);
  const 再生後 = await pg.evaluate(() => mon.summon.land.map(s => s.dur + '/' + s.shake));
  await pg.click('#landLoop');                       // くり返す
  await pg.waitForTimeout(1200);
  const くり返し中 = await pg.evaluate(() => ({
    on: landLoop, 並び: mon.summon.land.map(s => s.dur + '/' + s.shake)
  }));
  /* 見本ボタンは一度目では置きかえん */
  await pg.click('#landSample');
  await pg.waitForTimeout(150);
  const 見本一度目 = await pg.evaluate(() => ({
    ラベル: document.getElementById('landSample').textContent,
    並び: mon.summon.land.map(s => s.dur + '/' + s.shake)
  }));
  await pg.click('#landSample');                     // 二度目でようやく置きかえ
  await pg.waitForTimeout(300);
  const 見本二度目 = await pg.evaluate(() => mon.summon.land.map(s => s.dur + '/' + s.shake));
  await pg.click('#landLoop');
  out['4g3_見るだけでは変わらん'] = {
    自分で設定した値: '0.05/0',
    再生しても同じ: 再生後.every(v => v === '0.05/0'),
    くり返し中も同じ: くり返し中.on && くり返し中.並び.every(v => v === '0.05/0'),
    見本は一度目では入らん: 見本一度目.並び.every(v => v === '0.05/0'),
    見本ボタンの確認文: 見本一度目.ラベル,
    二度目でようやく見本: 見本二度目.join(' ')
  };
  /* 震えるのは本体だけ。背景（fieldTmp の貼り位置）は動かん */
  out['4g2_震えるのは本体だけ'] = await pg.evaluate(() => {
    const src = drawMon.toString(), src2 = drawPreview.toString();
    return {
      本体に足しとる: /px=L\.cx\+s\.dx\*dir\+vx/.test(src),
      背景には足しとらん: /drawImage\(fieldTmp,off\.x,off\.y\)/.test(src2)
    };
  });
  await pg.click('#landTab');
  await pg.click('#anim0');

  /* ---- 2.9 体力1/3以下で待機が遅くなる ---- */
  out['4h_瀕死の待機'] = await pg.evaluate(() => {
    sideE.anim = 'idle'; sideE.t = 0;
    const step = (weak) => { weakPreview = weak; sideE.t = 0; stepAnim(sideE, 1.0); return sideE.t; };
    const ふつう = step(false), 瀕死 = step(true);
    weakPreview = false;
    return { ふつう: +ふつう.toFixed(4), 瀕死: +瀕死.toFixed(4),
             比: +(瀕死 / ふつう).toFixed(2) };
  });

  /* ---- 3. 技クリエーター ---- */
  await pg.click('#btnNewMove');
  await pg.waitForTimeout(400);
  out['5_新しい技'] = await pg.evaluate(() => ({
    n: mon.customMoves.length, id: mon.customMoves[0].id,
    editorOpen: document.getElementById('mvEditor').style.display !== 'none',
    MOVESに登録: !!MOVES[mon.customMoves[0].id],
    フレーム: document.querySelectorAll('#mvFrames canvas').length
  }));
  /* generator を斬撃に切り替える */
  await pg.evaluate(() => {
    const bs = [...document.querySelectorAll('#mvGens button')];
    bs.find(x => x.textContent === '斬撃').click();
  });
  await pg.waitForTimeout(400);
  out['6_斬撃へ'] = await pg.evaluate(() => ({
    gen: mon.customMoves[0].fx.generator,
    フレーム: document.querySelectorAll('#mvFrames canvas').length,
    params: document.querySelectorAll('#mvParams .ml-ctl').length
  }));
  /* パラメータを1つ動かす */
  await setRange(pg, '#mvParams input[type=range]', 0, 200);
  await pg.waitForTimeout(300);
  out['7_パラメータ'] = await pg.evaluate(() => ({ size: mon.customMoves[0].fx.size }));
  /* 覚えさせて撃つ */
  await pg.evaluate(() => toggleMove(mon.customMoves[0].id));
  await pg.click('#mvFire');
  await pg.waitForTimeout(500);
  out['8_撃った'] = await pg.evaluate(() => ({ fx: fxs.length, anim: sideA.anim }));
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: shot('cr_move.png') });

  /* ---- 3.1 補助技：攻撃/補助トグルの即時反映（B8）・技棚round-trip・power:0の生存（B5） ----
     自分専用の技を1本作って最後に消す。mon.customMoves[0]（このあとの節が触る）はそのまま残す。 */
  await pg.evaluate(() => { newMove(); });
  await pg.waitForTimeout(300);
  const supId = await pg.evaluate(() => editMove.id);

  const beforeToggle = await pg.evaluate(() => ({
    威力あり: [...document.querySelectorAll('#mvBase .ctl')]
      .some(d => d.querySelector('label') && d.querySelector('label').textContent === '威力'),
    効果入力あり: !!document.getElementById('mvEffStat')
  }));
  ok(beforeToggle.威力あり && !beforeToggle.効果入力あり,
     '前提が崩れとる：新規技は既定で攻撃のはずが威力/効果の出方がおかしい: ' + JSON.stringify(beforeToggle));
  /* トグルを実際に操作する（selectOption は change イベントを発火させる） */
  await pg.selectOption('#mvKind', 'support');
  await pg.waitForTimeout(150);
  const afterToggle = await pg.evaluate(() => ({
    kind: editMove.kind, power: editMove.power, effect: { ...editMove.effect },
    威力あり: [...document.querySelectorAll('#mvBase .ctl')]
      .some(d => d.querySelector('label') && d.querySelector('label').textContent === '威力'),
    効果入力あり: !!document.getElementById('mvEffStat'),
    対象入力あり: !!document.getElementById('mvEffTarget'),
    MOVESに反映: MOVES[editMove.id] ? { kind: MOVES[editMove.id].kind, effect: MOVES[editMove.id].effect } : null
  }));
  ok(afterToggle.kind === 'support' && afterToggle.power === 0,
     'トグルで c.kind==="support" / c.power=0 にならん: ' + JSON.stringify(afterToggle));
  ok(!afterToggle.威力あり,
     'B8: 補助に切り替えても、閉じ直しなしで威力スライダが消えん（mvRebuild()呼びに戻っとらんか）');
  ok(afterToggle.効果入力あり && afterToggle.対象入力あり,
     'B8: 補助に切り替えても、閉じ直しなしで効果入力(効果/対象)が出らん');
  ok(!!afterToggle.MOVESに反映 && afterToggle.MOVESに反映.kind === 'support' && !!afterToggle.MOVESに反映.effect,
     'syncCustom() が MOVES[id] へ kind/effect を運んどらん: ' + JSON.stringify(afterToggle.MOVESに反映));
  ok(JSON.stringify(afterToggle.effect) === JSON.stringify({ stat: 'atk', delta: 20, dur: 15, target: 'self' }),
     '既定効果が {atk,delta:20,dur:15,target:self} やない（plan-check R4、勝てる領域からズレとる）: ' +
     JSON.stringify(afterToggle.effect));
  out['8h_補助トグル即時反映'] = { beforeToggle, afterToggle };

  /* spd を選んだときだけ「次の技から」の注記が出るか */
  await pg.selectOption('#mvEffStat', 'spd');
  await pg.waitForTimeout(150);
  const spdState = await pg.evaluate(() => ({
    注記あり: !!document.getElementById('mvSpdNote'), stat: editMove.effect.stat
  }));
  ok(spdState.注記あり, 'spd効果を選んでも「次の技から効く」の注記が出らん（W1のUI半分）');
  out['8i_spd注記'] = spdState;

  /* 技棚（localStorage）round-trip：def+18/12秒/相手 で保存し、nested battle.kind/battle.effect を直接見る */
  await pg.selectOption('#mvEffStat', 'def');
  await pg.waitForTimeout(80);
  await pg.evaluate(() => { editMove.effect.delta = 18; editMove.effect.dur = 12; mvRebuild(); });
  await pg.selectOption('#mvEffTarget', 'foe');
  await pg.waitForTimeout(150);
  await pg.evaluate(() => {
    document.querySelector('#mvLib input[type=text]').value = '__verify補助技棚__';
    document.querySelector('#mvLib .ml-bar button').click();
  });
  await pg.waitForTimeout(300);
  const shelfRec = await pg.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('shioumon_move_lib_v1') || '{}');
    const r = lib['__verify補助技棚__'];
    return { kind: r && r.battle && r.battle.kind, effect: r && r.battle && r.battle.effect };
  });
  ok(shelfRec.kind === 'support',
     '技棚(shioumon_move_lib_v1)のbattle.kindが"support"やない: ' + JSON.stringify(shelfRec));
  ok(!!shelfRec.effect && shelfRec.effect.stat === 'def' && shelfRec.effect.delta === 18 &&
     shelfRec.effect.dur === 12 && shelfRec.effect.target === 'foe',
     '技棚(shioumon_move_lib_v1)のbattle.effectが入力と一致せん: ' + JSON.stringify(shelfRec.effect));
  out['8j_技棚に保存'] = shelfRec;

  /* 棚から customMoves[] へ読込み直し、フラットな kind/effect が元と一致するか */
  await pg.evaluate(() => {
    const rows = [...document.querySelectorAll('#mvLib .ml-ctl')];
    const row = rows.find(r => r.querySelector('label') && r.querySelector('label').textContent === '__verify補助技棚__');
    row.querySelectorAll('button')[0].click();
  });
  await pg.waitForTimeout(300);
  const shelfLoaded = await pg.evaluate(() => {
    const c = mon.customMoves[mon.customMoves.length - 1];
    return { id: c.id, kind: c.kind, effect: { ...c.effect } };
  });
  ok(shelfLoaded.kind === 'support',
     '技棚から読込んだ customMoves[] のkindが"support"やない: ' + JSON.stringify(shelfLoaded));
  ok(shelfLoaded.effect.stat === 'def' && shelfLoaded.effect.delta === 18 &&
     shelfLoaded.effect.dur === 12 && shelfLoaded.effect.target === 'foe',
     '技棚から読込んだ effect が保存前と一致せん: ' + JSON.stringify(shelfLoaded.effect));
  out['8k_技棚から読込'] = shelfLoaded;
  /* 読込んで開いた技（customMoves末尾）を消す */
  await pg.evaluate(() => { const c = editMove; editMove = null; delMove(c); });
  await pg.waitForTimeout(150);

  /* B5：power:0・cast:0 の補助技をスロットへ保存し、normalizeMon()（スロット読込と同じ経路）を
     通しても両方とも 0 のまま残るか（+0||20 / +0||0.3 の再発防止）。 */
  await pg.evaluate((id) => {
    const c = mon.customMoves.find(x => x.id === id);
    c.cast = 0;
    syncCustom();
  }, supId);
  await pg.waitForTimeout(80);
  await pg.evaluate(() => {
    document.getElementById('slotName').value = '__verify補助技0__';
    document.getElementById('slotSave').click();
  });
  await pg.waitForTimeout(300);
  const b5 = await pg.evaluate((id) => {
    const sl = JSON.parse(localStorage.getItem('shioumon_creator_slots') || '{}');
    const raw = JSON.parse(sl['__verify補助技0__']);
    const restored = normalizeMon(raw);
    const c = restored.customMoves.find(x => x.id === id);
    return { power: c && c.power, cast: c && c.cast, kind: c && c.kind };
  }, supId);
  ok(b5.power === 0,
     'B5: normalizeMon()を通した後、power:0の補助技が0のまま残らん（+0||20の再発）: ' + JSON.stringify(b5));
  ok(b5.cast === 0,
     'B5: normalizeMon()を通した後、cast:0が0.3へ戻っとる（+0||0.3の再発）: ' + JSON.stringify(b5));
  out['8l_power0が生き残る'] = b5;
  /* このテスト専用スロットを消す（後続節の名前空間を汚さん） */
  await pg.evaluate(() => {
    const sl = JSON.parse(localStorage.getItem('shioumon_creator_slots') || '{}');
    delete sl['__verify補助技0__'];
    localStorage.setItem('shioumon_creator_slots', JSON.stringify(sl));
  });

  /* このセクション専用の技を消して、customMoves[] を元の1本（mon.customMoves[0]）だけに戻す */
  await pg.evaluate((id) => {
    const c = mon.customMoves.find(x => x.id === id);
    if (c) { if (editMove === c) editMove = null; delMove(c); }
  }, supId);
  await pg.waitForTimeout(150);
  out['8m_後始末'] = await pg.evaluate(() => ({
    技の数: mon.customMoves.length, 残っとるID: mon.customMoves.map(c => c.id)
  }));

  /* ---- 3.5 内蔵技をそのまま編集する ---- */
  await pg.evaluate(() => {
    const row = [...document.querySelectorAll('#moveList .mv')]
      .find(r => r.querySelector('.nm').textContent.indexOf('白熱光線') === 0);
    row.querySelectorAll('button')[0].click();     // ✎
  });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { editMove.power = 55; editMove.name = '白熱光線'; mvRebuild(); });
  await pg.waitForTimeout(300);
  out['8b_内蔵技を編集'] = await pg.evaluate(() => ({
    編集中のID: editMove.id,
    名前は変わっとらん: editMove.name === '白熱光線',
    MOVESに反映: MOVES.beam.power,
    IDは固定: document.querySelectorAll('#mvBase input[type=text]')[1].disabled,
    一覧に編集済: [...document.querySelectorAll('#moveList .mv .nm')]
      .some(n => n.textContent.indexOf('白熱光線 編集済') === 0),
    技の数: mon.customMoves.length,
    消すボタン: document.getElementById('mvDel').textContent
  }));
  /* もとに戻す（二度押し） */
  await pg.click('#mvDel'); await pg.waitForTimeout(120);
  await pg.click('#mvDel'); await pg.waitForTimeout(400);
  out['8c_内蔵技を戻した'] = await pg.evaluate(() => ({
    威力がもどった: MOVES.beam.power,
    上書きが消えた: !mon.customMoves.some(c => c.id === 'beam'),
    一覧に残っとる: [...document.querySelectorAll('#moveList .mv .nm')]
      .some(n => n.textContent.indexOf('白熱光線') === 0)
  }));

  /* ---- 3.6 技ごとの「本体の動き」（いつ・どれだけ） ---- */
  await pg.evaluate(() => openMove(mon.customMoves[0]));
  await pg.waitForTimeout(300);
  await pg.evaluate(() => {
    const fx = editMove.fx;
    fx.motions = [
      { anim: 'charge', at: 'cast',   off: 0,    dur: 0.40 },
      { anim: 'attack', at: 'fire',   off: 0,    dur: 0.20 },   // 素早い突き
      { anim: 'jump',   at: 'impact', off: 0.30, dur: 1.20 }    // 当たった0.3秒後に跳ぶ
    ];
    buildMoveEditor();
  });
  await pg.waitForTimeout(300);
  out['8d_動きの設定'] = await pg.evaluate(() => ({
    数: editMove.fx.motions.length,
    見出し: [...document.querySelectorAll('#mvMotion .ml-box label')].map(l => l.textContent),
    行UI: document.querySelectorAll('#mvMotion .ml-box').length
  }));
  /* 実際に撃って、構え→発射→着弾で動きが切り替わるか */
  await pg.evaluate(() => { previewKey = null; sideA.anim = 'idle'; sideA.t = 0; fireMove(editMove.id); });
  const 見た = new Set();
  let 予約あり = false;
  for (let i = 0; i < 45; i++) {
    const r = await pg.evaluate(() => ({ anim: sideA.anim, dur: sideA.durOv, pend: pendingMotions.length }));
    見た.add(r.anim + (r.durOv || ''));
    if (r.pend > 0) 予約あり = true;
    await pg.waitForTimeout(80);
  }
  out['8e_動きが切り替わった'] = {
    出た動き: [...見た],
    構えの溜め: 見た.has('charge'), 発射の突き: 見た.has('attack'),
    着弾の跳び: 見た.has('jump'), ずらし予約が入った: 予約あり
  };
  /* 時間指定がアニメの速さを変えとるか */
  /* 往復横跳びが動きの選択肢に出て、実際に左右へ振れるか */
  out['8f2_往復横跳び'] = await pg.evaluate(() => {
    const opts = [...document.querySelectorAll('#mvMotion select')]
      .flatMap(s => [...s.options].map(o => o.textContent));
    const z = ANIMS.zigzag;
    const xs = [0.19, 0.45, 0.71].map(t => Math.round(sampleAnim(z, t).dx));
    return {
      選択肢にある: opts.includes('往復横跳び'),
      左右へ振れる: xs.join(' → '),
      ちゃんと往復: xs[0] < -20 && xs[1] > 20 && xs[2] < -10,
      残像あり: sampleAnim(z, 0.19).ghost > 0.5,
      制作ツールも残像を描く: /st\.trail\.push/.test(drawMon.toString())
    };
  });
  out['8f_かける時間'] = await pg.evaluate(() => {
    sideA.anim = 'attack'; sideA.t = 0; sideA.durOv = 0.20;
    stepAnim(sideA, 0.10);
    const 速い = sideA.t;
    sideA.anim = 'attack'; sideA.t = 0; sideA.durOv = 1.50;
    stepAnim(sideA, 0.10);
    const 遅い = sideA.t;
    sideA.durOv = null; sideA.anim = 'idle'; sideA.t = 0;
    return { '0.2秒指定': +速い.toFixed(3), '1.5秒指定': +遅い.toFixed(3),
             比: Math.round(速い / 遅い) };
  });
  /* ---- 3.7 技全体の速さ ---- */
  out['8g_技全体の速さ'] = await pg.evaluate(() => {
    const fx = editMove.fx;
    fx.timeScale = 0.5; mvRebuild();
    const mk = () => { fxs.length = 0; fireMove(editMove.id); };
    const 遅い = spawnFX(fx, { x: 0, y: 0 }, { x: 100, y: 0 }, editBuilt, null).ts;
    fx.timeScale = 2; mvRebuild();
    const 速い = spawnFX(fx, { x: 0, y: 0 }, { x: 100, y: 0 }, editBuilt, null).ts;
    /* 素材の遅れも一緒に伸び縮みするか */
    fx.timeScale = 0.5;
    fx.parts = [{ generator: 'shatter', seed: 1, palette: ['#fff', '#fff', '#fff', '#fff'],
                  at: 'impact', off: 0.4, anchor: 'to', dx: 0, dy: 0 }];
    const p = spawnSubFX(fx, 'impact', { from: { x: 0, y: 0 }, to: { x: 10, y: 0 } })[0];
    const 素材の待ち = p.delay;
    fx.parts = []; fx.timeScale = 1; mvRebuild();
    return { 'x0.5のとき': 遅い, 'x2のとき': 速い,
             '0.4秒ずらし→半速で': +素材の待ち.toFixed(2) };
  });
  await pg.evaluate(() => { editMove.fx.motions = []; buildMoveEditor(); });

  /* ---- 4. 内蔵技の複製 ---- */
  await pg.evaluate(() => copyBuiltin('akuu'));
  await pg.waitForTimeout(400);
  out['9_複製'] = await pg.evaluate(() => ({
    n: mon.customMoves.length,
    最後: mon.customMoves[mon.customMoves.length - 1].name,
    音: (mon.customMoves[mon.customMoves.length - 1].audio || []).length
  }));

  /* ---- 4b. 亜空切断の追い討ち（空間割れ）が制作ツールでも出るか ---- */
  out['9b_追い討ち'] = await pg.evaluate(() => ({
    技データが持っとる: !!MOVES.akuu.fx.shatter,
    共有関数: typeof spawnSubFX,
    着弾で生成: spawnSubFX(MOVES.akuu.fx, 'impact',
      { from: { x: 100, y: 100 }, to: { x: 200, y: 100 } }).length,
    構えでは生成せん: spawnSubFX(MOVES.akuu.fx, 'cast',
      { from: { x: 100, y: 100 }, to: { x: 200, y: 100 } }).length
  }));
  await pg.evaluate(() => { fxs.length = 0; toggleMove('akuu'); previewKey = null; fireMove('akuu'); });
  let sawShatter = false;
  for (let i = 0; i < 40 && !sawShatter; i++) {
    sawShatter = await pg.evaluate(() => fxs.some(f => f.sp && f.sp.generator === 'shatter'));
    if (!sawShatter) await pg.waitForTimeout(100);
  }
  out['9c_撃ったら割れた'] = { 空間割れが出た: sawShatter };
  await pg.screenshot({ path: shot('cr_akuu.png') });
  await pg.evaluate(() => { toggleMove('akuu'); });

  /* ---- 4b2. 演出素材：足す・位置・タイミング・消す ---- */
  await pg.evaluate(() => openMove(mon.customMoves.find(c => c.id === 'mv2')));  // 亜空切断・改
  await pg.waitForTimeout(400);
  out['9e_旧shatterを素材へ'] = await pg.evaluate(() => {
    const fx = mon.customMoves.find(c => c.id === 'mv2').fx;
    return { 旧キーが消えた: !fx.shatter, 素材数: (fx.parts || []).length,
             名前: fx.parts[0].name, 種類: fx.parts[0].generator,
             見出し: document.querySelector('#mvSub .ml-box label').textContent };
  });
  /* 素材を足して、位置とタイミングを動かす */
  await pg.evaluate(() => { document.querySelector('#mvSub .aui-add').click(); });
  await pg.waitForTimeout(300);
  await pg.evaluate(() => {                       // 2つ目の素材：雷を、撃った人の頭上へ、構えから0.3秒後
    const fx = mon.customMoves.find(c => c.id === 'mv2').fx;
    const p = fx.parts[1];
    p.generator = 'lightning'; p.name = '前ぶれの雷';
    p.anchor = 'from'; p.dx = -20; p.dy = -30; p.at = 'cast'; p.off = 0.3;
    buildMoveEditor();
  });
  await pg.waitForTimeout(400);
  out['9f_素材を足した'] = await pg.evaluate(() => {
    const fx = mon.customMoves.find(c => c.id === 'mv2').fx;
    return { 素材数: fx.parts.length,
             見出し: [...document.querySelectorAll('#mvSub .ml-box label')].map(l => l.textContent),
             スライダ数: document.querySelectorAll('#mvSub input[type=range]').length };
  });
  /* 構えの素材が「ずらした秒数のあと」に出るか */
  await pg.evaluate(() => { fxs.length = 0; toggleMove('mv2'); previewKey = null; fireMove('mv2'); });
  const at0 = await pg.evaluate(() => fxs.filter(f => f.sp && f.sp.generator === 'lightning').length);
  await pg.waitForTimeout(700);
  const at7 = await pg.evaluate(() => fxs.filter(f => f.sp && f.sp.generator === 'lightning').length);
  const born = await pg.evaluate(() => fxs.some(f => f.sp && f.sp.generator === 'lightning' && f.inner));
  out['9g_遅れて出る'] = { 予約された: at0, 待った後: at7, 中身ができた: born };
  await pg.screenshot({ path: shot('cr_parts.png') });
  /* 素材を消す（二度押し） */
  await pg.evaluate(() => {
    const box = document.querySelectorAll('#mvSub .ml-box')[1];
    box.querySelectorAll('button')[2].click();     // ▲ ▼ × の3つ目：1回目
  });
  await pg.waitForTimeout(150);
  const 素材一度目 = await pg.evaluate(() =>
    mon.customMoves.find(c => c.id === 'mv2').fx.parts.length);
  await pg.evaluate(() => {
    const box = document.querySelectorAll('#mvSub .ml-box')[1];
    box.querySelectorAll('button')[2].click();     // 2回目
  });
  await pg.waitForTimeout(300);
  out['9h_素材を消した'] = await pg.evaluate(() =>
    ({ 一度押しでは消えん: null, 素材数: mon.customMoves.find(c => c.id === 'mv2').fx.parts.length }));
  out['9h_素材を消した'].一度押しでは消えん = (素材一度目 === 2);
  await pg.evaluate(() => { toggleMove('mv2'); });

  /* ---- 4b3. 技そのものを一覧から消す（実際にタップする・二度押し） ---- */
  const 消す前 = await pg.evaluate(() => mon.customMoves.length);
  const delBtn = pg.locator('#moveList .mv.cus', { hasText: 'あたらしい技' })
                   .locator('button', { hasText: '×' });
  await delBtn.click();                        // 1回目：ほんとに消す？ に変わるだけ
  const 一度目 = await pg.evaluate(() => mon.customMoves.length);
  await pg.locator('#moveList .mv.cus')
          .locator('button', { hasText: '消す？' }).click();   // 2回目：消える
  await pg.waitForTimeout(400);
  out['9i_技を消した'] = await pg.evaluate(() => ({
    消す前: null, 一度押しでは消えん: null, 技の数: mon.customMoves.length,
    MOVESから消えた: !MOVES.mv1,
    覚えとる技から外れた: !mon.moves.includes('mv1'),
    一覧の行数: document.querySelectorAll('#moveList .mv.cus').length
  }));
  out['9i_技を消した'].消す前 = 消す前;
  out['9i_技を消した'].一度押しでは消えん = (一度目 === 消す前);

  /* ---- 4c. プレビュー固定と自動連射 ---- */
  const isMini = () => pg.evaluate(() => document.getElementById('top').classList.contains('mini'));
  const 技を開いた時点 = await isMini();          // openMove が自動で小さくしとるはず
  await pg.click('#btnMini');
  const 押して戻した = await isMini();
  await pg.click('#btnMini');
  const もう一度小さく = await isMini();
  const sticky = await pg.evaluate(() => getComputedStyle(document.getElementById('top')).position);
  await pg.click('#btnAuto');
  await pg.waitForTimeout(2600);
  out['9d_画面'] = {
    技を開いたら自動で小さく: 技を開いた時点, 押して戻る: !押して戻した, もう一度小さく,
    貼り付け: sticky,
    自動連射: await pg.evaluate(() => autoFire),
    連射で出た玉: await pg.evaluate(() => fxs.length)
  };
  await pg.click('#btnAuto');

  /* ---- 4d. 技の保存（ライブラリ） ---- */
  await pg.evaluate(() => openMove(mon.customMoves[0]));
  await pg.waitForTimeout(300);
  await pg.evaluate(() => {
    document.querySelector('#mvLib input[type=text]').value = 'とっておき';
    document.querySelector('#mvLib .ml-bar button').click();
  });
  await pg.waitForTimeout(300);
  out['9j_技を保存'] = await pg.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('shioumon_move_lib_v1') || '{}');
    const r = lib['とっておき'];
    return { 棚の数: Object.keys(lib).length, 名前: r && r.name,
             エフェクト: r && r.fx && r.fx.generator, 素材: r && (r.fx.parts || []).length,
             威力: r && r.battle && r.battle.power,
             一覧に出た: document.querySelectorAll('#mvLib .ml-ctl').length };
  });
  /* 別の技として読み込む */
  const 読込前 = await pg.evaluate(() => mon.customMoves.length);
  await pg.evaluate(() => {
    const rows = [...document.querySelectorAll('#mvLib .ml-ctl')];
    const row = rows.find(r => r.querySelector('label') &&
      r.querySelector('label').textContent === 'とっておき');
    row.querySelectorAll('button')[0].click();
  });
  await pg.waitForTimeout(400);
  out['9k_技を読込'] = await pg.evaluate(() => ({
    読込前: null, 技の数: mon.customMoves.length,
    増えた技: mon.customMoves[mon.customMoves.length - 1].name,
    素材も来た: (mon.customMoves[mon.customMoves.length - 1].fx.parts || []).length,
    編集画面が開いた: document.getElementById('mvEditor').style.display !== 'none'
  }));
  out['9k_技を読込'].読込前 = 読込前;

  /* ---- 4d2. ネタ帳の10個を棚に入れる ---- */
  await pg.click('#mvStarter');
  await pg.waitForTimeout(600);
  out['9m_ネタ帳を棚へ'] = await pg.evaluate(() => {
    const lib = mlLibAll();
    const names = STARTER_MOVES.map(m => m.name);
    const gens = names.map(n => lib[n] && lib[n].fx.generator);
    return {
      ネタ帳の数: names.length,
      棚に入った: names.filter(n => !!lib[n]).length,
      全部入った: names.every(n => !!lib[n]),
      タイプ網羅: new Set(STARTER_MOVES.map(m => m.battle.type)).size,
      generator一巡: [...new Set(gens)].sort().join(','),
      素材つき: names.filter(n => (lib[n].fx.parts || []).length).length,
      動きつき: names.filter(n => (lib[n].fx.motions || []).length).length,
      音は空: names.every(n => (lib[n].audio || []).length === 0),
      表示: document.getElementById('mvStarterState').textContent.slice(0, 24)
    };
  });
  /* 2回押しても、もう棚にあるものは触らん */
  await pg.click('#mvStarter');
  await pg.waitForTimeout(500);
  out['9n_二度押しても増えん'] = await pg.evaluate(() => ({
    棚の数: Object.keys(mlLibAll()).length,
    表示: document.getElementById('mvStarterState').textContent.indexOf('もう棚にある') >= 0
  }));
  /* 棚から読んで実際に撃てるか（素材ごと来るか） */
  await pg.evaluate(() => {
    [...document.querySelectorAll('#mvLib .ml-ctl')]
      .find(r => r.querySelector('label') && r.querySelector('label').textContent === 'タネマシンガン')
      .querySelectorAll('button')[0].click();
  });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { fxs.length = 0; previewKey = null; fireMove(editMove.id); });
  let 最大 = 0;
  for (let i = 0; i < 20; i++) {
    const n = await pg.evaluate(() => fxs.length);
    if (n > 最大) 最大 = n;
    await pg.waitForTimeout(80);
  }
  out['9o_棚から撃てる'] = { 名前: 'タネマシンガン', 同時に出た最大: 最大, 素材も来た: 最大 >= 4 };
  await pg.evaluate(() => { const c = editMove; editMove = null; delMove(c); });

  /* ---- 4e. 再生速度 ---- */
  /* 攻撃モーション(0.75秒)が終わらん 300ms のあいだで、進み具合を比べる */
  const 進み = async (v) => {
    await pg.selectOption('#fxSpeedSel', v);
    await pg.evaluate(() => { fxs.length = 0; sideA.anim = 'attack'; sideA.t = 0; });
    await pg.waitForTimeout(300);
    return pg.evaluate(() => ({ t: sideA.t, anim: sideA.anim }));
  };
  const s25 = await 進み('0.25'), s1 = await 進み('0.85'), s4 = await 進み('4');
  await pg.selectOption('#fxSpeedSel', '0.85');
  out['9l_再生速度'] = {
    'x0.25': +s25.t.toFixed(2) + ' ' + s25.anim,
    '等速(0.85)': +s1.t.toFixed(2) + ' ' + s1.anim,
    'x4':    +s4.t.toFixed(2) + ' ' + s4.anim,
    順番どおり: s25.t < s1.t && (s4.anim === 'idle' || s4.t > s1.t)
  };
  await pg.evaluate(() => { mon.customMoves.pop(); syncCustom(); buildMoveList(); buildMoveEditor(); });

  /* ---- 5. 鳴き声 ---- */
  await pg.evaluate(() => { mon.cry.id = 'hurt1'; buildCry(); refresh(); });
  await pg.evaluate(() => { document.querySelectorAll('#cryCtl .bar button')[0].click(); });
  await pg.waitForTimeout(200);
  out['10_鳴き声'] = await pg.evaluate(() => ({ ...mon.cry }));

  /* ---- 5b. 鳴き声：ファイル選択 ---- */
  const WAV = path.join(SHOTS, 'cry_test.wav');
  fs.writeFileSync(WAV, makeWav(0.25, 660));
  await pg.setInputFiles('#cryFile', WAV);
  await pg.waitForTimeout(1500);
  out['10b_自前の鳴き声'] = await pg.evaluate(() => ({
    id: mon.cry.id, KB: mon.cry.data ? Math.round(mon.cry.data.length / 1024) : 0,
    バンクに登録: !!SND.custom[mon.cry.id], デコード済み: !!SND.buf[mon.cry.id],
    表示: document.getElementById('cryState').textContent.slice(0, 40)
  }));

  /* ---- 5c. 鳴き声：ファイルを画面へ放り込む（ドラッグ＆ドロップ） ---- */
  await pg.evaluate(() => {
    mon.cry.id = null; mon.cry.data = null; buildCry(); refresh();
  });
  const wav2 = fs.readFileSync(path.join(SHOTS, 'cry_test.wav')).toString('base64');
  await pg.evaluate(async (b64) => {
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const file = new File([u8], 'nakigoe.wav', { type: 'audio/wav' });
    const dt = new DataTransfer(); dt.items.add(file);
    document.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
    document.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
  }, wav2);
  await pg.waitForTimeout(1500);
  out['10c_投げ込み'] = await pg.evaluate(() => ({
    id: mon.cry.id, デコード済み: !!SND.buf[mon.cry.id],
    表示: document.getElementById('cryState').textContent.slice(0, 40)
  }));
  /* 音声でも画像でもないものを投げたら、ちゃんと理由が出るか */
  await pg.evaluate(() => {
    const file = new File(['hello'], 'memo.txt', { type: 'text/plain' });
    const dt = new DataTransfer(); dt.items.add(file);
    document.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
  });
  await pg.waitForTimeout(300);
  out['10d_変なファイル'] = await pg.evaluate(() =>
    ({ 表示: document.getElementById('cryState').textContent.slice(0, 40) }));

  /* ---- 6. コスト / 自動保存 ---- */
  await pg.evaluate(() => { mon.name = 'テストモン'; mon.id = 'test_mon'; refresh(); });
  await pg.waitForTimeout(700);
  out['11_自動保存'] = await pg.evaluate(() => {
    const s = localStorage.getItem('shioumon_creator_auto');
    const o = s && JSON.parse(s);
    return o ? { name: o.name, 技: o.customMoves.length, 影: !!o.shadow, 鳴: o.cry.id,
                 画像: Object.entries(o.images).filter(([, v]) => v).map(([k]) => k),
                 KB: Math.round(s.length / 1024) } : null;
  });

  /* ---- 6b. 保存まわり ---- */
  await pg.evaluate(() => {
    document.getElementById('slotName').value = 'はじめの1体';
    document.getElementById('slotSave').click();
  });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => {
    document.getElementById('slotName').value = 'かぶる名前';
    document.getElementById('slotSave').click();
  });
  await pg.waitForTimeout(300);
  await pg.evaluate(() => {
    document.getElementById('slotName').value = 'かぶる名前';
    document.getElementById('slotSave').click();
  });
  await pg.waitForTimeout(300);
  await pg.evaluate(() => {
    document.getElementById('slotName').value = 'かぶる名前';
    document.getElementById('slotSave').click();
  });
  await pg.waitForTimeout(300);
  out['11b_名前がかぶった'] = await pg.evaluate(() => {
    const sl = JSON.parse(localStorage.getItem('shioumon_creator_slots') || '{}');
    return {
      入っとる名前: Object.keys(sl),
      前のが残っとる: !!sl['かぶる名前'],
      警告: document.getElementById('autoState').textContent.slice(0, 34),
      入力欄: document.getElementById('slotName').value
    };
  });

  /* 上書き保存：結びついたスロットへ書く（二度押し） */
  const 上書き前 = await pg.evaluate(() => ({
    結びつき: boundSlot, ボタン: document.getElementById('slotOver').textContent
  }));
  await pg.evaluate(() => { mon.name = 'うわがきモン'; refresh(); });
  await pg.waitForTimeout(600);
  await pg.click('#slotOver'); await pg.waitForTimeout(150);
  const 上書き一度目 = await pg.evaluate(() => {
    const sl = JSON.parse(localStorage.getItem('shioumon_creator_slots') || '{}');
    return { ラベル: document.getElementById('slotOver').textContent,
             中身: JSON.parse(sl[boundSlot]).name };
  });
  await pg.click('#slotOver'); await pg.waitForTimeout(400);
  out['11c_上書き保存'] = await pg.evaluate(() => {
    const sl = JSON.parse(localStorage.getItem('shioumon_creator_slots') || '{}');
    return { 結びつき: boundSlot, 中身: JSON.parse(sl[boundSlot]).name,
             スロット数: Object.keys(sl).length };
  });
  out['11c_上書き保存'].保存前の結びつき = 上書き前.結びつき;
  out['11c_上書き保存'].一度押しでは書かん = (上書き一度目.中身 !== 'うわがきモン');
  out['11c_上書き保存'].確認文 = 上書き一度目.ラベル;

  /* 相手側を保存した個体に差し替える */
  await pg.evaluate(() => {
    const k = Object.keys(loadSlots())[0];
    setFoe(k); buildFoe();
  });
  await pg.waitForTimeout(600);
  out['11d_相手を差し替え'] = await pg.evaluate(() => ({
    相手の名前: foe && foe.mon.name,
    自分とは別物: foe && foe.mon !== mon,
    奥に使われとる: subjE() === foe,
    手前は自分のまま: SELF.mon === mon,
    選択肢の数: document.querySelectorAll('#foeCtl select option').length
  }));
  await pg.screenshot({ path: shot('cr_foe.png') });

  /* 出現で「奥も鳴く」か。手前と奥、それぞれの鳴くまでで予約が入る */
  await pg.evaluate(() => {
    mon.cry.id = 'hurt1';
    foe.mon.cry = { id: 'hurt2', vol: 1, rate: 1 };
    mon.summon.cryDelay = 0.5;
    foe.mon.summon.cryDelay = 0.9;
    playAppear();
  });
  await pg.waitForTimeout(120);
  const 鳴き予約 = await pg.evaluate(() => ({
    手前: cryTimer == null ? null : +cryTimer.toFixed(2),
    奥:   cryTimerE == null ? null : +cryTimerE.toFixed(2)
  }));
  await pg.waitForTimeout(550);
  const 手前だけ鳴いた = await pg.evaluate(() => ({ 手前: cryTimer == null, 奥: cryTimerE == null }));
  await pg.waitForTimeout(700);
  const 両方鳴いた = await pg.evaluate(() => ({ 手前: cryTimer == null, 奥: cryTimerE == null }));
  out['11e_奥も鳴く'] = {
    予約: 鳴き予約,
    '手前が先に鳴く': 手前だけ鳴いた.手前 && !手前だけ鳴いた.奥,
    '最後は両方鳴いた': 両方鳴いた.手前 && 両方鳴いた.奥
  };

  /* 鳴くまでの秒が毎回 ±0.15 ゆらぐか（設定は 0.5 のまま） */
  out['11f_鳴き声のゆらぎ'] = await pg.evaluate(async () => {
    mon.summon.cryDelay = 0.5;
    const got = [];
    for (let i = 0; i < 24; i++) {
      playAppear();
      got.push(cryTimer);
      await new Promise(r => setTimeout(r, 12));
    }
    cryTimer = null; cryTimerE = null;
    const min = Math.min(...got), max = Math.max(...got);
    const ちがう値 = new Set(got.map(v => v.toFixed(3))).size;
    return {
      設定: 0.5, いちばん早い: +min.toFixed(3), いちばん遅い: +max.toFixed(3),
      ばらけた数: ちがう値,
      範囲におさまっとる: min >= 0.35 - 1e-9 && max <= 0.65 + 1e-9,
      ちゃんと散った: ちがう値 >= 8 && (max - min) > 0.10,
      マイナスにならん: (() => { mon.summon.cryDelay = 0;
        const a = []; for (let i = 0; i < 12; i++) { playAppear(); a.push(cryTimer); }
        mon.summon.cryDelay = 0.5; cryTimer = null; cryTimerE = null;
        return Math.min(...a) >= 0; })()
    };
  });
  await pg.evaluate(() => { setFoe(null); buildFoe(); });


  /* ---- 7. 草むらへ放つ ---- */
  await pg.click('#btnRelease');
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path: shot('cr_release_1.png') });
  await pg.waitForTimeout(1800);
  await pg.screenshot({ path: shot('cr_release_2.png') });
  await pg.waitForTimeout(2400);
  await pg.screenshot({ path: shot('cr_release_3.png') });
  out['12_放流'] = await pg.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('shioumon_wild_pool_v1') || '[]');
    return { 匹: a.length, name: a[0] && a[0].mon.name, cost: a[0] && a[0].cost,
             とじる有効: !document.getElementById('sceneClose').disabled };
  });
  await pg.click('#sceneClose');
  await pg.waitForTimeout(300);
  out['13_もどった'] = await pg.evaluate(() => ({
    scene: scene === null, 草むら一覧: document.querySelectorAll('#wildList .mv').length
  }));

  /* ---- 8. 初期化（二度押し） ---- */
  const 初期化前の名前 = await pg.evaluate(() => mon.name);
  await pg.click('#btnReset');
  await pg.waitForTimeout(150);
  const 初期化一度目 = await pg.evaluate(() => ({
    name: mon.name, ラベル: document.getElementById('btnReset').textContent }));
  await pg.click('#btnReset');
  await pg.waitForTimeout(600);
  out['14_初期化'] = await pg.evaluate(() => ({
    一度押しでは戻らん: null, 一度押しの表示: null,
    name: mon.name, 技: mon.customMoves.length, 画像: SLOT_KEYS.filter(k => imgs[k]).length,
    影: mon.shadow.scale, auto: localStorage.getItem('shioumon_creator_auto') ? 'のこっとる' : '消えた',
    草むら: JSON.parse(localStorage.getItem('shioumon_wild_pool_v1') || '[]').length,
    MOVES: Object.keys(MOVES).length
  }));
  out['14_初期化'].一度押しでは戻らん = (初期化一度目.name === 初期化前の名前 && 初期化前の名前 !== 'なまえ');
  out['14_初期化'].一度押しの表示 = 初期化一度目.ラベル;

  /* ---- 9. 復元（リロードして続きから） ---- */
  await pg.evaluate(() => { mon.name = 'ふっかつモン'; refresh(); });
  await pg.waitForTimeout(600);
  await pg.reload();
  await pg.waitForTimeout(800);
  out['15_復元'] = await pg.evaluate(() => ({ name: mon.name, 草むら: document.querySelectorAll('#wildList .mv').length }));



  /* ---- 16. 試し打ちを戻らんで押せるか（FIRE-UX・2026-08-22） ----
     にーくら「試し打ちボタンがスクロールされて、いちいち数値を変えたら
     　　　　　そこまで戻って押す、の作業が面倒」
     ⚠ 撃たれた技は fxs を覗かず fireMove を包んで記録する。玉はすぐ消えるけん数え損ねる。 */
  await pg.click('#btnNewMove'); await pg.waitForTimeout(300);
  out['16_試し打ち'] = await pg.evaluate(() => {
    window.__fired = [];
    if (!window.__origFire) { window.__origFire = fireMove;
      window.fireMove = function(id){ window.__fired.push(id); return window.__origFire(id); }; }
    const r = {};
    const editId = editMove ? editMove.id : null;
    const sel = $('fireSel');
    const other = Array.from(sel.options).map(o => o.value).find(v => v && v !== editId);
    if (other) sel.value = other;
    r.編集中 = editId; r.ドロップダウン = sel.value;
    window.__fired.length = 0;
    $('btnFire').click();
    r.撃たれた技 = window.__fired[window.__fired.length - 1] || null;
    return r;
  });
  ok(out['16_試し打ち'].撃たれた技 === out['16_試し打ち'].編集中,
     'FIRE-UX-a: sticky の ▶撃つ が編集中の技を撃っとらん（撃たれた=' + out['16_試し打ち'].撃たれた技
     + ' 編集中=' + out['16_試し打ち'].編集中 + '）——下まで戻らんと試し打ちできん');

  out['16b_触ったら撃つ'] = await pg.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const r = {};
    r.トグルあり = !!$('btnLive');
    if (!$('btnLive')) return r;
    if (!liveFire) $('btnLive').click();
    r.入 = !!liveFire;
    window.__fired.length = 0;
    editMove.power = (editMove.power || 20) + 1; mvRebuild();
    await wait(120); r.すぐには撃たん = window.__fired.length;
    await wait(400); r.止めたら撃つ = window.__fired.length;
    $('btnLive').click(); r.切った = !!liveFire;
    window.__fired.length = 0;
    editMove.power = (editMove.power || 20) + 1; mvRebuild();
    await wait(520); r.切ったら撃たん = window.__fired.length;
    return r;
  });
  ok(out['16b_触ったら撃つ'].トグルあり === true, 'FIRE-UX-b: 「触ったら撃つ」のトグルが無い');
  ok(out['16b_触ったら撃つ'].すぐには撃たん === 0, 'FIRE-UX-c: 値を動かした瞬間に撃っとる（ドラッグ中に連発する）');
  ok(out['16b_触ったら撃つ'].止めたら撃つ >= 1, 'FIRE-UX-d: 手を止めても撃たれん（触ったら撃つが効いとらん）');
  ok(out['16b_触ったら撃つ'].切ったら撃たん === 0, 'FIRE-UX-e: トグルを切っても撃たれる');

  /* ---- 17. 一覧から上書き先を選ぶ（PICK-OVERWRITE・2026-08-22） ----
     にーくら「名前リストをクリックして選んで上書きできるようにして」
     ⚠ 本命は「名前を押しても中身が変わらん」こと。読込と違う道やけん——
       上書きしたい作業を消してしもうたら意味が無い。 */
  out['17_四皇モンの上書き先'] = await pg.evaluate(() => {
    const r = {};
    mon.name = 'えらぶモンA'; refresh(); $('slotName').value = 'えらぶモンA'; $('slotSave').click();
    mon.name = 'えらぶモンB'; refresh(); $('slotName').value = 'えらぶモンB'; $('slotSave').click();
    mon.name = 'いま編集しとる'; refresh();
    setBound(null);
    const rows = document.querySelectorAll('#slotList .mv');
    r.行数 = rows.length;
    const nm = rows[0] && rows[0].querySelector('.nm');
    r.名前を押せる = !!(nm && nm.onclick);
    if (nm) nm.click();
    r.選ばれた = boundSlot;
    r.中身は変わっとらん = (mon.name === 'いま編集しとる');
    r.選択が見て分かる = !!document.querySelector('#slotList .mv.picked');
    return r;
  });
  ok(out['17_四皇モンの上書き先'].名前を押せる === true, 'PICK-OVERWRITE-a: 保存一覧の名前が押せん');
  ok(!!out['17_四皇モンの上書き先'].選ばれた, 'PICK-OVERWRITE-b: 名前を押しても上書き先が選ばれとらん');
  ok(out['17_四皇モンの上書き先'].中身は変わっとらん === true,
     'PICK-OVERWRITE-c: 名前を押したら編集中の中身が読み込まれた——上書きしたい作業が消える（読込と同じになっとる）');
  ok(out['17_四皇モンの上書き先'].選択が見て分かる === true, 'PICK-OVERWRITE-d: 選ばれとる行が見て分からん');

  out['17b_技の上書き'] = await pg.evaluate(() => {
    const r = {};
    const before = Object.keys(mlLibAll()).length;
    r.棚の数 = before;
    r.上書きボタンあり = !!document.querySelector('#mvLib .ml-over');
    /* 保存欄（「名前をつけて」＋入力）も .ml-ctl で label を持つ。input を持つ行は棚やない。 */
    const rows = Array.from(document.querySelectorAll('#mvLib .ml-ctl'))
      .filter(d => d.querySelector('label') && !d.querySelector('input'));
    const lb = rows[0] && rows[0].querySelector('label');
    r.名前を押せる = !!(lb && lb.onclick);
    if (lb) lb.click();
    const ov = document.querySelector('#mvLib .ml-over');
    r.選んだら有効 = !!(ov && !ov.disabled);
    if (ov) ov.click();
    r.一度押しでは書かん = Object.keys(mlLibAll()).length === before;
    if (ov) ov.click();
    r.棚の数は増えとらん = Object.keys(mlLibAll()).length === before;
    return r;
  });
  ok(out['17b_技の上書き'].上書きボタンあり === true, 'PICK-OVERWRITE-e: 技ライブラリに上書きの口が無い');
  ok(out['17b_技の上書き'].名前を押せる === true, 'PICK-OVERWRITE-f: 技の一覧の名前が押せん');
  ok(out['17b_技の上書き'].選んだら有効 === true, 'PICK-OVERWRITE-g: 名前を選んでも上書きボタンが有効にならん');
  ok(out['17b_技の上書き'].一度押しでは書かん === true, 'PICK-OVERWRITE-h: 上書きが一度押しで走っとる（二度押しの掟）');
  ok(out['17b_技の上書き'].棚の数は増えとらん === true, 'PICK-OVERWRITE-i: 上書きしたのに棚が増えとる（新規保存になっとる）');

  await pg.screenshot({ path: shot('cr_final.png'), fullPage: false });
  out['ダイアログに頼っとらんか'] = { 出たダイアログ: dialogs.length, 内容: dialogs.slice(0, 3) };
  out['errs'] = errs;
  console.log(JSON.stringify(out, null, 2));
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
