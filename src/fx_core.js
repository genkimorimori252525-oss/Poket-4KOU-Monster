/* =========================================================
   EffectSystem — 技エフェクト生成の中核
   ※ 本番では EffectSystem.js として技ラボ／バトル双方から import する
   generator: projectile / beam / slash / lightning / aura / explosion
   ========================================================= */
class RNG{
  constructor(s){ this.s=(s>>>0)||1; }
  next(){ this.s|=0; this.s=(this.s+0x6D2B79F5)|0;
    let t=Math.imul(this.s^(this.s>>>15),1|this.s);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296; }
  range(a,b){ return a+this.next()*(b-a); }
  int(a,b){ return Math.floor(this.range(a,b+1)); }
}
function hash3(a,b,c){
  let h=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+Math.imul(c|0,2246822519))>>>0;
  h=Math.imul(h^(h>>>13),1274126177)>>>0;
  return ((h^(h>>>16))>>>0)/4294967296;
}
/* 使用者の攻撃 atk を 0〜1 で受け取り、本演出だけを技別の範囲で伸縮する。
   atk=50 は従来どおり1倍。ときのほうこうは指定により常に1倍。 */
function fxVisualScale(sp,channel){
  if(!sp||sp.generator==='roar_time'||sp.scaleByPower===false||sp.powerLevel==null) return 1;
  const band=sp.powerVisual&&sp.powerVisual[channel];
  if(!Array.isArray(band)||band.length<2) return 1;
  const p=Math.max(0,Math.min(1,+sp.powerLevel||0)), lo=+band[0]||1, hi=+band[1]||1;
  return p<=0.5 ? lo+(1-lo)*(p/0.5) : 1+(hi-1)*((p-0.5)/0.5);
}
function fxVisualCount(n,scale,min){ return Math.max(min||1,Math.round((+n||0)*scale)); }
const hexRGB=h=>{ h=h.replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join('');
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; };
const mkCv=(w,h)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };

/* ---- ドット描画プリミティブ（アンチエイリアスを使わない） ---- */
function pxLine(g,x0,y0,x1,y1,w,col){
  g.fillStyle=col;
  const dx=x1-x0, dy=y1-y0, n=Math.max(1,Math.ceil(Math.hypot(dx,dy)));
  const h=w/2;
  for(let i=0;i<=n;i++)
    g.fillRect(Math.round(x0+dx*i/n-h),Math.round(y0+dy*i/n-h),w,w);
}
function pxDisc(g,cx,cy,r,col){
  g.fillStyle=col; r=Math.max(0.5,r);
  for(let y=-Math.ceil(r);y<=Math.ceil(r);y++){
    const s=Math.floor(Math.sqrt(Math.max(0,r*r-y*y)));
    if(s>=0) g.fillRect(Math.round(cx-s),Math.round(cy+y),s*2+1,1);
  }
}
function pxRing(g,cx,cy,rx,ry,w,col){
  g.fillStyle=col;
  const n=Math.max(20,Math.ceil((rx+ry)*3));
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2;
    g.fillRect(Math.round(cx+Math.cos(a)*rx-w/2),Math.round(cy+Math.sin(a)*ry-w/2),w,w);
  }
}
function pxArc(g,cx,cy,r,a0,a1,w,col){
  g.fillStyle=col;
  const n=Math.max(6,Math.ceil(Math.abs(a1-a0)*r));
  for(let i=0;i<=n;i++){
    const a=a0+(a1-a0)*i/n;
    g.fillRect(Math.round(cx+Math.cos(a)*r-w/2),Math.round(cy+Math.sin(a)*r-w/2),w,w);
  }
}

function fillPolyPx(g,pts,col){
  let minY=Infinity,maxY=-Infinity;
  for(const p of pts){ if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; }
  g.fillStyle=col;
  for(let y=Math.floor(minY);y<=Math.ceil(maxY);y++){
    const xs=[];
    for(let i=0;i<pts.length;i++){
      const a=pts[i], b=pts[(i+1)%pts.length];
      if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y)) xs.push(a.x+(y-a.y)/(b.y-a.y)*(b.x-a.x));
    }
    xs.sort((p,q)=>p-q);
    for(let i=0;i+1<xs.length;i+=2){
      const x0=Math.round(xs[i]), x1=Math.round(xs[i+1]);
      if(x1>x0) g.fillRect(x0,y,x1-x0,1);
    }
  }
}

/* =========================================================
   フレーム生成（事前に焼くタイプ）
   ========================================================= */
function genBodyFrames(sp){
  const S=Math.max(4,sp.size|0), N=Math.max(1,sp.frames|0);
  const pal=sp.palette.map(hexRGB), P=pal.length, out=[];
  for(let f=0;f<N;f++){
    const c=mkCv(S,S), g=c.getContext('2d');
    const im=g.createImageData(S,S), d=im.data;
    const rng=new RNG(sp.seed+f*7919);
    const NA=16, noise=[];
    for(let i=0;i<NA;i++) noise.push(1+(rng.next()-0.5)*2*sp.wobble);
    const spin=(sp.spin||0)*f/N*Math.PI*2;
    for(let y=0;y<S;y++) for(let x=0;x<S;x++){
      let nx=(x+0.5-S/2)/(S/2), ny=(y+0.5-S/2)/(S/2);
      if(sp.shape==='shard'||sp.shape==='bolt') nx*=0.55;
      let dist=Math.sqrt(nx*nx+ny*ny);
      const ang=(Math.atan2(ny,nx)+spin+Math.PI*3)%(Math.PI*2);
      const a=ang/(Math.PI*2)*NA, i0=Math.floor(a)%NA, i1=(i0+1)%NA, fr=a-Math.floor(a);
      let n=noise[i0]*(1-fr)+noise[i1]*fr;
      if(sp.shape==='bolt') n*=(1+Math.sin(ang*5+f)*0.22);
      dist/=n;
      if(dist>1) continue;
      if(sp.shape==='ring'&&dist<0.55) continue;
      const t=Math.pow(dist,sp.core*2+0.25);
      const [r,gg,b]=pal[Math.min(P-1,Math.floor(t*P))];
      const o=(y*S+x)*4; d[o]=r; d[o+1]=gg; d[o+2]=b; d[o+3]=255;
    }
    for(let k=0;k<(sp.specks|0);k++){
      const ang=rng.next()*Math.PI*2, rr=rng.range(0.55,1.05)*(S/2);
      const x=Math.round(S/2+Math.cos(ang)*rr), y=Math.round(S/2+Math.sin(ang)*rr);
      if(x<0||y<0||x>=S||y>=S) continue;
      const [r,gg,b]=pal[0], o=(y*S+x)*4;
      d[o]=r; d[o+1]=gg; d[o+2]=b; d[o+3]=255;
    }
    g.putImageData(im,0,0); out.push(c);
  }
  return out;
}

function genImpactFrames(sp){
  const S=Math.max(8,sp.size|0), N=Math.max(2,sp.frames|0);
  const pal=sp.palette.map(hexRGB), P=pal.length, out=[];
  for(let f=0;f<N;f++){
    const c=mkCv(S,S), g=c.getContext('2d');
    const im=g.createImageData(S,S), d=im.data;
    const rng=new RNG(sp.seed+f*3571), p=f/(N-1);
    const R=(S/2)*(0.30+0.70*(1-Math.pow(1-p,2))), hollow=Math.pow(p,1.6)*0.92;
    const NA=20, noise=[];
    for(let i=0;i<NA;i++) noise.push(1+(rng.next()-0.5)*0.55);
    for(let y=0;y<S;y++) for(let x=0;x<S;x++){
      const nx=x+0.5-S/2, ny=y+0.5-S/2;
      const dist=Math.sqrt(nx*nx+ny*ny);
      const ang=(Math.atan2(ny,nx)+Math.PI*3)%(Math.PI*2);
      const a=ang/(Math.PI*2)*NA, i0=Math.floor(a)%NA, i1=(i0+1)%NA, fr=a-Math.floor(a);
      const n=noise[i0]*(1-fr)+noise[i1]*fr, rn=dist/(R*n);
      if(rn>1||rn<hollow) continue;
      const t=(rn-hollow)/Math.max(0.001,1-hollow);
      const [r,gg,b]=pal[Math.min(P-1,Math.floor(Math.pow(1-t,0.8)*P))];
      const o=(y*S+x)*4;
      d[o]=r; d[o+1]=gg; d[o+2]=b; d[o+3]=Math.round(255*(1-Math.pow(p,2.4)));
    }
    const srng=new RNG(sp.seed+991);
    for(let k=0;k<(sp.shards|0);k++){
      const ang=srng.next()*Math.PI*2, spd=srng.range(0.6,1.25), len=srng.range(1,3);
      const rr=R*spd*(0.5+p*0.9);
      for(let l=0;l<len;l++){
        const x=Math.round(S/2+Math.cos(ang)*(rr+l)), y=Math.round(S/2+Math.sin(ang)*(rr+l));
        if(x<0||y<0||x>=S||y>=S) continue;
        const [r,gg,b]=pal[Math.min(P-1,1)], o=(y*S+x)*4;
        d[o]=r; d[o+1]=gg; d[o+2]=b; d[o+3]=Math.round(255*(1-p));
      }
    }
    g.putImageData(im,0,0); out.push(c);
  }
  return out;
}

/* =========================================================
   斬撃／空間の裂け目を焼く
     taper  … 両端の尖り。1で紡錘形、大きいほど鋭い
     hollow … 芯の空洞。0で刃、0.5前後で「裂け目」になる
     jitter … 縁のギザつき
     squash … 縦の潰し（真円やなく楕円の弧にする）
   ========================================================= */
function genSlashFrames(sp){
  const S=Math.max(24,sp.size|0), N=14, out=[];
  const pal=sp.palette.map(hexRGB), P=pal.length;
  const style=sp.style||'arc';
  const half=(sp.arcDeg*Math.PI/180)/2;
  const R=S/2-3;
  const taper =sp.taper ===undefined?1.0:sp.taper;
  const hollow=sp.hollow===undefined?0  :sp.hollow;
  const jit   =sp.jitter===undefined?0.2:sp.jitter;
  const squash=sp.squash===undefined?1  :sp.squash;
  const wmax=Math.max(1.2,(sp.thickness||8)/2);
  const rng=new RNG(sp.seed||1);
  const NA=28, noise=[];
  for(let i=0;i<NA;i++) noise.push(1+(rng.next()-0.5)*2*jit);

  for(let f=0;f<N;f++){
    const c=mkCv(S,S), g=c.getContext('2d');
    const im=g.createImageData(S,S), d=im.data;
    const p=f/(N-1);
    /* 先端が走り抜け、少し遅れて後端が追いつき、最後に閉じる */
    const lead=Math.min(1, Math.pow(Math.max(0,p)/0.42, 0.62));
    const tail=Math.max(0, (p-0.52)/0.48);
    const fade=p<0.72?1:Math.max(0,1-(p-0.72)/0.28);
    if(lead>tail+0.01){
      const a0=-half+2*half*tail, a1=-half+2*half*lead, span=a1-a0;
      const flash=p<0.18?1:0;                     // 走り出しの白熱
      if(style==='arc'){
        for(let y=0;y<S;y++) for(let x=0;x<S;x++){
          const nx=x+0.5-S/2, ny=(y+0.5-S/2)/squash;
          const r=Math.hypot(nx,ny);
          const th=Math.atan2(ny,nx);
          if(th<a0||th>a1) continue;
          const uv=(th-a0)/Math.max(1e-6,span);
          /* 見えとる弧の両端で細くなる＝三日月 */
          const w=wmax*Math.pow(Math.sin(Math.PI*uv),taper);
          if(w<0.35) continue;
          const ai=((th+Math.PI*3)%(Math.PI*2))/(Math.PI*2)*NA;
          const i0=Math.floor(ai)%NA, i1=(i0+1)%NA, fr=ai-Math.floor(ai);
          const nz=noise[i0]*(1-fr)+noise[i1]*fr;
          const dist=Math.abs(r-(R+(nz-1)*wmax*1.3))/w;
          if(dist>1||dist<hollow) continue;
          const t=(dist-hollow)/Math.max(0.001,1-hollow);
          let idx=Math.min(P-1,Math.floor(t*P));
          if(flash && uv>0.72) idx=0;               // 先端は白く抜く
          const o=(y*S+x)*4;
          d[o]=pal[idx][0]; d[o+1]=pal[idx][1]; d[o+2]=pal[idx][2];
          d[o+3]=Math.round(255*fade);
        }
        /* 縁に散る破片 */
        const srng=new RNG((sp.seed||1)+f*613);
        const nsp=(sp.specks===undefined?10:sp.specks);
        for(let k=0;k<nsp;k++){
          const th=a0+srng.next()*span;
          const rr=R + (srng.next()-0.5)*wmax*3.2;
          const x=Math.round(S/2+Math.cos(th)*rr), y=Math.round(S/2+Math.sin(th)*rr*squash);
          if(x<0||y<0||x>=S||y>=S) continue;
          const o=(y*S+x)*4, col=pal[srng.next()<0.6?0:1];
          d[o]=col[0]; d[o+1]=col[1]; d[o+2]=col[2];
          d[o+3]=Math.round(255*fade*(0.5+srng.next()*0.5));
        }
      } else {
        for(let y=0;y<S;y++) for(let x=0;x<S;x++){
          const nx=x+0.5-S/2, ny=(y+0.5-S/2)/squash;
          let dist=Infinity, uv=0, hits=0;
          if(style==='cross'){
            for(const rot of [-Math.PI/4,Math.PI/4]){
              const along=nx*Math.cos(rot)+ny*Math.sin(rot);
              const across=-nx*Math.sin(rot)+ny*Math.cos(rot);
              const u=along/(2*R)+0.5;
              if(u<tail||u>lead) continue;
              const w=wmax*Math.pow(Math.max(0,Math.sin(Math.PI*u)),taper);
              const q=Math.abs(across)/Math.max(0.35,w);
              if(q<=1){ dist=Math.min(dist,q); uv=u; hits++; }
            }
          } else if(style==='thrust'){
            const u=nx/(2*R)+0.5;
            if(u>=tail&&u<=lead){
              const opening=Math.min(Math.PI*0.46,Math.max(0.08,half*0.5));
              const rootW=Math.min(R*0.72,Math.max(wmax*1.5,Math.tan(opening)*R*0.35));
              const w=Math.max(0.35,rootW*(1-u)+wmax*0.12);
              dist=Math.abs(ny)/w; uv=u;
            }
          } else if(style==='fan'){
            const blades=Math.max(1,Math.min(8,sp.count|0));
            const bx=-R*0.62, by=0;
            for(let k=0;k<blades;k++){
              const q=blades===1?0:k/(blades-1)-0.5;
              const a=q*Math.min(Math.PI*0.72,half*0.9);
              const tx=Math.cos(a)*R, ty=Math.sin(a)*R;
              const vx=tx-bx, vy=ty-by, ll=vx*vx+vy*vy;
              const u=((nx-bx)*vx+(ny-by)*vy)/ll;
              if(u<tail||u>lead) continue;
              const w=Math.max(0.35,wmax*0.42*Math.sin(Math.PI*Math.min(0.98,Math.max(0.02,u))));
              const qd=Math.abs((nx-bx)*vy-(ny-by)*vx)/Math.sqrt(ll)/w;
              if(qd<=1){ dist=Math.min(dist,qd); uv=u; hits++; }
            }
          } else if(style==='spiral'){
            const turns=Math.max(1,Math.min(2.5,sp.arcDeg/120));
            for(let k=0;k<=32;k++){
              const u=tail+(lead-tail)*k/32;
              const th=-Math.PI*turns+u*Math.PI*2*turns;
              const rr=R*(1-0.82*u);
              const sx=Math.cos(th)*rr, sy=Math.sin(th)*rr;
              const w=wmax*Math.pow(Math.max(0,Math.sin(Math.PI*u)),taper);
              const q=Math.hypot(nx-sx,ny-sy)/Math.max(0.35,w);
              if(q<dist){ dist=q; uv=u; }
            }
          }
          if(dist>1||dist<hollow) continue;
          const t=(dist-hollow)/Math.max(0.001,1-hollow);
          let idx=Math.min(P-1,Math.floor(t*P));
          if((style==='cross'&&hits>1)||(flash&&uv>0.72)) idx=0;
          const o=(y*S+x)*4;
          d[o]=pal[idx][0]; d[o+1]=pal[idx][1]; d[o+2]=pal[idx][2];
          d[o+3]=Math.round(255*fade);
        }
      }
    }
    g.putImageData(im,0,0); out.push(c);
  }
  return out;
}

function buildEffect(sp){
  const o={};
  if(sp.generator==='projectile') o.body=genBodyFrames(sp);
  if(sp.generator==='slash')      o.body=genSlashFrames(sp);
  if(sp.impact) o.impact=genImpactFrames({size:sp.impact.size,frames:sp.impact.frames,
      shards:sp.impact.shards,palette:sp.impact.palette,seed:sp.seed+13});
  return o;
}


/* =========================================================
   ScreenFX — 画面演出（背景の点滅・色付け・暗転・揺れ・走査線）
   技データの "screen" ブロックで指定する。技エフェクトの一部として扱う。
     at: 'cast'   … 技を出した瞬間
         'impact' … 当たった瞬間
   ========================================================= */
const SCREEN_DEFAULTS = {
  flash : {color:'#ffffff', strength:0.85, dur:0.14, at:'impact'},           // 一瞬光る
  blink : {color:'#ffffff', strength:0.70, times:4, dur:0.50, at:'impact'},  // 背景が点滅
  tint  : {color:'#ff6a10', strength:0.35, dur:0.50, at:'impact'},           // 背景に色が乗る
  darken: {strength:0.55, dur:0.50, at:'cast'},                              // 暗転（溜め演出）
  shake : {power:7, dur:0.35, at:'impact'},                                  // 画面が揺れる
  lines : {color:'#ffffff', strength:0.40, dur:0.40, at:'impact', dir:'h'}   // 走査線／集中線
};
const SCREEN_ORDER = ['darken','tint','lines','blink','flash'];

class ScreenFX{
  constructor(){ this.evs=[]; this.clock=0; }
  trigger(sc,phase){
    if(!sc) return;
    for(const k of Object.keys(SCREEN_DEFAULTS)){
      const c=sc[k];
      if(c && (c.at||'impact')===phase) this.evs.push({k,c,t:0,seed:(this.evs.length*37+1)|0});
    }
  }
  update(dt){
    this.clock+=dt;
    for(const e of this.evs) e.t+=dt;
    this.evs=this.evs.filter(e=>e.t<e.c.dur);
  }
  clear(){ this.evs.length=0; }
  /* 画面の揺れ量 */
  offset(){
    let x=0,y=0;
    for(const e of this.evs){
      if(e.k!=='shake') continue;
      const fade=1-e.t/e.c.dur;
      const tk=Math.floor(e.t*40);
      x+=(hash3(tk,e.seed,1)-0.5)*2*e.c.power*fade;
      y+=(hash3(tk,e.seed,2)-0.5)*2*e.c.power*fade;
    }
    return {x:Math.round(x),y:Math.round(y)};
  }
  /* フィールドの上に被せる */
  drawOver(g,w,h){
    const evs=this.evs.slice().sort((a,b)=>SCREEN_ORDER.indexOf(a.k)-SCREEN_ORDER.indexOf(b.k));
    for(const e of evs){
      const c=e.c, p=Math.min(1,e.t/c.dur), fade=1-p;
      if(e.k==='darken'){
        g.globalAlpha=c.strength*Math.min(1,p*6)*fade;
        g.fillStyle='#000000'; g.fillRect(0,0,w,h);
      } else if(e.k==='tint'){
        g.globalAlpha=c.strength*fade;
        g.fillStyle=c.color; g.fillRect(0,0,w,h);
      } else if(e.k==='flash'){
        g.globalAlpha=c.strength*Math.pow(fade,0.6);
        g.fillStyle=c.color; g.fillRect(0,0,w,h);
      } else if(e.k==='blink'){
        const on=Math.floor(p*c.times*2)%2===0;
        if(on){ g.globalAlpha=c.strength*fade; g.fillStyle=c.color; g.fillRect(0,0,w,h); }
      } else if(e.k==='lines'){
        g.globalAlpha=c.strength*fade; g.fillStyle=c.color;
        if(c.dir==='v'){
          const off=Math.floor(e.t*220)%8;
          for(let x=-off;x<w;x+=8) g.fillRect(x,0,2,h);
        } else {
          const off=Math.floor(e.t*260)%8;
          for(let y=-off;y<h;y+=8) g.fillRect(0,y,w,2);
        }
      }
      g.globalAlpha=1;
    }
  }
}
const SCREEN = new ScreenFX();

/* =========================================================
   ランタイム
   ========================================================= */
class Particle{
  constructor(x,y,vx,vy,life,col,size){ Object.assign(this,{x,y,vx,vy,life,max:life,col,size}); }
  update(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=40*dt; this.life-=dt; }
  draw(g){ const a=Math.max(0,this.life/this.max);
    g.globalAlpha=a; g.fillStyle=this.col;
    const s=Math.max(1,Math.round(this.size*a));
    g.fillRect(Math.round(this.x-s/2),Math.round(this.y-s/2),s,s); g.globalAlpha=1; }
}

class BaseFX{
  constructor(sp,from,to,built,onHit){
    Object.assign(this,{sp,f:from,t:to,b:built,onHit});
    this.time=0; this.state='run'; this.hit=false; this.if_=-1; this.parts=[];
    this.rng=new RNG(sp.seed+77);
    /* 技全体の速さ。技データの値やけん、同じ技なら誰が撃っても同じ速さになる
       （＝決定論は壊れん）。各 update の頭で dt に掛ける。 */
    this.ts=Math.max(0.05,Math.min(4,+sp.timeScale||1));
    SCREEN.trigger(sp.screen,'cast');
  }
  doHit(){ if(!this.hit){ this.hit=true; this.if_=0;
    SCREEN.trigger(this.sp.screen,'impact');
    if(this.onHit) this.onHit(); } }
  stepCommon(dt){
    this.time+=dt;
    for(const p of this.parts) p.update(dt);
    this.parts=this.parts.filter(p=>p.life>0);
    if(this.if_>=0) this.if_+=dt*24;
  }
  drawImpact(g,x,y){
    if(this.if_<0||!this.b.impact) return;
    const i=Math.floor(this.if_);
    if(i<this.b.impact.length){ const fr=this.b.impact[i];
      g.drawImage(fr,Math.round(x-fr.width/2),Math.round(y-fr.height/2)); }
  }
  impactDone(){ return !this.b.impact || this.if_>=this.b.impact.length; }
}

/* ---- projectile：飛び道具 ---- */
class ProjectileFX extends BaseFX{
  /* 大きさの倍率はここ1本だけ。draw() が使う fxVisualScale と同じ式を
     当たり判定も読む —— 別々に計算したら絵と判定がズレる（それが元の不具合） */
  get mul(){ return fxVisualScale(this.sp,'size'); }
  get radius(){ return Math.max(3,(this.sp.size||16)/2) * this.mul; }
  constructor(...a){ super(...a); this.p=0; this.spawn=0;
    this.dur=Math.hypot(this.t.x-this.f.x,this.t.y-this.f.y)/Math.max(20,this.sp.travel.speed);
    this.ang=Math.atan2(this.t.y-this.f.y,this.t.x-this.f.x); }
  pos(){ const t=this.p;
    return {x:this.f.x+(this.t.x-this.f.x)*t,
            y:this.f.y+(this.t.y-this.f.y)*t+Math.sin(Math.min(1,t)*Math.PI)*this.sp.travel.arc}; }
  update(dt){
    dt*=this.ts;                 // 技全体の速さ（sp.timeScale）
    this.stepCommon(dt);
    if(!this.hit){
      this.p+=dt/this.dur;
      const tr=this.sp.trail;
      if(tr&&tr.type!=='none'){
        this.spawn+=dt;
        const iv=0.016/Math.max(0.05,tr.rate);
        while(this.spawn>iv){
          this.spawn-=iv;
          const p=this.pos(), col=this.sp.palette[this.rng.int(0,this.sp.palette.length-1)];
          const s2=tr.type==='spark'?70:(tr.type==='smoke'?12:26);
          this.parts.push(new Particle(p.x+this.rng.range(-2,2),p.y+this.rng.range(-2,2),
            this.rng.range(-s2,s2),this.rng.range(-s2,s2)-(tr.type==='smoke'?26:0),
            tr.length/40*(0.6+this.rng.next()*0.8),
            tr.type==='smoke'?'#8a8a92':col, Math.max(1,tr.size*this.sp.size*0.14)));
        }
      }
      if(this.p>=1){
        if(this.passThrough){                 // 回避された：着弾せず通り抜ける
          if(this.p>1.9) this.state='dead';
        } else { this.p=1; this.doHit(); }
      }
    }
    if(this.hit&&this.impactDone()&&this.parts.length===0) this.state='dead';
  }
  draw(g){
    for(const p of this.parts) p.draw(g);
    const p=this.pos();
    const frames=this.b&&this.b.body;
    if(!this.hit){
      if(!frames||!frames.length){ this.state='dead'; return; }
      const i=Math.floor(this.time*18);
      const fr=frames[(Number.isFinite(i)?((i%frames.length)+frames.length)%frames.length:0)];
      if(!fr){ this.state='dead'; return; }
      g.save(); g.translate(p.x,p.y);
      if(this.sp.shape==='shard'||this.sp.shape==='bolt') g.rotate(this.ang);
      if(this.sp.travel.spin) g.rotate(this.time*this.sp.travel.spin);
      g.drawImage(fr,-fr.width/2,-fr.height/2); g.restore();
    } else this.drawImpact(g,p.x,p.y);
  }
}

/* ---- beam：太い光線。溜め→伸びる→持続→消える ---- */
class BeamFX extends BaseFX{
  /* limit: 0〜1。1未満なら途中で止められとる（相殺のせめぎ合い） */
  get firing(){ return this.time>=this.sp.charge; }
  /* 相殺の当たり判定はここを読む。draw() の中の width=s.width*sz と同じ式やけん、
     絵が太くなったぶんだけ判定も太くなる（呼び出し側で sp.width を直読みせん） */
  get halfWidth(){ return this.sp.width*0.5*fxVisualScale(this.sp,'size'); }
  extent(){
    const s=this.sp;
    const raw=this.time<s.charge+s.fire?(this.time-s.charge)/s.fire:1;
    return Math.max(0,Math.min(raw, this.limit===undefined?1:this.limit));
  }
  endPoint(){ const e=this.extent();
    return {x:this.f.x+(this.t.x-this.f.x)*e, y:this.f.y+(this.t.y-this.f.y)*e}; }
  update(dt){
    dt*=this.ts;                 // 技全体の速さ（sp.timeScale）
    this.stepCommon(dt);
    const s=this.sp;
    if(this.time>=s.charge+s.fire && !this.blocked) this.doHit();
    if(this.time>=s.charge+s.fire+s.sustain+s.fade) this.state='dead';
  }
  draw(g){
    const s=this.sp, P=s.palette;
    const style=s.style||'straight';
    if(this.time<s.charge){
      const p=this.time/s.charge, r=Math.max(1,s.width*0.8*p*(0.85+0.15*Math.sin(this.time*40)));
      pxDisc(g,this.f.x,this.f.y,r,P[Math.min(P.length-1,2)]);
      pxDisc(g,this.f.x,this.f.y,r*0.6,P[1]);
      pxDisc(g,this.f.x,this.f.y,r*0.28,P[0]);
      return;
    }
    const ext=this.extent();
    let a=1;
    const tEnd=s.charge+s.fire+s.sustain;
    if(this.time>tEnd) a=Math.max(0,1-(this.time-tEnd)/s.fade);
    const ex=this.f.x+(this.t.x-this.f.x)*ext, ey=this.f.y+(this.t.y-this.f.y)*ext;
    const ang=Math.atan2(ey-this.f.y,ex-this.f.x)+Math.PI/2;
    const tick=Math.floor(this.time*24);
    g.globalAlpha=a;
    if(style==='straight'){
      for(let li=P.length-1;li>=0;li--){
        // 外側（暗い色）が一番太く、中心の白が一番細い＝芯が通って見える
        const w=Math.max(1,Math.round(s.width*(li+1)/P.length));
        let px=this.f.x, py=this.f.y;
        for(let i=1;i<=s.segments;i++){
          const t=i/s.segments;
          const nx=this.f.x+(ex-this.f.x)*t, ny=this.f.y+(ey-this.f.y)*t;
          const jit=(hash3(i,li,tick)-0.5)*s.waver*(li+1)*(i===s.segments?0.2:1);
          const jx=nx+Math.cos(ang)*jit, jy=ny+Math.sin(ang)*jit;
          pxLine(g,px,py,jx,jy,w,P[li]);
          px=jx; py=jy;
        }
      }
    } else if(style==='wave'){
      const waves=Math.max(1,s.segments/4), amp=s.waver*(1+P.length*0.5);
      for(let li=P.length-1;li>=0;li--){
        const w=Math.max(1,Math.round(s.width*(li+1)/P.length));
        let px=this.f.x, py=this.f.y;
        for(let i=1;i<=s.segments;i++){
          const t=i/s.segments;
          const off=Math.sin(t*Math.PI*2*waves-tick*0.16)*amp*Math.sin(Math.PI*t);
          const jx=this.f.x+(ex-this.f.x)*t+Math.cos(ang)*off;
          const jy=this.f.y+(ey-this.f.y)*t+Math.sin(ang)*off;
          pxLine(g,px,py,jx,jy,w,P[li]); px=jx; py=jy;
        }
      }
    } else if(style==='twin'){
      const gap=Math.max(2,s.width*0.78);
      for(const side of [-1,1]) for(let li=P.length-1;li>=0;li--){
        const w=Math.max(1,Math.round(s.width*0.48*(li+1)/P.length));
        const off=side*gap;
        let px=this.f.x+Math.cos(ang)*off, py=this.f.y+Math.sin(ang)*off;
        for(let i=1;i<=s.segments;i++){
          const t=i/s.segments;
          const jit=(hash3(i,side,tick)-0.5)*s.waver*0.6*(i===s.segments?0.2:1);
          const jx=this.f.x+(ex-this.f.x)*t+Math.cos(ang)*(off+jit);
          const jy=this.f.y+(ey-this.f.y)*t+Math.sin(ang)*(off+jit);
          pxLine(g,px,py,jx,jy,w,P[li]); px=jx; py=jy;
        }
      }
    } else if(style==='spiral'){
      const turns=Math.max(1,Math.round(s.segments/5));
      const amp=Math.max(s.width*1.15,s.waver*2);
      for(const phase of [0,Math.PI]) for(let li=P.length-1;li>=0;li--){
        const w=Math.max(1,Math.round(s.width*0.42*(li+1)/P.length));
        let px=this.f.x, py=this.f.y;
        for(let i=1;i<=s.segments;i++){
          const t=i/s.segments;
          const off=Math.sin(t*Math.PI*2*turns+phase+tick*0.15)*amp*Math.sin(Math.PI*t);
          const jx=this.f.x+(ex-this.f.x)*t+Math.cos(ang)*off;
          const jy=this.f.y+(ey-this.f.y)*t+Math.sin(ang)*off;
          pxLine(g,px,py,jx,jy,w,P[li]); px=jx; py=jy;
        }
      }
    } else if(style==='cone'){
      const len=Math.hypot(ex-this.f.x,ey-this.f.y);
      const steps=Math.max(s.segments,Math.ceil(len/4));
      for(let li=P.length-1;li>=0;li--){
        for(let i=0;i<=steps;i++){
          const t=i/steps;
          const jit=(hash3(i,li,tick)-0.5)*s.waver*2*Math.sin(Math.PI*t);
          const x=this.f.x+(ex-this.f.x)*t+Math.cos(ang)*jit;
          const y=this.f.y+(ey-this.f.y)*t+Math.sin(ang)*jit;
          const r=Math.max(0.6,s.width*(li+1)/P.length*(0.08+1.32*t));
          pxDisc(g,x,y,r,P[li]);
        }
      }
    }
    g.globalAlpha=1;
    this.drawImpact(g,this.t.x,this.t.y);
  }
}

/* ---- slash：斬撃。連撃できる ---- */
class SlashFX extends BaseFX{
  constructor(...a){ super(...a); this.n=0; }
  update(dt){
    dt*=this.ts;                 // 技全体の速さ（sp.timeScale）
    this.stepCommon(dt);
    const s=this.sp, per=s.interval;
    this.n=Math.min(s.count,Math.floor(this.time/per)+1);
    if(this.time>=per*(s.count-1)+0.12) this.doHit();
    if(this.time>=per*s.count+0.35&&this.impactDone()) this.state='dead';
  }
  draw(g){
    const s=this.sp, per=s.interval, fr=this.b&&this.b.body;
    if(!fr||!fr.length){ this.drawImpact(g,this.t.x,this.t.y); return; }
    for(let k=0;k<this.n;k++){
      const lt=this.time-k*per;
      if(lt<0) continue;
      const i=Math.floor(lt/ (per*0.9) * fr.length);
      if(i>=fr.length) continue;
      const c=fr[i];
      const ox=(hash3(k,1,s.seed)-0.5)*s.spread, oy=(hash3(k,2,s.seed)-0.5)*s.spread;
      const rot=(hash3(k,3,s.seed)-0.5)*2.4;
      g.save(); g.translate(this.t.x+ox,this.t.y+oy); g.rotate(rot);
      g.drawImage(c,-c.width/2,-c.height/2); g.restore();
    }
    this.drawImpact(g,this.t.x,this.t.y);
  }
}

/* ---- lightning：中点変位で作る稲妻。枝分かれあり ---- */
class LightningFX extends BaseFX{
  constructor(...a){ super(...a); this.path=[]; this.branches=[]; this.tick=-1; this.gen(0); }
  gen(tick){
    const s=this.sp;
    const from = s.fromSky ? {x:this.t.x+(hash3(tick,9,s.seed)-0.5)*20, y:this.t.y-170} : this.f;
    let pts=[{x:from.x,y:from.y},{x:this.t.x,y:this.t.y}];
    for(let it=0;it<s.segments;it++){
      const np=[pts[0]];
      for(let i=0;i<pts.length-1;i++){
        const a=pts[i], b=pts[i+1];
        const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
        const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy);
        const j=(hash3(it*100+i,tick,s.seed)-0.5)*s.jag*len*0.5;
        np.push({x:mx-dy/len*j, y:my+dx/len*j});
        np.push(b);
      }
      pts=np;
    }
    this.path=pts;
    this.branches=[];
    for(let k=0;k<s.branches;k++){
      const i=Math.floor(hash3(k,tick,s.seed)*(pts.length-2))+1;
      const a=pts[i];
      const ang=hash3(k,tick+5,s.seed)*Math.PI*2;
      const len=20+hash3(k,tick+9,s.seed)*40;
      const bp=[a];
      for(let j=1;j<=3;j++)
        bp.push({x:a.x+Math.cos(ang)*len*j/3+(hash3(k,j+tick,s.seed)-0.5)*12,
                 y:a.y+Math.sin(ang)*len*j/3+(hash3(k,j+tick+3,s.seed)-0.5)*12});
      this.branches.push(bp);
    }
  }
  update(dt){
    dt*=this.ts;                 // 技全体の速さ（sp.timeScale）
    this.stepCommon(dt);
    const tk=Math.floor(this.time*16);
    if(tk!==this.tick){ this.tick=tk; this.gen(tk); }
    if(this.time>=0.10) this.doHit();
    if(this.time>=this.sp.duration&&this.impactDone()) this.state='dead';
  }
  draw(g){
    const s=this.sp, P=s.palette;
    const a=Math.max(0,1-Math.pow(this.time/s.duration,2.5));
    g.globalAlpha=a;
    const strokes=[[P[3]||P[2],s.width+4],[P[2],s.width+2],[P[1],s.width],[P[0],Math.max(1,s.width-2)]];
    for(const [col,w] of strokes){
      for(const bp of [this.path,...this.branches])
        for(let i=0;i<bp.length-1;i++)
          pxLine(g,bp[i].x,bp[i].y,bp[i+1].x,bp[i+1].y,Math.max(1,Math.round(w)),col);
    }
    g.globalAlpha=1;
    this.drawImpact(g,this.t.x,this.t.y);
  }
}

/* ---- aura：強化・回復・状態変化。輪が立ち昇る ---- */
class AuraFX extends BaseFX{
  update(dt){
    dt*=this.ts;                 // 技全体の速さ（sp.timeScale）
    this.stepCommon(dt);
    const s=this.sp;
    this.spawn=(this.spawn||0)+dt;
    while(this.spawn>0.05){
      this.spawn-=0.05;
      const r=s.size*0.5;
      const ang=this.rng.next()*Math.PI*2;
      this.parts.push(new Particle(
        this.t.x+Math.cos(ang)*r, this.t.y+this.rng.range(-4,10),
        this.rng.range(-6,6), -s.rise*this.rng.range(0.6,1.3),
        0.5+this.rng.next()*0.5,
        s.palette[this.rng.int(0,s.palette.length-1)], 2));
    }
    for(const p of this.parts) p.vy+=-40*dt;   // 重力を打ち消して上へ
    if(this.time>=0.10) this.doHit();
    if(this.time>=s.duration&&this.parts.length===0) this.state='dead';
  }
  draw(g){
    const s=this.sp, P=s.palette;
    const a=this.time<s.duration?1:0;
    if(a){
      for(let k=0;k<s.rings;k++){
        const t=((this.time*s.rise/40)+k/s.rings)%1;
        const y=this.t.y+16-t*s.size*1.1;
        const rx=s.size*0.5*(0.5+t*0.55), ry=rx*0.32;
        g.globalAlpha=Math.max(0,1-t)*0.9;
        pxRing(g,this.t.x,y,rx,ry,2,P[Math.min(P.length-1,1+(k%2))]);
      }
      g.globalAlpha=1;
    }
    for(const p of this.parts) p.draw(g);
  }
}

/* ---- shatter：空間がガラスのように割れる ----
   1. 亀裂が走る → 2. 面が白く閃く → 3. 破片が回りながら飛び散る   */
class ShatterFX extends BaseFX{
  constructor(...a){
    super(...a);
    const sp=this.sp, rng=new RNG(sp.seed||7);
    this.R=sp.size/2;
    const N=Math.max(3,sp.cracks|0);
    /* 中心から放射する亀裂。中点変位でギザつかせる */
    this.rays=[];
    for(let i=0;i<N;i++){
      const base=(i/N)*Math.PI*2 + (rng.next()-0.5)*(Math.PI*2/N)*0.8;
      const len=this.R*(0.65+rng.next()*0.55);
      let pts=[{x:0,y:0},{x:Math.cos(base)*len,y:Math.sin(base)*len}];
      for(let it=0;it<3;it++){
        const np=[pts[0]];
        for(let k=0;k<pts.length-1;k++){
          const A=pts[k],B=pts[k+1];
          const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;
          const dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy)||1;
          const j=(rng.next()-0.5)*sp.jag*L*0.45;
          np.push({x:mx-dy/L*j,y:my+dx/L*j}); np.push(B);
        }
        pts=np;
      }
      this.rays.push({pts,ang:base,len});
    }
    /* 隣り合う亀裂のあいだが破片になる */
    this.shards=[];
    for(let i=0;i<N;i++){
      const a=this.rays[i], b=this.rays[(i+1)%N];
      const mid={x:(a.pts[a.pts.length-1].x+b.pts[b.pts.length-1].x)/2*(0.75+rng.next()*0.4),
                 y:(a.pts[a.pts.length-1].y+b.pts[b.pts.length-1].y)/2*(0.75+rng.next()*0.4)};
      const ia=a.pts[Math.floor(a.pts.length*0.32)], ib=b.pts[Math.floor(b.pts.length*0.32)];
      const poly=[ia, a.pts[Math.floor(a.pts.length*0.62)], mid, b.pts[Math.floor(b.pts.length*0.62)], ib];
      const cx=poly.reduce((s2,p)=>s2+p.x,0)/poly.length;
      const cy=poly.reduce((s2,p)=>s2+p.y,0)/poly.length;
      const dir=Math.atan2(cy,cx);
      this.shards.push({poly,cx,cy,
        vx:Math.cos(dir)*sp.drift*(0.6+rng.next()*0.8),
        vy:Math.sin(dir)*sp.drift*(0.6+rng.next()*0.8)-sp.drift*0.25,
        spin:(rng.next()-0.5)*sp.spin, tone:rng.next()});
    }
    /* 細かいガラス片（粉） */
    this.dust=[];
    const nd=sp.dust===undefined?46:sp.dust;
    for(let k=0;k<nd;k++){
      const a=rng.next()*Math.PI*2, sp2=sp.drift*(0.5+rng.next()*1.6);
      this.dust.push({x:Math.cos(a)*this.R*rng.next()*0.35, y:Math.sin(a)*this.R*rng.next()*0.35,
        vx:Math.cos(a)*sp2, vy:Math.sin(a)*sp2-sp.drift*0.3,
        sz:1+Math.floor(rng.next()*2.4), tone:rng.next()});
    }
  }
  update(dt){
    dt*=this.ts;                 // 技全体の速さ（sp.timeScale）
    this.stepCommon(dt);
    if(this.time>=0.06) this.doHit();
    if(this.time>=this.sp.duration) this.state='dead';
  }
  draw(g){
    const sp=this.sp, P=sp.palette, T=this.time, D=sp.duration;
    const p=Math.min(1,T/D);
    const cx=this.t.x, cy=this.t.y;

    /* 1. 亀裂が走る */
    const crackP=Math.min(1,T/(D*0.22));
    if(p<0.95){
      g.globalAlpha=p<0.55?1:Math.max(0,1-(p-0.55)/0.45);
      for(const r of this.rays){
        const n=Math.max(2,Math.floor(r.pts.length*crackP));
        for(let i=0;i<n-1;i++){
          pxLine(g,cx+r.pts[i].x,cy+r.pts[i].y,cx+r.pts[i+1].x,cy+r.pts[i+1].y,3,P[3]||P[2]);
          pxLine(g,cx+r.pts[i].x,cy+r.pts[i].y,cx+r.pts[i+1].x,cy+r.pts[i+1].y,1,P[0]);
        }
      }
      g.globalAlpha=1;
    }
    /* 2. 面が閃く */
    if(T<D*0.16){
      const fl=1-T/(D*0.16);
      g.globalAlpha=fl*0.75;
      for(const s2 of this.shards)
        fillPolyPx(g,s2.poly.map(q=>({x:cx+q.x,y:cy+q.y})),P[1]);
      g.globalAlpha=1;
    }
    /* 3. 破片が飛び散る */
    if(T>D*0.22){
      const t2=(T-D*0.22);
      const a=Math.max(0,1-t2/(D*0.78));
      g.globalAlpha=a;
      for(const s2 of this.shards){
        const ox=s2.vx*t2, oy=s2.vy*t2+120*t2*t2;
        const rot=s2.spin*t2, co=Math.cos(rot), si=Math.sin(rot);
        const pts=s2.poly.map(q=>{
          const rx=q.x-s2.cx, ry=q.y-s2.cy;
          return {x:cx+s2.cx+ox+rx*co-ry*si, y:cy+s2.cy+oy+rx*si+ry*co};
        });
        fillPolyPx(g,pts,P[s2.tone<0.34?3:(s2.tone<0.68?2:1)]);
        for(let i=0;i<pts.length;i++)
          pxLine(g,pts[i].x,pts[i].y,pts[(i+1)%pts.length].x,pts[(i+1)%pts.length].y,1,P[0]);
      }
      for(const dsp of this.dust){
        const x=Math.round(cx+dsp.x+dsp.vx*t2), y=Math.round(cy+dsp.y+dsp.vy*t2+150*t2*t2);
        g.fillStyle=P[dsp.tone<0.4?1:(dsp.tone<0.8?2:0)];
        g.fillRect(x,y,dsp.sz,dsp.sz);
      }
      g.globalAlpha=1;
    }
  }
}

/* ---- hydro_pump：高圧水流。圧力脈・気泡・キャビテーションを専用描画 ---- */
class HydroPumpFX extends BeamFX{
  draw(g){
    const s=this.sp, P=s.palette, tick=Math.floor(this.time*24);
    const sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount'), width=s.width*sz;
    if(this.time<s.charge){
      const p=this.time/Math.max(0.001,s.charge), r=Math.max(2,width*(0.35+p*0.9));
      for(let i=0;i<3;i++) pxRing(g,this.f.x,this.f.y,r+i*5,r*0.45+i*2,2,P[Math.min(P.length-1,i+1)]);
      pxDisc(g,this.f.x,this.f.y,Math.max(1,r*0.28),P[0]);
      return;
    }
    const ext=this.extent();
    const ex=this.f.x+(this.t.x-this.f.x)*ext, ey=this.f.y+(this.t.y-this.f.y)*ext;
    const dx=ex-this.f.x, dy=ey-this.f.y, len=Math.hypot(dx,dy)||1;
    const ux=dx/len, uy=dy/len, nx=-uy, ny=ux;
    const tEnd=s.charge+s.fire+s.sustain;
    const alpha=this.time>tEnd?Math.max(0,1-(this.time-tEnd)/s.fade):1;
    g.globalAlpha=alpha;
    for(let li=P.length-1;li>=0;li--){
      const w=Math.max(1,Math.round(width*(li+1)/P.length));
      pxLine(g,this.f.x,this.f.y,ex,ey,w,P[li]);
    }
    const pulses=fxVisualCount(s.pressure,amt,3), amp=width*0.78;
    for(const side of [-1,1]){
      let px=this.f.x, py=this.f.y;
      for(let i=1;i<=pulses*2;i++){
        const u=i/(pulses*2), phase=u*pulses*Math.PI+tick*0.22;
        const off=Math.sin(phase)*amp*Math.sin(Math.PI*u)*side;
        const x=this.f.x+dx*u+nx*off, y=this.f.y+dy*u+ny*off;
        pxLine(g,px,py,x,y,side<0?2:1,P[side<0?1:0]); px=x; py=y;
      }
    }
    for(let k=0;k<fxVisualCount(s.bubbles,amt,1);k++){
      const u=hash3(k,s.seed,1)*ext;
      const off=(hash3(k,s.seed,2)-0.5)*width*2.4*Math.sin(Math.PI*u);
      const drift=(hash3(k,tick,s.seed)-0.5)*4;
      const x=this.f.x+dx*u+nx*(off+drift), y=this.f.y+dy*u+ny*(off+drift);
      const r=1+hash3(k,s.seed,3)*3;
      pxRing(g,x,y,r,r,1,P[hash3(k,s.seed,4)<0.65?0:1]);
    }
    if(this.if_>=0){
      const q=Math.min(1,this.if_/18), count=fxVisualCount(s.bubbles,amt,8);
      for(let k=0;k<count;k++){
        const a=hash3(k,s.seed,8)*Math.PI*2, rr=(8+hash3(k,s.seed,9)*width*2.8)*q;
        const r=Math.max(1,(1-q)*5+hash3(k,s.seed,10)*2);
        pxRing(g,this.t.x+Math.cos(a)*rr,this.t.y+Math.sin(a)*rr,r,r,1,P[k%Math.min(2,P.length)]);
      }
      pxRing(g,this.t.x,this.t.y,width*(0.4+q*2.2),width*(0.2+q),2,P[0]);
    }
    g.globalAlpha=1;
  }
}

/* ---- close_combat：踏み込みから連打・決めまでを1素材で描く ---- */
class CloseCombatFX extends BaseFX{
  update(dt){
    dt*=this.ts; this.stepCommon(dt);
    const s=this.sp, hitAt=s.interval*Math.max(0,s.hits-1)+0.08;
    if(this.time>=hitAt) this.doHit();
    if(this.time>=s.duration) this.state='dead';
  }
  draw(g){
    const s=this.sp, P=s.palette, hitLife=Math.max(0.12,s.interval*2.8);
    const sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount'), size=s.size*sz;
    const hits=fxVisualCount(s.hits,amt,2), step=s.interval*Math.max(1,s.hits-1)/Math.max(1,hits-1);
    for(let k=0;k<hits;k++){
      const age=this.time-k*step;
      if(age<0||age>hitLife) continue;
      const q=age/hitLife, fade=Math.sin(Math.PI*q);
      const a=hash3(k,s.seed,1)*Math.PI*2;
      const bend=(hash3(k,s.seed,2)-0.5)*0.9;
      const reach=s.reach*sz*(1-q*0.82);
      const sx=this.t.x+Math.cos(a)*reach, sy=this.t.y+Math.sin(a)*reach;
      const ex=this.t.x+Math.cos(a+bend)*size*0.08, ey=this.t.y+Math.sin(a+bend)*size*0.08;
      g.globalAlpha=fade;
      pxLine(g,sx,sy,ex,ey,Math.max(3,size*0.10),P[P.length-1]);
      pxLine(g,sx,sy,ex,ey,Math.max(2,size*0.055),P[1]);
      pxLine(g,sx,sy,ex,ey,1,P[0]);
      const fist=size*(0.07+0.05*fade);
      pxDisc(g,ex,ey,fist,P[1]); pxDisc(g,ex,ey,fist*0.45,P[0]);
      const pa=a+Math.PI/2;
      pxLine(g,ex-Math.cos(pa)*fist,ey-Math.sin(pa)*fist,
        ex+Math.cos(pa)*fist,ey+Math.sin(pa)*fist,2,P[0]);
    }
    if(this.if_>=0){
      const q=Math.min(1,this.if_/18), r=size*(0.18+q*0.52);
      g.globalAlpha=1-q;
      pxRing(g,this.t.x,this.t.y,r,r*0.62,Math.max(2,Math.round(5*(1-q))),P[0]);
      for(let k=0;k<10;k++){
        const a=k/10*Math.PI*2+hash3(k,s.seed,7)*0.18;
        const r0=size*0.12, r1=r*(0.9+hash3(k,s.seed,8)*0.35);
        pxLine(g,this.t.x+Math.cos(a)*r0,this.t.y+Math.sin(a)*r0,
          this.t.x+Math.cos(a)*r1,this.t.y+Math.sin(a)*r1,Math.max(1,3*(1-q)),P[k%P.length]);
      }
    }
    g.globalAlpha=1;
  }
}

/* ---- flamethrower：線ではなく、円錐に流れる炎粒の群れ ---- */
class FlamethrowerFX extends BeamFX{
  draw(g){
    const s=this.sp, P=s.palette, tick=Math.floor(this.time*22);
    const sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount');
    const width=s.width*sz, spread=s.flameSpread*sz, particles=fxVisualCount(s.particles,amt,4);
    if(this.time<s.charge){
      const p=this.time/Math.max(0.001,s.charge);
      for(let k=0;k<fxVisualCount(8,amt,3);k++){
        const a=hash3(k,tick,s.seed)*Math.PI*2, rr=2+hash3(k,s.seed,2)*width*p;
        pxDisc(g,this.f.x+Math.cos(a)*rr,this.f.y+Math.sin(a)*rr,1+hash3(k,s.seed,3)*3,P[k%P.length]);
      }
      return;
    }
    const ext=this.extent();
    const ex=this.f.x+(this.t.x-this.f.x)*ext, ey=this.f.y+(this.t.y-this.f.y)*ext;
    const dx=ex-this.f.x, dy=ey-this.f.y, len=Math.hypot(dx,dy)||1;
    const nx=-dy/len, ny=dx/len;
    const tEnd=s.charge+s.fire+s.sustain;
    const alpha=this.time>tEnd?Math.max(0,1-(this.time-tEnd)/s.fade):1;
    g.globalAlpha=alpha;
    for(let k=0;k<particles;k++){
      const lane=hash3(k,s.seed,1), speed=0.012+hash3(k,s.seed,2)*0.018;
      const u=((lane+tick*speed)%1)*ext;
      const cone=spread*u*(0.35+hash3(k,s.seed,3)*0.65);
      const side=(hash3(k,tick,s.seed)-0.5)*2;
      const x=this.f.x+dx*u+nx*side*cone;
      const y=this.f.y+dy*u+ny*side*cone-(hash3(k,s.seed,5)*5*u);
      const r=Math.max(1,width*(0.08+0.24*u)*(0.55+hash3(k,s.seed,6)));
      const ci=Math.min(P.length-1,Math.floor(hash3(k,s.seed,7)*P.length));
      pxDisc(g,x,y,r,P[ci]);
      if(r>2) pxDisc(g,x-dx/len*r*0.45,y-dy/len*r*0.45,r*0.42,P[Math.max(0,ci-1)]);
    }
    pxDisc(g,this.f.x,this.f.y,Math.max(2,width*0.30),P[0]);
    if(this.if_>=0){
      const q=Math.min(1,this.if_/22);
      for(let k=0;k<fxVisualCount(18,amt,6);k++){
        const rise=(12+hash3(k,s.seed,11)*spread)*q;
        const x=this.t.x+(hash3(k,s.seed,12)-0.5)*spread*1.6*(0.3+q);
        const y=this.t.y-rise+Math.sin(k*2.1)*5;
        const r=(1-q)*(3+hash3(k,s.seed,13)*8);
        pxDisc(g,x,y,Math.max(1,r),P[k%P.length]);
      }
    }
    g.globalAlpha=1;
  }
}

/* ---- roar_time：時計輪が連なる時間のトンネル。既存光線・空間割れは使わない ---- */
class RoarOfTimeFX extends BeamFX{
  drawClock(g,cx,cy,r,rot,P,alpha){
    g.globalAlpha=alpha;
    pxRing(g,cx,cy,r,r,2,P[1]); pxRing(g,cx,cy,r*0.78,r*0.78,1,P[0]);
    for(let k=0;k<12;k++){
      const a=k/12*Math.PI*2+rot, r0=r*(k%3===0?0.67:0.72);
      pxLine(g,cx+Math.cos(a)*r0,cy+Math.sin(a)*r0,cx+Math.cos(a)*r*0.92,cy+Math.sin(a)*r*0.92,1,P[k%P.length]);
    }
    pxLine(g,cx,cy,cx+Math.cos(rot*1.7)*r*0.55,cy+Math.sin(rot*1.7)*r*0.55,2,P[0]);
    pxLine(g,cx,cy,cx+Math.cos(-rot*2.4)*r*0.36,cy+Math.sin(-rot*2.4)*r*0.36,2,P[0]);
    g.globalAlpha=1;
  }
  draw(g){
    const s=this.sp, P=s.palette, tick=Math.floor(this.time*18), rot=tick*0.08;
    if(this.time<s.charge){
      const p=this.time/Math.max(0.001,s.charge), r=s.width*(0.35+p*0.95);
      this.drawClock(g,this.f.x,this.f.y,r,rot,P,0.45+0.55*p);
      return;
    }
    const ext=this.extent();
    const ex=this.f.x+(this.t.x-this.f.x)*ext, ey=this.f.y+(this.t.y-this.f.y)*ext;
    const dx=ex-this.f.x, dy=ey-this.f.y, len=Math.hypot(dx,dy)||1, nx=-dy/len, ny=dx/len;
    const tEnd=s.charge+s.fire+s.sustain;
    const alpha=this.time>tEnd?Math.max(0,1-(this.time-tEnd)/s.fade):1;
    const rings=Math.max(3,s.timeRings|0);
    g.globalAlpha=alpha;
    let top=null, bottom=null;
    for(let i=0;i<=rings;i++){
      const u=i/rings*ext, wave=Math.sin(u*Math.PI*4+rot)*s.warp*Math.sin(Math.PI*u);
      const cx=this.f.x+dx*u+nx*wave, cy=this.f.y+dy*u+ny*wave;
      const r=s.width*(0.38+0.22*Math.sin(i*1.7+rot));
      pxLine(g,cx+nx*r,cy+ny*r,cx-nx*r,cy-ny*r,Math.max(1,3-i%2),P[i%P.length]);
      pxDisc(g,cx,cy,Math.max(1,r*0.10),P[0]);
      if(top) pxLine(g,top.x,top.y,cx+nx*r,cy+ny*r,2,P[2%P.length]);
      if(bottom) pxLine(g,bottom.x,bottom.y,cx-nx*r,cy-ny*r,2,P[1%P.length]);
      top={x:cx+nx*r,y:cy+ny*r}; bottom={x:cx-nx*r,y:cy-ny*r};
    }
    pxLine(g,this.f.x,this.f.y,ex,ey,Math.max(2,s.width*0.18),P[1]);
    pxLine(g,this.f.x,this.f.y,ex,ey,Math.max(1,s.width*0.07),P[0]);
    if(this.if_>=0){
      const q=Math.min(1,this.if_/24), r=s.width*(0.65+q*2.2);
      this.drawClock(g,this.t.x,this.t.y,r,rot*(1+q*3),P,1-q);
      for(let k=0;k<12;k++){
        const a=k/12*Math.PI*2-rot, bend=Math.sin(a*3+rot)*s.warp*q;
        pxLine(g,this.t.x+Math.cos(a)*r*0.25,this.t.y+Math.sin(a)*r*0.25,
          this.t.x+Math.cos(a)*r+nx*bend,this.t.y+Math.sin(a)*r+ny*bend,Math.max(1,3*(1-q)),P[k%P.length]);
      }
    }
    g.globalAlpha=1;
  }
}

/* ---- psychokinesis：対象を囲む念力場。空間割れを使わず、収束・浮遊・圧縮を描く ---- */
class PsychokinesisFX extends BaseFX{
  update(dt){
    dt*=this.ts; this.stepCommon(dt);
    if(this.time>=this.sp.squeeze) this.doHit();
    if(this.time>=this.sp.duration) this.state='dead';
  }
  draw(g){
    const s=this.sp, P=s.palette, cx=this.t.x, cy=this.t.y;
    const sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount');
    const hitAt=Math.max(0.05,s.squeeze), before=Math.min(1,this.time/hitAt);
    const after=Math.max(0,(this.time-hitAt)/Math.max(0.05,s.duration-hitAt));
    const fade=after>0?Math.max(0,1-after):1;
    const turn=this.time*5.4, field=s.fieldSize*sz*0.5*(1-before*0.38);
    g.globalAlpha=fade;
    for(let i=0;i<3;i++){
      const wob=Math.sin(turn*1.7+i*2.2)*s.warp;
      pxRing(g,cx+wob,cy-wob*0.35,field*(1-i*0.17),field*(0.50+i*0.10),2,P[(i+1)%P.length]);
    }
    const grips=fxVisualCount(s.grips,amt,3);
    for(let k=0;k<grips;k++){
      const a=k/Math.max(1,grips)*Math.PI*2+turn*(k%2?1:-1)*0.12;
      const r=field*(0.72+hash3(k,s.seed,1)*0.32), tang=a+Math.PI/2;
      const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r*0.58;
      const arm=(8+hash3(k,s.seed,2)*10)*sz;
      pxLine(g,x-Math.cos(tang)*arm,y-Math.sin(tang)*arm,
        x+Math.cos(tang)*arm,y+Math.sin(tang)*arm,2,P[k%P.length]);
      pxLine(g,x,y,cx+Math.cos(a)*field*0.30,cy+Math.sin(a)*field*0.18,1,P[0]);
    }
    for(let k=0;k<fxVisualCount(s.debris,amt,3);k++){
      const a=hash3(k,s.seed,3)*Math.PI*2+turn*(0.35+hash3(k,s.seed,4));
      const base=field*(0.28+hash3(k,s.seed,5)*0.68);
      const blast=after*after*s.fieldSize*sz*(0.2+hash3(k,s.seed,6)*0.5);
      const x=cx+Math.cos(a)*(base+blast), y=cy+Math.sin(a)*(base*0.55+blast);
      const z=2+Math.floor(hash3(k,s.seed,7)*5)*(1-before*0.55);
      g.fillStyle=P[(k+2)%P.length];
      g.fillRect(Math.round(x-z/2),Math.round(y-z/2),Math.max(1,Math.round(z)),Math.max(1,Math.round(z)));
    }
    if(after>0){
      for(let i=0;i<3;i++){
        const r=s.fieldSize*sz*(0.08+after*(0.38+i*0.11));
        pxRing(g,cx,cy,r,r*(0.38+i*0.10),Math.max(1,3-i),P[i%P.length]);
      }
      pxDisc(g,cx,cy,Math.max(1,s.fieldSize*sz*0.06*(1-after)),P[0]);
    }
    g.globalAlpha=1;
  }
}

/* ---- electro_ball：軌道電極を持つ蓄電球。既存弾体・尾・着弾フレームは使わない ---- */
class ElectroBallFX extends ProjectileFX{
  constructor(...a){ super(...a); this.burst=-1; }
  pos(){
    const p=this.p, arc=Math.sin(Math.min(1,p)*Math.PI)*this.sp.travel.arc;
    const bob=Math.sin(p*Math.PI*6+this.sp.seed)*this.sp.voltage;
    return {x:this.f.x+(this.t.x-this.f.x)*p,
            y:this.f.y+(this.t.y-this.f.y)*p+arc+bob};
  }
  update(dt){
    dt*=this.ts; this.stepCommon(dt);
    if(!this.hit){
      this.p+=dt/this.dur;
      if(this.p>=1){
        if(this.passThrough){ if(this.p>1.9) this.state='dead'; }
        else { this.p=1; this.doHit(); this.burst=0; }
      }
    }else{
      this.burst+=dt;
      if(this.burst>=this.sp.burst) this.state='dead';
    }
  }
  draw(g){
    const s=this.sp, P=s.palette, p=this.pos(), tick=Math.floor(this.time*28);
    const sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount'), size=s.size*sz;
    const orbitals=fxVisualCount(s.orbitals,amt,2), bolts=fxVisualCount(s.bolts,amt,3);
    if(!this.hit){
      for(let j=5;j>=1;j--){
        const q=Math.max(0,this.p-j*0.045);
        const x=this.f.x+(this.t.x-this.f.x)*q;
        const y=this.f.y+(this.t.y-this.f.y)*q+Math.sin(q*Math.PI)*s.travel.arc;
        const r=Math.max(1,size*(0.16-j*0.018));
        g.globalAlpha=(6-j)/14; pxRing(g,x,y,r*1.6,r,1,P[(j+1)%P.length]);
      }
      g.globalAlpha=1;
      pxDisc(g,p.x,p.y,size*0.50,P[P.length-1]);
      pxRing(g,p.x,p.y,size*0.50,size*0.50,2,P[1]);
      pxDisc(g,p.x,p.y,size*0.20,P[0]);
      for(let k=0;k<orbitals;k++){
        const a=k/Math.max(1,orbitals)*Math.PI*2+tick*0.11*(k%2?1:-1);
        const rx=size*(0.62+0.08*(k%3)), ry=size*(0.26+0.05*((k+1)%3));
        pxArc(g,p.x,p.y,rx,a,a+Math.PI*0.72,2,P[(k+1)%P.length]);
        pxDisc(g,p.x+Math.cos(a)*rx,p.y+Math.sin(a)*ry,2+hash3(k,s.seed,3)*2,P[0]);
      }
      for(let k=0;k<bolts;k++){
        const a=k/Math.max(1,bolts)*Math.PI*2+tick*0.08;
        let x=p.x+Math.cos(a)*size*0.30, y=p.y+Math.sin(a)*size*0.30;
        for(let n=1;n<=3;n++){
          const rr=size*(0.30+n*0.18), bend=(hash3(k,n+tick,s.seed)-0.5)*size*0.28;
          const nx=p.x+Math.cos(a)*rr-Math.sin(a)*bend, ny=p.y+Math.sin(a)*rr+Math.cos(a)*bend;
          pxLine(g,x,y,nx,ny,n===1?2:1,P[n===1?0:1]); x=nx; y=ny;
        }
      }
    }else{
      const q=Math.min(1,this.burst/Math.max(0.05,s.burst));
      g.globalAlpha=1-q;
      for(let k=0;k<Math.max(8,bolts*2);k++){
        const a=k/Math.max(8,bolts*2)*Math.PI*2+hash3(k,s.seed,8)*0.24;
        const r0=size*0.18, r1=size*(0.7+q*2.2)*(0.72+hash3(k,s.seed,9)*0.45);
        const mx=p.x+Math.cos(a)*r1*0.55-Math.sin(a)*(hash3(k,tick,s.seed)-0.5)*12;
        const my=p.y+Math.sin(a)*r1*0.55+Math.cos(a)*(hash3(k,tick,s.seed)-0.5)*12;
        pxLine(g,p.x+Math.cos(a)*r0,p.y+Math.sin(a)*r0,mx,my,2,P[k%P.length]);
        pxLine(g,mx,my,p.x+Math.cos(a)*r1,p.y+Math.sin(a)*r1,1,P[0]);
      }
      pxRing(g,p.x,p.y,size*(0.5+q*2),size*(0.5+q*2),2,P[1]);
      pxDisc(g,p.x,p.y,Math.max(1,size*0.34*(1-q)),P[0]);
    }
    g.globalAlpha=1;
  }
}

/* ---- solar_beam：集光花と葉脈を通る太陽光。既存光線描画は使わない ---- */
class SolarBeamFX extends BeamFX{
  draw(g){
    const s=this.sp, P=s.palette, tick=Math.floor(this.time*20);
    const sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount'), width=s.width*sz;
    const rays=fxVisualCount(s.sunRays,amt,4), leaves=fxVisualCount(s.leaves,amt,3);
    if(this.time<s.charge){
      const q=this.time/Math.max(0.001,s.charge), r=width*(0.45+q*1.10);
      pxDisc(g,this.f.x,this.f.y,Math.max(1,r*0.25),P[0]);
      pxRing(g,this.f.x,this.f.y,r,r,2,P[1]);
      for(let k=0;k<rays;k++){
        const a=k/Math.max(1,rays)*Math.PI*2+tick*0.025;
        const r0=r*(0.74+0.08*Math.sin(k+tick*0.2)), r1=r*(1.10+0.22*q);
        pxLine(g,this.f.x+Math.cos(a)*r0,this.f.y+Math.sin(a)*r0,
          this.f.x+Math.cos(a)*r1,this.f.y+Math.sin(a)*r1,2,P[k%P.length]);
      }
      for(let k=0;k<leaves;k++){
        const a=hash3(k,s.seed,1)*Math.PI*2-tick*0.035;
        const rr=r*(1.3+hash3(k,s.seed,2)*1.2)*(1-q*0.78);
        const x=this.f.x+Math.cos(a)*rr, y=this.f.y+Math.sin(a)*rr;
        const len=4+hash3(k,s.seed,3)*7;
        fillPolyPx(g,[{x:x+Math.cos(a)*len,y:y+Math.sin(a)*len},
          {x:x+Math.cos(a+1.7)*len*0.45,y:y+Math.sin(a+1.7)*len*0.45},
          {x:x-Math.cos(a)*len,y:y-Math.sin(a)*len},
          {x:x+Math.cos(a-1.7)*len*0.45,y:y+Math.sin(a-1.7)*len*0.45}],P[2%P.length]);
      }
      return;
    }
    const ext=this.extent(), ex=this.f.x+(this.t.x-this.f.x)*ext, ey=this.f.y+(this.t.y-this.f.y)*ext;
    const dx=ex-this.f.x, dy=ey-this.f.y, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len, nx=-uy, ny=ux;
    const end=s.charge+s.fire+s.sustain;
    const alpha=this.time>end?Math.max(0,1-(this.time-end)/s.fade):1;
    g.globalAlpha=alpha;
    pxLine(g,this.f.x,this.f.y,ex,ey,width,P[P.length-1]);
    pxLine(g,this.f.x,this.f.y,ex,ey,width*0.62,P[2%P.length]);
    pxLine(g,this.f.x,this.f.y,ex,ey,width*0.24,P[0]);
    for(let k=0;k<leaves;k++){
      const u=((hash3(k,s.seed,5)+tick*(0.012+hash3(k,s.seed,6)*0.008))%1)*ext;
      const side=k%2?1:-1, off=side*width*(0.58+hash3(k,s.seed,7)*0.55);
      const x=this.f.x+dx*u+nx*off, y=this.f.y+dy*u+ny*off;
      const l=4+hash3(k,s.seed,8)*7;
      fillPolyPx(g,[{x:x+ux*l,y:y+uy*l},{x:x+nx*l*0.48,y:y+ny*l*0.48},
        {x:x-ux*l,y:y-uy*l},{x:x-nx*l*0.48,y:y-ny*l*0.48}],P[(k+1)%P.length]);
      pxLine(g,x-ux*l,y-uy*l,x+ux*l,y+uy*l,1,P[0]);
    }
    for(let k=0;k<rays;k++){
      const u=(k+1)/(rays+1)*ext, pulse=Math.sin(tick*0.32+k*1.8);
      const x=this.f.x+dx*u, y=this.f.y+dy*u, rr=width*(0.34+0.10*pulse);
      pxLine(g,x+nx*rr,y+ny*rr,x-nx*rr,y-ny*rr,2,P[k%P.length]);
    }
    if(this.if_>=0){
      const q=Math.min(1,this.if_/24), r=width*(0.55+q*2.4);
      g.globalAlpha=(1-q)*alpha;
      pxRing(g,this.t.x,this.t.y,r,r,Math.max(1,4*(1-q)),P[1]);
      for(let k=0;k<rays;k++){
        const a=k/Math.max(1,rays)*Math.PI*2+tick*0.02;
        pxLine(g,this.t.x+Math.cos(a)*r*0.28,this.t.y+Math.sin(a)*r*0.28,
          this.t.x+Math.cos(a)*r,this.t.y+Math.sin(a)*r,Math.max(1,3*(1-q)),P[k%P.length]);
      }
    }
    g.globalAlpha=1;
  }
}

/* ---- big_butt_drop：双円の尻圧印と地面の圧縮波。既存斬撃・割れ・着弾を使わない ---- */
class BigButtDropFX extends BaseFX{
  update(dt){
    dt*=this.ts; this.stepCommon(dt);
    if(this.time>=this.sp.dropAt) this.doHit();
    if(this.time>=this.sp.duration) this.state='dead';
  }
  draw(g){
    const s=this.sp, P=s.palette;
    const sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount'), size=s.size*sz;
    const cx=this.t.x-Math.sign(this.t.x-this.f.x||1)*size*0.30, cy=this.t.y;
    const q=Math.min(1,this.time/Math.max(0.05,s.dropAt));
    const after=Math.max(0,(this.time-s.dropAt)/Math.max(0.05,s.duration-s.dropAt));
    if(after<=0){
      const fall=(1-q)*(1-q)*s.dropHeight*(0.75+sz*0.25), squash=0.72+q*0.28;
      const y=cy-fall, l=size*0.26, r=size*0.24;
      g.globalAlpha=0.34+q*0.66;
      pxRing(g,cx,cy+5,size*(0.16+q*0.34),size*(0.05+q*0.09),2,P[P.length-1]);
      pxDisc(g,cx-l,y,r*squash,P[2%P.length]);
      pxDisc(g,cx+l,y,r*squash,P[2%P.length]);
      pxArc(g,cx-l,y,r*squash,Math.PI*0.55,Math.PI*1.55,2,P[0]);
      pxArc(g,cx+l,y,r*squash,-Math.PI*0.55,Math.PI*0.45,2,P[0]);
      pxLine(g,cx,y-r*0.45,cx,y+r*0.58,2,P[1]);
      for(let k=0;k<6;k++){
        const a=k/6*Math.PI*2+this.time*3, rr=size*(0.32+0.16*q);
        pxDisc(g,cx+Math.cos(a)*rr,y+Math.sin(a)*rr*0.55,1+(k%3),P[(k+1)%P.length]);
      }
    }else{
      const fade=Math.max(0,1-after), spread=size*(0.28+after*1.05);
      g.globalAlpha=fade;
      pxRing(g,cx,cy+6,spread,spread*0.24,Math.max(1,5*(1-after)),P[0]);
      pxRing(g,cx,cy+6,spread*0.72,spread*0.14,Math.max(1,4*(1-after)),P[1]);
      pxDisc(g,cx-size*0.20,cy-size*0.04,size*0.22*(1-after),P[2%P.length]);
      pxDisc(g,cx+size*0.20,cy-size*0.04,size*0.22*(1-after),P[2%P.length]);
      for(let k=0;k<fxVisualCount(s.dust,amt,4);k++){
        const side=k%2?1:-1, u=hash3(k,s.seed,11);
        const x=cx+side*(size*0.18+spread*(0.25+u*0.82));
        const y=cy+8-after*(10+hash3(k,s.seed,12)*size*0.48);
        const z=Math.max(1,Math.round((1-after)*(2+hash3(k,s.seed,13)*5)));
        g.fillStyle=P[(k+1)%P.length]; g.fillRect(Math.round(x),Math.round(y),z,z);
      }
    }
    g.globalAlpha=1;
  }
}

/* ---- ten_thousand_volt：空中の端子列から対象へ収束する電圧格子 ---- */
class TenThousandVoltFX extends BaseFX{
  update(dt){
    dt*=this.ts; this.stepCommon(dt);
    if(this.time>=this.sp.hitAt) this.doHit();
    if(this.time>=this.sp.duration) this.state='dead';
  }
  draw(g){
    const s=this.sp, P=s.palette, sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount');
    const cx=this.t.x-Math.sign(this.t.x-this.f.x||1)*s.width*sz*0.18, cy=this.t.y, tick=Math.floor(this.time*30);
    const before=Math.min(1,this.time/Math.max(0.05,s.hitAt));
    const after=Math.max(0,(this.time-s.hitAt)/Math.max(0.05,s.duration-s.hitAt));
    const width=s.width*sz, height=s.height*sz, bolts=fxVisualCount(s.bolts,amt,3);
    g.globalAlpha=after>0?Math.max(0,1-after):0.55+before*0.45;
    for(let k=0;k<bolts;k++){
      const topX=cx+(k-(bolts-1)/2)*width/Math.max(1,bolts-1);
      const topY=cy-height*(0.82+hash3(k,s.seed,1)*0.18);
      pxDisc(g,topX,topY,2+sz,P[k%P.length]);
      pxRing(g,topX,topY,5*sz,3*sz,1,P[(k+1)%P.length]);
      let px=topX, py=topY;
      for(let n=1;n<=s.steps;n++){
        const u=n/s.steps, pinch=Math.pow(u,1.45);
        const j=(hash3(k,n+tick,s.seed)-0.5)*width*0.18*(1-u);
        const x=topX+(cx-topX)*pinch+j, y=topY+(cy-topY)*u;
        pxLine(g,px,py,x,y,n%2?2:1,P[(k+n)%P.length]); px=x; py=y;
      }
    }
    for(let n=0;n<Math.max(3,s.steps-1);n++){
      const u=(n+1)/s.steps, y=cy-height*(1-u);
      const span=width*(1-u)*0.48;
      pxLine(g,cx-span,y,cx+span,y,1,P[(n+1)%P.length]);
    }
    if(after>0){
      const r=width*(0.10+after*0.55);
      pxRing(g,cx,cy,r,r*0.42,Math.max(1,3*(1-after)),P[0]);
      for(let k=0;k<bolts;k++){
        const a=k/bolts*Math.PI*2+tick*0.06, r1=r*(0.8+hash3(k,s.seed,8)*0.7);
        pxLine(g,cx,cy,cx+Math.cos(a)*r1,cy+Math.sin(a)*r1,1+(k%2),P[k%P.length]);
      }
    }
    g.globalAlpha=1;
  }
}

/* ---- million_volt：多重電柱と電冠で閉じる超高圧ケージ ---- */
class MillionVoltFX extends BaseFX{
  update(dt){
    dt*=this.ts; this.stepCommon(dt);
    if(this.time>=this.sp.hitAt) this.doHit();
    if(this.time>=this.sp.duration) this.state='dead';
  }
  draw(g){
    const s=this.sp, P=s.palette, sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount');
    const cage=s.cage*sz;
    const cx=this.t.x-Math.sign(this.t.x-this.f.x||1)*cage*0.55, cy=this.t.y, tick=Math.floor(this.time*26);
    const before=Math.min(1,this.time/Math.max(0.05,s.hitAt));
    const after=Math.max(0,(this.time-s.hitAt)/Math.max(0.05,s.duration-s.hitAt));
    const columns=fxVisualCount(s.columns,amt,5), crowns=fxVisualCount(s.crowns,amt,4);
    g.globalAlpha=after>0?Math.max(0,1-after):0.45+before*0.55;
    pxRing(g,cx,cy-cage*0.72,cage*0.72,cage*0.22,2,P[1]);
    pxRing(g,cx,cy+cage*0.18,cage*0.62,cage*0.18,2,P[2%P.length]);
    for(let k=0;k<columns;k++){
      const a=k/columns*Math.PI*2+tick*0.018;
      const x=cx+Math.cos(a)*cage*0.56, y0=cy-cage*(0.72+0.08*Math.sin(a));
      let px=x, py=y0;
      for(let n=1;n<=s.steps;n++){
        const u=n/s.steps, j=(hash3(k,n+tick,s.seed)-0.5)*cage*0.14;
        const nx=x+j*Math.sin(a), ny=y0+u*cage*0.92;
        pxLine(g,px,py,nx,ny,n%2?3:1,P[(k+n)%P.length]); px=nx; py=ny;
      }
    }
    for(let k=0;k<crowns;k++){
      const a=k/crowns*Math.PI*2-tick*0.055, r0=cage*0.16, r1=cage*(0.68+0.12*Math.sin(k+tick));
      pxLine(g,cx+Math.cos(a)*r0,cy-cage*0.72+Math.sin(a)*r0*0.28,
        cx+Math.cos(a)*r1,cy-cage*0.72+Math.sin(a)*r1*0.28,2,P[k%P.length]);
      pxDisc(g,cx+Math.cos(a)*r1,cy-cage*0.72+Math.sin(a)*r1*0.28,2+sz,P[0]);
    }
    if(after>0){
      const q=after, r=cage*(0.18+q*0.82);
      pxDisc(g,cx,cy-cage*0.08,Math.max(1,cage*0.22*(1-q)),P[0]);
      pxRing(g,cx,cy,r,r,Math.max(1,5*(1-q)),P[1]);
      pxRing(g,cx,cy,r*0.68,r*0.30,Math.max(1,4*(1-q)),P[0]);
    }
    g.globalAlpha=1;
  }
}

/* ---- two_volt：2個の微小電荷がよろめきながら進む専用の弱電弾 ---- */
class TwoVoltFX extends ProjectileFX{
  constructor(...a){ super(...a); this.burst=-1; }
  pos(){
    const p=this.p, hop=Math.abs(Math.sin(p*Math.PI*this.sp.hops))*this.sp.hopHeight;
    return {x:this.f.x+(this.t.x-this.f.x)*p,y:this.f.y+(this.t.y-this.f.y)*p-hop};
  }
  update(dt){
    dt*=this.ts; this.stepCommon(dt);
    if(!this.hit){
      this.p+=dt/this.dur;
      if(this.p>=1){
        if(this.passThrough){ if(this.p>1.7) this.state='dead'; }
        else { this.p=1; this.doHit(); this.burst=0; }
      }
    }else{ this.burst+=dt; if(this.burst>=this.sp.burst) this.state='dead'; }
  }
  draw(g){
    const s=this.sp, P=s.palette, p=this.pos(), sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount');
    const size=Math.max(1,s.size*sz), dots=fxVisualCount(s.dots,amt,2), tick=Math.floor(this.time*18);
    if(!this.hit){
      for(let j=1;j<=dots;j++){
        const q=Math.max(0,this.p-j*0.075), x=this.f.x+(this.t.x-this.f.x)*q;
        const y=this.f.y+(this.t.y-this.f.y)*q-Math.abs(Math.sin(q*Math.PI*s.hops))*s.hopHeight;
        g.globalAlpha=(dots-j+1)/(dots+2)*0.55; pxDisc(g,x,y,Math.max(1,size*0.20),P[j%P.length]);
      }
      g.globalAlpha=1;
      const gap=size*(0.30+0.05*Math.sin(tick));
      pxDisc(g,p.x-gap,p.y,size*0.32,P[1]); pxDisc(g,p.x+gap,p.y,size*0.32,P[2%P.length]);
      pxLine(g,p.x-gap,p.y,p.x,p.y-1-size*0.16,1,P[0]);
      pxLine(g,p.x,p.y-1-size*0.16,p.x+gap,p.y,1,P[0]);
    }else{
      const q=Math.min(1,this.burst/Math.max(0.05,s.burst));
      g.globalAlpha=1-q;
      pxArc(g,p.x,p.y,size*(0.3+q),Math.PI*0.10,Math.PI*0.88,1,P[0]);
      pxDisc(g,p.x-size*0.24,p.y,size*0.18*(1-q),P[1]);
      pxDisc(g,p.x+size*0.24,p.y,size*0.18*(1-q),P[2%P.length]);
    }
    g.globalAlpha=1;
  }
}

/* ---- black_kick：黒い脚線と靴底印だけで構成する専用蹴撃 ---- */
class BlackKickFX extends BaseFX{
  update(dt){
    dt*=this.ts; this.stepCommon(dt);
    if(this.time>=this.sp.hitAt) this.doHit();
    if(this.time>=this.sp.duration) this.state='dead';
  }
  draw(g){
    const s=this.sp, P=s.palette, sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount');
    const q=Math.min(1,this.time/Math.max(0.05,s.hitAt));
    const after=Math.max(0,(this.time-s.hitAt)/Math.max(0.05,s.duration-s.hitAt));
    const size=s.size*sz, echoes=fxVisualCount(s.echoes,amt,2);
    const dx=this.t.x-this.f.x, dy=this.t.y-this.f.y, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len, nx=-uy, ny=ux;
    if(after<=0){
      for(let e=echoes-1;e>=0;e--){
        const qe=Math.max(0,q-e*0.055), x=this.f.x+dx*qe, y=this.f.y+dy*qe-Math.sin(qe*Math.PI)*s.lift*sz;
        const heelX=x-ux*size*0.42, heelY=y-uy*size*0.42;
        g.globalAlpha=(echoes-e)/(echoes+1);
        pxLine(g,heelX-ux*size*0.65,heelY-uy*size*0.65,heelX,heelY,size*0.24,P[P.length-1]);
        fillPolyPx(g,[{x:x+ux*size*0.48,y:y+uy*size*0.48},{x:x+nx*size*0.28,y:y+ny*size*0.28},
          {x:heelX+nx*size*0.22,y:heelY+ny*size*0.22},{x:heelX-nx*size*0.18,y:heelY-ny*size*0.18}],P[e?2%P.length:1]);
        pxLine(g,heelX-nx*size*0.18,heelY-ny*size*0.18,x+ux*size*0.48,y+uy*size*0.48,2,P[0]);
      }
    }else{
      g.globalAlpha=Math.max(0,1-after);
      const r=size*(0.35+after*1.25);
      pxArc(g,this.t.x,this.t.y,r,Math.PI*0.08,Math.PI*0.92,Math.max(1,5*(1-after)),P[1]);
      pxLine(g,this.t.x-size*0.42,this.t.y+size*0.10,this.t.x+size*0.48,this.t.y-size*0.06,
        Math.max(1,6*(1-after)),P[0]);
      for(let k=0;k<echoes*2;k++){
        const a=Math.PI+(k/(echoes*2-1||1)-0.5)*1.2, rr=r*(0.7+hash3(k,s.seed,4)*0.5);
        pxLine(g,this.t.x,this.t.y,this.t.x+Math.cos(a)*rr,this.t.y+Math.sin(a)*rr,1,P[k%P.length]);
      }
    }
    g.globalAlpha=1;
  }
}

/* ---- black_punch：四つの黒い拳骨と圧縮筒で構成する専用拳撃 ---- */
class BlackPunchFX extends BaseFX{
  update(dt){
    dt*=this.ts; this.stepCommon(dt);
    if(this.time>=this.sp.hitAt) this.doHit();
    if(this.time>=this.sp.duration) this.state='dead';
  }
  draw(g){
    const s=this.sp, P=s.palette, sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount');
    const q=Math.min(1,this.time/Math.max(0.05,s.hitAt));
    const after=Math.max(0,(this.time-s.hitAt)/Math.max(0.05,s.duration-s.hitAt));
    const size=s.size*sz, rings=fxVisualCount(s.rings,amt,2);
    const dx=this.t.x-this.f.x, dy=this.t.y-this.f.y, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len, nx=-uy, ny=ux;
    const x=this.f.x+dx*q, y=this.f.y+dy*q-Math.sin(q*Math.PI)*s.lift*0.25*sz;
    if(after<=0){
      for(let k=0;k<rings;k++){
        const u=Math.max(0,q-k*0.075), cx=this.f.x+dx*u, cy=this.f.y+dy*u;
        g.globalAlpha=(rings-k)/(rings+1)*0.65;
        pxRing(g,cx,cy,size*(0.22+k*0.06),size*(0.12+k*0.03),1,P[(k+1)%P.length]);
      }
      g.globalAlpha=1;
      pxLine(g,x-ux*size*0.82,y-uy*size*0.82,x-ux*size*0.18,y-uy*size*0.18,size*0.34,P[P.length-1]);
      for(let k=0;k<4;k++){
        const off=(k-1.5)*size*0.20;
        pxDisc(g,x+nx*off+ux*size*0.12,y+ny*off+uy*size*0.12,size*(0.18+0.02*(k%2)),P[1]);
        pxDisc(g,x+nx*off+ux*size*0.18,y+ny*off+uy*size*0.18,size*0.07,P[0]);
      }
    }else{
      const fade=Math.max(0,1-after), r=size*(0.28+after*1.15);
      g.globalAlpha=fade;
      pxRing(g,this.t.x,this.t.y,r,r,Math.max(1,6*(1-after)),P[1]);
      pxRing(g,this.t.x,this.t.y,r*0.72,r*0.30,Math.max(1,4*(1-after)),P[0]);
      for(let k=0;k<rings*2;k++){
        const a=k/(rings*2)*Math.PI*2+hash3(k,s.seed,5)*0.25;
        pxDisc(g,this.t.x+Math.cos(a)*r,this.t.y+Math.sin(a)*r,Math.max(1,4*(1-after)),P[(k+2)%P.length]);
      }
    }
    g.globalAlpha=1;
  }
}

/* ---- black_shot：光を吸う核・角形の欠損尾・内向き着弾を持つ専用暗黒弾 ---- */
class BlackShotFX extends ProjectileFX{
  constructor(...a){ super(...a); this.burst=-1; }
  pos(){
    const p=this.p, sway=Math.sin(p*Math.PI*5+this.sp.seed)*this.sp.sway;
    const dx=this.t.x-this.f.x, dy=this.t.y-this.f.y, len=Math.hypot(dx,dy)||1;
    return {x:this.f.x+dx*p-dy/len*sway,y:this.f.y+dy*p+dx/len*sway};
  }
  update(dt){
    dt*=this.ts; this.stepCommon(dt);
    if(!this.hit){
      this.p+=dt/this.dur;
      if(this.p>=1){
        if(this.passThrough){ if(this.p>1.8) this.state='dead'; }
        else { this.p=1; this.doHit(); this.burst=0; }
      }
    }else{ this.burst+=dt; if(this.burst>=this.sp.burst) this.state='dead'; }
  }
  draw(g){
    const s=this.sp, P=s.palette, p=this.pos(), sz=fxVisualScale(s,'size'), amt=fxVisualScale(s,'amount');
    const size=s.size*sz, blocks=fxVisualCount(s.blocks,amt,3), tick=Math.floor(this.time*22);
    if(!this.hit){
      for(let k=blocks;k>=1;k--){
        const q=Math.max(0,this.p-k*0.035), dx=this.t.x-this.f.x, dy=this.t.y-this.f.y, len=Math.hypot(dx,dy)||1;
        const side=(hash3(k,tick,s.seed)-0.5)*size*1.5;
        const x=this.f.x+dx*q-dy/len*side, y=this.f.y+dy*q+dx/len*side;
        const z=Math.max(1,Math.round(size*(0.08+hash3(k,s.seed,2)*0.16)));
        g.globalAlpha=(blocks-k+1)/(blocks+2)*0.72; g.fillStyle=P[(k+2)%P.length];
        g.fillRect(Math.round(x-z/2),Math.round(y-z/2),z,z);
      }
      g.globalAlpha=1;
      pxDisc(g,p.x,p.y,size*0.56,P[1]);
      pxRing(g,p.x,p.y,size*0.62,size*0.44,2,P[2%P.length]);
      pxDisc(g,p.x,p.y,size*0.34,P[P.length-1]);
      for(let k=0;k<Math.max(3,Math.round(blocks/2));k++){
        const a=k/Math.max(3,Math.round(blocks/2))*Math.PI*2-tick*0.08, r=size*(0.68+0.14*(k%2));
        pxArc(g,p.x,p.y,r,a,a+1.2,1,P[k%P.length]);
      }
    }else{
      const q=Math.min(1,this.burst/Math.max(0.05,s.burst)), r=size*(1.35-q*0.95);
      g.globalAlpha=1-q;
      pxRing(g,p.x,p.y,r,r,Math.max(1,5*(1-q)),P[1]);
      for(let k=0;k<blocks;k++){
        const a=k/blocks*Math.PI*2+hash3(k,s.seed,9)*0.30;
        pxLine(g,p.x+Math.cos(a)*r*1.8,p.y+Math.sin(a)*r*1.8,p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,2,P[k%P.length]);
      }
      pxDisc(g,p.x,p.y,Math.max(1,size*0.28*(1-q)),P[P.length-1]);
    }
    g.globalAlpha=1;
  }
}

/* ---- 生成ディスパッチ ---- */
function spawnFX(sp,from,to,built,onHit){
  /* ポケモン由来38技と爆撃は専用classへ直結する。
     汎用generatorへ落とすと、見た目だけ別名の素材流用になるため先に分岐する。 */
  const Rebuilt=globalThis.REBUILT_MOVE_FX&&globalThis.REBUILT_MOVE_FX[sp.generator];
  if(Rebuilt) return new Rebuilt(sp,from,to,built,onHit);
  switch(sp.generator){
    case 'ten_thousand_volt':return new TenThousandVoltFX(sp,from,to,built,onHit);
    case 'million_volt':return new MillionVoltFX(sp,from,to,built,onHit);
    case 'two_volt':return new TwoVoltFX(sp,from,to,built,onHit);
    case 'black_kick':return new BlackKickFX(sp,from,to,built,onHit);
    case 'black_punch':return new BlackPunchFX(sp,from,to,built,onHit);
    case 'black_shot':return new BlackShotFX(sp,from,to,built,onHit);
    case 'psychokinesis':return new PsychokinesisFX(sp,from,to,built,onHit);
    case 'electro_ball': return new ElectroBallFX(sp,from,to,built,onHit);
    case 'solar_beam':   return new SolarBeamFX(sp,from,to,built,onHit);
    case 'big_butt_drop':return new BigButtDropFX(sp,from,to,built,onHit);
    case 'hydro_pump':  return new HydroPumpFX(sp,from,to,built,onHit);
    case 'close_combat':return new CloseCombatFX(sp,from,to,built,onHit);
    case 'flamethrower':return new FlamethrowerFX(sp,from,to,built,onHit);
    case 'roar_time':   return new RoarOfTimeFX(sp,from,to,built,onHit);
    case 'beam':      return new BeamFX(sp,from,to,built,onHit);
    case 'slash':     return new SlashFX(sp,from,to,built,onHit);
    case 'lightning': return new LightningFX(sp,from,to,built,onHit);
    case 'aura':      return new AuraFX(sp,from,to,built,onHit);
    case 'shatter':   return new ShatterFX(sp,from,to,built,onHit);
    default:          return new ProjectileFX(sp,from,to,built,onHit);
  }
}

/* =========================================================
   演出素材（parts）
   技は「本体ひとつ」やのうて、素材の集まりとして組める。
   素材ごとに 種類・基準・位置・タイミング を持つ：

     at     'cast' 構え ／ 'fire' 発射 ／ 'impact' 着弾
     off    その瞬間から何秒あと
     anchor 'from' 撃った人 ／ 'to' 当たった場所 ／ 'center' 画面の中央
     dx,dy  基準からのずらし（px）

   **遅延に setTimeout を使わん。** 固定タイムステップの dt で数える。
   使うと戦闘の決定論が壊れる（掟1・2）。
   **技ラボ・制作ツール・戦闘は spawnSubFX() だけを使うこと。**
   呼ぶ側それぞれに書いたら「亜空切断の割れが戦闘にだけ出る」が実際に起きた。
   ========================================================= */

/* 出るまで待つだけの入れ物。時間が来てはじめて中身を作る（＝画面演出も遅れて出る） */
class DelayFX{
  constructor(delay, make, sp){
    this.delay=delay; this.make=make; this.sp=sp;
    this.inner=null; this.state='run'; this.hit=false;
  }
  update(dt){
    if(!this.inner){
      this.delay-=dt;
      if(this.delay>0) return;
      this.inner=this.make();
    }
    this.inner.update(dt);
    this.state=this.inner.state;
    this.hit=this.inner.hit;
  }
  draw(g){ if(this.inner) this.inner.draw(g); }
}

/* 素材の焼いたコマは使い回す。編集中に作り替えたら forgetPart() で捨てる */
const PART_BUILT = new WeakMap();
function builtPart(sp){
  let b=PART_BUILT.get(sp);
  if(!b){ b=buildEffect(sp); PART_BUILT.set(sp,b); }
  return b;
}
function forgetPart(sp){ if(sp) PART_BUILT.delete(sp); }

const TRAVELS = { projectile:1, beam:1, hydro_pump:1, flamethrower:1, roar_time:1,
  electro_ball:1, solar_beam:1, two_volt:1, black_shot:1 };
function partPoints(p, pts){
  const a=p.anchor||'to';
  const base = a==='from' ? pts.from : a==='center' ? (pts.center||pts.to) : pts.to;
  const from = { x:(base.x||0)+(+p.dx||0), y:(base.y||0)+(+p.dy||0) };
  if(!TRAVELS[p.generator]) return {from, to:from};
  /* 飛ぶ素材は「基準の反対側」へ向かう。同じ点やと距離0で計算が壊れる */
  const other = a==='from' ? pts.to : pts.from;
  let to = {x:other.x, y:other.y};
  if(Math.hypot(to.x-from.x,to.y-from.y)<1) to={x:from.x+1,y:from.y};
  return {from, to};
}
/* ts = 親の技の速さ。素材の遅れも中身の速さも一緒に伸び縮みさせる */
function spawnPart(p, pts, ts){
  const k=Math.max(0.05,Math.min(4,+ts||1));
  const {from,to}=partPoints(p,pts);
  const make=()=>{ const o=spawnFX(p, from, to, builtPart(p), null); o.ts*=k; return o; };
  const d=Math.max(0,+p.off||0)/k;
  return d>0 ? new DelayFX(d, make, p) : make();
}
/* phase の瞬間に出るべき素材を作って返す。呼ぶ側は自分の描画リストへ push する。
   pts = {from:撃った人, to:当たった場所, center:画面の中央} */
function spawnSubFX(sp, phase, pts){
  const out=[];
  if(!sp||!pts) return out;
  const ts=+sp.timeScale||1;
  /* 旧形式 fx.shatter ＝「着弾と同時・当たった場所」の素材1つと同じ扱い */
  if(sp.shatter && phase==='impact')
    out.push(spawnPart(Object.assign({},sp.shatter,{anchor:'to',dx:0,dy:0,off:0}), pts, ts));
  for(const p of (sp.parts||[]))
    if(p && (p.at||'impact')===phase) out.push(spawnPart(p, pts, ts));
  return out;
}

/* ---- 鳴き声のゆらぎ ----
   毎回きっちり同じ秒数で鳴くと機械っぽい。±CRY_JITTER 秒だけ散らす。
   **戦闘で Math.random() は使えん**（掟1）けん、種から決める。
   同じ種なら必ず同じズレになるけん、決定論は壊れん。
   戦闘は battleTime から、制作ツールは押した時刻から種を作る。 */
const CRY_JITTER = 0.15;
function cryJitter(seed, amt){
  const a = amt==null ? CRY_JITTER : amt;
  return (hash3(seed|0, 20260816, 7) - 0.5) * 2 * a;
}
/* 鳴くまでの秒。マイナスにはせん */
function cryDelayWith(delay, seed, amt){
  return Math.max(0, (+delay||0) + cryJitter(seed, amt));
}

/* ---- 出現（召喚）の光 ----
   ANIMS は変形しかできん（絵を描けん）けん、光の柱と着地の衝撃はここが描く。
   ANIMS.appear と対で使う。u は appear の進行度（0〜1）。
   cx=中心x / groundY=足元のy / w=見た目の幅
   制作ツール・草むら演出・戦闘の3か所で同じ絵になるよう、ここ1か所に置く。 */
function drawSummon(g, cx, groundY, w, u){
  if(!(u>=0) || u>1) return;
  const BEAM_END=0.50;                       // 着地したら光は消える
  if(u<BEAM_END){
    const k=1-u/BEAM_END;
    g.save();
    const bw=Math.max(4, w*0.44*k);
    g.globalAlpha=0.26*k; g.fillStyle='#bfe6ff';
    g.fillRect(Math.round(cx-bw/2), 0, Math.round(bw), Math.round(groundY));
    const cw=Math.max(2, bw*0.36);
    g.globalAlpha=0.80*k; g.fillStyle='#ffffff';
    g.fillRect(Math.round(cx-cw/2), 0, Math.round(cw), Math.round(groundY));
    g.restore();
  }
  if(u>=0.44){                               // 着地の衝撃：床に輪が広がる
    const k=Math.min(1,(u-0.44)/0.46);
    g.save();
    g.globalAlpha=(1-k)*0.8; g.strokeStyle='#ffffff'; g.lineWidth=2;
    g.beginPath(); g.ellipse(cx,groundY, w*0.20+k*w*0.80, (w*0.20+k*w*0.80)*0.30, 0,0,Math.PI*2); g.stroke();
    g.globalAlpha=(1-k)*0.45; g.strokeStyle='#dff0ff'; g.lineWidth=1;
    g.beginPath(); g.ellipse(cx,groundY, w*0.12+k*w*0.46, (w*0.12+k*w*0.46)*0.30, 0,0,Math.PI*2); g.stroke();
    g.restore();
  }
}

/* ---- パレット ---- */
const PALETTES = {
  '炎':['#ffffff','#ffd44a','#ff7a18','#c8260c'],
  '水':['#ffffff','#b6ecff','#3fa9f5','#0b4c9c'],
  '雷':['#ffffff','#fff7a0','#ffd21e','#8a5a00'],
  '毒':['#f2d8ff','#d08cff','#8e33d6','#3d0a63'],
  '氷':['#ffffff','#ddf6ff','#8fd8f7','#2f7fae'],
  '闇':['#e0d0ff','#9b7ad6','#5227a0','#160a30'],
  '草':['#f0ffd8','#b8e986','#5aa832','#1f5a18'],
  '鋼':['#ffffff','#e6eef6','#9aa9bb','#4a5568']
};

/* ---- 各 generator の既定値 ---- */
const DEFAULTS = {
  projectile:{ generator:'projectile', shape:'orb', size:22, frames:6, wobble:0.16,
    core:0.5, spin:0.15, specks:5, trail:{type:'flame',length:14,rate:0.8,size:0.8},
    travel:{speed:230,arc:-26,spin:0},
    impact:{size:56,frames:9,shards:14,palette:PALETTES['炎']} },
  beam:{ generator:'beam', style:'straight', width:11, segments:12, waver:2.6,
    charge:0.40, fire:0.10, sustain:0.40, fade:0.22,
    impact:{size:64,frames:10,shards:16,palette:PALETTES['炎']} },
  slash:{ generator:'slash', style:'arc', size:96, arcDeg:175, thickness:12, count:3,
    interval:0.13, spread:26, taper:1.1, hollow:0, jitter:0.18, squash:1, specks:10,
    impact:{size:40,frames:7,shards:8,palette:PALETTES['鋼']} },
  lightning:{ generator:'lightning', width:5, jag:0.55, branches:4, segments:5,
    duration:0.45, fromSky:true,
    impact:{size:54,frames:9,shards:14,palette:PALETTES['雷']} },
  aura:{ generator:'aura', size:70, rings:4, rise:52, duration:1.2, impact:null },
  shatter:{ generator:'shatter', size:190, cracks:26, jag:0.5, drift:82, spin:4.0,
    dust:46, duration:1.15, impact:null },
  hydro_pump:{ generator:'hydro_pump', width:24, pressure:9, bubbles:18,
    charge:0.45, fire:0.09, sustain:0.54, fade:0.28,
    powerVisual:{size:[0.72,1.75],amount:[0.65,1.80]} },
  close_combat:{ generator:'close_combat', size:112, hits:8, interval:0.055, reach:72, duration:0.90,
    powerVisual:{size:[0.80,1.45],amount:[0.65,1.60]} },
  flamethrower:{ generator:'flamethrower', width:27, particles:52, flameSpread:36,
    charge:0.25, fire:0.12, sustain:0.62, fade:0.34,
    powerVisual:{size:[0.65,2.00],amount:[0.55,2.20]} },
  roar_time:{ generator:'roar_time', width:46, timeRings:11, warp:9,
    charge:0.82, fire:0.16, sustain:0.78, fade:0.42 },
  psychokinesis:{ generator:'psychokinesis', fieldSize:112, grips:8, debris:18, warp:9,
    squeeze:0.38, duration:1.05, impact:null,
    powerVisual:{size:[0.70,1.60],amount:[0.60,1.80]} },
  electro_ball:{ generator:'electro_ball', size:32, orbitals:5, bolts:6, voltage:4,
    travel:{speed:300,arc:-22}, burst:0.46, impact:null,
    powerVisual:{size:[0.75,1.60],amount:[0.60,1.75]} },
  solar_beam:{ generator:'solar_beam', width:48, sunRays:12, leaves:18,
    charge:0.95, fire:0.13, sustain:0.62, fade:0.34, impact:null,
    powerVisual:{size:[0.72,1.65],amount:[0.60,1.90]} },
  big_butt_drop:{ generator:'big_butt_drop', size:118, dropHeight:96, dropAt:0.56,
    dust:20, duration:1.08, impact:null,
    powerVisual:{size:[0.75,1.55],amount:[0.60,1.80]} },
  ten_thousand_volt:{ generator:'ten_thousand_volt', width:108, height:104, bolts:8, steps:6,
    hitAt:0.34, duration:0.82, impact:null,
    powerVisual:{size:[0.70,1.80],amount:[0.55,2.00]} },
  million_volt:{ generator:'million_volt', cage:88, columns:10, crowns:12, steps:7,
    hitAt:0.48, duration:1.14, impact:null,
    powerVisual:{size:[0.80,1.60],amount:[0.70,1.75]} },
  two_volt:{ generator:'two_volt', size:8, dots:4, hops:5, hopHeight:7,
    travel:{speed:175,arc:0}, burst:0.24, impact:null,
    powerVisual:{size:[0.85,1.25],amount:[0.75,1.40]} },
  black_kick:{ generator:'black_kick', size:74, lift:54, echoes:4,
    hitAt:0.32, duration:0.78, impact:null,
    powerVisual:{size:[0.78,1.55],amount:[0.70,1.65]} },
  black_punch:{ generator:'black_punch', size:72, lift:32, rings:5,
    hitAt:0.30, duration:0.76, impact:null,
    powerVisual:{size:[0.75,1.65],amount:[0.70,1.60]} },
  black_shot:{ generator:'black_shot', size:34, blocks:12, sway:7,
    travel:{speed:330,arc:0}, burst:0.48, impact:null,
    powerVisual:{size:[0.70,1.70],amount:[0.60,1.90]} }
};
function makeSpec(gen,seed,name,palKey){
  const pal=PALETTES[palKey]||PALETTES['炎'];
  const d=JSON.parse(JSON.stringify(DEFAULTS[gen]));
  d.id=gen+'_'+seed; d.name=name; d.seed=seed; d.palette=[...pal];
  if(d.impact) d.impact.palette=[...pal];
  d.screen={};                      // 画面演出は既定では無し。技ラボで足す
  return d;
}
