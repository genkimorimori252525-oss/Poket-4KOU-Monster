/* =========================================================
   movelab.js — 技クリエーターの共有部品
   技ラボ（lab.tpl.html）と 四皇モン制作ツール（creator.tpl.html）が同じ部品を使う。
   ここに置くのは「技データをいじるUI」だけ。
     絵を描く   → fx_core.js
     音を並べる → audio_ui.js
   前提: fx_core.js（PALETTES / SCREEN_DEFAULTS / makeSpec / buildEffect / mkCv）

   ctx（呼び出し側が渡す窓口）:
     spec()        いま編集しとる技スペックを返す
     set(newSpec)  スペックごと差し替える（generator 切替で使う）
     change()      値が変わった（＝作り直して保存）
     rebuild()     コントロールの構造ごと作り直す
   ========================================================= */

/* ラベルは「見りゃ何のツマミか分かる」ことを優先する。
   短さより分かりやすさ。迷ったら動詞を入れる。 */
const LABEL={
  shape:'玉のかたち',size:'大きさ',frames:'パラパラのコマ数',wobble:'ぐらつき',
  core:'芯の明るさ',spin:'回転',specks:'散る火の粉',
  'trail.type':'尾のたなびき方','trail.length':'尾の長さ','trail.rate':'尾の濃さ',
  'trail.size':'尾の粒の大きさ',
  'travel.speed':'飛ぶ速さ','travel.arc':'山なりの高さ','travel.spin':'飛びながら回る',
  width:'太さ',segments:'折れ曲がる数',waver:'うねり',
  charge:'溜める時間',fire:'伸びきるまで',sustain:'出しっぱなしの時間',fade:'消えるまで',
  arcDeg:'振る角度',thickness:'刃の太さ',taper:'先の細さ',hollow:'芯の空洞',
  jitter:'縁のギザつき',squash:'縦のつぶし',
  count:'何連撃',interval:'次を出すまで',spread:'振る位置のばらけ',
  jag:'ギザギザの荒さ',branches:'枝分かれの数',duration:'出とる長さ',fromSky:'空から落とす',
  rings:'輪の数',rise:'昇る高さ',cracks:'ひび割れの数',drift:'破片の飛ぶ速さ',dust:'ガラス粉の量',
  'impact.size':'着弾の大きさ','impact.frames':'着弾のコマ数','impact.shards':'着弾の破片',
  strength:'強さ',dur:'長さ',times:'点滅の回数',power:'揺れ幅',color:'色',
  at:'いつ',dir:'線の向き',
  off:'ずらす',dx:'横の位置',dy:'縦の位置',anchor:'どこを基準に'
};
const SCREEN_JP={flash:'閃光',blink:'背景点滅',tint:'背景に色',darken:'暗転',shake:'画面揺れ',lines:'走査線'};
const GEN_JP={projectile:'飛び道具',beam:'光線',slash:'斬撃',lightning:'雷',aura:'オーラ',shatter:'空間割れ'};
const GEN_DESC={
  projectile:'弾が飛んでいく。火の玉・水弾・エネルギー球',
  beam:'まっすぐ伸びる光の柱。溜めてから撃つ',
  slash:'弧を描いて斬る。連撃にもできる',
  lightning:'雷が落ちる。空からでも足元からでも',
  aura:'自分のまわりを輪が昇る。補助技むき',
  shatter:'空間がガラスみたいに割れて飛び散る'
};
/* 素材の置き場所 */
const ANCHOR_JP={ from:'撃った人', to:'当たった場所', center:'画面の中央' };
const PHASE_JP ={ cast:'構えた時', fire:'撃った時', impact:'当たった時' };
/* 技を出すとき、四皇モン本体にさせる動き */
const ANIM_JP={ attack:'突き出す', charge:'力を溜める', jump:'跳ぶ', fly:'空へ舞う',
                dodge:'横へ跳ぶ', zigzag:'往復横跳び', hurt:'のけぞる', knockback:'ふっとぶ',
                appear:'降りてくる', idle:'動かん' };
const SCHEMA={
  projectile:[['shape','sel',['orb','shard','ring','bolt']],['size','rng',6,96,1,'px'],
    ['frames','rng',1,12,1,'コマ'],['wobble','rng',0,0.5,0.01],['core','rng',0.1,1.2,0.05],
    ['spin','rng',0,1,0.05],['specks','rng',0,14,1],
    ['trail.type','sel',['none','flame','smoke','spark']],['trail.length','rng',2,40,1],
    ['trail.rate','rng',0.1,3,0.1],['trail.size','rng',0.2,2,0.1],
    ['travel.speed','rng',40,700,10,'px/s'],['travel.arc','rng',-80,80,1,'px'],
    ['travel.spin','rng',0,12,0.5]],
  beam:[['width','rng',3,72,1,'px'],['segments','rng',3,24,1],['waver','rng',0,8,0.2],
    ['charge','rng',0,1.2,0.05,'秒'],['fire','rng',0.03,0.6,0.01,'秒'],
    ['sustain','rng',0,1.5,0.05,'秒'],['fade','rng',0.05,1,0.05,'秒']],
  slash:[['size','rng',24,320,4,'px'],['arcDeg','rng',40,340,5,'°'],['thickness','rng',2,40,1],
    ['taper','rng',0.3,3,0.1],['hollow','rng',0,0.85,0.05],['jitter','rng',0,0.8,0.02],
    ['squash','rng',0.4,1.6,0.05],['specks','rng',0,30,1],
    ['count','rng',1,6,1,'連'],['interval','rng',0.05,0.5,0.01,'秒'],['spread','rng',0,60,2]],
  lightning:[['width','rng',1,26,1],['jag','rng',0,1.2,0.05],['branches','rng',0,18,1],
    ['segments','rng',2,7,1],['duration','rng',0.15,1.5,0.05,'秒'],['fromSky','bool']],
  aura:[['size','rng',30,320,4,'px'],['rings','rng',1,14,1],['rise','rng',10,200,2],
    ['duration','rng',0.4,3,0.1,'秒']],
  shatter:[['size','rng',60,360,4,'px'],['cracks','rng',3,40,1,'本'],['jag','rng',0,1.2,0.05],
    ['drift','rng',0,220,5],['spin','rng',0,14,0.5],['dust','rng',0,120,2,'粒'],
    ['duration','rng',0.4,2.5,0.05,'秒']]
};

const specGet=(o,p)=>p.split('.').reduce((a,k)=>a&&a[k],o);
const specSet=(o,p,v)=>{ const ks=p.split('.'); let t=o;
  for(let i=0;i<ks.length-1;i++){ if(t[ks[i]]==null) t[ks[i]]={}; t=t[ks[i]]; }
  t[ks[ks.length-1]]=v; };

/* ---- 共有CSS（技ラボ側は自前の <style> と同じ見た目になる） ---- */
const MOVELAB_CSS=`
.ml-gens{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:8px;}
.ml-gens button{padding:10px 2px;font-size:10px;background:#252d3a;border:1px solid #2c3442;
  color:#dfe6f0;border-radius:3px;font-family:inherit;}
.ml-gens button.on{background:#f0a020;color:#12151c;border-color:#f0a020;}
.ml-ctl{display:flex;align-items:center;gap:8px;margin-bottom:7px;}
.ml-ctl label{font-size:11px;color:#8b97a8;width:82px;flex:none;}
.ml-ctl input[type=range]{flex:1;min-width:50px;accent-color:#f0a020;}
.ml-ctl .v{font-size:11px;color:#f0a020;width:52px;text-align:right;flex:none;}
.ml-ctl select,.ml-ctl input[type=text],.ml-ctl input[type=number]{flex:1;background:#0c0f15;
  border:1px solid #2c3442;color:#dfe6f0;border-radius:3px;padding:7px;font-size:12px;
  font-family:inherit;min-width:0;}
.ml-ctl button{background:#252d3a;border:1px solid #2c3442;color:#dfe6f0;border-radius:3px;
  padding:9px 6px;font-size:11px;font-family:inherit;}
.ml-ctl button.on{background:#f0a020;color:#12151c;border-color:#f0a020;}
.ml-bar{display:flex;gap:5px;margin:8px 0;}
.ml-bar button{flex:1;background:#252d3a;border:1px solid #2c3442;color:#dfe6f0;border-radius:3px;
  padding:9px 6px;font-size:11px;font-family:inherit;}
.ml-pre{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;}
.ml-pre button{padding:9px 2px;font-size:11px;background:#252d3a;border:1px solid #2c3442;
  color:#dfe6f0;border-radius:3px;font-family:inherit;}
.ml-pre button.on{background:#f0a020;color:#12151c;border-color:#f0a020;}
.ml-pal{display:flex;gap:6px;margin-top:10px;}
.ml-pal>div{flex:1;}
.ml-pal input[type=color]{width:100%;height:34px;border:1px solid #2c3442;background:none;
  border-radius:3px;padding:0;}
.ml-hint{font-size:10px;color:#8b97a8;line-height:1.6;margin-top:6px;}
.ml-frames{display:flex;gap:4px;flex-wrap:wrap;background:#0c0f15;padding:8px;border-radius:3px;
  border:1px solid #2c3442;min-height:40px;overflow-x:auto;}
.ml-frames canvas{width:auto;height:52px;image-rendering:pixelated;border:1px solid #2c3442;
  background:repeating-conic-gradient(#20252e 0% 25%,#171b23 0% 50%) 0 0/10px 10px;}
.ml-box{border:1px solid #262e3b;border-radius:3px;padding:8px;margin-bottom:7px;}
`;
/* 二度押しで消す。
   confirm() はブラウザに「このページのダイアログを表示しない」を効かされると
   黙って false を返す。そうなると何を押しても消えん。ダイアログに頼らん。 */
function mlArmDelete(btn, onDo, armedText){
  let armed=false, timer=null;
  const base=btn.textContent, baseW=btn.style.width, baseTitle=btn.title||'';
  const reset=()=>{ armed=false; btn.textContent=base; btn.title=baseTitle;
    btn.style.width=baseW; btn.style.background='';
    if(timer){ clearTimeout(timer); timer=null; } };
  btn.onclick=e=>{
    if(e) e.stopPropagation();
    if(armed){ reset(); onDo(); return; }
    armed=true;
    btn.textContent=armedText||'消す？'; btn.title='もう一度押すと決まる';
    btn.style.width='auto'; btn.style.background='#7a2020';
    timer=setTimeout(reset,3500);
  };
}

function mlInjectCSS(){
  if(document.getElementById('movelab-css')) return;
  const s=document.createElement('style'); s.id='movelab-css'; s.textContent=MOVELAB_CSS;
  document.head.appendChild(s);
}

/* ---- 部品 ---- */
function mlRange(host,ctx,path,min,max,step,unit,labelOv){
  const d=document.createElement('div'); d.className='ml-ctl';
  d.innerHTML=`<label>${labelOv||LABEL[path]||path}</label>`+
    `<input type=range min=${min} max=${max} step=${step}><span class=v></span>`;
  const r=d.querySelector('input'), v=d.querySelector('.v');
  const show=()=>{ const g0=specGet(ctx.spec(),path); r.value=g0;
    v.textContent=(step<1?(+g0).toFixed(2):g0)+(unit||''); };
  r.oninput=()=>{ specSet(ctx.spec(),path,step<1?parseFloat(r.value):parseInt(r.value,10));
    show(); ctx.change(); };
  host.appendChild(d); show(); return d;
}
function mlSel(host,ctx,path,opts){
  const d=document.createElement('div'); d.className='ml-ctl';
  d.innerHTML=`<label>${LABEL[path]||path}</label>`+
    `<select>${opts.map(o=>`<option>${o}</option>`).join('')}</select>`;
  const s=d.querySelector('select'); s.value=specGet(ctx.spec(),path);
  s.onchange=()=>{ specSet(ctx.spec(),path,s.value); ctx.change(); };
  host.appendChild(d); return d;
}
function mlBool(host,ctx,path){
  const d=document.createElement('div'); d.className='ml-ctl';
  d.innerHTML=`<label>${LABEL[path]||path}</label><button style="flex:1"></button>`;
  const b=d.querySelector('button');
  const show=()=>{ const on=!!specGet(ctx.spec(),path);
    b.textContent=on?'ON':'OFF'; b.classList.toggle('on',on); };
  b.onclick=()=>{ specSet(ctx.spec(),path,!specGet(ctx.spec(),path)); show(); ctx.change(); };
  host.appendChild(d); show(); return d;
}
function mlText(host,label,get0,set0,onChange){
  const d=document.createElement('div'); d.className='ml-ctl';
  d.innerHTML=`<label>${label}</label><input type=text>`;
  const t=d.querySelector('input'); t.value=get0();
  t.oninput=()=>{ set0(t.value); onChange&&onChange(); };
  host.appendChild(d); return d;
}

/* generator 切替（押すとその generator の既定値で作り直す） */
function mlGens(host,ctx){
  mlInjectCSS();
  const gs=document.createElement('div'); gs.className='ml-gens';
  Object.keys(SCHEMA).forEach(k=>{
    const b=document.createElement('button');
    b.textContent=GEN_JP[k]; b.classList.toggle('on',ctx.spec().generator===k);
    b.onclick=()=>{
      const old=ctx.spec();
      const sp=makeSpec(k,old.seed,old.name,old.palKey||'炎');
      sp.id=old.id; sp.palKey=old.palKey||'炎';
      sp.palette=[...old.palette];
      if(sp.impact) sp.impact.palette=[...old.palette];
      if(old.screen) sp.screen=JSON.parse(JSON.stringify(old.screen));
      ctx.set(sp); ctx.rebuild(); ctx.change();
    };
    gs.appendChild(b);
  });
  host.appendChild(gs); return gs;
}

/* 技名 / ID / シード（技ラボ用。制作ツールは戦闘値も一緒に出すので自前で組む） */
function mlBase(host,ctx){
  mlInjectCSS();
  mlText(host,'技名',()=>ctx.spec().name,v=>ctx.spec().name=v,ctx.change);
  mlText(host,'ID',  ()=>ctx.spec().id,  v=>ctx.spec().id=v,  ctx.change);
  mlSeed(host,ctx);
}
/* 技全体の速さ。エフェクトも素材も本体の動きも、まとめて伸び縮みする */
function mlTimeScale(host,ctx){
  mlInjectCSS();
  const sp=ctx.spec();
  if(sp.timeScale==null) sp.timeScale=1;
  mlRange(host,ctx,'timeScale',0.25,3,0.05,'倍','技全体の速さ');
  const h=document.createElement('div'); h.className='ml-hint';
  h.innerHTML='1.00 が今までどおり。0.50 にすると<b>技が半分の速さ</b>（重い大技になる）、'+
    '2.00 で倍速（素早い連射向き）。<br>'+
    'エフェクト・演出素材のずらし・本体の動き、<b>全部まとめて</b>伸び縮みする。'+
    'プレビューの再生速度とは別物で、<b>こっちは実戦にも効く</b>。';
  host.appendChild(h);
}
function mlSeed(host,ctx){
  const rb=document.createElement('div'); rb.className='ml-bar';
  rb.innerHTML='<button>シード変更</button><button>シード戻す</button>';
  const bs=rb.querySelectorAll('button');
  bs[0].onclick=()=>{ const s=ctx.spec(); s.seed=(s.seed*7919+13)%999983; ctx.change(); };
  bs[1].onclick=()=>{ ctx.spec().seed=918273; ctx.change(); };
  host.appendChild(rb); return rb;
}

/* generator ごとのパラメータ */
function mlParams(host,ctx){
  mlInjectCSS();
  const rows=SCHEMA[ctx.spec().generator]||[];
  for(const row of rows){
    const [path,type]=row;
    if(type==='rng')      mlRange(host,ctx,path,row[2],row[3],row[4],row[5]);
    else if(type==='sel') mlSel(host,ctx,path,row[2]);
    else if(type==='bool')mlBool(host,ctx,path);
  }
}

/* 4色がどのプリセットと一致するか。読み込んだJSONに palKey が無いとき用 */
function mlPalKeyOf(pal){
  if(!Array.isArray(pal)) return null;
  for(const k in PALETTES){
    const p=PALETTES[k];
    if(p.length===pal.length &&
       p.every((c,i)=>c.toLowerCase()===String(pal[i]).toLowerCase())) return k;
  }
  return null;
}

/* パレット（プリセット＋4色） */
function mlPalette(host,ctx){
  mlInjectCSS();
  const sp=ctx.spec();
  const cur=sp.palKey||mlPalKeyOf(sp.palette)||'';
  const pre=document.createElement('div'); pre.className='ml-pre';
  Object.keys(PALETTES).forEach(k=>{
    const bt=document.createElement('button'); bt.textContent=k;
    bt.classList.toggle('on',cur===k);
    bt.onclick=()=>{ const s=ctx.spec();
      s.palKey=k; s.palette=[...PALETTES[k]];
      if(s.impact) s.impact.palette=[...PALETTES[k]];
      ctx.rebuild(); ctx.change(); };
    pre.appendChild(bt);
  });
  host.appendChild(pre);
  const row=document.createElement('div'); row.className='ml-pal';
  sp.palette.forEach((c,i)=>{
    const w=document.createElement('div');
    w.innerHTML=`<input type=color value="${c}">`;
    w.querySelector('input').oninput=e=>{
      const s=ctx.spec(); s.palette[i]=e.target.value;
      if(s.impact&&s.impact.palette) s.impact.palette[i]=e.target.value;
      ctx.change(); };
    row.appendChild(w);
  });
  host.appendChild(row);
  const lb=document.createElement('div'); lb.className='ml-hint';
  lb.textContent='左＝中心（明るい）→ 右＝外周（暗い）。この並び順が立体感を作る。';
  host.appendChild(lb);
}

/* 着弾 */
function mlImpact(host,ctx){
  mlInjectCSS();
  if(ctx.spec().impact){
    mlRange(host,ctx,'impact.size',12,340,2,'px');
    mlRange(host,ctx,'impact.frames',2,24,1,'コマ');
    mlRange(host,ctx,'impact.shards',0,60,1);
  } else {
    const d=document.createElement('div'); d.className='ml-hint';
    d.textContent='この generator は着弾エフェクトを持たん（補助技あつかい）。';
    host.appendChild(d);
  }
}

/* =========================================================
   演出素材（parts）— 本体に重ねる追加のエフェクト
   1つずつ「種類・どこを基準に・横縦の位置・いつ・何秒ずらす」を決められる。
   ========================================================= */
function partLabel(p,i){
  const nm=p.name||GEN_JP[p.generator]||'素材';
  const off=(+p.off||0)>0 ? ' +'+(+p.off).toFixed(2)+'秒' : '';
  return '⑈'.replace('⑈',String(i+1))+'. '+nm+
         '　〈'+(PHASE_JP[p.at||'impact'])+off+'・'+(ANCHOR_JP[p.anchor||'to'])+'〉';
}
function newPart(sp,gen){
  const g=gen||'shatter';
  const p=makeSpec(g,((sp.seed||1)+7*((sp.parts||[]).length+1))%999983,GEN_JP[g],sp.palKey||'炎');
  p.palette=[...(sp.palette||PALETTES['炎'])];
  if(p.impact) p.impact.palette=[...p.palette];
  p.name=GEN_JP[g];
  p.at='impact'; p.off=0; p.anchor='to'; p.dx=0; p.dy=0;
  delete p.screen;                       // 画面演出は本体側で持つ。素材ごとに持たせると重なりすぎる
  return p;
}
function mlParts(host,ctx){
  mlInjectCSS();
  host.innerHTML='';
  const sp=ctx.spec();
  if(!Array.isArray(sp.parts)) sp.parts=[];
  /* 旧形式（fx.shatter）は開いた時点で素材へ移す。以後ふつうに位置もずらせる */
  if(sp.shatter){
    const p=Object.assign({},sp.shatter,
      {name:'空間割れ',at:'impact',off:0,anchor:'to',dx:0,dy:0});
    sp.parts.push(p); delete sp.shatter;
  }

  if(!sp.parts.length){
    const e=document.createElement('div'); e.className='ml-hint'; e.style.margin='0 0 8px';
    e.textContent='素材はまだ無い。本体だけの技になる。';
    host.appendChild(e);
  }

  sp.parts.forEach((p,i)=>{
    const box=document.createElement('div'); box.className='ml-box';
    const head=document.createElement('div'); head.className='ml-ctl'; head.style.marginBottom='0';
    head.innerHTML='<label style="width:auto;flex:1;color:#f0a020;font-size:11px"></label>'+
      '<button style="width:30px;flex:none" title="上へ">▲</button>'+
      '<button style="width:30px;flex:none" title="下へ">▼</button>'+
      '<button style="width:30px;flex:none;background:#2a1a1a;border-color:#5a2a2a;color:#e08080" '+
      'title="この素材を消す">×</button>';
    head.querySelector('label').textContent=partLabel(p,i);
    const [bu,bd,bx]=head.querySelectorAll('button');
    bu.onclick=()=>{ if(i>0){ sp.parts.splice(i-1,0,sp.parts.splice(i,1)[0]);
                     mlParts(host,ctx); ctx.change(); } };
    bd.onclick=()=>{ if(i<sp.parts.length-1){ sp.parts.splice(i+1,0,sp.parts.splice(i,1)[0]);
                     mlParts(host,ctx); ctx.change(); } };
    mlArmDelete(bx,()=>{ forgetPart(p); sp.parts.splice(i,1); mlParts(host,ctx); ctx.change(); });
    box.appendChild(head);

    const body=document.createElement('div'); body.style.marginTop='8px';
    const pctx={ spec:()=>p, set:()=>{},
                 change:()=>{ forgetPart(p); ctx.change(); },
                 rebuild:()=>mlParts(host,ctx) };

    mlText(body,'素材の名前',()=>p.name||'',v=>{ p.name=v;
      head.querySelector('label').textContent=partLabel(p,i); ctx.change(); });

    /* 種類 */
    const gs=document.createElement('div'); gs.className='ml-gens';
    Object.keys(SCHEMA).forEach(k=>{
      const b=document.createElement('button'); b.textContent=GEN_JP[k];
      b.classList.toggle('on',p.generator===k);
      b.onclick=()=>{
        const keep={name:p.name,at:p.at,off:p.off,anchor:p.anchor,dx:p.dx,dy:p.dy,
                    palette:[...p.palette],seed:p.seed};
        const np=newPart(sp,k);
        Object.assign(np,keep);
        if(np.impact) np.impact.palette=[...keep.palette];
        forgetPart(p); sp.parts[i]=np;
        mlParts(host,ctx); ctx.change();
      };
      gs.appendChild(b);
    });
    body.appendChild(gs);
    const gd=document.createElement('div'); gd.className='ml-hint'; gd.style.margin='0 0 8px';
    gd.textContent=GEN_DESC[p.generator]||'';
    body.appendChild(gd);

    /* 場所 */
    const an=document.createElement('div'); an.className='ml-ctl';
    an.innerHTML='<label>どこを基準に</label><select>'+
      Object.keys(ANCHOR_JP).map(k=>'<option value="'+k+'">'+ANCHOR_JP[k]+'</option>').join('')+
      '</select>';
    const ansel=an.querySelector('select'); ansel.value=p.anchor||'to';
    ansel.onchange=()=>{ p.anchor=ansel.value;
      head.querySelector('label').textContent=partLabel(p,i); ctx.change(); };
    body.appendChild(an);
    mlRange(body,pctx,'dx',-192,192,1,'px');
    mlRange(body,pctx,'dy',-140,140,1,'px');

    /* タイミング */
    const at=document.createElement('div'); at.className='ml-ctl';
    at.innerHTML='<label>いつ</label><select>'+
      Object.keys(PHASE_JP).map(k=>'<option value="'+k+'">'+PHASE_JP[k]+'</option>').join('')+
      '</select>';
    const atsel=at.querySelector('select'); atsel.value=p.at||'impact';
    atsel.onchange=()=>{ p.at=atsel.value;
      head.querySelector('label').textContent=partLabel(p,i); ctx.change(); };
    body.appendChild(at);
    const offRow=mlRange(body,pctx,'off',0,2,0.01,'秒');
    offRow.querySelector('input').addEventListener('input',()=>{
      head.querySelector('label').textContent=partLabel(p,i); });

    /* この種類のパラメータ */
    const sep=document.createElement('div');
    sep.style.cssText='border-top:1px solid #262e3b;margin:9px 0 8px;';
    body.appendChild(sep);
    for(const row of SCHEMA[p.generator]||[]){
      const [path,type]=row;
      if(type==='rng')      mlRange(body,pctx,path,row[2],row[3],row[4],row[5]);
      else if(type==='sel') mlSel(body,pctx,path,row[2]);
      else if(type==='bool')mlBool(body,pctx,path);
    }
    if(p.impact){
      mlRange(body,pctx,'impact.size',12,340,2,'px');
      mlRange(body,pctx,'impact.frames',2,24,1,'コマ');
      mlRange(body,pctx,'impact.shards',0,60,1);
    }
    /* 色 */
    const pal=document.createElement('div'); pal.className='ml-pal';
    (p.palette||[]).forEach((c,j)=>{
      const w=document.createElement('div');
      w.innerHTML=`<input type=color value="${c}">`;
      w.querySelector('input').oninput=e=>{
        p.palette[j]=e.target.value;
        if(p.impact&&p.impact.palette) p.impact.palette[j]=e.target.value;
        forgetPart(p); ctx.change(); };
      pal.appendChild(w);
    });
    body.appendChild(pal);

    box.appendChild(body);
    host.appendChild(box);
  });

  const add=document.createElement('button'); add.className='aui-add';
  add.textContent='＋ 素材を足す';
  add.onclick=()=>{ sp.parts.push(newPart(sp,'shatter')); mlParts(host,ctx); ctx.change(); };
  host.appendChild(add);

  const h=document.createElement('div'); h.className='ml-hint';
  h.innerHTML='素材は本体に<b>重ねる</b>追加のエフェクト。亜空切断の「空間割れ」がこれ。<br>'+
    '「いつ」＋「ずらす」で順番を組める。0.20秒ずらして2枚重ねる、みたいな作り方ができる。<br>'+
    'ずらす時間は<b>戦闘の時計で数えとる</b>けん、遅くなっても演出は崩れんし、決定論も壊れん。';
  host.appendChild(h);
}

/* =========================================================
   四皇モン本体の動き（fx.motions）
   技を出すとき、撃った本人にどの動きを・いつ・何秒かけてさせるか。
   空なら「撃った時に突き出す」だけ（今までと同じ）。
   ========================================================= */
function motionLabel(m,i){
  const off=(+m.off||0)>0 ? ' +'+(+m.off).toFixed(2)+'秒' : '';
  return (i+1)+'. '+(ANIM_JP[m.anim]||m.anim)+
         '　〈'+(PHASE_JP[m.at||'fire'])+off+'・'+(+m.dur||0.75).toFixed(2)+'秒かけて〉';
}
function mlMotions(host,ctx){
  mlInjectCSS();
  host.innerHTML='';
  const sp=ctx.spec();
  if(!Array.isArray(sp.motions)) sp.motions=[];
  if(!sp.motions.length){
    const e=document.createElement('div'); e.className='ml-hint'; e.style.margin='0 0 8px';
    e.textContent='何も入れとらん＝「撃った時に突き出す」だけ（今までと同じ動き）。';
    host.appendChild(e);
  }
  sp.motions.forEach((m,i)=>{
    const box=document.createElement('div'); box.className='ml-box';
    const head=document.createElement('div'); head.className='ml-ctl'; head.style.marginBottom='8px';
    head.innerHTML='<label style="width:auto;flex:1;color:#f0a020;font-size:11px"></label>'+
      '<button style="width:30px;flex:none" title="上へ">▲</button>'+
      '<button style="width:30px;flex:none" title="下へ">▼</button>'+
      '<button style="width:30px;flex:none;background:#2a1a1a;border-color:#5a2a2a;color:#e08080" '+
      'title="消す">×</button>';
    const lb=head.querySelector('label');
    const paint=()=>{ lb.textContent=motionLabel(m,i); };
    paint();
    const [bu,bd,bx]=head.querySelectorAll('button');
    bu.onclick=()=>{ if(i>0){ sp.motions.splice(i-1,0,sp.motions.splice(i,1)[0]);
                     mlMotions(host,ctx); ctx.change(); } };
    bd.onclick=()=>{ if(i<sp.motions.length-1){ sp.motions.splice(i+1,0,sp.motions.splice(i,1)[0]);
                     mlMotions(host,ctx); ctx.change(); } };
    mlArmDelete(bx,()=>{ sp.motions.splice(i,1); mlMotions(host,ctx); ctx.change(); });
    box.appendChild(head);

    const mctx={ spec:()=>m, set:()=>{}, change:()=>{ paint(); ctx.change(); },
                 rebuild:()=>mlMotions(host,ctx) };
    const sel=(label,key,map,def)=>{
      const d=document.createElement('div'); d.className='ml-ctl';
      d.innerHTML='<label>'+label+'</label><select>'+
        Object.keys(map).map(k=>'<option value="'+k+'">'+map[k]+'</option>').join('')+'</select>';
      const s=d.querySelector('select'); s.value=m[key]||def;
      s.onchange=()=>{ m[key]=s.value; paint(); ctx.change(); };
      box.appendChild(d);
    };
    sel('どの動き','anim',ANIM_JP,'attack');
    sel('いつ','at',PHASE_JP,'fire');
    mlRange(box,mctx,'off',0,2,0.01,'秒','その瞬間から');
    mlRange(box,mctx,'dur',0.05,3,0.05,'秒','かける時間');
    host.appendChild(box);
  });
  const add=document.createElement('button'); add.className='aui-add';
  add.textContent='＋ 動きを足す';
  add.onclick=()=>{ sp.motions.push({anim:'attack',at:'fire',off:0,dur:0.75});
                    mlMotions(host,ctx); ctx.change(); };
  host.appendChild(add);
  const h=document.createElement('div'); h.className='ml-hint';
  h.innerHTML='技を出したとき、<b>撃った本人</b>にさせる動き。<br>'+
    '「かけて」の秒数でアニメを伸び縮みさせる。0.20秒にすれば素早い突き、'+
    '1.50秒にすればじっくり溜めた動きになる。<br>'+
    '複数入れれば「構えで力を溜める → 撃った瞬間に突き出す → 当たった瞬間に跳ぶ」も組める。';
  host.appendChild(h);
}

/* 画面演出（背景変化） */
function mlScreen(host,ctx){
  mlInjectCSS();
  host.innerHTML='';
  const sp=ctx.spec();
  if(!sp.screen) sp.screen={};
  for(const k of Object.keys(SCREEN_DEFAULTS)){
    const wrap=document.createElement('div'); wrap.className='ml-box';
    const head=document.createElement('div'); head.className='ml-ctl'; head.style.marginBottom='0';
    head.innerHTML='<label style="width:auto;flex:1;color:#dfe6f0">'+SCREEN_JP[k]+'</label>'
                  +'<button style="width:74px;flex:none"></button>';
    const bt=head.querySelector('button');
    const on=()=>!!sp.screen[k];
    const paint=()=>{ bt.textContent=on()?'ON':'OFF'; bt.classList.toggle('on',on()); };
    bt.onclick=()=>{ if(on()) delete sp.screen[k];
      else sp.screen[k]=JSON.parse(JSON.stringify(SCREEN_DEFAULTS[k]));
      mlScreen(host,ctx); ctx.change(); };
    wrap.appendChild(head); paint();
    if(on()){
      const body=document.createElement('div'); body.style.marginTop='8px';
      const cfg=sp.screen[k];
      for(const key of Object.keys(SCREEN_DEFAULTS[k])){
        if(key==='color'){
          const d=document.createElement('div'); d.className='ml-ctl';
          d.innerHTML='<label>色</label><input type=color value="'+cfg.color+'" '+
            'style="flex:1;height:30px;border:1px solid #2c3442;background:none;border-radius:3px;padding:0">';
          d.querySelector('input').oninput=e=>{ cfg.color=e.target.value; ctx.change(); };
          body.appendChild(d);
        } else if(key==='at'){
          const d=document.createElement('div'); d.className='ml-ctl';
          d.innerHTML='<label>タイミング</label><select><option value="cast">技を出した時</option>'+
                      '<option value="impact">当たった時</option></select>';
          const sel=d.querySelector('select'); sel.value=cfg.at;
          sel.onchange=()=>{ cfg.at=sel.value; ctx.change(); };
          body.appendChild(d);
        } else if(key==='dir'){
          const d=document.createElement('div'); d.className='ml-ctl';
          d.innerHTML='<label>向き</label><select><option value="h">横線</option>'+
                      '<option value="v">縦線</option></select>';
          const sel=d.querySelector('select'); sel.value=cfg.dir;
          sel.onchange=()=>{ cfg.dir=sel.value; ctx.change(); };
          body.appendChild(d);
        } else {
          const RG={strength:[0,1,0.05],dur:[0.05,2,0.05],times:[1,16,1],power:[1,26,1]};
          const [mn,mx,st]=RG[key]||[0,1,0.05];
          const d=document.createElement('div'); d.className='ml-ctl';
          d.innerHTML='<label>'+(LABEL[key]||key)+'</label><input type=range min='+mn+
                      ' max='+mx+' step='+st+'><span class=v></span>';
          const r=d.querySelector('input'), v=d.querySelector('.v');
          const show=()=>{ r.value=cfg[key]; v.textContent=st<1?(+cfg[key]).toFixed(2):cfg[key]; };
          r.oninput=()=>{ cfg[key]=st<1?parseFloat(r.value):parseInt(r.value,10); show(); ctx.change(); };
          body.appendChild(d); show();
        }
      }
      wrap.appendChild(body);
    }
    host.appendChild(wrap);
  }
  const h=document.createElement('div'); h.className='ml-hint';
  h.textContent='背景の点滅・色付け・暗転・揺れは「技エフェクトの一部」として技データに入る。'+
                '大技ほど画面を派手に動かせる。';
  host.appendChild(h);
}

/* =========================================================
   技ライブラリ（技ラボと制作ツールで共有）
   localStorage['shioumon_move_lib_v1'] = { 名前: {name, fx, battle, audio} }
   fx      … エフェクトの設計（素材ぜんぶ入り）
   battle  … 戦闘の数値（タイプ・威力・溜め・CD）。技ラボから保存したときは null
   audio   … 音のタイムライン
   ========================================================= */
const MOVE_LIB_KEY='shioumon_move_lib_v1';
function mlLibAll(){
  try{ const o=JSON.parse(localStorage.getItem(MOVE_LIB_KEY)||'{}');
       return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; }
}
function mlLibPut(name,rec){
  try{ const a=mlLibAll(); a[name]=rec;
       localStorage.setItem(MOVE_LIB_KEY,JSON.stringify(a)); return {ok:true}; }
  catch(e){ return {ok:false,msg:e.name}; }
}
function mlLibDel(name){
  try{ const a=mlLibAll(); delete a[name];
       localStorage.setItem(MOVE_LIB_KEY,JSON.stringify(a)); return true; }catch(e){ return false; }
}
/* opts = { rec():保存する中身（無ければ null）, name():既定の名前, load(rec,名前) } */
function mlLibrary(host,opts){
  mlInjectCSS();
  host.innerHTML='';
  const row=document.createElement('div'); row.className='ml-ctl';
  row.innerHTML='<label>名前をつけて</label><input type=text placeholder="亜空切断">';
  const inp=row.querySelector('input');
  inp.value=(opts.name&&opts.name())||'';
  host.appendChild(row);
  const bar=document.createElement('div'); bar.className='ml-bar';
  bar.innerHTML='<button>この名前で保存</button>';
  bar.querySelector('button').onclick=()=>{
    const rec=opts.rec();
    if(!rec){ alert('先に技を開いて'); return; }
    /* 同じ名前でも上書きせん。◯◯2 と番号を振って警告を出す。
       ダイアログには頼らん（止められると黙って消える）し、黙って上書きもせん。 */
    const raw=(inp.value||rec.name||'無題').trim();
    const all=mlLibAll();
    const dup=!!all[raw];
    let nm=raw, n=2;
    while(all[nm]) nm=raw+(n++);
    const r=mlLibPut(nm,rec);
    if(!r.ok){ alert('保存できん（'+r.msg+'）。要らん技を消して。'); return; }
    mlLibrary(host,opts);
    const note=document.createElement('div'); note.className='ml-hint';
    note.style.margin='0 0 6px';
    note.innerHTML = dup
      ? '<b style="color:#f0a020">！ 「'+raw+'」はもうあったけん「'+nm+'」で保存した。'+
        '前のは消しとらん。</b>'
      : '<b style="color:#7ad6a0">「'+nm+'」を保存した</b>';
    host.insertBefore(note,host.firstChild);
    if(!dup) setTimeout(()=>{ if(note.parentNode) note.parentNode.removeChild(note); },2500);
  };
  host.appendChild(bar);

  const all=mlLibAll(), keys=Object.keys(all);
  if(!keys.length){
    const e=document.createElement('div'); e.className='ml-hint'; e.style.margin='0';
    e.textContent='まだ1つも保存しとらん。保存しとけば、別の四皇モンにも同じ技を持たせられる。';
    host.appendChild(e); return;
  }
  for(const k of keys){
    const rec=all[k];
    const d=document.createElement('div'); d.className='ml-ctl';
    const gen=(rec.fx&&GEN_JP[rec.fx.generator])||'?';
    const np=(rec.fx&&rec.fx.parts||[]).length;
    const pw=(rec.battle&&rec.battle.power!=null)?('威'+rec.battle.power):'数値なし';
    d.innerHTML='<label style="width:auto;flex:1;color:#dfe6f0;font-size:11px;overflow:hidden;'+
      'text-overflow:ellipsis;white-space:nowrap"></label>'+
      '<span style="font-size:9px;color:#8b97a8;flex:none">'+gen+(np?'+素材'+np:'')+' / '+pw+'</span>'+
      '<button style="width:52px;flex:none">読込</button>'+
      '<button style="width:32px;flex:none;background:#2a1a1a;border-color:#5a2a2a;color:#e08080">×</button>';
    d.querySelector('label').textContent=k;
    const [bl,bx]=d.querySelectorAll('button');
    bl.onclick=()=>opts.load(JSON.parse(JSON.stringify(all[k])),k);
    mlArmDelete(bx,()=>{ mlLibDel(k); mlLibrary(host,opts); });
    host.appendChild(d);
  }
}

/* 焼いたコマの一覧 */
function mlFrames(host,built){
  mlInjectCSS();
  host.innerHTML='';
  const add=c=>{ const n=mkCv(c.width,c.height); n.getContext('2d').drawImage(c,0,0); host.appendChild(n); };
  if(built.body) built.body.forEach(add);
  if(built.body&&built.impact){ const sp=document.createElement('div');
    sp.style.width='12px'; sp.style.flex='none'; host.appendChild(sp); }
  if(built.impact) built.impact.forEach(add);
  if(!built.body&&!built.impact)
    host.innerHTML='<div class="ml-hint" style="margin:0">毎フレーム描画型（焼いたコマなし）</div>';
}
