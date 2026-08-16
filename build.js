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
  '/*__FX_CORE__*/' : read('fx_core.js'),
  '/*__SFX_BANK__*/': read('sfx_bank.js'),
  '/*__MOVES__*/'   : read('moves.js'),
  '/*__ANIMS__*/'   : read('anims.js'),
  '/*__AUDIO_UI__*/': read('audio_ui.js'),
  '/*__FX_AUDIO__*/': read('fx_audio.js'),   // 旧・手続き音源（現在は未使用）
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
