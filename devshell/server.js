#!/usr/bin/env bun
/* devshell 用の Bun サーバ。tools/serve.js（dist/ 専用・ポート8765・検証チェーンとは無関係）とは
   別に立つ。ダッシュボードの配信 ＋ dist/・dist-dev/ の静的配信を 127.0.0.1 だけで行う。
   使い方:  bun devshell/server.js [port]   → http://127.0.0.1:8766/ */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(import.meta.dir, '..');
const CONFIG_PATH = path.join(import.meta.dir, 'shell.config.json');
const DASHBOARD_PATH = path.join(import.meta.dir, 'dashboard.html');

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

const CONFIG = readConfig();
const PORT = parseInt(process.argv[2] || CONFIG.port || '8766', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.css': 'text/css',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// 長いプレフィックス優先で照合する（/dev/ を / より先に見る）
const ROOTS = (CONFIG.roots || [])
  .map((r) => ({ prefix: r.prefix, dir: path.resolve(REPO_ROOT, r.dir) }))
  .sort((a, b) => b.prefix.length - a.prefix.length);

function text(body, status, contentType) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': contentType || 'text/plain; charset=utf-8' },
  });
}

function readJsonSafe(absPath) {
  // ファイルが無い・壊れとる場合は例外を投げず null を返す。loadSlots() 系の
  // read-with-fallback idiom と同じ考え方（PATTERNS「localStorage read-with-fallback idiom」）。
  try {
    if (!fs.existsSync(absPath)) return null;
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function serveFromRoot(rel, rootAbs) {
  const resolved = path.resolve(rootAbs, rel);
  // 兄弟ディレクトリ名の接頭辞一致（dist と dist-dev2 のような食い違い）も塞ぐ。T-02-04
  if (resolved !== rootAbs && !resolved.startsWith(rootAbs + path.sep)) {
    return text('no', 403);
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return text('見つからん: ' + rel, 404);
  }
  const buf = fs.readFileSync(resolved);
  return text(buf, 200, MIME[path.extname(resolved)] || 'application/octet-stream');
}

Bun.serve({
  hostname: '127.0.0.1', // LANから待ち受けない。T-02-03
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch (e) {
      return text('no', 400);
    }

    if (pathname === '/') {
      return text(fs.readFileSync(DASHBOARD_PATH), 200, MIME['.html']);
    }
    if (pathname === '/__shell/ping') {
      return text('ok', 200);
    }
    if (pathname === '/__shell/config.json') {
      return text(fs.readFileSync(CONFIG_PATH, 'utf8'), 200, MIME['.json']);
    }
    /* ---- データの書き込みAPI（127.0.0.1 限定）。dataDir の外へは1バイトも書かん ---- */
    if (pathname.startsWith('/__shell/data/')) {
      if (!CONFIG.dataDir) return text('dataDir が設定されとらん', 501);
      const dataRoot = path.resolve(REPO_ROOT, CONFIG.dataDir);
      const rel = pathname.slice('/__shell/data/'.length);
      const target = path.resolve(dataRoot, rel);
      // 封じ込め。兄弟ディレクトリの接頭辞一致も塞ぐ（静的配信と同じ判定）
      if (target !== dataRoot && !target.startsWith(dataRoot + path.sep)) {
        return text('no', 403);
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        return req.arrayBuffer().then((ab) => {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, Buffer.from(ab));
          return text(JSON.stringify({ ok: true, path: rel, bytes: ab.byteLength }), 200, MIME['.json']);
        });
      }
      if (req.method === 'DELETE') {
        if (!fs.existsSync(target)) return text(JSON.stringify({ ok: true, missing: true }), 200, MIME['.json']);
        fs.rmSync(target, { recursive: true, force: true });
        return text(JSON.stringify({ ok: true, deleted: rel }), 200, MIME['.json']);
      }
      if (req.method === 'GET') {
        if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return text('見つからん: ' + rel, 404);
        return text(fs.readFileSync(target), 200, MIME[path.extname(target)] || 'application/octet-stream');
      }
      return text('no', 405);
    }

    /* ---- データの一覧。中身は返さん（大きいけん）。パスと大きさだけ ---- */
    if (pathname === '/__shell/data-index') {
      if (!CONFIG.dataDir) return text(JSON.stringify({ files: [] }), 200, MIME['.json']);
      const dataRoot = path.resolve(REPO_ROOT, CONFIG.dataDir);
      const out = [];
      const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, e.name);
          if (e.isDirectory()) walk(abs);
          else out.push({ path: path.relative(dataRoot, abs).split(path.sep).join('/'), bytes: fs.statSync(abs).size });
        }
      };
      walk(dataRoot);
      return text(JSON.stringify({ files: out }), 200, MIME['.json']);
    }

    /* ---- プロジェクト一覧（ハブ用）。config.projects があるときだけ働く ----
       種類を問わん共通の状態だけを出す: git・GSD・自前のシェルがあるか。
       そのプロジェクトにしか無いものはここに出さん —— 種類が違えば持っとらんけん。 */
    if (pathname === '/__shell/projects') {
      const list = CONFIG.projects || [];
      const out = list.map((proj) => {
        const dir = path.resolve(REPO_ROOT, proj.dir);
        /* percent と note は**にーくらが設定に書いた分だけ**通す。
           自動計算はせん —— 進捗率は数えられるもんやのうて、本人の申告やけん。 */
        const row = { label: proj.label || path.basename(dir), dir, exists: fs.existsSync(dir),
                      percent: (typeof proj.percent === 'number') ? proj.percent : null,
                      note: proj.note || null };
        if (!row.exists) return row;

        /* 種類。何で建てとるかで見分ける */
        row.kind = fs.existsSync(path.join(dir, 'gradlew')) || fs.existsSync(path.join(dir, 'build.gradle'))
          ? 'Java/Gradle'
          : fs.existsSync(path.join(dir, 'package.json')) ? 'Node' : '—';

        /* git。読むだけ。書き込みも fetch もせん */
        const git = (args) => {
          try {
            return require('child_process')
              .execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
              .trim();
          } catch (e) { return null; }
        };
        if (fs.existsSync(path.join(dir, '.git'))) {
          const porcelain = git(['status', '--porcelain']);
          const lines = porcelain ? porcelain.split(String.fromCharCode(10)).filter(Boolean) : [];
          const countN = (v) => { const x = parseInt(v || '', 10); return isNaN(x) ? null : x; };
          row.git = {
            branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
            dirty: lines.length,
            /* 未コミットの内訳。数えるだけ */
            untracked: lines.filter((l) => l.indexOf('??') === 0).length,
            lastSubject: git(['log', '-1', '--format=%s']),
            lastAt: git(['log', '-1', '--format=%cI']),
            /* 活動量。「最近どれを触っとるか」が一目で分かる。数えるだけで推定は入っとらん */
            commits7: countN(git(['rev-list', '--count', '--since=7 days ago', 'HEAD'])),
            commits30: countN(git(['rev-list', '--count', '--since=30 days ago', 'HEAD'])),
            total: countN(git(['rev-list', '--count', 'HEAD']))
          };
          /* remote があるときだけ、何個先／何個遅れかを出す。fetch はせん（勝手に通信せん） */
          const up = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
          if (up) {
            const ab = git(['rev-list', '--left-right', '--count', 'HEAD...@{u}']);
            if (ab) {
              const parts = ab.split(/\s+/);
              row.git.ahead = countN(parts[0]);
              row.git.behind = countN(parts[1]);
            }
          }
        }

        /* GSD。STATE.md の frontmatter から現在地だけ拾う（読むだけ） */
        const st = path.join(dir, '.planning', 'STATE.md');
        if (fs.existsSync(st)) {
          try {
            const head = fs.readFileSync(st, 'utf8').split('---')[1] || '';
            /* frontmatter から1つ拾う。正規表現やのうて素直に行を探す ——
               percent は progress: の下に**字下げして**書かれとるけん、行頭一致やと取れん。 */
            const rows = head.split(String.fromCharCode(10));
            const pick = (k) => {
              const line = rows.find((l) => l.trim().indexOf(k + ':') === 0);
              if (!line) return null;
              return line.trim().slice(k.length + 1).trim().replace(/^["']|["']$/g, '');
            };
            row.gsd = {
              phase: pick('current_phase'),
              phaseName: pick('current_phase_name'),
              status: pick('status'),
              activity: pick('last_activity_desc')
            };
            /* フェーズと要件は**チェックボックスを数えるだけ**。率にはせん ——
               「3/4 完了」は事実やが、それを 75% と書いた瞬間
               「プロジェクトが75%終わった」という別の主張になってしまう。
               率を出すんは、にーくらが設定に書いた分だけ。 */
            const tick = (file, re) => {
              try {
                const t = fs.readFileSync(path.join(dir, '.planning', file), 'utf8');
                const all = t.match(re);
                if (!all) return null;
                const done = all.filter((l) => l.indexOf('[x]') >= 0 || l.indexOf('[X]') >= 0).length;
                return { done, total: all.length };
              } catch (e) { return null; }
            };
            row.gsd.phases = tick('ROADMAP.md', /^- \[[ xX]\] \*\*Phase .*$/gm);
            row.gsd.reqs   = tick('REQUIREMENTS.md', /^- \[[ xX]\] \*\*[A-Z]+-[0-9]+\*\*.*$/gm);
          } catch (e) {}
        }

        /* 最後にビルドが通った証拠。Java は成果物の .jar、Node は検証結果ファイル。
           **古さも一緒に出す** —— 3日前に通ったんは「通っとる」とは違う。 */
        const newest = (d, ext) => {
          try {
            let best = null;
            for (const f of fs.readdirSync(d)) {
              if (ext && !f.endsWith(ext)) continue;
              const st = fs.statSync(path.join(d, f));
              if (!st.isFile()) continue;
              if (!best || st.mtimeMs > best.at) best = { name: f, at: st.mtimeMs, bytes: st.size };
            }
            return best;
          } catch (e) { return null; }
        };
        const libs = path.join(dir, 'build', 'libs');
        if (fs.existsSync(libs)) row.build = newest(libs, '.jar');
        const vs = path.join(dir, '.verify-status.json');
        if (fs.existsSync(vs)) {
          const j = readJsonSafe(vs);
          if (j) row.verify = { ok: j.ok, at: j.finishedAt, stages: (j.stages || []).length };
        }

        row.hasShell = fs.existsSync(path.join(dir, 'devshell', 'launch.js'));
        return row;
      });
      return text(JSON.stringify({ projects: out }), 200, MIME['.json']);
    }

    /* ---- そのプロジェクトを開く。config.projects に載っとるものだけ ----
       ⚠ ここは一度「嘘をついた」箇所。Windows で shell 無しの spawn は bun.exe を
       解決できずに失敗するが、その失敗は例外やのうて 'error' イベントで飛ぶ。
       受け取らんまま ok:true を返しとったけん、**何も起きとらんのに「開いた」と出とった**。
       今は起動を見届けてから返す。 */
    if (pathname === '/__shell/open' && req.method === 'POST') {
      return req.text().then(async (body) => {
        let want = '';
        try { want = (JSON.parse(body) || {}).dir || ''; } catch (e) {}
        const hit = (CONFIG.projects || []).find((p) => path.resolve(REPO_ROOT, p.dir) === path.resolve(want));
        if (!hit) return text(JSON.stringify({ ok: false, why: '設定に載っとらん場所' }), 403, MIME['.json']);
        const dir = path.resolve(REPO_ROOT, hit.dir);
        const cp = require('child_process');
        const win = process.platform === 'win32';

        /* 起動して、error が飛ばんかったかを少し待って見る */
        const trySpawn = (cmd, args, opts) => new Promise((resolve) => {
          let child;
          try { child = cp.spawn(cmd, args, Object.assign({ detached: true, stdio: 'ignore', shell: win }, opts)); }
          catch (e) { return resolve({ ok: false, why: String(e.message || e) }); }
          let done = false;
          child.on('error', (e) => { if (!done) { done = true; resolve({ ok: false, why: String(e.message || e) }); } });
          setTimeout(() => { if (!done) { done = true; try { child.unref(); } catch (e) {} resolve({ ok: true }); } }, 700);
        });

        const shellPath = path.join(dir, 'devshell', 'launch.js');
        if (fs.existsSync(shellPath)) {
          const r = await trySpawn('bun', [path.join('devshell', 'launch.js')], { cwd: dir });
          if (!r.ok) return text(JSON.stringify({ ok: false, how: 'devshell', why: r.why }), 200, MIME['.json']);
          /* そのプロジェクトのシェルが実際に立ったかを、自分のポートを見て確かめる */
          let port = null;
          try { port = JSON.parse(fs.readFileSync(path.join(dir, 'devshell', 'shell.config.json'), 'utf8')).port; } catch (e) {}
          if (port) {
            for (let i = 0; i < 20; i++) {
              try { const rr = await fetch('http://127.0.0.1:' + port + '/__shell/ping'); if (rr.ok) return text(JSON.stringify({ ok: true, how: 'devshell', port }), 200, MIME['.json']); }
              catch (e) {}
              await new Promise((r2) => setTimeout(r2, 400));
            }
            return text(JSON.stringify({ ok: false, how: 'devshell', why: 'シェルは起動したが ' + port + ' が応答せん' }), 200, MIME['.json']);
          }
          return text(JSON.stringify({ ok: true, how: 'devshell' }), 200, MIME['.json']);
        }

        /* シェルを持っとらんプロジェクトはフォルダを開く。これも「開く」の一種 */
        const r2 = await trySpawn('explorer', [dir], {});
        /* explorer は開けても非ゼロで終わることがあるけん、error が飛ばんかっただけで良しとする */
        return text(JSON.stringify({ ok: r2.ok, how: 'folder', why: r2.why || null }), 200, MIME['.json']);
      });
    }

    if (pathname === '/__shell/status') {
      const now = new Date();
      const verify = readJsonSafe(path.resolve(REPO_ROOT, CONFIG.verifyStatus));
      const verifyAgeMs = verify && verify.finishedAt ? now - new Date(verify.finishedAt) : null;
      const build = readJsonSafe(path.resolve(REPO_ROOT, CONFIG.buildInfo));
      const buildAgeMs = build && build.builtAt ? now - new Date(build.builtAt) : null;
      const status = { verify, verifyAgeMs, build, buildAgeMs, now: now.toISOString() };
      return text(JSON.stringify(status), 200, MIME['.json']);
    }

    for (const root of ROOTS) {
      if (pathname.startsWith(root.prefix)) {
        const rel = pathname.slice(root.prefix.length);
        if (!fs.existsSync(root.dir)) {
          return text('見つからん: ' + rel, 404);
        }
        return serveFromRoot(rel, root.dir);
      }
    }
    return text('見つからん: ' + pathname, 404);
  },
});

console.log('devshell  http://127.0.0.1:' + PORT + '/');
