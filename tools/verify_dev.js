/* dist-dev/ の「音は鳴らした瞬間に初めて読まれる」を機械で確かめる。
   使い方:  node tools/verify_dev.js        （NGなら終了コード1）

   dist-dev/ の音は fetch で読むけん file:// では鳴らん。自分でサーバーを立てる。
   ポートは開発シェルの既定(8766)とずらして、シェルを開いたままでも流せるようにしとる。

   npm run verify の4段には入れん。あれは dist/ の正しさを見る連鎖で、
   dist-dev/ は開発用の派生物やけん別のコマンドにしとく。 */
const { chromium } = require('playwright');
const offlineFonts = require('./_pw_offline.js');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8792;
const BASE = 'http://127.0.0.1:' + PORT;
const ROOT = path.join(__dirname, '..');
/* Chromium が見つからんときは PW_CHROMIUM に実行ファイルのパスを入れる */
const LAUNCH = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

const wait = ms => new Promise(r => setTimeout(r, ms));

/* 鳴き声の経路（パッチBの data: 分岐）を試すための data URI。
   偽のバイト列やと decodeAudioData が正しく拒否して「壊れとる」の誤判定になるけん、
   dist-dev/se/ の本物の .ogg をそのまま data URI にする —— にーくらが鳴き声を
   読み込むときと同じ形。ファイルはビルド済みの中から一番小さいものを選ぶ。 */
const fs = require('fs');
const SE_DIR = path.join(ROOT, 'dist-dev', 'se');
let CRY_URI = null;
try {
  const smallest = fs.readdirSync(SE_DIR).filter(f => f.endsWith('.ogg'))
    .map(f => ({ f, size: fs.statSync(path.join(SE_DIR, f)).size }))
    .sort((a, b) => a.size - b.size)[0];
  if (smallest) CRY_URI = 'data:audio/ogg;base64,' +
    fs.readFileSync(path.join(SE_DIR, smallest.f)).toString('base64');
} catch (e) {}

(async () => {
  const allErrs = [];
  const results = {};
  const srv = spawn('bun', [path.join('devshell', 'server.js'), String(PORT)],
                    { cwd: ROOT, stdio: 'ignore', shell: process.platform === 'win32' });
  let b = null;
  try {
    /* サーバーが上がるまで待つ */
    let up = false;
    for (let i = 0; i < 30; i++) {
      try { const r = await fetch(BASE + '/__shell/config.json'); if (r.ok) { up = true; break; } } catch (e) {}
      await wait(300);
    }
    if (!up) { console.error('verify_dev: サーバーが立たんかった ' + BASE); process.exit(1); }

    /* .ogg が正しい MIME で配られとるか（02-01 で足した MIME 表の実地確認） */
    const oggRes = await fetch(BASE + '/dev/se/shot_light.ogg');
    const ctype = oggRes.headers.get('content-type') || '';
    results['se の MIME'] = { status: oggRes.status, contentType: ctype };
    if (!/audio\/ogg/.test(ctype)) allErrs.push('[se] content-type が audio/ogg やない: ' + ctype);

    b = await chromium.launch(LAUNCH);

    offlineFonts(b);

    for (const [name, file] of [
      ['音ラボ',     'shioumon_audio_lab.html'],
      ['技ラボ',     'shioumon_effect_lab.html'],
      ['戦闘',       'shioumon_field_test.html'],
      ['クリエーター', 'shioumon_creator.html'],
    ]) {
      const pg = await b.newPage({ viewport: { width: 420, height: 900 } });
      const errs = [];
      pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
      pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
      await pg.goto(BASE + '/dev/' + file);
      await pg.waitForTimeout(1200);

      /* 1. 音を解禁しても、79音が一括デコードされんこと。
            dist/ なら同じ操作で79件全部埋まる。ここが決定的な差。

            ⚠ 「必ず0件」やない。戦闘テスト画面は開いた瞬間にAI自動戦闘が始まって
            実際に音が鳴るけん、鳴った分だけ遅延デコードが走る（それは正常な動き）。
            見るべきは「一括で全部読んどらんか」であって「1件も読んどらんか」やない。 */
      const before = await pg.evaluate(async () => {
        if (typeof SND === 'undefined') return { err: 'no SND' };
        await SND.resume();
        return { bankTotal: Object.keys(SFX_SRC).length };
      });
      await pg.waitForTimeout(1500);
      const before2 = await pg.evaluate(() => {
        const bank = Object.keys(SFX_SRC);
        return Object.keys(SND.buf).filter(id => bank.includes(id)).length;
      });

      /* 2. まだ読んどらん音を1つ鳴らすと、その音だけが増えること。
            音IDはベタ書きせん —— AUDIO_CFG.system から、まだ未デコードのものを選ぶ（掟8）。
            戦闘画面は起動時に何音か鳴らしとるけん、単に先頭を取ると既読で当たってしまう。 */
      const played = await pg.evaluate(async () => {
        const bank = Object.keys(SFX_SRC);
        const cnt = () => Object.keys(SND.buf).filter(id => bank.includes(id)).length;
        let ev = null, want = null;
        for (const k of Object.keys(AUDIO_CFG.system)) {
          const sid = AUDIO_CFG.system[k].id;
          if (SFX_SRC[sid] && !SND.buf[sid]) { ev = k; want = sid; break; }
        }
        if (!ev) return { err: 'AUDIO_CFG.system に未デコードの音が無かった' };
        const n0 = cnt();
        playSys(ev);
        for (let i = 0; i < 40 && !SND.buf[want]; i++) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => setTimeout(r, 400));
        return { ev, want, has: !!SND.buf[want], n0, n1: cnt(), total: bank.length };
      });

      /* 3. 鳴き声（custom）の経路が data URI で今までどおり通ること（パッチBの data: 分岐）。
            本物の .ogg のバイト列を data URI にして渡す —— にーくらが鳴き声を読み込むのと同じ形。 */
      const custom = await pg.evaluate(async (uri) => {
        try { await SND.addCustom('gsd_test_cry', 'テスト', uri); return SND.buf['gsd_test_cry'] ? 'ok' : 'デコードされんかった'; }
        catch (e) { return 'ERR ' + (e && e.message || e); }
      }, CRY_URI);

      results[name] = {
        バンク総数: before.bankTotal,
        起動直後のデコード: before2,
        鳴らした音: played.want,
        鳴らす前後: played.n0 + ' → ' + played.n1,
        custom経路: custom,
        errs: errs.slice(0, 6),
      };

      /* 一括デコードしとらんことの判定。全79件が埋まっとったら遅延が効いとらん。
         起動時に鳴る音があるけん少数は許す（戦闘画面）。閾値は総数の1/4 */
      const cap = Math.floor(before.bankTotal / 4);
      if (before2 >= before.bankTotal) allErrs.push('[' + name + '] 起動直後に79件すべてデコードされとる（遅延が効いとらん）');
      else if (before2 > cap) allErrs.push('[' + name + '] 起動直後のデコードが ' + before2 + ' 件で多すぎる（' + cap + ' 件以下のはず）');
      if (played.err) allErrs.push('[' + name + '] ' + played.err);
      else {
        /* 遅延ロードの本体の判定。「鳴らす前は未デコード、鳴らした後はデコード済み」——
           これが遅延の定義そのもの。件数の増分は判定に使わん:
           戦闘テスト画面は開いた瞬間からAI自動戦闘が走っとって、待っとる数秒の間に
           試合の方でも音が鳴る。「ちょうど+1」は音が鳴り続けとる画面では原理的に成立せん。
           一括デコードしとらんことは、上の cap 判定と n1 が総数未満であることで見る。 */
        if (!played.has) allErrs.push('[' + name + '] 鳴らした音 ' + played.want + ' がデコードされんかった（遅延ロードが効いとらん）');
        if (played.n1 >= played.total) allErrs.push('[' + name + '] 鳴らしたあとに ' + played.n1 + ' 件（総数 ' + played.total + '）—— 一括デコードになっとる');
        if (played.n1 > cap) allErrs.push('[' + name + '] 鳴らしたあとのデコードが ' + played.n1 + ' 件で多すぎる（' + cap + ' 件以下のはず）');
      }
      if (custom !== 'ok') allErrs.push('[' + name + '] custom(鳴き声)の経路が壊れとる: ' + custom);
      errs.forEach(e => allErrs.push('[' + name + '] ' + e));
      await pg.close();
    }

    console.log(JSON.stringify(results, null, 2));
  } finally {
    if (b) await b.close().catch(() => {});
    srv.kill();
    /* Windows では shell 経由の子が残ることがあるけん、ポートを掴んどるやつを落とす */
    if (process.platform === 'win32') {
      try {
        require('child_process').execSync(
          'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ' + PORT +
          ' -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"',
          { stdio: 'ignore' });
      } catch (e) {}
    }
  }

  if (allErrs.length) {
    console.error('verify_dev: ' + allErrs.length + '件のエラー');
    allErrs.forEach(e => console.error(e));
  }
  process.exit(allErrs.length ? 1 : 0);
})();
