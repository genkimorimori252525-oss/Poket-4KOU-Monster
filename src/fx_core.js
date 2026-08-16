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
  get radius(){ return Math.max(3,(this.sp.size||16)/2); }
  constructor(...a){ super(...a); this.p=0; this.spawn=0;
    this.dur=Math.hypot(this.t.x-this.f.x,this.t.y-this.f.y)/Math.max(20,this.sp.travel.speed);
    this.ang=Math.atan2(this.t.y-this.f.y,this.t.x-this.f.x); }
  pos(){ const t=this.p;
    return {x:this.f.x+(this.t.x-this.f.x)*t,
            y:this.f.y+(this.t.y-this.f.y)*t+Math.sin(Math.min(1,t)*Math.PI)*this.sp.travel.arc}; }
  update(dt){
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
  extent(){
    const s=this.sp;
    const raw=this.time<s.charge+s.fire?(this.time-s.charge)/s.fire:1;
    return Math.max(0,Math.min(raw, this.limit===undefined?1:this.limit));
  }
  endPoint(){ const e=this.extent();
    return {x:this.f.x+(this.t.x-this.f.x)*e, y:this.f.y+(this.t.y-this.f.y)*e}; }
  update(dt){
    this.stepCommon(dt);
    const s=this.sp;
    if(this.time>=s.charge+s.fire && !this.blocked) this.doHit();
    if(this.time>=s.charge+s.fire+s.sustain+s.fade) this.state='dead';
  }
  draw(g){
    const s=this.sp, P=s.palette;
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
    g.globalAlpha=1;
    this.drawImpact(g,this.t.x,this.t.y);
  }
}

/* ---- slash：斬撃。連撃できる ---- */
class SlashFX extends BaseFX{
  constructor(...a){ super(...a); this.n=0; }
  update(dt){
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

/* ---- 生成ディスパッチ ---- */
function spawnFX(sp,from,to,built,onHit){
  switch(sp.generator){
    case 'beam':      return new BeamFX(sp,from,to,built,onHit);
    case 'slash':     return new SlashFX(sp,from,to,built,onHit);
    case 'lightning': return new LightningFX(sp,from,to,built,onHit);
    case 'aura':      return new AuraFX(sp,from,to,built,onHit);
    case 'shatter':   return new ShatterFX(sp,from,to,built,onHit);
    default:          return new ProjectileFX(sp,from,to,built,onHit);
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
  beam:{ generator:'beam', width:11, segments:12, waver:2.6,
    charge:0.40, fire:0.10, sustain:0.40, fade:0.22,
    impact:{size:64,frames:10,shards:16,palette:PALETTES['炎']} },
  slash:{ generator:'slash', size:96, arcDeg:175, thickness:12, count:3,
    interval:0.13, spread:26, taper:1.1, hollow:0, jitter:0.18, squash:1, specks:10,
    impact:{size:40,frames:7,shards:8,palette:PALETTES['鋼']} },
  lightning:{ generator:'lightning', width:5, jag:0.55, branches:4, segments:5,
    duration:0.45, fromSky:true,
    impact:{size:54,frames:9,shards:14,palette:PALETTES['雷']} },
  aura:{ generator:'aura', size:70, rings:4, rise:52, duration:1.2, impact:null },
  shatter:{ generator:'shatter', size:190, cracks:26, jag:0.5, drift:82, spin:4.0,
    dust:46, duration:1.15, impact:null }
};
function makeSpec(gen,seed,name,palKey){
  const pal=PALETTES[palKey]||PALETTES['炎'];
  const d=JSON.parse(JSON.stringify(DEFAULTS[gen]));
  d.id=gen+'_'+seed; d.name=name; d.seed=seed; d.palette=[...pal];
  if(d.impact) d.impact.palette=[...pal];
  d.screen={};                      // 画面演出は既定では無し。技ラボで足す
  return d;
}
