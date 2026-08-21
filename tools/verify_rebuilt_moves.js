/* ポケモン由来38技＋爆撃の専用素材・描画・威力連動・拘束契約を検証する。 */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const lib=JSON.parse(read('data/moves/library.json'));
const fxCore=read('src/fx_core.js');
const rebuilt=read('src/fx_rebuilt_moves.js');
const movelab=read('src/movelab.js');
const anims=read('src/anims.js')+'\n'+read('src/anims_rebuilt_moves.js');
const battle=read('src/battle.tpl.html');
const builtBattle=read('dist/shioumon_field_test.html');
const errors=[];
const ok=(v,msg)=>{ if(!v) errors.push(msg); };

const names=['ひのこ','はっぱカッター','タネマシンガン','トライアタック','みらいよち','つららばり',
  'きあいだま','ヘドロばくだん','ミサイルばり','シャドーボール','おにび','ムーンフォース',
  'でんこうせっか','だいもんじ','アクアジェット','ドリルライナー','ブレイブバード','つばめがえし',
  'シザークロス','つじぎり','かみくだく','メタルクロー','かみなりパンチ','エアスラッシュ',
  'サイコカッター','げきりん','れいとうビーム','ラスターカノン','マジカルシャイン','はかいこうせん',
  'りゅうのはどう','りゅうのまい','どくどく','うずしお','いわなだれ','ストーンエッジ',
  'だいちのちから','じしん','爆撃'];

/* fx_core + 専用素材をブラウザ同等のglobal scriptとして読む。 */
const context={console,document:{createElement(){ return {width:0,height:0,getContext(){return null;}}; }}};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fxCore+'\n'+rebuilt+'\n;globalThis.__R={meta:REBUILT_MOVE_META,reg:REBUILT_MOVE_FX,spawnFX,buildEffect};',context);
const {meta,reg,spawnFX,buildEffect}=context.__R;

ok(Object.keys(meta).length===39,'専用metadataが39本ではない');
ok(Object.keys(reg).length===39,'専用class登録が39本ではない');
ok(new Set(Object.values(reg).map(C=>C.name)).size===39,'複数generatorが同じclassを流用している');
ok(names.every(n=>Object.values(meta).some(m=>m.jp===n)),'対象39技とmetadata名が一致しない');

const generic=new Set(['projectile','beam','slash','lightning','aura','shatter']);
const generators=[];
for(const name of names){
  const rec=lib[name],m=Object.entries(meta).find(([,v])=>v.jp===name);
  ok(!!rec,name+' がlibraryにない'); if(!rec||!m) continue;
  const [generator,md]=m,fx=rec.fx||{};
  generators.push(fx.generator);
  ok(fx.generator===generator,name+' のgeneratorがmetadataと違う');
  ok(!generic.has(fx.generator),name+' が汎用generatorを使っている');
  ok(Array.isArray(fx.parts)&&fx.parts.length===0,name+' がpartsを流用している');
  ok(fx.impact===null,name+' が既存impact素材を持っている');
  ok(fx.clashKind===md.clashKind,name+' の相殺契約が違う');
  ok(fx.powerVisual&&fx.powerVisual.size&&fx.powerVisual.amount,name+' に威力連動範囲がない');
  ok(Array.isArray(fx.motions),name+' のmotionsが配列ではない');
}
ok(new Set(generators).size===39,'専用generatorが技ごとに一意ではない');
ok(lib['亜空切断']&&lib['亜空切断'].fx.generator==='shatter','亜空切断の監修済みgeneratorを変更した');
ok(!Object.values(meta).some(m=>m.jp==='亜空切断'),'亜空切断を専用化対象へ混ぜた');
ok(/function\s+mlGeneratorKeys\s*\(/.test(movelab),'技ラボに専用generatorの隔離処理がない');
ok((movelab.match(/mlGeneratorKeys\s*\(/g)||[]).length>=3,'専用generatorが本体・partsの両方で隔離されていない');

/* class本体が既存の視覚class・素材ディスパッチを呼ばない。 */
for(const C of Object.values(reg)){
  const src=C.toString();
  ok(/^class\s+\w+\s+extends\s+RebuiltMoveFX/.test(src),C.name+' が専用無描画基底を継承していない');
  ok(!/(ProjectileFX|BeamFX|SlashFX|LightningFX|AuraFX|ShatterFX|spawnSubFX|drawImpact|genBodyFrames|genSlashFrames)/.test(src),
    C.name+' が既存素材を呼んでいる');
}

/* Canvas命令をハッシュ化する偽context。実画像生成前に全classの例外・空描画・決定論を検出する。 */
function hashString(h,s){ for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h; }
function fakeContext(){
  const stack=[];
  const g={canvas:{width:384,height:216},globalAlpha:1,fillStyle:'#000',ops:0,hash:2166136261,
    save(){stack.push([this.globalAlpha,this.fillStyle]);},restore(){const s=stack.pop();if(s){this.globalAlpha=s[0];this.fillStyle=s[1];}},
    translate(){},rotate(){},
    fillRect(x,y,w,h){ this.ops++; this.hash=hashString(this.hash,[this.fillStyle,this.globalAlpha.toFixed(3),x,y,w,h].join('|')); },
    drawImage(){ this.ops++; this.hash=hashString(this.hash,'image'); }
  };
  return g;
}
function renderSignature(fx,power){
  let out=2166136261,totalOps=0;
  for(const phase of [.18,.43,.68,.88]){
    const sp=JSON.parse(JSON.stringify(fx)); sp.powerLevel=power;
    const sh=spawnFX(sp,{x:60,y:142},{x:304,y:108},buildEffect(sp),()=>{});
    sh.update(sh.duration*phase);
    const g=fakeContext(); sh.draw(g); totalOps+=g.ops;
    out=hashString(out,g.hash.toString(16)+'/'+g.ops);
  }
  return {hash:out>>>0,ops:totalOps};
}
const seen=new Map();
for(const name of names){
  const fx=lib[name].fx;
  try{
    const low=renderSignature(fx,0),high=renderSignature(fx,1),again=renderSignature(fx,0);
    ok(low.ops>=12,name+' の本演出が空、または描画命令が少なすぎる: '+low.ops);
    ok(low.hash===again.hash,name+' の描画が非決定的');
    ok(low.hash!==high.hash,name+' が威力0/100で変化しない');
    ok(!seen.has(low.hash),name+' の描画署名が '+seen.get(low.hash)+' と同一');
    seen.set(low.hash,name);
    let hits=0,sh=spawnFX(JSON.parse(JSON.stringify(fx)),{x:60,y:142},{x:304,y:108},buildEffect(fx),()=>hits++);
    for(let i=0;i<900&&sh.state!=='dead';i++) sh.update(1/120);
    ok(sh.state==='dead',name+' の演出が終了しない');
    ok(hits===1,name+' の命中callback回数が '+hits);
  }catch(e){ errors.push(name+' の描画で例外: '+e.stack); }
}

/* motionsが参照する専用ANIMSと、爆撃の約5秒・拘束契約。 */
const actx={}; actx.globalThis=actx; vm.createContext(actx);
vm.runInContext(anims+'\n;globalThis.__A=ANIMS;',actx);
const A=actx.__A;
for(const name of names) for(const mo of lib[name].fx.motions||[]) ok(!!A[mo.anim],name+' の専用motion '+mo.anim+' がない');
const bomb=lib['爆撃'];
ok(Math.abs((bomb.battle.cast+bomb.fx.duration)-5)<.25,'爆撃が約5秒ではない');
ok(bomb.fx.lockTarget===bomb.fx.duration,'爆撃の拘束時間と本演出時間が一致しない');
ok(A.bombing_flight&&A.bombing_flight.keys.length>=14,'爆撃の優雅な飛行経路が不足');
ok((bomb.fx.motions||[]).some(m=>m.anim==='bombing_flight'&&m.at==='fire'),'爆撃が専用飛行motionを使っていない');
for(const token of ['immobileUntil','lockTarget','行動不能','f.immobileUntil','foe.immobileUntil'])
  ok(battle.includes(token),'戦闘側に爆撃拘束の配線 '+token+' がない');
ok(/s\.clashKind==='bullet'/.test(battle)&&/s\.clashKind==='beam'/.test(battle),'専用素材の相殺配線がない');
ok(builtBattle.includes('class BombingMoveFX')&&builtBattle.includes("jp:'じしん'")&&builtBattle.includes('bombing_flight'),
  'build済み戦闘HTMLに専用素材・motionが入っていない');

if(errors.length){
  console.error('\nverify_rebuilt_moves: '+errors.length+'件');
  for(const e of errors) console.error('  - '+e);
  process.exit(1);
}
console.log('verify_rebuilt_moves: OK — 38技+爆撃、39 generator/class、非流用、威力連動、決定論、約5秒拘束');
