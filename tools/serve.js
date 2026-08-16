#!/usr/bin/env node
/* dist/ をローカル配信するだけの検証用サーバ。file:// だとブラウザ検証が効かん環境がある。
   使い方:  node tools/serve.js [port]   → http://localhost:8765/shioumon_creator.html */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');
const PORT = parseInt(process.argv[2] || '8765', 10);
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json',
               '.png':'image/png', '.css':'text/css' };
http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('no'); return; }
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('見つからん: ' + rel); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
    res.end(buf);
  });
}).listen(PORT, () => console.log('serve  http://localhost:' + PORT + '/  ← dist/'));
