#!/usr/bin/env node
/* =========================================================
   ビルド：共有モジュールを各HTMLテンプレートへ流し込む
   src/*.tpl.html の /*__NAME__*​/ を src/*.js の中身で置換して dist/ へ出す。
   （本番プロジェクトでは ES Modules の import に置き換わる想定）

   使い方:  node build.js
   ========================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC  = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const read = f => {
  const p = path.join(SRC, f);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
};

/* 置換トークン → 元ファイル */
const MODULES = {
  '/*__STORE__*/'   : read('store_bridge.js'),
  '/*__FX_CORE__*/' : read('fx_core.js'),
  '/*__SFX_BANK__*/': read('sfx_bank.js'),
  '/*__MOVES__*/'   : read('moves.js'),
  '/*__ANIMS__*/'   : read('anims.js'),
  '/*__AUDIO_UI__*/': read('audio_ui.js'),
  '/*__MOVELAB__*/' : read('movelab.js'),
  '/*__STARTER__*/' : read('starter_moves.js'),
};

const TARGETS = [
  ['lab.tpl.html',      'shioumon_effect_lab.html'],
  ['battle.tpl.html',   'shioumon_field_test.html'],
  ['audiolab.tpl.html', 'shioumon_audio_lab.html'],
  ['creator.tpl.html',  'shioumon_creator.html'],
];

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

let ok = 0;
for (const [tpl, out] of TARGETS) {
  const p = path.join(SRC, tpl);
  if (!fs.existsSync(p)) { console.warn('skip (無い):', tpl); continue; }
  let s = fs.readFileSync(p, 'utf8');
  for (const [token, code] of Object.entries(MODULES)) {
    if (s.includes(token)) s = s.replace(token, () => code);   // $& 展開を避けるため関数で渡す
  }
  const dst = path.join(DIST, out);
  fs.writeFileSync(dst, s);
  console.log('built', 'dist/' + out, '(' + Math.round(fs.statSync(dst).size / 1024) + ' KB)');
  ok++;
}
console.log(ok + ' / ' + TARGETS.length + ' 個ビルドした');

/* =========================================================
   開発用の軽いビルド（--dev）。ここから下は追記ブロック。

   上の 1〜54 行には一切触らん。dist/ のバイト不変を「気をつける」やのうて
   **構造**で保証するため。tools/check_untouched.js がハッシュで見張る。

   やること: src/sfx_bank.js に焼き込まれとる 79音の data URI を dist-dev/se/*.ogg
   として外へ出し、SoundBank を「鳴らす瞬間に1つずつ読む」形に差し替える。
   **src/sfx_bank.js は読むだけ。書き込まん。**（CC0の元素材がこのマシンに無い）

   使い方:  node build.js --dev
   ========================================================= */
const DEV = process.argv.includes('--dev');
if (DEV) {
  const vm = require('vm');
  const DEV_DIST = path.join(ROOT, 'dist-dev');
  const SE_DIR   = path.join(DEV_DIST, 'se');
  fs.mkdirSync(SE_DIR, { recursive: true });

  /* --- 1. SFX_SRC を「値」として取り出す（正規表現でこじ開けん） --- */
  const bankText = MODULES['/*__SFX_BANK__*/'];
  const cut = bankText.indexOf('class SoundBank');
  if (cut < 0) throw new Error('dev: sfx_bank.js に class SoundBank が見つからん');
  const sandbox = {};
  vm.runInNewContext(bankText.slice(0, cut) + '\nglobalThis.__SRC = SFX_SRC;', sandbox);
  const SRC_TABLE = sandbox.__SRC;
  const ids = Object.keys(SRC_TABLE || {});
  if (!ids.length) throw new Error('dev: SFX_SRC が0件。取り出しに失敗しとる');
  console.log('dev: 効果音 ' + ids.length + ' 件を取り出した');

  /* --- 2. 音をファイルへ出し、同じ文字列をテキスト側で相対URLへ差し替える（必ず対で） --- */
  const PREFIX = 'data:audio/ogg;base64,';
  let devBank = bankText;
  let seBytes = 0;
  for (const id of ids) {
    const uri = SRC_TABLE[id].data;
    if (typeof uri !== 'string' || !uri.startsWith(PREFIX)) {
      throw new Error('dev: 想定外の音の持ち方 ' + id + ' : ' + String(uri).slice(0, 40));
    }
    const buf = Buffer.from(uri.slice(PREFIX.length), 'base64');
    fs.writeFileSync(path.join(SE_DIR, id + '.ogg'), buf);
    seBytes += buf.length;
    const before = devBank.length;
    devBank = devBank.replace(uri, () => 'se/' + id + '.ogg');   // $& 展開を避けるため関数で渡す
    if (devBank.length === before) throw new Error('dev: 置換できんかった ' + id);
  }

  /* --- 3. SoundBank を遅延デコードにする。アンカーは1件でなければ即止める --- */
  const patch = (text, anchor, replacement, label) => {
    const n = text.split(anchor).length - 1;
    if (n !== 1) throw new Error('dev: アンカーが ' + n + ' 件（1件であるべき）: ' + label);
    return text.replace(anchor, () => replacement);
  };

  /* A: load() でバンクを一括デコードせん。custom（鳴き声）は今までどおり一括で読む */
  devBank = patch(devBank,
    '      const ids = Object.keys(SFX_SRC).concat(Object.keys(this.custom));',
    '      const ids = Object.keys(this.custom);   /* dev: バンクの音は play() の時に1つずつ読む */',
    'A load()');

  /* B: decodeOne() を URL にも対応させる。data: で始まるもの（鳴き声）は今までどおり */
  devBank = patch(devBank,
    "    const uri = (SFX_SRC[id]||this.custom[id]).data;\n" +
    "    const bin = atob(uri.split(',')[1]);\n" +
    "    const ab = new ArrayBuffer(bin.length); const u8 = new Uint8Array(ab);\n" +
    "    for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);\n" +
    "    this.buf[id] = await ctx.decodeAudioData(ab);",
    "    const uri = (SFX_SRC[id]||this.custom[id]).data;\n" +
    "    let ab;\n" +
    "    if(uri.slice(0,5)==='data:'){\n" +
    "      const bin = atob(uri.split(',')[1]);\n" +
    "      ab = new ArrayBuffer(bin.length); const u8 = new Uint8Array(ab);\n" +
    "      for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);\n" +
    "    }else{\n" +
    "      const r = await fetch(uri);\n" +
    "      if(!r.ok) throw new Error('音が取れん ' + uri + ' ' + r.status);\n" +
    "      ab = await r.arrayBuffer();\n" +
    "    }\n" +
    "    this.buf[id] = await ctx.decodeAudioData(ab);",
    'B decodeOne()');

  /* C: play() が未デコードの音を自分で読んでから鳴らし直す（playCry と同じ手口の一般化）。
        「どの音を鳴らすか」を決める層（AUDIO_CFG / playSys / playMovePhase）には触っとらん＝掟8 */
  devBank = patch(devBank,
    '    if(!this.ctx || !this.buf[id]) return false;',
    '    if(!this.ctx) return false;\n' +
    '    if(!this.buf[id]){\n' +
    '      /* dev: まだ読んどらん音は、ここで1つだけ読んでから鳴らし直す */\n' +
    '      if(!(SFX_SRC[id]||this.custom[id])) return false;\n' +
    '      this._pend = this._pend || {};\n' +
    '      if(this._pend[id]) return false;\n' +
    '      this._pend[id] = 1;\n' +
    '      this.decodeOne(id).then(()=>{ delete this._pend[id]; this.play(id,opt); })\n' +
    "                        .catch(e=>{ delete this._pend[id]; console.warn('[SND] 遅延decode失敗', id, e); });\n" +
    '      return false;\n' +
    '    }',
    'C play()');

  /* --- 4. dev 用の4HTMLを書き出す（既存ループは触らず、ここに独立して書く） --- */
  const DEV_MODULES = Object.assign({}, MODULES, { '/*__SFX_BANK__*/': devBank });
  const screens = [];
  let devOk = 0;
  for (const [tpl, out] of TARGETS) {
    const p = path.join(SRC, tpl);
    if (!fs.existsSync(p)) { console.warn('dev skip (無い):', tpl); continue; }
    let s = fs.readFileSync(p, 'utf8');
    for (const [token, code] of Object.entries(DEV_MODULES)) {
      if (s.includes(token)) s = s.replace(token, () => code);
    }
    const dst = path.join(DEV_DIST, out);
    fs.writeFileSync(dst, s);
    const devBytes  = fs.statSync(dst).size;
    const distBytes = fs.statSync(path.join(DIST, out)).size;   /* dist/ は読むだけ */
    const ratio = Math.round((devBytes / distBytes) * 1000) / 1000;
    screens.push({ file: out, distBytes, devBytes, ratio });
    console.log('dev: ' + out + '  ' + Math.round(distBytes / 1024) + ' KB → ' +
                Math.round(devBytes / 1024) + ' KB (' + Math.round(ratio * 100) + '%)');
    devOk++;
  }

  /* --- 5. 実測を残す。「軽くなった」を主張やのうて数字にする --- */
  fs.writeFileSync(path.join(DEV_DIST, 'BUILD-INFO.json'),
    JSON.stringify({ builtAt: new Date().toISOString(), sounds: ids.length, seBytes, screens }, null, 2));
  console.log('dev: se/ ' + ids.length + ' 本 / ' + Math.round(seBytes / 1024) + ' KB');
  console.log(devOk + ' / ' + TARGETS.length + ' 個 dist-dev へビルドした');
}
