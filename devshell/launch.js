#!/usr/bin/env bun
/* devshell の起動本体。ブラウザ探索とサーバー起動を行う。Bun で走らせる。
   使い方:  bun devshell/launch.js
   findBrowser / CANDIDATES はテストから直接 require() で呼べるように CommonJS で公開する。
   このファイルの上半分（findBrowser・CANDIDATES）は fs/path しか使わず、
   plain Node からも require() できる（Bun 専用APIは main() の中だけ）。 */
const fs = require('fs');
const path = require('path');

// 存在確認だけで済ませる静的フォールバック候補（Chrome → Edge の順）。
// Playwright 同梱 Chromium は %LOCALAPPDATA%\ms-playwright\chromium-* を都度 glob するので
// ここには含めない（バージョンでディレクトリ名が変わるため固定パスにできない）。
const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

/* ブラウザの実行ファイルを探す。fs.existsSync だけで判定し、実行ファイルは一切起動しない
   （このマシンでは --version 相当が2分帰ってこんかった実測がある）。
   探索順: 環境変数 SHELL_BROWSER → Playwright 同梱 Chromium（chromium- で始まる、降順）→ CANDIDATES。 */
function findBrowser() {
  if (process.env.SHELL_BROWSER && fs.existsSync(process.env.SHELL_BROWSER)) {
    return process.env.SHELL_BROWSER;
  }

  var pwBase = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(pwBase)) {
    var entries = fs.readdirSync(pwBase)
      .filter(function (e) { return e.indexOf('chromium-') === 0; }) // ハイフン。chromium_headless_shell- は自然に外れる
      .sort()
      .reverse();
    for (var i = 0; i < entries.length; i++) {
      var p = path.join(pwBase, entries[i], 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(p)) return p;
    }
  }

  for (var j = 0; j < CANDIDATES.length; j++) {
    if (CANDIDATES[j] && fs.existsSync(CANDIDATES[j])) return CANDIDATES[j];
  }

  return null;
}

async function pingOnce(url) {
  try {
    var res = await fetch(url);
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function main() {
  var configPath = path.join(__dirname, 'shell.config.json');
  var config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  var port = config.port;
  var repoRoot = path.join(__dirname, '..');
  var pingUrl = 'http://127.0.0.1:' + port + '/__shell/ping';

  var startedByMe = false;
  var serverProc = null;

  var already = await pingOnce(pingUrl);
  if (!already) {
    var serverPath = path.join(__dirname, 'server.js');
    serverProc = Bun.spawn([process.execPath, serverPath], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    startedByMe = true;

    var up = false;
    for (var i = 0; i < 50; i++) {
      await new Promise(function (r) { setTimeout(r, 100); });
      if (await pingOnce(pingUrl)) { up = true; break; }
    }
    if (!up) {
      console.error('サーバーが立ち上がらん（5秒待った）');
      process.exit(1);
    }
  } else {
    console.log('devshell はもう立っとる。それに乗る。');
  }

  var browser = findBrowser();
  if (!browser) {
    console.error('ブラウザが見つからん。SHELL_BROWSER に実行ファイルのパスを入れて');
    process.exit(1);
  }

  var profileDir = path.resolve(repoRoot, config.profileDir);
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('起動: ' + browser);
  var browserProc = Bun.spawn([
    browser,
    '--app=http://127.0.0.1:' + port + '/',
    '--user-data-dir=' + profileDir,
    '--window-size=780,900',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  await browserProc.exited;

  if (startedByMe && serverProc) {
    serverProc.kill();
  }
}

module.exports = { findBrowser: findBrowser, CANDIDATES: CANDIDATES };

if (require.main === module) main();
