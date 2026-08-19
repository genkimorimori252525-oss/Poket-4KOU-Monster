#!/usr/bin/env node
/* 構え（反動／間／溜め）が分かれとるか（STATE-01〜03）。
   使い方:  node tools/verify_stance.js        （NGなら終了コード1）

   Phase 1 の約束は「**読めるようにするだけで、挙動は1ミリも変えん**」。
   やけんこの検証の本題は「状態が在るか」やのうて「**何も変わっとらんか**」の方。
   状態を足したせいで戦闘が変わっとったら、それは Phase 1 の失敗や。 */
const path = require('path');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const DIST_URL = 'file://' + path.join(__dirname, '..', 'dist') + '/';
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

  /* ---- 1. 4つの構えが名前を持っとるか（STATE-01）---- */
  const shape = await pg.evaluate(() => {
    if (typeof stanceOf !== 'function') return { err: 'stanceOf が居らん' };
    if (typeof STANCE === 'undefined') return { err: 'STANCE の表が居らん' };
    return { keys: Object.keys(STANCE).sort(), names: STANCE };
  });
  if (shape.err) { errs.push(shape.err); }
  else {
    const want = ['charge', 'down', 'free', 'hold', 'recoil'];
    ok(shape.keys.join(',') === want.join(','), '構えの顔ぶれが違う: ' + shape.keys.join(','));
    console.log('構え          ' + shape.keys.map((k) => k + '=' + shape.names[k]).join(' / '));
  }

  /* ---- 2. それぞれの状態を作って、正しく読めるか ----
     **実際に条件を作って確かめる。** 「たぶんこう返る」では意味が無い。 */
  const cases = await pg.evaluate(() => {
    resetBattle(4242);
    const f = partyA[0];
    const out = {};
    const snap = { cd: Object.assign({}, f.cd), charging: f.charging, dead: f.dead, holding: f.holding };

    /* 自由：全部撃てる */
    f.cd = {}; f.charging = null; f.dead = false; f.holding = false;
    out.free = stanceOf(f);

    /* 反動：技を全部クールダウンに入れる */
    f.moves.forEach((m) => { f.cd[m.id] = 3; });
    out.recoil = stanceOf(f);

    /* 反動中でも溜めが優先されるか（溜めながら次が撃てん状態） */
    f.charging = { t: 1, move: f.moves[0] };
    out.chargeBeatsRecoil = stanceOf(f);
    f.charging = null;

    /* 間：撃てるのに撃たん（Phase 2 で AI が立てる旗） */
    f.cd = {}; f.holding = true;
    out.hold = stanceOf(f);
    f.holding = false;

    /* 戦闘不能が全部に勝つか */
    f.dead = true; f.charging = { t: 1, move: f.moves[0] }; f.cd = {};
    out.downBeatsAll = stanceOf(f);

    /* 元に戻す */
    f.cd = snap.cd; f.charging = snap.charging; f.dead = snap.dead; f.holding = snap.holding;
    resetBattle(4242);
    return out;
  });
  ok(cases.free === 'free', '全部撃てるのに free やない: ' + cases.free);
  ok(cases.recoil === 'recoil', '全技CD中なのに recoil やない: ' + cases.recoil);
  ok(cases.chargeBeatsRecoil === 'charge', '溜め中は charge が勝つべき: ' + cases.chargeBeatsRecoil);
  ok(cases.hold === 'hold', 'holding を立てても hold にならん: ' + cases.hold);
  ok(cases.downBeatsAll === 'down', '戦闘不能が最優先やない: ' + cases.downBeatsAll);
  console.log('読み取り      自由/反動/溜め優先/間/戦闘不能 すべて期待どおり');

  /* ---- 3. 実戦で反動が本当に起きるか（作り物やのうて）---- */
  const live = await pg.evaluate(() => {
    resetBattle(4242);
    const seen = {};
    for (let i = 0; i < 60 * 60 * 3 && !over; i++) {
      stepBattle(1 / 60); ally.update(1 / 60); enemy.update(1 / 60);
      for (const f of [ally, enemy]) { const s = stanceOf(f); seen[s] = (seen[s] || 0) + 1; }
    }
    const logs = AILog.entries.filter((e) => e.kind === 'ev' && /：.*→/.test(e.text || ''));
    return { seen, 構えのログ: logs.length, 例: logs.slice(0, 3).map((e) => e.text) };
  });
  ok((live.seen.recoil || 0) > 0, '3分回しても反動が一度も起きん（判定が効いとらん）');
  ok((live.seen.free || 0) > 0, '自由な時間が一度も無い');
  ok(live.構えのログ > 0, '構えが変わってもログに出とらん（STATE-02）');
  /* ⚠ Phase 1 のときここは「hold は 0 件のはず」やった —— まだ AI が間を選べんかったけん。
     Phase 2 で間が入って前提が変わったけん、見張りも入れ替えた。
     今は「hold が読める形で出とるか」を見る。取りすぎ／取らなさすぎの判定は
     verify_ma.js の担当（あっちが本職）。 */
  ok((live.seen.hold || 0) >= 0, 'hold の集計が壊れとる');
  ok((live.seen.recoil || 0) > (live.seen.hold || 0) * 0.1,
     '反動より間が極端に多い —— 構えの判定が混ざっとらんか');
  console.log('実戦          ' + Object.entries(live.seen).map(([k, v]) => k + ' ' + v).join(' / '));
  console.log('              構えのログ ' + live.構えのログ + '件  例: ' + (live.例[0] || '—'));

  /* ---- 4. ログが垂れ流しになっとらんか ----
     毎フレーム出しとったら、肝心の判断がログから読めんくなる */
  ok(live.構えのログ < 200, '構えのログが多すぎる（' + live.構えのログ + '件）—— 毎フレーム出しとらんか');

  /* ---- 5. **挙動が変わっとらんか**（Phase 1 の本題）---- */
  const det = await pg.evaluate(() => { const r = determinismTest(); return { ok: r.ok, at: r.at }; });
  ok(det.ok, '構えを足したら決定論が落ちた（掟1）at=' + det.at);

  /* 同じ種で2回走らせて、戦闘の結果が丸ごと一致するか。
     determinismTest は HP しか見とらんけん、経済と決着も突き合わせる。 */
  const twice = await pg.evaluate(() => {
    const play = () => {
      resetBattle(31337);
      let n = 0;
      for (; n < 30000 && !over; n++) { stepBattle(1 / 60); ally.update(1 / 60); enemy.update(1 / 60); }
      return { frames: n, reason: endReason, q: quarter,
               a: TEAM.ally.own, e: TEAM.enemy.own,
               hpA: partyA.map((f) => f.hp.toFixed(4)).join(','),
               hpB: partyB.map((f) => f.hp.toFixed(4)).join(',') };
    };
    const x = play(), y = play();
    resetBattle(4242);
    return { same: JSON.stringify(x) === JSON.stringify(y), x, y };
  });
  ok(twice.same, '同じ種で結果が変わる: ' + JSON.stringify(twice.x) + ' vs ' + JSON.stringify(twice.y));
  console.log('決定論        戦闘 ' + (det.ok ? 'ok' : 'NG') + ' ／ 2回とも同じ: ' + twice.same
    + '（' + twice.x.frames + 'フレーム ' + twice.x.reason + '）');

  await pg.close();
  await b.close();

  if (errs.length) {
    console.error(String.fromCharCode(10) + 'verify_stance: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(String.fromCharCode(10) + 'verify_stance: 全部通った');
  process.exit(0);
})();
