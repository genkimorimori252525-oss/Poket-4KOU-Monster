#!/usr/bin/env node
/* 移行で1件も失っとらんことを機械で確かめる（SAVE-07）。
   使い方:  node tools/verify_migration.js [backup.json]

   やり方: data/ のファイル群から**元の形を組み立て直して**、バックアップJSONの中身と
   1フィールドずつ突き合わせる。往復して同じなら、落ちたものは無い。
   「移行できたはず」やのうて「戻したら同じやった」で示す。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const MIME = { webp:'image/webp', png:'image/png', jpg:'image/jpeg', gif:'image/gif',
               mp3:'audio/mpeg', ogg:'audio/ogg', wav:'audio/wav', webm:'audio/webm',
               m4a:'audio/mp4', aac:'audio/aac' };

function findBackup(arg) {
  if (arg) return path.resolve(ROOT, arg);
  const c = fs.readdirSync(ROOT).filter(f => /^shioumon_backup_.*\.json$/.test(f))
    .map(f => ({ f, m: fs.statSync(path.join(ROOT, f)).mtimeMs })).sort((a,b)=>b.m-a.m);
  if (!c.length) { console.error('バックアップJSONが無い'); process.exit(1); }
  return path.join(ROOT, c[0].f);
}

/* 移行時に記録しといた mime をそのまま使う。拡張子から推測すると
   ;codecs=opus のようなパラメータが復元できん（実際にそれで4体ぶん食い違った） */
function toDataUri(ref) {
  const rel  = typeof ref === 'string' ? ref : ref.file;
  const abs  = path.join(DATA, 'monsters', rel);
  const ext  = path.extname(abs).slice(1).toLowerCase();
  const mime = (typeof ref === 'object' && ref.mime) ? ref.mime : (MIME[ext] || 'application/octet-stream');
  return 'data:' + mime + ';base64,' + fs.readFileSync(abs).toString('base64');
}
function refPath(ref) { return typeof ref === 'string' ? ref : ref.file; }

/* 深い比較。違うところの「道筋」を返す */
function diff(a, b, p, out) {
  if (out.length > 20) return out;
  const ta = a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a;
  const tb = b === null ? 'null' : Array.isArray(b) ? 'array' : typeof b;
  if (ta !== tb) { out.push(p + ': 型が違う ' + ta + ' vs ' + tb); return out; }
  if (ta === 'object') {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    for (const k of ka) if (!(k in b)) out.push(p + '.' + k + ': 移行後に無い');
    for (const k of kb) if (!(k in a)) out.push(p + '.' + k + ': 移行後に増えとる');
    for (const k of ka) if (k in b) diff(a[k], b[k], p + '.' + k, out);
  } else if (ta === 'array') {
    if (a.length !== b.length) { out.push(p + ': 要素数 ' + a.length + ' vs ' + b.length); return out; }
    for (let i = 0; i < a.length; i++) diff(a[i], b[i], p + '[' + i + ']', out);
  } else if (a !== b) {
    const sa = String(a), sb = String(b);
    out.push(p + ': ' + (sa.length > 40 ? sa.slice(0,20)+'…('+sa.length+'字)' : JSON.stringify(a))
             + ' vs ' + (sb.length > 40 ? sb.slice(0,20)+'…('+sb.length+'字)' : JSON.stringify(b)));
  }
  return out;
}

const src = findBackup(process.argv[2]);
const store = JSON.parse(fs.readFileSync(src, 'utf8'));
const slots = JSON.parse(store['shioumon_creator_slots'] || '{}');
const problems = [];
let checked = 0, mediaBytes = 0;

console.log('照合元: ' + path.relative(ROOT, src));
console.log('');
console.log('=== 四皇モン：ファイルから組み立て直して元と突き合わせる ===');

for (const slotName of Object.keys(slots)) {
  const original = JSON.parse(slots[slotName]);
  /* この個体のファイルを探す（_slot が一致するもの） */
  const files = fs.readdirSync(path.join(DATA, 'monsters')).filter(f => f.endsWith('.json'));
  let found = null;
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(DATA, 'monsters', f), 'utf8'));
    if (j._slot === slotName) { found = j; break; }
  }
  if (!found) { problems.push('「' + slotName + '」のファイルが無い'); continue; }

  /* 組み立て直す：メディアを data URI へ戻し、移行用の印を外す */
  const rebuilt = JSON.parse(JSON.stringify(found));
  delete rebuilt._slot;
  rebuilt.images = {};
  for (const k of Object.keys(found.images || {})) {
    const v = found.images[k];
    if (v == null) { rebuilt.images[k] = null; continue; }
    rebuilt.images[k] = toDataUri(v);
    mediaBytes += fs.statSync(path.join(DATA, 'monsters', refPath(v))).size;
  }
  if (found.cry && found.cry.file) {
    rebuilt.cry = Object.assign({}, found.cry);
    const uri = toDataUri({ file: found.cry.file, mime: found.cry.mime });
    mediaBytes += fs.statSync(path.join(DATA, 'monsters', found.cry.file)).size;
    delete rebuilt.cry.file; delete rebuilt.cry.mime;
    rebuilt.cry.data = uri;
  }

  const d = diff(original, rebuilt, '', []);
  checked++;
  if (d.length) { problems.push('「' + slotName + '」に ' + d.length + '件の違い:\n    ' + d.join('\n    ')); }
  console.log('  ' + (d.length ? '✗' : '✓') + '  ' + slotName.padEnd(14) + ' → ' + found.id
    + '  技' + ((original.moves||[]).length + (original.customMoves||[]).length) + '本'
    + '  写真' + Object.values(found.images||{}).filter(Boolean).length + '枚'
    + (found.cry && found.cry.file ? '  鳴き声あり' : ''));
}

console.log('');
console.log('=== 技の棚・音設定・草むら ===');
const pairs = [
  ['shioumon_move_lib_v1',  'moves/library.json', '技の棚',   '{}'],
  ['shioumon_audio_cfg_v1', 'audio/config.json',  '音設定',   '{}'],
  ['shioumon_wild_pool_v1', 'wild-pool.json',     '草むら',   '[]'],
  ['shioumon_scene_sfx_v1', 'audio/scene.json',   'シーン音', '{}'],
];
for (const [key, rel, label, dflt] of pairs) {
  const before = JSON.parse(store[key] || dflt);
  const after  = JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8'));
  const d = diff(before, after, '', []);
  const n = Array.isArray(before) ? before.length : Object.keys(before).length;
  console.log('  ' + (d.length ? '✗' : '✓') + '  ' + label.padEnd(8) + n + '件'
    + (store[key] === undefined ? '（元は存在せんかった。空で作った）' : ''));
  if (d.length) problems.push(label + 'に違い: ' + d.join(' / '));
}

console.log('');
if (problems.length) {
  console.error('■ 移行で失われた／変わったものがある ' + problems.length + '件');
  problems.forEach(p => console.error('  ' + p));
  process.exit(1);
}
console.log('個体 ' + checked + '体すべて、ファイルから戻したら元と1バイトも違わんかった。');
console.log('メディア ' + Math.round(mediaBytes / 1024) + ' KB を含めて往復一致。');
process.exit(0);
