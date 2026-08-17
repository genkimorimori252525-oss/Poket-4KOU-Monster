#!/usr/bin/env node
/* 検証チェーンの外側ランナー。tools/verify_*.js の4本は1バイトも編集せず、
   このファイルが順に呼んで合否・所要時間を .verify-status.json へ書き残す。
   Node の素の CommonJS のみで書く(require/child_process/fs のみ。Bun専用APIは使わない)。
   最初に非ゼロで終わった段でループを止め、到達しなかった段は skipped:true として記録する。
   使い方: node devshell/verify-report.js */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'shell.config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const stages = config.verifyStages || [];

const startedAt = new Date().toISOString();
const results = [];
let failedExitCode = 0;

for (let i = 0; i < stages.length; i++) {
  const stage = stages[i];

  if (failedExitCode !== 0) {
    // 直前までの段が失敗しとる。この段は走らせず「走っとらん」として記録する ——
    // 走っていない段を「通った」と書かないため(Phase 1 で殺した「嘘をつく検証」を繰り返さない)。
    results.push({ name: stage.name, label: stage.label, ok: null, exitCode: null, ms: null, skipped: true });
    continue;
  }

  const cmd = stage.cmd;
  const t0 = Date.now();
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', cwd: REPO_ROOT });
  const ms = Date.now() - t0;
  // シグナルで落ちて r.status が null になるケースも失敗として扱う
  const exitCode = r.status == null ? 1 : r.status;
  const ok = exitCode === 0;

  results.push({ name: stage.name, label: stage.label, ok: ok, exitCode: exitCode, ms: ms, skipped: false });
  if (!ok) failedExitCode = exitCode;
}

const finishedAt = new Date().toISOString();
const overallOk = results.length > 0 && results.every(function (s) { return s.ok === true; });

const report = {
  startedAt: startedAt,
  finishedAt: finishedAt,
  ok: overallOk,
  stages: results,
};

try {
  const outPath = path.resolve(REPO_ROOT, config.verifyStatus);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
} catch (e) {
  // 記録は付随物であって判定やない。書けんかっても検証そのものの終了コードは変えない。
  console.error('検証結果を書けんかった: ' + e.message);
}

process.exit(failedExitCode || 0);
