#!/usr/bin/env node
/* 触ったらいかんものが HEAD から1バイトも動いとらんかを見張るゲート。
   使い方:  node tools/check_untouched.js   （変わっとったら終了コード1）

   なぜ `git status` を使わんか:
   Windows の core.autocrlf=true やと git のインデックスの stat キャッシュが陳腐化して、
   **中身が同一なのに M と報告される**。Phase 1 でこの罠を2回踏んどる
   （01-02 / 01-03 の SUMMARY に診断記録あり）。
   git hash-object は実際の中身を読んでハッシュを出すけん、この偽陽性を原理的に踏まん。
   ゲートは見た目やのうて中身で判定する。 */
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const UNTOUCHABLE = [
  /* 復元手段が無い。CC0の元素材がこのマシンに無く、616KB のこれが79音の唯一の実体 */
  'src/sfx_bank.js',
  /* 単体で開ける・外部参照ゼロの掟を担う4画面。dist-dev/ を作っても動いたらいかん */
  'dist/shioumon_field_test.html',
  'dist/shioumon_effect_lab.html',
  'dist/shioumon_audio_lab.html',
  'dist/shioumon_creator.html',
];

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

let changed = 0;
for (const p of UNTOUCHABLE) {
  let work, head;
  try { work = git(['hash-object', p]); }
  catch (e) { console.log('  ？    ' + p + '  （作業ツリーに無い）'); changed++; continue; }
  try { head = git(['rev-parse', 'HEAD:' + p]); }
  catch (e) { console.log('  ？    ' + p + '  （HEAD に無い。ゲートの基準が存在せん）'); changed++; continue; }

  if (work === head) {
    console.log('  同じ  ' + p);
  } else {
    console.log('  変わっとる  ' + p + '\n          作業ツリー ' + work + '\n          HEAD       ' + head);
    changed++;
  }
}

if (changed) {
  console.error('\n不可触 ' + changed + '件 変わっとる。' +
                'これは racy git の見間違いやのうて本物の変更やけん、原因を突き止めて');
  process.exit(1);
}
console.log('\n不可触 ' + UNTOUCHABLE.length + '件すべて HEAD と一致');
process.exit(0);
