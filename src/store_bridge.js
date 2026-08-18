/* ============================================================
   保存の橋渡し（SAVE-01〜06）

   サーバー（devshell）がおるときは data/ のファイルが正。おらんときは今までどおり
   localStorage が正。**既存の保存コードは1行も変えん** —— 保存は全部
   localStorage.setItem を通っとるけん、その入口と出口だけを押さえる。

   起動時: ファイルの中身を localStorage へ流し込む（アプリが読む前に済ませる）
   保存時: localStorage への書き込みを拾って、ファイルへも書く（350msまとめ）

   file:// で単体HTMLを開いたときは何もせん。掟「単体で開ける」を壊さん。
   ============================================================ */
(function () {
  var KEYS = ['shioumon_creator_slots', 'shioumon_creator_auto', 'shioumon_move_lib_v1',
              'shioumon_audio_cfg_v1', 'shioumon_wild_pool_v1', 'shioumon_scene_sfx_v1'];
  /* localStorage のキー → data/ のファイル。移行スクリプトと同じ対応。
     creator_slots だけは個体ごとに1ファイルにするけん null（下で特別扱い） */
  var MAP = {
    'shioumon_creator_slots': null,
    'shioumon_creator_auto': 'creator-auto.json',
    'shioumon_move_lib_v1': 'moves/library.json',
    'shioumon_audio_cfg_v1': 'audio/config.json',
    'shioumon_wild_pool_v1': 'wild-pool.json',
    'shioumon_scene_sfx_v1': 'audio/scene.json'
  };
  var EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
              'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'webm',
              'audio/mp4': 'm4a', 'audio/aac': 'aac' };

  function bail(mode, note) { window.STORE_MODE = mode; window.STORE_NOTE = note; }

  /* file:// 直開きなら何もせん */
  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    bail('localStorage',
      'file:// で開いとるけん、保存先は今までどおりブラウザの中（localStorage）。' +
      'サーバー経由（npm run dev）で開くと data/ のファイルに残って、git で戻せるようになる。');
    return;
  }
  var SHELL = location.origin;

  /* アプリが読む前に揃えんといかんけん同期で取る。ローカルの開発ツールやけん許す */
  function getSync(url) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', url, false);
      x.send(null);
      return x.status === 200 ? x.responseText : null;
    } catch (e) { return null; }
  }

  /* メディアは URL で渡す（base64 に戻さんけん localStorage を食わん）。
     ただし mime（audio/webm;codecs=opus など）を落とすと、保存し返した時に
     別物になってしまう —— 実際に4体の鳴き声から ;codecs=opus が消えた。
     サーバーは url.pathname しか見んけん、クエリに積んで往復させる。 */
  function mediaUrl(ref) {
    var file = typeof ref === 'string' ? ref : ref.file;
    var mime = (typeof ref === 'object' && ref.mime) ? ref.mime : '';
    return SHELL + '/data/monsters/' + file + (mime ? '?mime=' + encodeURIComponent(mime) : '');
  }
  function parseMediaUrl(u) {
    var body = u.split('/data/monsters/')[1] || '';
    var q = body.indexOf('?');
    if (q < 0) return { file: body, mime: null };
    var mime = null;
    var m = /(?:^|&)mime=([^&]*)/.exec(body.slice(q + 1));
    if (m) { try { mime = decodeURIComponent(m[1]); } catch (e) { mime = null; } }
    return { file: body.slice(0, q), mime: mime };
  }

  var index = getSync(SHELL + '/__shell/data-index');
  if (index === null) {
    bail('localStorage', 'サーバーにデータの口が無いけん、保存先は localStorage のまま。');
    return;
  }
  var files = [];
  try { files = JSON.parse(index).files || []; } catch (e) { files = []; }

  /* ---------- 起動時：ファイル → localStorage ---------- */
  var slots = {};
  var loaded = 0;
  files.filter(function (f) { return /^monsters\/[^/]+\.json$/.test(f.path); }).forEach(function (f) {
    var txt = getSync(SHELL + '/data/' + f.path);
    if (!txt) return;
    var mon;
    try { mon = JSON.parse(txt); } catch (e) { return; }
    var slotName = mon._slot || mon.name || mon.id;
    delete mon._slot;
    /* 写真と鳴き声はURLのまま渡す。base64 に戻さんけん localStorage の容量も食わん */
    if (mon.images) {
      var im = {};
      for (var k in mon.images) {
        var v = mon.images[k];
        im[k] = v ? mediaUrl(v) : null;
      }
      mon.images = im;
    }
    if (mon.cry && mon.cry.file) {
      var c = {};
      for (var ck in mon.cry) c[ck] = mon.cry[ck];
      c.data = mediaUrl({ file: mon.cry.file, mime: mon.cry.mime });
      delete c.file; delete c.mime;
      mon.cry = c;
    }
    slots[slotName] = JSON.stringify(mon);
    loaded++;
  });
  if (loaded) {
    try { localStorage.setItem('shioumon_creator_slots', JSON.stringify(slots)); } catch (e) {}
  }
  for (var key in MAP) {
    if (!MAP[key]) continue;
    var txt2 = getSync(SHELL + '/data/' + MAP[key]);
    if (txt2 === null) continue;
    try { localStorage.setItem(key, txt2); } catch (e) {}
  }

  /* ---------- 保存時：localStorage → ファイル ---------- */
  var pending = {}, timer = null;

  function putMedia(id, slot, uri) {
    var comma = uri.indexOf(',');
    var head = uri.slice(5, comma).replace(/;\s*base64/i, '');
    var ext = EXT[head.split(';')[0]] || 'bin';
    var bin = atob(uri.slice(comma + 1));
    var buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    var rel = id + '/' + slot + '.' + ext;
    return fetch(SHELL + '/__shell/data/monsters/' + rel, { method: 'PUT', body: buf })
      .then(function () { return { file: rel, mime: head }; })
      .catch(function () { return { file: rel, mime: head }; });
  }

  function pushSlots(raw) {
    var obj;
    try { obj = JSON.parse(raw); } catch (e) { return; }
    Object.keys(obj).forEach(function (slotName) {
      var mon;
      try { mon = JSON.parse(obj[slotName]); } catch (e) { return; }
      var id = /^[A-Za-z0-9_-]+$/.test(String(mon.id || '')) ? mon.id : null;
      if (!id) return;                       /* id が使えん個体はファイルにせん（名前は日本語やけん） */
      var out = JSON.parse(JSON.stringify(mon));
      out._slot = slotName;
      var jobs = [];
      if (out.images) {
        Object.keys(out.images).forEach(function (k) {
          var v = out.images[k];
          if (typeof v !== 'string') return;
          if (v.slice(0, 5) === 'data:') {
            /* 新しく入れた写真。バイト列にして別ファイルへ */
            jobs.push(putMedia(id, k, v).then(function (r) { out.images[k] = r; }));
          } else if (v.indexOf('/data/monsters/') >= 0) {
            out.images[k] = parseMediaUrl(v);
          }
        });
      }
      if (out.cry && typeof out.cry.data === 'string') {
        if (out.cry.data.slice(0, 5) === 'data:') {
          jobs.push(putMedia(id, 'cry', out.cry.data).then(function (r) {
            out.cry.file = r.file; out.cry.mime = r.mime; delete out.cry.data;
          }));
        } else if (out.cry.data.indexOf('/data/monsters/') >= 0) {
          var pm = parseMediaUrl(out.cry.data);
          out.cry.file = pm.file;
          if (pm.mime) out.cry.mime = pm.mime;
          delete out.cry.data;
        }
      }
      Promise.all(jobs).then(function () {
        fetch(SHELL + '/__shell/data/monsters/' + id + '.json',
              { method: 'PUT', body: JSON.stringify(out, null, 2) + '\n' }).catch(function () {});
      });
    });
  }

  function flush() {
    timer = null;
    var ks = Object.keys(pending);
    pending = {};
    ks.forEach(function (key) {
      var raw = localStorage.getItem(key);
      if (raw === null) return;
      if (key === 'shioumon_creator_slots') { pushSlots(raw); return; }
      var rel = MAP[key];
      if (!rel) return;
      fetch(SHELL + '/__shell/data/' + rel, { method: 'PUT', body: raw }).catch(function () {});
    });
  }
  function mark(key) {
    if (KEYS.indexOf(key) < 0) return;
    pending[key] = 1;
    if (!timer) timer = setTimeout(flush, 350);   /* 既存のデバウンスと同じ間隔 */
  }

  var origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    try {
      var r = origSet(key, value);
      mark(key);
      return r;
    } catch (e) {
      /* localStorage が満杯でも、ファイルへは書く。データは失わせん */
      mark(key);
      throw e;
    }
  };

  bail('files', '保存先は data/ のファイル（' + loaded + '体を読み込んだ）。' +
                'git で戻せるし、容量の上限も無い。');
  console.log('[STORE] data/ のファイルへ保存する。読み込み ' + loaded + '体');

  /* ---------- シェルへの戻り口 ----------
     画面に入ったら戻れんかった（実際ににーくらが詰まった）。
     ここに置くんは、このモジュールが4画面すべてに入っとって、しかも
     「サーバー経由かどうか」を既に知っとる唯一の場所やけん。
     file:// で単体で開いたときは出さん —— そこにシェルは無い。 */
  function addBackLink() {
    if (document.getElementById('__shellBack')) return;
    var a = document.createElement('a');
    a.id = '__shellBack';
    a.href = '/';
    a.textContent = '← シェル';
    a.title = '開発シェルのダッシュボードへ戻る';
    a.style.cssText = [
      'position:fixed', 'top:6px', 'right:6px', 'z-index:99999',
      'font:11px/1 "DotGothic16","MS Gothic",monospace',
      'padding:6px 9px', 'border-radius:3px',
      'background:rgba(25,30,39,0.72)', 'color:#8b97a8',
      'border:1px solid rgba(44,52,66,0.8)', 'text-decoration:none',
      'opacity:0.55', 'transition:opacity .12s'
    ].join(';');
    a.addEventListener('mouseenter', function () { a.style.opacity = '1'; a.style.color = '#dfe6f0'; });
    a.addEventListener('mouseleave', function () { a.style.opacity = '0.55'; a.style.color = '#8b97a8'; });
    document.body.appendChild(a);
  }
  if (document.body) addBackLink();
  else document.addEventListener('DOMContentLoaded', addBackLink);
})();
