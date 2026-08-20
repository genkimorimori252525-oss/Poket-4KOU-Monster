#!/usr/bin/env node
/* 覚えられる技（mon.customMoves・最大12）／覚える技（mon.moves・最大4）／
   mon.excludeBuiltin（内蔵技の個体ごとの除外）の恒久的な回帰ゲート。
   docs/整理_技一覧の一本化.md 第4節（⚠ 設計を直した版）を数える。
   使い方: node tools/verify_learnable.js        （NGなら終了コード1） */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');

const ROOT = path.join(__dirname, '..');
const DIST_URL = 'file://' + path.join(ROOT, 'dist') + '/';
const SHOT = path.join(__dirname, '_learnable-shot.png');
const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

(async () => {
  const errs = [];
  const ok = (c, w) => { if (!c) errs.push(w); };
  let b;
  try {
    b = await chromium.launch(LAUNCH);
    offlineFonts(b);
    const pg = await b.newPage({ viewport: { width: 420, height: 1100 } });
    pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    pg.on('console', (m) => { if (m.type() === 'error' && !/ERR_/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
    /* ダイアログは全部つっぱねる。拒否理由が「画面（ダイアログ）に出とる」ことは
       dialogs の中身で確認する。confirm() の戻り値には頼らんことの確認も兼ねる。 */
    const dialogs = [];
    pg.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });

    await pg.goto(DIST_URL + 'shioumon_creator.html');
    await pg.evaluate(() => localStorage.clear());
    await pg.reload();
    await pg.waitForTimeout(600);

    /* ---- 1. 後方互換（design docの最大リスク）：excludeBuiltin を持たん個体は
       内蔵6技が今までどおり全部『覚えられる技』に出る ---- */
    const backCompat = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll('#moveList .mv')];
      const per = BUILTIN_MOVE_IDS.map((id) => {
        const nm = (MOVES[id] && MOVES[id].name) || id;
        const row = rows.find((r) => (r.querySelector('.nm').textContent || '').indexOf(nm) === 0);
        return { id, name: nm, found: !!row, opacityHalf: !!row && row.style.opacity === '0.5' };
      });
      return {
        excludeBuiltinEmpty: Array.isArray(mon.excludeBuiltin) && mon.excludeBuiltin.length === 0,
        builtinCount: BUILTIN_MOVE_IDS.length,
        per
      };
    });
    ok(backCompat.excludeBuiltinEmpty, '新規個体の mon.excludeBuiltin が空配列やない');
    ok(backCompat.builtinCount === 6, 'BUILTIN_MOVE_IDS が6本やない（verified_facts#3を変えとる）: ' + backCompat.builtinCount);
    for (const r of backCompat.per) {
      ok(r.found, '「覚えられる技」に内蔵技 ' + r.name + '(' + r.id + ') が出とらん');
      ok(!r.opacityHalf, '除外しとらん内蔵技 ' + r.name + '(' + r.id + ') が薄く（除外扱いに）なっとる');
    }
    console.log('1_後方互換  builtin=' + backCompat.builtinCount + '本  全部『覚えられる技』に出とる・除外マーク無し');

    /* ---- 2. 除外で1本だけ消える ---- */
    const excludeOne = await pg.evaluate((id) => {
      toggleExcludeBuiltin(id);
      return { excludeBuiltin: mon.excludeBuiltin.slice() };
    }, 'bolt');
    ok(excludeOne.excludeBuiltin.length === 1 && excludeOne.excludeBuiltin[0] === 'bolt',
      'bolt を除外した直後の mon.excludeBuiltin が [\'bolt\'] ちょうどやない（残り5本が紛れ込んどらんかも含む）: ' +
      JSON.stringify(excludeOne.excludeBuiltin));
    console.log('2_除外で1本だけ消える  excludeBuiltin=' + JSON.stringify(excludeOne.excludeBuiltin));

    /* ---- 3. 除外した技は装備できん（拒否＋alert） ---- */
    const beforeLen = await pg.evaluate(() => mon.moves.length);
    const dialogsBefore3 = dialogs.length;
    const afterEquipTry = await pg.evaluate((id) => {
      toggleMove(id);
      return { includes: mon.moves.includes(id), len: mon.moves.length };
    }, 'bolt');
    ok(!afterEquipTry.includes, '除外したはずの bolt が mon.moves へ入ってしもうた');
    ok(afterEquipTry.len === beforeLen, '除外拒否のはずが mon.moves.length が変わっとる: ' + beforeLen + '→' + afterEquipTry.len);
    const newDialogs3 = dialogs.slice(dialogsBefore3);
    ok(newDialogs3.some((m) => m.indexOf('除外') >= 0 || m.indexOf('含めて') >= 0),
      '除外拒否の理由がダイアログ（画面）に出とらん: ' + JSON.stringify(newDialogs3));
    console.log('3_除外した技は装備できん  moves.length=' + afterEquipTry.len + '（不変）  dialog=' + JSON.stringify(newDialogs3));

    /* ---- 4. 上限は今までどおり（覚える技4・覚えられる技customMoves12） ---- */
    const capMoves2 = await pg.evaluate(() => {
      mon.excludeBuiltin = [];
      buildMoveList();
      mon.moves = [];
      for (const id of BUILTIN_MOVE_IDS.slice(0, 5)) toggleMove(id);
      return mon.moves.length;
    });
    ok(capMoves2 === 4, '覚える技が4つで止まらんかった: ' + capMoves2);
    console.log('4a_覚える技の上限  moves.length=' + capMoves2 + '（4で止まった）');

    const dialogsBeforeCap12 = dialogs.length;
    const capCustom = await pg.evaluate(() => {
      mon.customMoves = [];
      for (let i = 0; i < 12; i++) {
        mon.customMoves.push({
          id: 'capfill' + i, name: 'ダミー' + i, type: 'ノーマル',
          power: 10, cast: 0.2, cooldown: 1,
          fx: makeSpec('projectile', i, 'x' + i, '炎'), audio: []
        });
      }
      syncCustom();
      mlLibPut('容量テスト', {
        name: '容量テスト', fx: makeSpec('projectile', 99, '容量テスト', '炎'),
        battle: { type: 'ノーマル', power: 10, cast: 0.2, cooldown: 1, tags: [] }, audio: []
      });
      buildMoveEditor();
      const row = [...document.querySelectorAll('#mvLib .ml-ctl')]
        .find((r) => r.querySelector('label') && r.querySelector('label').textContent === '容量テスト');
      if (!row) return { found: false, n: mon.customMoves.length };
      row.querySelectorAll('button')[0].click();   // 読込
      return { found: true, n: mon.customMoves.length };
    });
    ok(capCustom.found, '技ライブラリの「容量テスト」の行が #mvLib に見つからん');
    ok(capCustom.n === 12, '覚えられる技（customMoves）が12本のまま止まらんかった: ' + capCustom.n);
    const newDialogsCap12 = dialogs.slice(dialogsBeforeCap12);
    ok(newDialogsCap12.some((m) => m.indexOf('持ちすぎ') >= 0),
      'customMoves 12本上限の拒否理由がダイアログに出とらん: ' + JSON.stringify(newDialogsCap12));
    console.log('4b_覚えられる技の上限  customMoves.length=' + capCustom.n + '（12で止まった）  dialog=' + JSON.stringify(newDialogsCap12));

    /* ---- 5. excludeBuiltinの往復（snapshot→normalizeMon／absentの扱い） ---- */
    const roundTrip = await pg.evaluate(() => {
      mon.excludeBuiltin = ['akuu', 'beam'];
      const snap = JSON.parse(JSON.stringify(snapshot()));
      const restored = normalizeMon(snap);
      const absent = normalizeMon({});
      return {
        restored: (restored.excludeBuiltin || []).slice().sort(),
        absentIsArray: Array.isArray(absent.excludeBuiltin),
        absentLen: (absent.excludeBuiltin || []).length
      };
    });
    ok(JSON.stringify(roundTrip.restored) === JSON.stringify(['akuu', 'beam']),
      'snapshot→normalizeMon を経た excludeBuiltin が [\'akuu\',\'beam\'] と一致せん: ' + JSON.stringify(roundTrip.restored));
    ok(roundTrip.absentIsArray && roundTrip.absentLen === 0,
      'excludeBuiltin が存在せんデータを normalizeMon した結果が空配列やない');
    console.log('5_excludeBuiltinの往復  restored=' + JSON.stringify(roundTrip.restored) + '  absent=[]（' + roundTrip.absentIsArray + '）');

    /* ---- 6. 矛盾状態（UIを介さず作った excludeBuiltin と moves の食い違い）が画面に出る ---- */
    const conflict = await pg.evaluate(() => {
      mon.excludeBuiltin = ['slash'];
      mon.moves = ['slash'];
      buildMoveList();
      return document.getElementById('moveConflict').textContent;
    });
    ok(conflict.indexOf('⚠') >= 0, '#moveConflict に矛盾の警告（⚠）が出とらん: ' + JSON.stringify(conflict));
    console.log('6_矛盾状態が画面に出る  #moveConflict=' + JSON.stringify(conflict));

    await pg.screenshot({ path: SHOT });
    await pg.close();
  } catch (e) {
    errs.push(e.stack || e.message || String(e));
  } finally {
    if (b) await b.close();
  }

  if (errs.length) {
    console.error(String.fromCharCode(10) + 'verify_learnable: ' + errs.length + '件');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(String.fromCharCode(10) + 'verify_learnable: 全部通った   ' + path.relative(ROOT, SHOT));
  process.exit(0);
})();
