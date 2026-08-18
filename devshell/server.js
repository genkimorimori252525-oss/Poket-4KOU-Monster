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
