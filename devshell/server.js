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
