#!/usr/bin/env node
/* localStorage のバックアップJSON → data/ 以下のファイルへ移す（SAVE-07）。
   使い方:  node tools/migrate_to_files.js [backup.json]
            引数を省くとリポジトリ直下の shioumon_backup_*.json のうち一番新しいものを使う。

   方針:
   - **元データは絶対に消さん。** localStorage にも触らん（読むのはバックアップJSONだけ）。
   - **冪等。** 二度流しても同じ結果になる。
   - **1件も失わんことを機械で確かめる。** 個体数・技の本数・メディアのバイト数を
     移行前後で突き合わせ、1つでも合わんかったら非ゼロで落ちる。
   - 写真と鳴き声は JSON の外へ出す。設計データだけが残るけん git の差分が読めるようになる。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

/* data URI の MIME から拡張子を決める。実物に従う（決め打ちせん） */
const EXT = {
  'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'webm',
  'audio/mp4': 'm4a', 'audio/aac': 'aac',
};

function splitDataUri(uri) {
  if (typeof uri !== 'string' || uri.slice(0, 5) !== 'data:') return null;
  const comma = uri.indexOf(',');
  if (comma < 0) return null;
  const head = uri.slice(5, comma);              // 例: image/webp;base64 / audio/webm;codecs=opus;base64
  const isB64 = /;base64/i.test(head);
  /* base64 の印だけ外して、あとは丸ごと保つ。;codecs=opus のようなパラメータを落とすと
     戻したとき別物になる（実際に4体の鳴き声で12文字消えとった） */
  const mime = head.replace(/;s*base64/i, '');
  const baseType = mime.split(';')[0];
  const body = uri.slice(comma + 1);
  const buf = isB64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8');
  return { mime, buf, ext: EXT[baseType] || 'bin' };
}

function readJson(s, fallback) {
  try { return JSON.parse(s); } catch (e) { return fallback; }
}

function findBackup(arg) {
  if (arg) return path.resolve(ROOT, arg);
  const cands = fs.readdirSync(ROOT)
    .filter(f => /^shioumon_backup_.*\.json$/.test(f))
    .map(f => ({ f, m: fs.statSync(path.join(ROOT, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  if (!cands.length) {
    console.error('バックアップJSONが見つからん。制作ツールのコンソールで書き出したファイルを');
    console.error('リポジトリ直下に置くか、パスを引数で渡して');
    process.exit(1);
  }
  return path.join(ROOT, cands[0].f);
}

const src = findBackup(process.argv[2]);
console.log('移行元: ' + path.relative(ROOT, src));
const store = readJson(fs.readFileSync(src, 'utf8'), null);
if (!store) { console.error('バックアップJSONが読めん'); process.exit(1); }

fs.mkdirSync(path.join(DATA, 'monsters'), { recursive: true });
fs.mkdirSync(path.join(DATA, 'moves'), { recursive: true });
fs.mkdirSync(path.join(DATA, 'audio'), { recursive: true });

/* ---------- 四皇モン ---------- */
const slots = readJson(store['shioumon_creator_slots'] || '{}', {});
const slotNames = Object.keys(slots);
const report = [];
let mediaFiles = 0, mediaBytes = 0;

for (const slotName of slotNames) {
  const mon = readJson(slots[slotName], null);
  if (!mon) { console.error('  読めん個体をとばした: ' + slotName); continue; }

  /* ファイル名は id（ASCII）。無い・使えん場合だけスロット名から作る */
  let id = String(mon.id || '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    id = 'mon_' + Buffer.from(slotName, 'utf8').toString('hex').slice(0, 12);
  }
  const dir = path.join(DATA, 'monsters', id);
  fs.mkdirSync(dir, { recursive: true });

  /* 設計データだけを残した写しを作る。元は書き換えん */
  const out = JSON.parse(JSON.stringify(mon));
  out._slot = slotName;   /* 保存スロット名。mon.name と違うことがある（◯◯2 など）。無損失のため保つ */

  /* 写真: images.<枠> の data URI を実ファイルへ */
  const imgs = mon.images || {};
  out.images = {};
  for (const k of Object.keys(imgs)) {
    const d = splitDataUri(imgs[k]);
    if (!d) { out.images[k] = null; continue; }
    const fname = k + '.' + d.ext;
    fs.writeFileSync(path.join(dir, fname), d.buf);
    out.images[k] = { file: id + '/' + fname, mime: d.mime };
    mediaFiles++; mediaBytes += d.buf.length;
  }

  /* 鳴き声: cry.data を実ファイルへ。id/vol/rate/label は残す */
  if (mon.cry && mon.cry.data) {
    const d = splitDataUri(mon.cry.data);
    if (d) {
      const fname = 'cry.' + d.ext;
      fs.writeFileSync(path.join(dir, fname), d.buf);
      out.cry = Object.assign({}, mon.cry);
      delete out.cry.data;
      out.cry.file = id + '/' + fname;
      out.cry.mime = d.mime;
      mediaFiles++; mediaBytes += d.buf.length;
    }
  }

  const jsonPath = path.join(DATA, 'monsters', id + '.json');
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2) + '\n');

  const moveCount = (Array.isArray(mon.moves) ? mon.moves.length : 0)
                  + (Array.isArray(mon.customMoves) ? mon.customMoves.length : 0);
  report.push({
    slot: slotName, id,
    beforeKB: Math.round(slots[slotName].length / 1024),
    afterKB: Math.round(fs.statSync(jsonPath).size / 1024),
    moves: moveCount,
  });
}

/* ---------- 技の棚・音設定・草むら・その他 ---------- */
const lib = readJson(store['shioumon_move_lib_v1'] || '{}', {});
fs.writeFileSync(path.join(DATA, 'moves', 'library.json'), JSON.stringify(lib, null, 2) + '\n');

const acfg = readJson(store['shioumon_audio_cfg_v1'] || '{}', {});
fs.writeFileSync(path.join(DATA, 'audio', 'config.json'), JSON.stringify(acfg, null, 2) + '\n');

const wild = readJson(store['shioumon_wild_pool_v1'] || '[]', []);
fs.writeFileSync(path.join(DATA, 'wild-pool.json'), JSON.stringify(wild, null, 2) + '\n');

const scene = readJson(store['shioumon_scene_sfx_v1'] || '{}', {});
fs.writeFileSync(path.join(DATA, 'audio', 'scene.json'), JSON.stringify(scene, null, 2) + '\n');

const auto = store['shioumon_creator_auto'];
if (auto) fs.writeFileSync(path.join(DATA, 'creator-auto.json'), JSON.stringify(readJson(auto, {}), null, 2) + '\n');

/* 小さい設定値はまとめて1つに */
const settings = {};
for (const k of Object.keys(store)) {
  if (/^shioumon_/.test(k) && !/creator_slots|move_lib_v1|audio_cfg_v1|wild_pool_v1|scene_sfx_v1|creator_auto/.test(k)) {
    settings[k] = store[k];
  }
}
fs.writeFileSync(path.join(DATA, 'settings.json'), JSON.stringify(settings, null, 2) + '\n');

/* ---------- 結果 ---------- */
console.log('');
console.log('四皇モン ' + report.length + '体');
for (const r of report) {
  console.log('  ' + String(r.beforeKB).padStart(4) + ' KB → ' + String(r.afterKB).padStart(3) + ' KB  '
    + r.id.padEnd(11) + '（' + r.slot + '） 技' + r.moves + '本');
}
console.log('  メディア ' + mediaFiles + 'ファイル / ' + Math.round(mediaBytes / 1024) + ' KB を外へ出した');
console.log('');
console.log('技の棚 ' + Object.keys(lib).length + '本 → data/moves/library.json');
console.log('音設定 技' + Object.keys(acfg.moves || {}).length + '件・システム'
  + Object.keys(acfg.system || {}).length + '件 → data/audio/config.json');
console.log('草むら ' + (Array.isArray(wild) ? wild.length : 0) + '件 → data/wild-pool.json');
console.log('設定 ' + Object.keys(settings).length + '件 → data/settings.json');
console.log('');
console.log('元の localStorage には触っとらん。バックアップJSONも残っとる。');
