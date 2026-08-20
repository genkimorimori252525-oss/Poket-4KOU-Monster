#!/usr/bin/env node
/* =========================================================
   migrate_movelist.js — 技ネタ帳180個を data/moves/library.json へ追加専用で移す（MOVELIST-03）

   使い方: node tools/migrate_movelist.js

   ・docs/技ネタ_タイプ別.md が無ければ何もせん（既に廃止済み、という定常状態）。
   ・既に library.json に居る名前は一切触らん（上書きしない・触らない）。
   ・居らん名前だけ status:"idea" で追加する。fx も power/cast/cooldown も持たせん
     （design doc §6-3。決めたのか未定なのか見分けが付かんくなる数字は作らん）。
   ・何度実行しても、2回目以降は no-op になる（idempotence）。
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const DOC_PATH = path.join(__dirname, '..', 'docs', '技ネタ_タイプ別.md');
const LIB_PATH = path.join(__dirname, '..', 'data', 'moves', 'library.json');

const TYPES = [
  'ノーマル', 'ほのお', 'みず', 'でんき', 'くさ', 'こおり', 'かくとう', 'どく', 'じめん',
  'ひこう', 'エスパー', 'むし', 'いわ', 'ゴースト', 'ドラゴン', 'あく', 'はがね', 'フェアリー'
];

const METHOD_TO_GENERATOR = {
  '飛び道具': 'projectile',
  '光線': 'beam',
  '斬撃': 'slash',
  '雷': 'lightning',
  'オーラ': 'aura',
  '空間割れ': 'shatter'
};

function main() {
  if (!fs.existsSync(DOC_PATH)) {
    console.log('migrate_movelist: 技ネタ帳は既に廃止済み。何もせん。');
    return;
  }

  const doc = fs.readFileSync(DOC_PATH, 'utf8');
  const lines = doc.split(/\r?\n/);

  const records = [];
  let currentType = null;
  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      currentType = TYPES.includes(heading[1]) ? heading[1] : null;
      continue;
    }
    if (!currentType) continue;
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    // 例: "| 技名 | 作り方 | パレット | ねらい |" → split('|') → ['', '技名', '作り方', 'パレット', 'ねらい', '']
    if (cells.length < 6) continue;
    const [, name, method, palette, aim] = cells;
    if (!name || name === '技名' || /^-+$/.test(name)) continue;
    const generator = METHOD_TO_GENERATOR[method];
    if (!generator) throw new Error('migrate_movelist: 未知の作り方「' + method + '」（技: ' + name + '）');
    records.push({ type: currentType, name, generator, palette, aim });
  }

  console.log('migrate_movelist: 技ネタ帳から ' + records.length + ' 行パースした');

  const library = JSON.parse(fs.readFileSync(LIB_PATH, 'utf8'));
  const existingNames = new Set(Object.keys(library));

  const additions = {};
  let addedCount = 0;
  for (const rec of records) {
    if (existingNames.has(rec.name)) continue;
    additions[rec.name] = {
      name: rec.name,
      status: 'idea',
      battle: { type: rec.type },
      hint: { generator: rec.generator, palette: rec.palette },
      note: rec.aim
    };
    addedCount++;
  }

  if (!addedCount) {
    console.log('migrate_movelist: 追加なし（全部既存）');
    return;
  }

  const merged = Object.assign({}, library, additions);
  fs.writeFileSync(LIB_PATH, JSON.stringify(merged));
  console.log('migrate_movelist: ' + addedCount + '件を status:"idea" で追加した');
}

main();
