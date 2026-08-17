/* =========================================================
   掟4の突き合わせ検証：battle.tpl.html と creator.tpl.html の resolve()
   両者は別々の実装（D-03の決定で1つへはまとめん）やけん、
   同じ入力を両方へ食わせて返り値が一致するかだけを見る。
   使い方: node tools/verify_resolve.js
   ========================================================= */
const { chromium } = require('playwright');
const path = require('path');
const DIST_URL = 'file://' + path.join(__dirname, '..', 'dist') + '/';
/* Chromium が見つからんときは PW_CHROMIUM に実行ファイルのパスを入れる */
const LAUNCH = { args:['--autoplay-policy=no-user-gesture-required'] };
if(process.env.PW_CHROMIUM) LAUNCH.executablePath = process.env.PW_CHROMIUM;

/* 掟4：戦闘と制作ツールの resolve() は「必ず同じ判断」をせんといかん。
   同じ入力を両方へ食わせて、返る {img,key} が一致するかだけを見る。
   1つの関数へまとめはせん —— それは別の判断で、CONTEXT.md で先送りにしとる。
   previewKey は制作ツールにしか無い分岐やけん、比べる前に外す。 */
const SETS = {
  full: { normal:'N', attack:'A', hurt:'H', back:'B', summon:'S' },  // 5枚そろい
  thin: { normal:'N' },                                             // 通常だけ
  none: {},                                                         // 写真ゼロ → 仮の姿へ落ちる
};
const PH   = { normal:'pN', attack:'pA', hurt:'pH', back:'pB', summon:'pS' };
const KEYS = ['normal','attack','hurt','back','summon','shiranai'];

(async () => {
  const b = await chromium.launch(LAUNCH);
  const allErrs = [];
  const watch = (pg, tag) => {
    pg.on('pageerror', e => allErrs.push(tag + ' PAGEERROR ' + e.message));
    pg.on('console', m => { if(m.type()==='error' && !/ERR_/.test(m.text())) allErrs.push(tag + ' C ' + m.text()); });
  };

  /* ---------- 戦闘側：Fighter.prototype.resolve(key) ---------- */
  const pg1 = await b.newPage({ viewport:{ width:420, height:900 } });
  watch(pg1, '戦闘');
  await pg1.goto(DIST_URL + 'shioumon_field_test.html');
  await pg1.waitForTimeout(1200);
  const bat = await pg1.evaluate(({ SETS, PH, KEYS }) => {
    /* 走っとる Fighter には触らん（決定論チェックを揺らさんため）。
       prototype だけ借りて、状態は自前で持たせる */
    const proto = (typeof Fighter !== 'undefined')
      ? Fighter.prototype : Object.getPrototypeOf(partyA[0]);
    const out = {};
    for(const sn in SETS) for(const back of [false,true]) for(const k of KEYS){
      const f = Object.create(proto);
      f.imgs = SETS[sn]; f.ph = PH; f.useBack = back;
      const r = f.resolve(k);
      out[sn+'|'+back+'|'+k] = String(r && r.img) + ' / ' + String(r && r.key);
    }
    return out;
  }, { SETS, PH, KEYS });
  await pg1.close();

  /* ---------- 制作ツール側：resolve(key, back, st, S) ---------- */
  const pg2 = await b.newPage({ viewport:{ width:420, height:1100 } });
  watch(pg2, '制作');
  await pg2.goto(DIST_URL + 'shioumon_creator.html');
  await pg2.waitForTimeout(1200);
  const cre = await pg2.evaluate(({ SETS, PHV, KEYS }) => {
    /* ⚠ ここはページが生きたまま走る。ph と previewKey は制作ツール本体が
       毎フレームの描画で使っとる本物の状態やけん、借りたら**必ず同じ同期ブロックの中で返す**。
       この関数の中に await は1つも無いけん、途中で requestAnimationFrame が割り込む余地は無い。
       返し忘れると、evaluate が返ってから pg2.close() までの間に描画が1フレーム走った時だけ
       drawImage('pN') が TypeError を投げる —— タイミング次第で落ちたり落ちんかったりする、
       一番たちの悪い形になる（実際に3回中2回落ちた）。 */
    const savedPreviewKey = previewKey;
    const savedPh = Object.assign({}, ph);
    let out = {};
    try {
      previewKey = '';                               // 制作ツールだけの上書き。戦闘に対応物が無い
      for(const k of Object.keys(ph)) delete ph[k];  // ph は const。中身だけ入れ替える
      Object.assign(ph, PHV);
      for(const sn in SETS) for(const back of [false,true]) for(const k of KEYS){
        const r = resolve(k, back, { anim:'attack' }, { imgs:SETS[sn] });
        out[sn+'|'+back+'|'+k] = String(r && r.img) + ' / ' + String(r && r.key);
      }
    } finally {
      previewKey = savedPreviewKey;
      for(const k of Object.keys(ph)) delete ph[k];
      Object.assign(ph, savedPh);
    }
    return out;
  }, { SETS, PHV:PH, KEYS });
  await pg2.close();
  await b.close();

  /* ---------- 突き合わせ ---------- */
  const diffs = [];
  for(const k of Object.keys(bat)){
    if(bat[k] !== cre[k]) diffs.push(k + '   戦闘= ' + bat[k] + '   制作= ' + cre[k]);
  }
  console.log(JSON.stringify({
    比べた組合せ: Object.keys(bat).length,
    食い違い: diffs.length,
    JSエラー: allErrs.length,
  }, null, 2));
  if(diffs.length){
    console.error('■ resolve() が食い違うとる ' + diffs.length + '件（掟4）');
    for(const d of diffs) console.error('  ' + d);
  }
  if(allErrs.length){
    console.error('■ JSエラー ' + allErrs.length + '件');
    for(const e of allErrs) console.error('  ' + e);
  }
  process.exit(diffs.length || allErrs.length ? 1 : 0);
})();
