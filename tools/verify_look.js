#!/usr/bin/env node
/* 反動／間／溜め が**見分けが付く絵**になっとるか（LOOK-01〜05・KEEP-01〜03）。
   使い方:  node tools/verify_look.js        （NGなら終了コード1）

   絵の話やけん「見れば分かる」で済ませたくなるが、それやと次に誰かが
   数字を触ったとき気付けん。**キーフレームの値と実際の描画の両方を数える。**

   もう1つの本題が KEEP —— にーくら「すでにある自作技に影響がないようにしないとね」。
   `motions` を自前で書いとる技は既定に来んけん無影響、というのを**数えて示す**。 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const ROOT = path.join(__dirname, '..');
const DIST_URL = 'file://' + path.join(ROOT, 'dist') + '/';
const SHOT = path.join(__dirname, '_look-shot.png');
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

  /* ---- 1. 3つの動きの中身（LOOK-01〜03）---- */
  const anim = await pg.evaluate(() => {
    const g = (n) => {
      const a = ANIMS[n];
      if (!a) return null;
      const k = a.keys || [];
      return {
        loop: !!a.loop, dur: a.dur,
        maxFlash: Math.max(...k.map((f) => f.flash || 0)),
        /* 動いとるか＝拡縮と移動が1でも変わるか */
        moves: k.some((f) => Math.abs((f.sx || 1) - 1) > 0.005 || Math.abs((f.sy || 1) - 1) > 0.005
                          || Math.abs(f.dx || 0) > 0.5 || Math.abs(f.dy || 0) > 0.5)
      };
    };
    return { recoil: g('recoil'), hold: g('hold'), charge: g('charge'), idle: g('idle') };
  });
  ok(anim.recoil, 'recoil の動きが無い');
  ok(anim.hold, 'hold の動きが無い');
  if (anim.recoil) {
    /* 閾値は**実測の崖**から決めとる —— 0.22 まで下げると待機との差が2画素になって
       目に見えんくなる。0.25 を下回ったら「点滅しとらん」と見なす。 */
    ok(anim.recoil.maxFlash >= 0.25, '反動の白が弱すぎて見えん（flash最大 ' + anim.recoil.maxFlash + '・0.22で消える）');
    ok(anim.recoil.maxFlash <= 0.45, '反動の白が強すぎる（flash最大 ' + anim.recoil.maxFlash + '）—— にーくらの「白すぎない」指定');
    ok(anim.recoil.moves === false, '反動が動いとる —— **静止させる**のが指定やった');
    ok(anim.recoil.loop, '反動が繰り返しやない（1回で終わったら反動中ずっとは出せん）');
  }
  if (anim.hold) {
    ok(anim.hold.maxFlash === 0, '間が白く点滅しとる —— 白は反動のものやけん被る');
    ok(anim.hold.moves, '間が全く動いとらん —— 反動と見分けが付かん');
  }
  if (anim.charge) {
    ok(anim.charge.maxFlash === 0, '溜めから白が抜けとらん（flash最大 ' + anim.charge.maxFlash + '）');
    ok(anim.charge.moves, '溜めが動いとらん');
  }
  console.log('反動          白 ' + anim.recoil.maxFlash + ' / 動く ' + anim.recoil.moves + ' / 繰り返し ' + anim.recoil.loop);
  console.log('間            白 ' + anim.hold.maxFlash + ' / 動く ' + anim.hold.moves);
  console.log('溜め          白 ' + anim.charge.maxFlash + ' / 動く ' + anim.charge.moves);

  /* ---- 2. 実際の描画で見分けが付くか（LOOK-04）----
     3つの状態を作って、キャンバスの画素を比べる。 */
  const pix = await pg.evaluate(() => {
    const f = partyA[0];
    const grab = () => {
      const g = fieldCv.getContext('2d');
      const d = g.getImageData(0, 0, fieldCv.width, fieldCv.height).data;
      let white = 0, ink = 0;
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i], G = d[i + 1], B = d[i + 2];
        if (R > 235 && G > 235 && B > 235) white++;
        if (R + G + B > 120) ink++;
      }
      return { white, ink };
    };
    const pose = (anim, t) => {
      resetBattle(4242);
      autoBattle = false;                 /* AI に動かされんよう止める */
      f.play(anim); f.t = t;
      drawField();
      return grab();
    };
    const out = {
      /* 白がいちばん出る瞬間で比べる */
      recoil: pose('recoil', 0.10),
      hold:   pose('hold',   0.34),
      charge: pose('charge', 0.50),
      idle:   pose('idle',   0.30)
    };
    resetBattle(4242); autoBattle = true;
    return out;
  });
  ok(pix.recoil.white > pix.hold.white, '反動が間より白ない: ' + pix.recoil.white + ' vs ' + pix.hold.white);
  ok(pix.recoil.white > pix.charge.white, '反動が溜めより白ない: ' + pix.recoil.white + ' vs ' + pix.charge.white);
  ok(pix.recoil.white > pix.idle.white + 20, '反動が待機と見分けが付かん: ' + pix.recoil.white + ' vs ' + pix.idle.white);
  console.log('画素の白      反動 ' + pix.recoil.white + ' / 間 ' + pix.hold.white
    + ' / 溜め ' + pix.charge.white + ' / 待機 ' + pix.idle.white);

  /* ---- 3. 実戦で3つとも絵に出るか ---- */
  const live = await pg.evaluate(() => {
    resetBattle(12345);
    const seen = {};
    for (let i = 0; i < 60 * 60 * 2 && !over; i++) {
      stepBattle(1 / 60); ally.update(1 / 60); enemy.update(1 / 60);
      for (const f of [ally, enemy]) seen[f.anim] = (seen[f.anim] || 0) + 1;
    }
    resetBattle(4242);
    return seen;
  });
  ok((live.recoil || 0) > 0, '実戦で反動の絵が一度も出とらん');
  ok((live.hold || 0) > 0, '実戦で間の絵が一度も出とらん');
  console.log('実戦の絵      ' + Object.entries(live).sort((a, c) => c[1] - a[1])
    .map(([k, v]) => k + ' ' + v).join(' / '));

  /* ---- 3.5 溜めの絵は**溜めとる間だけ**か ----
     ⚠ ここは実際に外した。`charge` が loop:true で**自分では終わらん**動きやったけん、
     cast 0.42秒の技を撃っても、絵だけ4秒後まで上下し続けとった。
     にーくらの「何度も上下に動く」も「白くなるのが実機の方が長い」も、
     元をたどればこの1点。**検証が見張っとらん所やった**けん足す。 */
  const chargeLife = await pg.evaluate(() => {
    const run = (gen) => {
      resetBattle(4242);
      autoBattle = false;
      const f = partyA[0], foe = partyB[0];
      /* ⚠ 技を差し替えるけん**必ず控えて戻す**。戻し忘れると、この後の
         determinismTest が偽の技を踏んで落ちる（実際に一度やった）。
         検証が検証自身の後始末で失敗するんは、いちばん質の悪い赤や。 */
      const keepMoves = f.moves, keepCd = f.cd;
      try {
        const mv = { id: 'probe', name: '試験', power: 20, cast: 0.42, cooldown: 5,
                     fx: { generator: gen, motions: [] }, type: '闇' };
        f.moves = [mv]; f.cd = {};
        startAttack(f, foe, mv);
        let frames = 0;
        for (let i = 0; i < 60 * 5; i++) {
          stepBattle(1 / 60); f.update(1 / 60); foe.update(1 / 60);
          if (f.anim === 'charge') frames++;
        }
        return { sec: +(frames / 60).toFixed(2), last: f.anim };
      } finally {
        f.moves = keepMoves; f.cd = keepCd;
        resetBattle(4242); autoBattle = true;
      }
    };
    return { remote: run('shatter'), melee: run('slash') };
  });
  ok(chargeLife.remote.sec > 0, '遠隔技で溜めの絵が一度も出とらん');
  ok(chargeLife.remote.sec < 1.6,
     '溜めの絵が長すぎる（' + chargeLife.remote.sec + '秒）—— 溜めが終わっても止まっとらんのやないか');
  ok(chargeLife.remote.last !== 'charge', '5秒経っても溜めの絵のまま（終わっとらん）');
  ok(chargeLife.melee.sec === 0, '近接技なのに溜めの絵が出とる: ' + chargeLife.melee.sec + '秒');
  console.log('溜めの寿命    遠隔 ' + chargeLife.remote.sec + '秒 → ' + chargeLife.remote.last
    + ' ／ 近接 ' + chargeLife.melee.sec + '秒（cast は 0.42秒）');

  /* ---- 4. 既存を壊しとらんか（KEEP-01〜03）---- */
  const keep = await pg.evaluate(() => {
    /* 分類→anim の割り当てが変わっとらんか */
    const mk = (gen) => ({ id: 'x', name: 'x', fx: { generator: gen, motions: [] } });
    const map = {};
    ['projectile', 'beam', 'slash', 'lightning', 'aura', 'shatter'].forEach((g) => {
      const mo = MOVE_RANGE.motionOf(mk(g));
      map[g] = MOVE_RANGE.rangeOf(mk(g)) + '→' + mo.anim + (mo.dur ? '/' + mo.dur : '');
    });
    /* motions を自前で書いた技は既定に来んか */
    const f = partyA[0];
    f.anim = 'idle'; f.durOv = null; f.pendMo.length = 0;
    f.scheduleMotions({ generator: 'shatter', motions: [{ anim: 'jump', at: 'fire', off: 0, dur: 1.25 }] }, 'fire');
    const ownWins = { anim: f.anim, dur: f.durOv };
    f.anim = 'idle'; f.durOv = null; f.pendMo.length = 0;
    return { map, ownWins };
  });
  const wantMap = {
    projectile: 'ranged→attack/0.42', beam: 'ranged→attack/0.42',
    slash: 'melee→attack', lightning: 'remote→charge/0.42',
    aura: 'remote→charge/0.42', shatter: 'remote→charge/0.42'
  };
  Object.keys(wantMap).forEach((g) => {
    ok(keep.map[g] === wantMap[g],
       '割り当てが変わっとる（KEEP-02）' + g + ': ' + keep.map[g] + '（期待 ' + wantMap[g] + '）');
  });
  ok(keep.ownWins.anim === 'jump' && keep.ownWins.dur === 1.25,
     'motions を自前で書いた技が既定に食われとる（KEEP-01）: ' + JSON.stringify(keep.ownWins));
  console.log('割り当て      変わっとらん（' + Object.values(keep.map).join(' / ') + '）');
  console.log('自前の motions  jump/1.25 のまま勝つ（既定に食われとらん）');

  /* にーくらの保存個体の自作技が、今も分類できて動きが付くか（KEEP-03） */
  const mons = [];
  const dir = path.join(ROOT, 'data', 'monsters');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        for (const k in (j.customMoves || {})) {
          const m = j.customMoves[k];
          mons.push({ who: j.name || f, name: m.name, fx: m.fx, range: m.range });
        }
      } catch (e) {}
    }
  }
  if (mons.length) {
    const own = await pg.evaluate((list) => list.map((m) => {
      const mo = MOVE_RANGE.motionOf({ fx: m.fx, range: m.range });
      return { who: m.who, name: m.name, range: MOVE_RANGE.rangeOf({ fx: m.fx, range: m.range }),
               anim: mo.anim, hasOwn: !!(m.fx && m.fx.motions && m.fx.motions.length) };
    }), mons);
    own.forEach((m) => {
      ok(['attack', 'charge'].indexOf(m.anim) >= 0,
         '自作技の動きが知らんものになっとる（KEEP-03）' + m.who + '「' + m.name + '」: ' + m.anim);
    });
    console.log('自作技        ' + own.map((m) => m.who + '「' + m.name + '」' + m.range
      + (m.hasOwn ? '(自前)' : '→' + m.anim)).join(' / '));
  }

  /* ---- 5. 絵のファイルを増やしとらんか（LOOK-05・掟4）---- */
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

  /* ---- 6. 決定論（掟1）---- */
  const det = await pg.evaluate(() => { const r = determinismTest(); return { ok: r.ok, at: r.at }; });
  ok(det.ok, '見た目を変えたら決定論が落ちた（掟1）at=' + det.at);
  console.log('決定論        ' + (det.ok ? 'ok' : 'NG'));

  /* 見た目を1枚残す（人が後から見られるように） */
  const url = await pg.evaluate(() => {
    resetBattle(12345);
    for (let i = 0; i < 60 * 20; i++) { stepBattle(1 / 60); ally.update(1 / 60); enemy.update(1 / 60); }
    drawField();
    return fieldCv.toDataURL('image/png');
  });
  fs.writeFileSync(SHOT, Buffer.from(url.split(',')[1], 'base64'));

  await pg.close();
  await b.close();

  if (errs.length) {
    console.error(String.fromCharCode(10) + 'verify_look: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(String.fromCharCode(10) + 'verify_look: 全部通った   ' + path.relative(ROOT, SHOT));
  process.exit(0);
})();
