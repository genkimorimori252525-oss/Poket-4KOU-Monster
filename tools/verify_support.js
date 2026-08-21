#!/usr/bin/env node
/* 補助技（docs/整理_技一覧の一本化.md §4.5）の検証。数値・構造の検証が中心で、
   絵は見ん（SC1のダメージ着弾だけ launch() 経由の hp 減少で確かめる）。
   使い方:  node tools/verify_support.js        （NGなら終了コード1）

   house style は tools/verify_look.js に合わせる（chromium.launch / offlineFonts /
   PW_CHROMIUM / pageerror・console のエラー収集 / ok(cond,msg) の蓄積 / 非ゼロ終了）。

   ⚠ 後始末の作法（tools/verify_look.js が既にコメントしとる通り）：
   合成技・一時的な stats/per/actionTimer/hp/phaseLeft の書き換えは、必ず元の値を
   save して finally で戻す。「戻す先を定数で決め打ち」しない —— にーくらの既定ロスター
   （パルキア atk92 等）は全50やないけん、決め打ちの復元は個体を壊したまま後続の検査へ
   持ち越す（見た目には出らんまま、determinismTest すら2回とも同じ壊れ方で緑になる）。
   「検証が検証自身の後始末で失敗するんは、いちばん質の悪い赤や」。 */
const path = require('path');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const ROOT = path.join(__dirname, '..');
const DIST_URL = 'file://' + path.join(ROOT, 'dist') + '/';
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

  /* =========================================================
     Task 1: statOf() スイープ単体 —— kind/effect/採点は一切存在せん段階で、
     「素早さで何も変わっとらん」ことを数値で証明する。
     ========================================================= */

  /* ---- 1a. 決定論（掟1）。補助技はまだ何も無いけん、スイープが挙動を
     1ミリも変えとらんならここは今まで通り緑になるはず ---- */
  const det = await pg.evaluate(() => { const r = determinismTest(); return { ok: r.ok, at: r.at }; });
  ok(det.ok, 'statOf() スイープ後、決定論チェックが落ちた（掟1）at=' + det.at);
  console.log('決定論        ' + (det.ok ? 'ok' : 'NG'));

  /* ---- 1b. byte-identical サンプル ----
     ページの実際の既定ロスター（パルキア/ルギアもどき、全50やない）のまま、
     statOf() が「バフが無いときは f.stats を素通しする」こと、そして
     damageOf() が手計算と完全一致することを、生の値がいくつであっても確かめる。 */
  const sample = await pg.evaluate(() => {
    resetBattle(4242);
    const out = {};
    for (const id of ['shakunetsu', 'slash', 'akuu']) {
      const mv = MOVES[id];
      const atkStat = statOf(ally, 'atk'), defStat = statOf(enemy, 'def');
      const hand = mv.power * (0.5 + atkStat / 100) * (100 / (100 + defStat))
        * quarterBonus() * stabOf(ally, mv);
      const real = damageOf(ally, enemy, mv);
      out[id] = {
        hand: +hand.toFixed(6), real: +real.toFixed(6),
        statEcho: statOf(ally, 'atk') === ally.stats.atk && statOf(enemy, 'def') === enemy.stats.def
      };
    }
    return out;
  });
  for (const id of ['shakunetsu', 'slash', 'akuu']) {
    const s = sample[id];
    ok(Math.abs(s.hand - s.real) < 1e-9,
       id + ' の damageOf() が手計算とズレた: hand=' + s.hand + ' real=' + s.real);
    ok(s.statEcho, id + ' の statOf() がバフ無しで f.stats を素通ししとらん');
  }
  console.log('byte-identical  ' + Object.entries(sample)
    .map(([k, v]) => k + ' hand=' + v.hand + ' real=' + v.real).join(' / '));

  /* ---- 1c. statOf() の 1〜100 クランプ。パルキアの atk は 92（全50やない）——
     「50 に戻す」と書くと個体を壊したまま持ち越すけん、必ず元の値を save/restore する。 */
  const clamp = await pg.evaluate(() => {
    resetBattle(4242);
    const original = ally.stats.atk;
    let result;
    try {
      ally.stats.atk = 150;
      result = statOf(ally, 'atk');
    } finally {
      ally.stats.atk = original;
    }
    return { result, restored: ally.stats.atk === original, original };
  });
  ok(clamp.result === 100, 'statOf() の天井クランプが効いとらん: 150 → ' + clamp.result + '（期待 100）');
  ok(clamp.restored, 'statOf() クランプ検証が元の atk（' + clamp.original + '）へ戻し損ねた');
  console.log('天井クランプ  atk150 → ' + clamp.result + '（元 ' + clamp.original + ' へ復元 ' + clamp.restored + '）');

  await pg.close();
  await b.close();

  if (errs.length) {
    console.error('\nverify_support: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log('\nverify_support: 全部通った');
  process.exit(0);
})();
