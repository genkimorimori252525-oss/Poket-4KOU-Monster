/* ============================================================
   制作ツール → 戦闘 の配線（WIRE-01〜05）

   これまで戦闘に出られたのは ROSTER_A / ROSTER_B にベタ書きされた個体だけやった。
   制作ツールで作った四皇モンは、影も鳴き声も自作技も、戦闘側から一度も読まれとらんかった。

   ここがその橋。保存済みの個体を戦闘の def へ組み替えて、
   - 自作技を MOVES と AUDIO_CFG へ登録する（コストも音も内蔵技と同じ道を通る＝掟8）
   - 写真を Image として積む
   - 影と鳴き声と召喚の設定をそのまま持ち込む
   ============================================================ */
var ROSTER = (function () {

  /* 保存済みの個体を読む。store_bridge が起動時に localStorage へ流し込んどる */
  function saved() {
    var out = [];
    try {
      var slots = JSON.parse(localStorage.getItem('shioumon_creator_slots') || '{}');
      Object.keys(slots).forEach(function (slotName) {
        try {
          var m = JSON.parse(slots[slotName]);
          m._slot = slotName;
          out.push(m);
        } catch (e) {}
      });
    } catch (e) {}
    return out;
  }

  /* 自作技を実行時の技表へ入れる。
     内蔵技と同じ MOVES に入れるけん、コスト計算も音の割り当ても同じ道を通る（掟8）。
     内蔵IDと同じ id の上書きも、制作ツールと同じふるまいになる。 */
  function registerMoves(mon) {
    var ids = [];
    (mon.customMoves || []).forEach(function (cm) {
      if (!cm || !cm.id) return;
      if (typeof MOVES !== 'undefined') MOVES[cm.id] = cm;
      /* 音は AUDIO_CFG 側が正。個体に抱えさせん（抱えるとにーくらの設定を上書きして壊す） */
      if (typeof AUDIO_CFG !== 'undefined' && cm.audio && cm.audio.length &&
          !(AUDIO_CFG.moves && AUDIO_CFG.moves[cm.id])) {
        AUDIO_CFG.moves = AUDIO_CFG.moves || {};
        AUDIO_CFG.moves[cm.id] = cm.audio;
      }
      ids.push(cm.id);
    });
    return ids;
  }

  /* 保存された個体 → 戦闘の addMember に渡す def */
  function toDef(mon) {
    registerMoves(mon);
    /* moves（内蔵技のID）と customMoves の両方。MOVES に無いIDは落とす */
    var ids = [];
    (mon.moves || []).forEach(function (id) { if (typeof MOVES !== 'undefined' && MOVES[id]) ids.push(id); });
    (mon.customMoves || []).forEach(function (cm) {
      if (cm && cm.id && ids.indexOf(cm.id) < 0) ids.push(cm.id);
    });
    if (!ids.length) ids = ['slash'];        /* 技ゼロやと戦闘が成立せんけん最低1本 */

    return {
      name: mon.name || mon._slot || mon.id,
      types: (mon.types && mon.types.length) ? mon.types : ['ノーマル'],
      stats: mon.stats || {},
      per: mon.per || {},
      moves: ids,
      cost: mon.cost,
      scale: mon.scale, dy: mon.dy,
      img: mon.img,                 /* 枠ごとの表示倍率・縦位置 */
      images: mon.images,           /* 写真そのもの（URL か data URI） */
      shadow: mon.shadow,           /* WIRE-03 */
      summon: mon.summon,           /* 出方と鳴くまでの間 */
      cry: mon.cry,                 /* WIRE-04 */
      idleMotion: mon.idleMotion,
      _slot: mon._slot,
      _id: mon.id
    };
  }

  /* 写真を Image として積む。URL でも data URI でも同じ扱い */
  function attachImages(f, def) {
    if (!def.images) return;
    Object.keys(def.images).forEach(function (k) {
      var src = def.images[k];
      if (!src || typeof src !== 'string') return;
      var im = new Image();
      im.onload = function () { f.imgs[k] = im; };
      im.src = src;
    });
  }

  /* 鳴き声を SoundBank へ登録する。

     ⚠ URL のまま addCustom に渡したらいかん。dist/ の SoundBank.decodeOne() は
     data URI しか扱えん（atob に URL を食わせて落ちる）。URL を読める版は
     dist-dev/ のビルド時パッチにしか入っとらんし、**src/sfx_bank.js は手で編集せん掟**やけん、
     ここで data URI に変えてから渡す。ファイルは数十KBやけん取り込んでも軽い。 */
  function attachCry(f, def) {
    if (!def.cry || !def.cry.id || !def.cry.data) return;
    f.cry = { id: def.cry.id, vol: def.cry.vol, rate: def.cry.rate, data: def.cry.data };
    if (typeof SND === 'undefined' || SND.custom[def.cry.id]) return;
    var label = def.cry.label || ((def.name || '') + 'の声');
    var src = def.cry.data;
    if (src.slice(0, 5) === 'data:') {
      try { SND.addCustom(def.cry.id, label, src); } catch (e) {}
      return;
    }
    fetch(src).then(function (r) {
      if (!r.ok) throw new Error('鳴き声が取れん ' + r.status);
      var mime = (r.headers.get('content-type') || 'audio/webm').split(';')[0];
      return r.arrayBuffer().then(function (ab) {
        var u8 = new Uint8Array(ab), bin = '';
        for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
        var uri = 'data:' + mime + ';base64,' + btoa(bin);
        f.cry.data = uri;
        SND.addCustom(def.cry.id, label, uri);
      });
    }).catch(function (e) { console.warn('[ROSTER] 鳴き声を読めんかった', def.cry.id, e); });
  }

  return {
    saved: saved,
    toDef: toDef,
    attachImages: attachImages,
    attachCry: attachCry,
    registerMoves: registerMoves
  };
})();
