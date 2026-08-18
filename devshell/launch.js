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

  /* この起動で使うブラウザの窓が、実際に画面に出とるか。
     プロセスの有無やのうて**窓の有無**を見る —— 立ち上がって即死ぬときも
     プロセスは一瞬存在するけん、それやと嘘になる。
     見分けが付かんときは true（黙る）。余計な警告を出すより害が少ない。 */
  function windowIsUp() {
    if (process.platform !== 'win32') return true;
    try {
      var out = require('child_process').execFileSync('powershell', ['-NoProfile', '-Command',
        '@(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq ' +
        JSON.stringify(browser).replace(/"/g, "'") + ' -and $_.MainWindowHandle -ne 0 }).Count'
      ], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] });
      return parseInt(out.trim(), 10) > 0;
    } catch (e) { return true; }
  }

  /* 窓を1つ開けて、**何ミリ秒生きたか**を返す */
  async function openWindow() {
    var at = Date.now();
    var proc = Bun.spawn([
      browser,
      '--app=http://127.0.0.1:' + port + '/',
      '--user-data-dir=' + profileDir,
      '--window-size=780,900',
      '--no-first-run',
      '--no-default-browser-check',
      /* Chrome for Testing が出す「自動テスト専用です」の帯を黙らせる。
         窓の上に常時居座って邪魔やった。

         ⚠ このフラグは「今の Chrome では効かん」と言われがちやが、
         **実機で確かめたら効いた**（v151.0.7922.34・2周とも帯が消えた）。
         逆に定番と言われる --test-type は効かんかった。伝聞やのうて測った結果。

         引き換えに他の帯（「ページを復元しますか」など）も出んくなるが、
         用途が決まった1枚窓やけん、むしろその方がよか。 */
      '--disable-infobars',
      '--autoplay-policy=no-user-gesture-required',
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
    await proc.exited;
    return Date.now() - at;
  }

  /* ⚠ ここは罠がある。同じ --user-data-dir を使っとる Chromium が既に居ると、
     新しい方は**既存の窓に仕事を渡して即座に終わる**。素直に受け取ると
     「閉じられた」と読めてしまい、下でサーバーを殺す —— その結果、
     **窓は生きとるのにサーバーだけ死んだ**状態が残る（実際に一度これで詰まった）。

     ところが「すぐ落ちた」には理由が2つあって、外からは見分けが付かん:
       (a) もう開いとる窓に渡した        …… 正常。窓は在る
       (b) 直前に殺した Chromium がまだプロファイルを離しとらん
                                         …… 失敗。**窓が出てこん**
     (b) を「渡した」と読んで黙ると、押しても何も起きんまま何の合図も出ん。
     窓を隠しとる（launch.vbs）けん、なおさら気付けん。

     どっちでも**少し待ってもう一度試す**のが正しい。(a) なら既存の窓が
     前に出るだけで害は無い。(b) なら今度こそ窓が出る。 */
  var lived = await openWindow();
  if (lived < 4000) {
    await new Promise(function (r) { setTimeout(r, 2500); });
    lived = await openWindow();
  }

  /* それでも窓が無いなら、渡したんやのうて**開けとらん**。Chromium は
     こういうとき黙って死ぬけん、押した人には「押しても何も起きん」としか見えん。

     ⚠ 原因を断定しとらん。実測で分かっとるんは「強制終了した直後に立て直すと
     しばらく窓が出んことがある（時間を置けば同じプロファイルで出る）」まで。
     プロファイルの壊れは**あり得る筋であって、確かめた原因やない**。
     一度それを原因と決めつけて外しとる。

     やけん、ここは最後の手当てとしてだけ置く。しかも**消さん。脇へ退ける**。
     中にどんな残り物があるか俺には分からんし、人のデータを俺の都合で捨てる話やない。
     退けたものが要らんと分かったら、にーくらが自分で消せばよか。 */
  if (lived < 4000 && !windowIsUp()) {
    var aside = profileDir + '.broken-' + Date.now();
    var moved = false;
    try {
      if (fs.existsSync(profileDir)) { fs.renameSync(profileDir, aside); moved = true; }
      fs.mkdirSync(profileDir, { recursive: true });
    } catch (e) {}
    if (moved) {
      console.log('窓が出んかった。プロファイルを ' + path.basename(aside) + ' へ退けて作り直す。');
      lived = await openWindow();
    }
  }

  if (lived < 4000 && !windowIsUp()) {
    var msg = '開けんかった。' + String.fromCharCode(10) +
              'サーバーは http://127.0.0.1:' + port + '/ で動いとる。' + String.fromCharCode(10) +
              '中を見るには devshell' + String.fromCharCode(92) + 'launch.cmd を直に叩いて。';
    console.error(msg);
    /* 窓を隠しとる（launch.vbs）けん、黙ったら誰も気付けん。ここだけは喋る */
    if (process.platform === 'win32') {
      try {
        require('child_process').execFileSync('powershell', ['-NoProfile', '-Command',
          'Add-Type -AssemblyName System.Windows.Forms; ' +
          '[System.Windows.Forms.MessageBox]::Show(' + JSON.stringify(msg).replace(/"/g, "'") +
          ", '開発シェル') | Out-Null"], { timeout: 60000, stdio: 'ignore' });
      } catch (e) {}
    }
    if (startedByMe && serverProc) serverProc.kill();
    process.exit(1);
  }

  if (lived < 4000) {
    console.log('もう開いとる窓に渡した（' + lived + 'ms）。サーバーは生かしたままにする。');
    return;
  }

  if (startedByMe && serverProc) {
    serverProc.kill();
  }
}

module.exports = { findBrowser: findBrowser, CANDIDATES: CANDIDATES };

if (require.main === module) main();
