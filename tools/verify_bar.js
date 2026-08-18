#!/usr/bin/env node
/* 所持コストバーが本当に描かれとるか（BAR-01〜04）。
   使い方:  node tools/verify_bar.js        （NGなら終了コード1・絵を1枚吐く）

   **目視に頼らん。** キャンバスの画素を直に読んで、
   「棒が在る」「減ったら短くなる」「増えたら伸びる」を数字で確かめる。
   絵の話やけん見れば分かる、で済ますと、次に誰かが座標を動かしたとき気付けん。 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const ROOT = path.join(__dirname, '..');
const DIST_URL = 'file://' + path.join(ROOT, 'dist') + '/';
const SHOT = path.join(__dirname, '_bar-shot.png');
const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

(async () => {
  const errs = [];
  const ok = (c, w) => { if (!c) errs.push(w); };

  const b = await chromium.launch(LAUNCH);
  offlineFonts(b);
  const pg = await b.newPage({ viewport: { width: 420, height: 900 } });
  pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.goto(DIST_URL + 'shioumon_field_test.html');
  await pg.waitForTimeout(1500);

  /* 棒の色が横に何画素続いとるかを数える。**それが棒の長さ**

     座標は CB_RECT から取る —— **決め打ちせん**。置き場所を動かしても検証が追従する。
     決め打ちやと、箱の中へ移した途端に古い座標を読んで、
     製品は正しいのに不合格を出す（実際にやった）。

     ⚠ #cv やのうて fieldCv を読む。drawField() が描くんは裏のキャンバスで、
        #cv へは loop() が後から合成する。#cv やと合成前の古い絵を掴む（これもやった）。 */
  const measure = [
    '(function(side){',
    '  var r = CB_RECT[side];',
    '  if (!r) return { filled:-1, ghost:-1, width:0 };',
    '  var g = fieldCv.getContext("2d");',
    '  var d = g.getImageData(r.x, r.y + Math.floor(r.h/2), r.w, 1).data;',
    '  var filled = 0, ghost = 0;',
    '  for (var i = 0; i < r.w; i++) {',
    '    var R = d[i*4], G = d[i*4+1], B = d[i*4+2];',
    '    /* 味方=緑 #5cb85c / 相手=紫 #a05cd0 / 尾=赤 #e05070 */',
    '    var isBody = side === "ally" ? (G > 140 && R < 150 && B < 150)',
    '                                 : (R > 130 && R < 200 && B > 180 && G < 130);',
    '    var isGhost = (R > 190 && G < 120 && B > 80 && B < 150);',
    '    if (isBody) filled++;',
    '    else if (isGhost) ghost++;',
    '  }',
    '  return { filled: filled, ghost: ghost, width: r.w };',
    '})'
  ].join('\n');

  /* ---- 1. 開始時、両方の棒が出とるか（BAR-01）---- */
  const start = await pg.evaluate(([m]) => {
    resetBattle(4242);
    stepBattle(1 / 60); ally.update(1 / 60); enemy.update(1 / 60);
    drawField();
    return { ally: eval(m)('ally'), enemy: eval(m)('enemy'), max: COST.maxOwn(), own: TEAM.ally.own };
  }, [measure]);
  ok(start.ally.filled > 0, '味方の棒が描かれとらん');
  ok(start.enemy.filled > 0, '相手の棒が描かれとらん');
  /* 150/300 やけん、棒はおよそ半分のはず */
  const want = Math.round(start.ally.width * start.own / start.max);
  ok(Math.abs(start.ally.filled - want) <= 3,
     '棒の長さが所持コストと合っとらん: ' + start.ally.filled + '画素（期待 ' + want + '）');
  console.log('開始          味方' + start.ally.filled + '画素 / 相手' + start.enemy.filled
    + '画素（' + start.own + '/' + start.max + ' → 期待 ' + want + '）');

  /* ---- 2. 減ったら短くなるか＋尾が出るか（BAR-02）---- */
  const dropped = await pg.evaluate(([m]) => {
    addCost('ally', -90, '試験：大きく減らす');
    drawField();
    const right = eval(m)('ally');
    /* 尾は時間で縮む。少し進めて、縮んどるかも見る */
    for (let i = 0; i < 30; i++) stepCostBar(1 / 60);
    drawField();
    const later = eval(m)('ally');
    return { right, later, own: TEAM.ally.own };
  }, [measure]);
  ok(dropped.right.filled < start.ally.filled,
     '所持コストが減ったのに棒が短くなっとらん: ' + start.ally.filled + ' → ' + dropped.right.filled);
  ok(dropped.right.ghost > 0, '減った分の尾が出とらん（ガクッと落ちたのが見えん）');
  ok(dropped.later.ghost < dropped.right.ghost, '尾が縮んどらん（出しっぱなし）');
  console.log('減ったとき    棒 ' + start.ally.filled + '→' + dropped.right.filled
    + '画素　尾 ' + dropped.right.ghost + '→' + dropped.later.ghost + '画素（0.5秒後）');

  /* ---- 3. 増えたら伸びるか（BAR-04）---- */
  const grown = await pg.evaluate(([m]) => {
    const before = TEAM.ally.own;
    addCost('ally', +120, '試験：増やす');
    for (let i = 0; i < 40; i++) stepCostBar(1 / 60);
    drawField();
    return { bar: eval(m)('ally'), before, after: TEAM.ally.own };
  }, [measure]);
  ok(grown.bar.filled > dropped.right.filled,
     '所持コストが増えたのに棒が伸びとらん: ' + dropped.right.filled + ' → ' + grown.bar.filled);
  console.log('増えたとき    棒 ' + dropped.right.filled + '→' + grown.bar.filled
    + '画素（' + grown.before.toFixed(0) + '→' + grown.after.toFixed(0) + '）');

  /* ---- 4. 上限で頭打ちしても棒が溢れんか ---- */
  const capped = await pg.evaluate(([m]) => {
    addCost('ally', 9999, '試験：上限');
    for (let i = 0; i < 40; i++) stepCostBar(1 / 60);
    drawField();
    return { bar: eval(m)('ally'), own: TEAM.ally.own };
  }, [measure]);
  ok(capped.bar.filled <= capped.bar.width, '棒が枠から溢れとる: ' + capped.bar.filled + '/' + capped.bar.width);
  ok(capped.bar.filled >= capped.bar.width - 2, '上限なのに棒が満ちとらん: ' + capped.bar.filled);
  console.log('上限          ' + capped.own + ' → ' + capped.bar.filled + '/' + capped.bar.width + '画素');

  /* ---- 5. 決着の理由が画面に出るか（WIN-05）---- */
  const banner = await pg.evaluate(() => {
    const read = () => {
      /* ⚠ 字の色だけを数えたら誤検出した —— 戦場の絵にも橙っぽい画素が居って、
         決着しとらんのに「出とる」と読めてしまう。
         看板は**暗い板の上に橙の字**やけん、板（暗さ）と字（橙）の両方を数える。 */
      const g = fieldCv.getContext('2d');
      const d = g.getImageData(142, 96, 100, 22).data;
      let dark = 0, lit = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], bb = d[i + 2];
        if (r < 45 && gg < 50 && bb < 60) dark++;
        if (r > 225 && gg > 140 && gg < 185 && bb < 65) lit++;
      }
      return { dark, lit };
    };
    resetBattle(4242); drawField();
    const before = read();
    TEAM.enemy.own = 0.5; addCost('enemy', -1, '試験'); checkCostOut(); drawField();
    const after = read();
    resetBattle(4242);
    return { before, after, reason: 'コスト枯渇' };
  });
  /* 板の暗さは頼りにならん —— 半透明で戦場に重なるけん、下地が明るいと薄くなる。
     字（橙）の方が確かな信号やった: 決着前0画素 → 決着後135画素と、きれいに分かれる。 */
  ok(banner.before.lit === 0, '決着しとらんのに理由が出とる: ' + JSON.stringify(banner.before));
  ok(banner.after.lit > 50,
     '決着したのに理由が画面に出とらん（WIN-05）: ' + JSON.stringify(banner.before) + ' → ' + JSON.stringify(banner.after));
  console.log('決着の表示    板 ' + banner.before.dark + '→' + banner.after.dark
    + '画素　字 ' + banner.before.lit + '→' + banner.after.lit + '画素');

  /* ---- 6. 絵のファイルを増やしとらんか（掟4・BAR-03）---- */
  const imgs = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(e.name)) imgs.push(path.relative(ROOT, p));
    }
  };
  walk(path.join(ROOT, 'src'));
  walk(path.join(ROOT, 'dist'));
  ok(imgs.length === 0, '絵のファイルが増えとる（掟4）: ' + imgs.join(' '));
  console.log('掟4          src/ と dist/ の絵ファイル ' + imgs.length + '枚');

  /* 見た目も1枚残す（機械の確認とは別に、後から人が見られるように） */
  await pg.evaluate(() => {
    resetBattle(4242);
    for (let i = 0; i < 60 * 24; i++) { stepBattle(1 / 60); ally.update(1 / 60); enemy.update(1 / 60); }
    drawField();
  });
  /* 絵も裏キャンバスから直に取る。#cv を撮ると合成のタイミング待ちが要って揺れる */
  const dataUrl = await pg.evaluate(() => fieldCv.toDataURL('image/png'));
  fs.writeFileSync(SHOT, Buffer.from(dataUrl.split(',')[1], 'base64'));

  await pg.close();
  await b.close();

  if (errs.length) {
    console.error(String.fromCharCode(10) + 'verify_bar: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(String.fromCharCode(10) + 'verify_bar: 全部通った   ' + path.relative(ROOT, SHOT));
  process.exit(0);
})();
