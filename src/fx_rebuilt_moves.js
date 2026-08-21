/* =========================================================
   ポケモン由来38技＋オリジナル技「爆撃」の専用本演出

   ここにある共有処理は時間・座標・低水準図形だけを扱う。
   技の見た目は各 class の drawMaterial() が個別に組み立て、
   既存の projectile / beam / slash / lightning / aura / shatter や
   parts を一切呼ばない。
   ========================================================= */
const RM_TAU=Math.PI*2;
const rmClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rmLerp=(a,b,t)=>a+(b-a)*t;
const rmEase=t=>t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function rmAlpha(g,a,fn){ g.save(); g.globalAlpha=rmClamp(a,0,1); fn(); g.restore(); }
function rmPoly(g,pts,col){ fillPolyPx(g,pts.map(p=>({x:Math.round(p[0]),y:Math.round(p[1])})),col); }
function rmLine(g,a,b,w,col){ pxLine(g,a.x,a.y,b.x,b.y,Math.max(1,Math.round(w)),col); }
function rmStar(g,x,y,r,n,col,rot){
  const pts=[]; rot=rot||0;
  for(let i=0;i<n*2;i++){
    const a=rot+i*Math.PI/n, rr=i%2?r:r*0.38;
    pts.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);
  }
  rmPoly(g,pts,col);
}
function rmDiamond(g,x,y,rx,ry,col){ rmPoly(g,[[x,y-ry],[x+rx,y],[x,y+ry],[x-rx,y]],col); }
function rmLeaf(g,x,y,len,w,ang,col,vein){
  const ca=Math.cos(ang),sa=Math.sin(ang), nx=-sa,ny=ca;
  const a=[x-ca*len*0.5,y-sa*len*0.5], b=[x+ca*len*0.5,y+sa*len*0.5];
  rmPoly(g,[a,[x+nx*w,y+ny*w],b,[x-nx*w,y-ny*w]],col);
  if(vein) pxLine(g,a[0],a[1],b[0],b[1],1,vein);
}
function rmFlame(g,x,y,r,col,hot,lean){
  lean=lean||0;
  rmPoly(g,[[x-r*0.72,y+r*0.55],[x-r*0.45+lean,y-r*0.10],[x-r*0.08+lean*1.8,y-r],
    [x+r*0.12+lean,y-r*0.34],[x+r*0.58,y-r*0.72],[x+r*0.72,y+r*0.55]],col);
  if(hot) rmPoly(g,[[x-r*0.30,y+r*0.45],[x-r*0.10+lean*0.3,y-r*0.25],
    [x+r*0.18+lean*0.2,y-r*0.52],[x+r*0.34,y+r*0.45]],hot);
}
function rmBolt(g,x0,y0,x1,y1,steps,jag,w,col,seed){
  let px=x0,py=y0;
  const dx=x1-x0,dy=y1-y0,L=Math.max(1,Math.hypot(dx,dy)),nx=-dy/L,ny=dx/L;
  for(let i=1;i<=steps;i++){
    const u=i/steps, h=(hash3(seed||1,i,steps)-0.5)*jag*(i===steps?0:1);
    const x=x0+dx*u+nx*h,y=y0+dy*u+ny*h;
    pxLine(g,px,py,x,y,w,col); px=x;py=y;
  }
}
function rmRingBurst(g,x,y,r,count,col,phase){
  for(let i=0;i<count;i++){
    const a=RM_TAU*i/count+phase, rr=r*(0.64+0.28*hash3(i,count,17));
    const x2=x+Math.cos(a)*rr,y2=y+Math.sin(a)*rr;
    pxLine(g,x+Math.cos(a)*r*0.18,y+Math.sin(a)*r*0.18,x2,y2,1+(i%2),col);
  }
}

/* 専用素材共通の「時計」。描画は持たず、既存素材の見た目を継承しない。 */
class RebuiltMoveFX extends BaseFX{
  constructor(sp,from,to,built,onHit){
    super(sp,from,to,built||{},onHit);
    this.duration=Math.max(0.18,+sp.duration||0.9);
    this.hitRatio=rmClamp(+sp.hitAt||0.72,0.08,0.98);
    this.clashKind=sp.clashKind||'none';
    this.p=0; this.limit=1; this.blocked=false; this.passThrough=false;
    this.ang=Math.atan2(to.y-from.y,to.x-from.x);
  }
  get q(){ return rmClamp(this.time/this.duration,0,1); }
  get sizeMul(){ return fxVisualScale(this.sp,'size'); }
  get amountMul(){ return fxVisualScale(this.sp,'amount'); }
  amount(n,min){ return fxVisualCount(n,this.amountMul,min||1); }
  get radius(){ return Math.max(4,(+this.sp.size||28)*0.48*this.sizeMul); }
  get halfWidth(){ return Math.max(2,(+this.sp.size||28)*0.18*this.sizeMul); }
  get firing(){ return this.clashKind==='beam' && this.q>=0.10 && this.q<0.94; }
  get travelP(){
    const raw=this.q/this.hitRatio;
    return this.passThrough?Math.min(1.65,raw):Math.min(1,raw);
  }
  pos(){
    const u=this.travelP,arc=(+this.sp.arc||0)*Math.sin(Math.min(1,u)*Math.PI);
    return {x:rmLerp(this.f.x,this.t.x,u),y:rmLerp(this.f.y,this.t.y,u)+arc};
  }
  endPoint(){
    const u=Math.min(this.travelP,this.limit===undefined?1:this.limit);
    return {x:rmLerp(this.f.x,this.t.x,u),y:rmLerp(this.f.y,this.t.y,u)};
  }
  update(dt){
    dt*=this.ts; this.stepCommon(dt); this.p=this.travelP;
    if(this.blocked && this.clashKind==='bullet' && this.travelP>=this.limit){ this.state='dead'; return; }
    if(!this.hit && this.q>=this.hitRatio && !this.passThrough && !this.blocked) this.doHit();
    if(this.q>=1) this.state='dead';
  }
  draw(g){ if(this.state==='dead') return; g.save(); this.drawMaterial(g); g.restore(); }
  drawMaterial(g){}
}

/* ひのこ：不揃いの火種が寄り集まり、着弾で小さな火口を作る。 */
class EmberMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,p=this.pos(),s=(this.sp.size||18)*this.sizeMul,P=this.sp.palette;
    const n=this.amount(this.sp.amount||9,3);
    for(let i=0;i<n;i++){
      const age=((q*2.8+i/n)%1), back=age*s*2.8;
      const x=p.x-Math.cos(this.ang)*back+Math.sin(this.ang)*Math.sin(i*4+q*20)*s*0.28;
      const y=p.y-Math.sin(this.ang)*back-Math.cos(this.ang)*Math.sin(i*4+q*20)*s*0.28;
      rmAlpha(g,1-age,()=>rmFlame(g,x,y,s*(0.24+0.22*(1-age)),P[2],P[0],-Math.cos(this.ang)*2));
    }
    rmFlame(g,p.x,p.y,s*0.74,P[3],P[1],-Math.cos(this.ang)*4);
    pxDisc(g,p.x,p.y+s*0.1,s*0.22,P[0]);
    if(this.hit) rmRingBurst(g,this.t.x,this.t.y,s*(0.8+q),n,P[2],q*5);
  }
}

/* はっぱカッター：葉そのものが扇状に旋回する。斬撃の弧は使わない。 */
class RazorLeafMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const u=this.travelP,s=(this.sp.size||22)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||7,3);
    for(let i=0;i<n;i++){
      const lag=Math.max(0,u-i*0.045), fan=(i-(n-1)/2)*0.16;
      const x=rmLerp(this.f.x,this.t.x,lag), y=rmLerp(this.f.y,this.t.y,lag)+Math.sin(lag*Math.PI+fan)*24*fan;
      rmLeaf(g,x,y,s*(0.72+0.08*(i%3)),s*0.24,this.ang+fan+this.time*8*(i%2?1:-1),P[1+(i%3)],P[0]);
    }
    if(this.hit){
      for(let i=0;i<n;i++){
        const a=RM_TAU*i/n+this.time*4,r=s*(0.6+0.08*i);
        rmLeaf(g,this.t.x+Math.cos(a)*r,this.t.y+Math.sin(a)*r,s*0.52,s*0.16,a+1.2,P[2],P[0]);
      }
    }
  }
}

/* タネマシンガン：莢の照準から硬い種子を一列ずつ射出する。 */
class SeedMachineGunMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const s=(this.sp.size||12)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||8,4),u=this.travelP;
    rmLeaf(g,this.f.x,this.f.y,s*1.8,s*0.55,this.ang,P[3],P[1]);
    for(let i=0;i<n;i++){
      const v=rmClamp(u-i*0.075,0,1), wob=Math.sin(i*3.1+v*18)*s*0.35;
      const x=rmLerp(this.f.x,this.t.x,v)-Math.sin(this.ang)*wob;
      const y=rmLerp(this.f.y,this.t.y,v)+Math.cos(this.ang)*wob;
      pxDisc(g,x,y,s*0.48,P[3]); pxDisc(g,x-2*Math.cos(this.ang),y-2*Math.sin(this.ang),s*0.22,P[1]);
      pxLine(g,x-Math.cos(this.ang)*s*0.5,y-Math.sin(this.ang)*s*0.5,
        x-Math.cos(this.ang)*s,y-Math.sin(this.ang)*s,1,P[0]);
    }
  }
}

/* トライアタック：炎・氷・雷の三頂点を結ぶ移動三角形。 */
class TriAttackMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const p=this.pos(),s=(this.sp.size||34)*this.sizeMul,P=this.sp.palette,a=this.time*3.2;
    const pts=[];
    for(let i=0;i<3;i++) pts.push({x:p.x+Math.cos(a+i*RM_TAU/3)*s*0.72,y:p.y+Math.sin(a+i*RM_TAU/3)*s*0.72});
    rmLine(g,pts[0],pts[1],2,'#ffffff'); rmLine(g,pts[1],pts[2],2,'#ffffff'); rmLine(g,pts[2],pts[0],2,'#ffffff');
    rmFlame(g,pts[0].x,pts[0].y,s*0.30,'#e83c12','#ffd34a',0);
    rmDiamond(g,pts[1].x,pts[1].y,s*0.27,s*0.40,'#bff5ff'); pxLine(g,pts[1].x,pts[1].y-s*.3,pts[1].x,pts[1].y+s*.3,1,'#ffffff');
    rmBolt(g,pts[2].x,pts[2].y-s*.34,pts[2].x,pts[2].y+s*.34,4,s*.22,2,'#ffe43b',31);
    pxDisc(g,p.x,p.y,s*0.16,P[0]||'#fff');
    if(this.hit) rmStar(g,this.t.x,this.t.y,s*1.15,6,'#ffffff',a);
  }
}

/* みらいよち：未来の着弾点を示す時計眼が閉じ、時間差で光を落とす。 */
class FutureSightMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||74)*this.sizeMul,P=this.sp.palette,x=this.t.x,y=this.t.y;
    const open=Math.sin(Math.PI*rmClamp(q/this.hitRatio,0,1));
    pxRing(g,x,y,s,s*0.48,2,P[2]); pxRing(g,x,y,s*0.62,s*0.28,1,P[1]);
    rmPoly(g,[[x-s,y],[x,y-s*.48*open],[x+s,y],[x,y+s*.48*open]],P[3]);
    pxDisc(g,x,y,s*0.18,P[0]); pxDisc(g,x,y,s*0.07,P[2]);
    const ticks=this.amount(this.sp.amount||12,6);
    for(let i=0;i<ticks;i++){
      const a=RM_TAU*i/ticks-q*4,r=s*0.82;
      pxLine(g,x+Math.cos(a)*r,y+Math.sin(a)*r*.5,x+Math.cos(a)*r*1.12,y+Math.sin(a)*r*.56,1,P[1]);
    }
    if(this.hit) rmAlpha(g,1-q,()=>{ pxLine(g,x,y-s*1.5,x,y+s*1.1,s*.18,P[0]); rmStar(g,x,y,s*.62,8,P[1],q); });
  }
}

/* つららばり：長さの違う氷槍を順に打ち込む。 */
class IcicleSpearMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const u=this.travelP,s=(this.sp.size||18)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||6,3);
    for(let i=0;i<n;i++){
      const v=rmClamp(u-i*0.07,0,1),off=(i-(n-1)/2)*s*0.48;
      const x=rmLerp(this.f.x,this.t.x,v)-Math.sin(this.ang)*off;
      const y=rmLerp(this.f.y,this.t.y,v)+Math.cos(this.ang)*off;
      const ca=Math.cos(this.ang),sa=Math.sin(this.ang),nx=-sa,ny=ca,L=s*(1.25+0.18*(i%3)),W=s*.22;
      rmPoly(g,[[x+ca*L,y+sa*L],[x-ca*L*.65+nx*W,y-sa*L*.65+ny*W],
        [x-ca*L*.85,y-sa*L*.85],[x-ca*L*.65-nx*W,y-sa*L*.65-ny*W]],P[2]);
      pxLine(g,x-ca*L*.45,y-sa*L*.45,x+ca*L*.65,y+sa*L*.65,1,P[0]);
    }
    if(this.hit) for(let i=0;i<n;i++) rmDiamond(g,this.t.x+(i-(n-1)/2)*s*.4,this.t.y+s*.2,s*.12,s*.5,P[1]);
  }
}

/* きあいだま：拳法の方位印が圧縮された球として飛ぶ。 */
class FocusBlastMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const p=this.pos(),s=(this.sp.size||42)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||8,4),a=-this.time*5;
    for(let i=0;i<3;i++) pxRing(g,p.x,p.y,s*(0.48+i*.18),s*(0.24+i*.08),2,P[3-i]);
    for(let i=0;i<n;i++){
      const th=a+i*RM_TAU/n,r=s*(0.55+0.12*Math.sin(i*7));
      rmDiamond(g,p.x+Math.cos(th)*r,p.y+Math.sin(th)*r*.55,s*.09,s*.17,P[1]);
    }
    pxDisc(g,p.x,p.y,s*.34,P[2]); pxDisc(g,p.x,p.y,s*.18,P[0]);
    rmPoly(g,[[p.x-s*.13,p.y-s*.05],[p.x,p.y-s*.20],[p.x+s*.13,p.y-s*.05],[p.x+s*.08,p.y+s*.18],[p.x-s*.08,p.y+s*.18]],P[3]);
    if(this.hit) rmRingBurst(g,this.t.x,this.t.y,s*1.5,n,P[1],a);
  }
}

/* ヘドロばくだん：粘る毒塊が変形しながら飛び、飛沫の池になる。 */
class SludgeBombMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const p=this.pos(),s=(this.sp.size||31)*this.sizeMul,P=this.sp.palette,w=Math.sin(this.time*16),n=this.amount(this.sp.amount||11,4);
    rmPoly(g,[[p.x-s*.75,p.y+s*.30],[p.x-s*.55,p.y-s*(.35+.12*w)],[p.x-s*.12,p.y-s*.72],
      [p.x+s*.26,p.y-s*(.52-.10*w)],[p.x+s*.72,p.y-s*.12],[p.x+s*.55,p.y+s*.48],[p.x,p.y+s*.64]],P[3]);
    pxDisc(g,p.x-s*.12,p.y-s*.12,s*.34,P[1]); pxDisc(g,p.x-s*.24,p.y-s*.24,s*.11,P[0]);
    for(let i=0;i<n;i++){
      const a=RM_TAU*i/n+this.time*2,r=s*(.65+.25*hash3(i,9,3));
      pxDisc(g,p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,s*.08,P[2]);
    }
    if(this.hit){
      pxRing(g,this.t.x,this.t.y,s*1.35,s*.42,3,P[2]);
      for(let i=0;i<n;i++) pxDisc(g,this.t.x+(hash3(i,3,1)-.5)*s*2.4,this.t.y+(hash3(i,7,2)-.5)*s*.6,s*.12,P[1]);
    }
  }
}

/* ミサイルばり：昆虫の翅を持つ針弾が編隊を組む。 */
class PinMissileMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const u=this.travelP,s=(this.sp.size||14)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||7,3);
    for(let i=0;i<n;i++){
      const v=rmClamp(u-i*.055,0,1),lane=(i-(n-1)/2)*s*.55;
      const x=rmLerp(this.f.x,this.t.x,v)-Math.sin(this.ang)*lane;
      const y=rmLerp(this.f.y,this.t.y,v)+Math.cos(this.ang)*lane;
      const ca=Math.cos(this.ang),sa=Math.sin(this.ang),nx=-sa,ny=ca;
      rmPoly(g,[[x+ca*s*1.2,y+sa*s*1.2],[x-ca*s*.55+nx*s*.18,y-sa*s*.55+ny*s*.18],
        [x-ca*s*.82,y-sa*s*.82],[x-ca*s*.55-nx*s*.18,y-sa*s*.55-ny*s*.18]],P[3]);
      rmPoly(g,[[x-ca*s*.2,y-sa*s*.2],[x-ca*s*.62+nx*s*.54,y-sa*s*.62+ny*s*.54],[x-ca*s*.72,y-sa*s*.72]],P[1]);
      rmPoly(g,[[x-ca*s*.2,y-sa*s*.2],[x-ca*s*.62-nx*s*.54,y-sa*s*.62-ny*s*.54],[x-ca*s*.72,y-sa*s*.72]],P[2]);
      pxLine(g,x,y,x+ca*s*.9,y+sa*s*.9,1,P[0]);
    }
  }
}

/* シャドーボール：光を吸う核から影の手が伸びる。 */
class ShadowBallMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const p=this.pos(),s=(this.sp.size||38)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||9,4),a=this.time*2.7;
    for(let i=0;i<n;i++){
      const th=a+i*RM_TAU/n,r=s*(.55+.22*Math.sin(i*5+a));
      const x=p.x+Math.cos(th)*r,y=p.y+Math.sin(th)*r;
      pxLine(g,p.x,p.y,x,y,Math.max(1,s*.07),P[3]);
      pxDisc(g,x,y,s*.12,P[2]);
      for(let k=-1;k<=1;k++) pxLine(g,x,y,x+Math.cos(th+k*.35)*s*.30,y+Math.sin(th+k*.35)*s*.30,1,P[1]);
    }
    pxDisc(g,p.x,p.y,s*.62,P[3]); pxRing(g,p.x,p.y,s*.48,s*.48,3,P[2]);
    pxDisc(g,p.x-s*.16,p.y-s*.18,s*.12,P[0]);
    if(this.hit) rmAlpha(g,.8,()=>rmRingBurst(g,this.t.x,this.t.y,s*1.5,n,P[2],-a));
  }
}

/* おにび：三つの鬼火が互いを追い、蛇行しながら対象へ集まる。 */
class WillOWispMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const u=this.travelP,s=(this.sp.size||25)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||5,3);
    for(let i=0;i<n;i++){
      const phase=i*RM_TAU/n+u*9, off=Math.sin(phase)*s*.9;
      const x=rmLerp(this.f.x,this.t.x,u)-Math.sin(this.ang)*off;
      const y=rmLerp(this.f.y,this.t.y,u)+Math.cos(this.ang)*off-Math.abs(Math.cos(phase))*s*.35;
      rmFlame(g,x,y,s*(.34+.06*(i%2)),P[2],P[0],Math.sin(phase)*3);
      pxDisc(g,x,y+s*.12,s*.09,P[3]);
    }
    if(this.hit){
      for(let i=0;i<n;i++){
        const a=i*RM_TAU/n+this.time*2;
        rmFlame(g,this.t.x+Math.cos(a)*s*1.1,this.t.y+Math.sin(a)*s*.55,s*.38,P[2],P[0],0);
      }
    }
  }
}

/* ムーンフォース：月相が満ち、三日月の潮汐光を落とす。 */
class MoonForceMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const p=this.pos(),s=(this.sp.size||48)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||10,5),a=this.time*1.5;
    pxDisc(g,p.x,p.y,s*.65,P[1]); pxDisc(g,p.x+s*.23,p.y-s*.12,s*.58,P[3]);
    pxRing(g,p.x,p.y,s*.85,s*.85,2,P[0]);
    for(let i=0;i<n;i++){
      const th=i*RM_TAU/n-a,r=s*(1+.16*Math.sin(i*4));
      rmStar(g,p.x+Math.cos(th)*r,p.y+Math.sin(th)*r,s*.09,4,P[i%2],th);
    }
    pxLine(g,p.x,p.y+s*.35,this.t.x,this.t.y,s*.09,P[1]);
    if(this.hit){ pxRing(g,this.t.x,this.t.y,s*1.25,s*.42,3,P[1]); rmStar(g,this.t.x,this.t.y,s*.55,8,P[0],a); }
  }
}

/* でんこうせっか：白い速度殻が一直線に裂け、残像の輪郭を置く。 */
class QuickAttackMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const u=this.travelP,s=(this.sp.size||30)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||8,4);
    const head={x:rmLerp(this.f.x,this.t.x,u),y:rmLerp(this.f.y,this.t.y,u)};
    for(let i=0;i<n;i++){
      const lag=Math.max(0,u-i*.085),x=rmLerp(this.f.x,this.t.x,lag),y=rmLerp(this.f.y,this.t.y,lag);
      rmAlpha(g,1-i/n,()=>{
        const ca=Math.cos(this.ang),sa=Math.sin(this.ang),nx=-sa,ny=ca,L=s*(1.2+i*.22),W=s*(.36-i/n*.18);
        rmPoly(g,[[x+ca*L,y+sa*L],[x-ca*L*.5+nx*W,y-sa*L*.5+ny*W],[x-ca*L,y-sa*L],[x-ca*L*.5-nx*W,y-sa*L*.5-ny*W]],P[i%2]);
      });
    }
    pxRing(g,head.x,head.y,s*.75,s*.38,2,P[0]);
    if(this.hit) rmStar(g,this.t.x,this.t.y,s*1.1,5,P[1],this.ang);
  }
}

/* だいもんじ：五本の炎路が「大」の字を描いて対象を焼く。 */
class FireBlastMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||74)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||22,8);
    const c=this.pos(),grow=rmEase(Math.min(1,q/this.hitRatio));
    const seg=[[-.72,-.72,.72,.72],[.72,-.72,-.72,.72],[0,-.88,0,.82],[0,-.08,-.92,.35],[0,-.08,.92,.35]];
    for(const [x0,y0,x1,y1] of seg){
      const a={x:c.x+x0*s*grow,y:c.y+y0*s*grow},b={x:c.x+x1*s*grow,y:c.y+y1*s*grow};
      pxLine(g,a.x,a.y,b.x,b.y,s*.16,P[3]); pxLine(g,a.x,a.y,b.x,b.y,s*.09,P[1]);
    }
    for(let i=0;i<n;i++){
      const k=seg[i%seg.length],v=hash3(i,4,8),x=c.x+rmLerp(k[0],k[2],v)*s*grow,y=c.y+rmLerp(k[1],k[3],v)*s*grow;
      rmFlame(g,x,y,s*.13,P[2],P[0],Math.sin(i)*2);
    }
    if(this.hit) pxRing(g,this.t.x,this.t.y,s*1.08,s*.72,4,P[2]);
  }
}

/* アクアジェット：使用者を包む水滴型の流線殻が突進する。 */
class AquaJetMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const p=this.pos(),s=(this.sp.size||38)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||16,6);
    const ca=Math.cos(this.ang),sa=Math.sin(this.ang),nx=-sa,ny=ca;
    rmPoly(g,[[p.x+ca*s*1.3,p.y+sa*s*1.3],[p.x-ca*s*.55+nx*s*.72,p.y-sa*s*.55+ny*s*.72],
      [p.x-ca*s*1.55,p.y-sa*s*1.55],[p.x-ca*s*.55-nx*s*.72,p.y-sa*s*.55-ny*s*.72]],P[3]);
    rmPoly(g,[[p.x+ca*s,p.y+sa*s],[p.x-ca*s*.45+nx*s*.48,p.y-sa*s*.45+ny*s*.48],
      [p.x-ca*s*1.15,p.y-sa*s*1.15],[p.x-ca*s*.45-nx*s*.48,p.y-sa*s*.45-ny*s*.48]],P[1]);
    pxDisc(g,p.x+ca*s*.18,p.y+sa*s*.18,s*.28,P[0]);
    for(let i=0;i<n;i++){
      const lag=(i+1)/n*s*3.2,side=(hash3(i,7,11)-.5)*s*1.2;
      pxDisc(g,p.x-ca*lag+nx*side,p.y-sa*lag+ny*side,s*(.06+.07*hash3(i,3,9)),P[1]);
    }
    if(this.hit) for(let i=0;i<n;i++){
      const a=Math.PI+(i/(n-1)-.5)*2.2;
      pxLine(g,this.t.x,this.t.y,this.t.x+Math.cos(a)*s*1.5,this.t.y+Math.sin(a)*s*1.5,2,P[1]);
    }
  }
}

/* ドリルライナー：土層の円錐が複数の螺旋刃に分かれて回転する。 */
class DrillRunMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const p=this.pos(),s=(this.sp.size||45)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||9,4),a=this.ang;
    const ca=Math.cos(a),sa=Math.sin(a),nx=-sa,ny=ca;
    for(let i=n-1;i>=0;i--){
      const z=i/(n-1||1),cx=p.x-ca*s*z*1.65,cy=p.y-sa*s*z*1.65;
      const rr=s*(.62*z+.08),spin=this.time*15+i*.9;
      const ox=nx*Math.cos(spin)*rr,oy=ny*Math.cos(spin)*rr;
      pxLine(g,cx+ox,cy+oy,p.x+ca*s*1.05,p.y+sa*s*1.05,Math.max(1,s*.07),P[1+i%3]);
      pxDisc(g,cx+ox,cy+oy,s*.09,P[0]);
    }
    rmPoly(g,[[p.x+ca*s*1.35,p.y+sa*s*1.35],[p.x-ca*s*.45+nx*s*.52,p.y-sa*s*.45+ny*s*.52],
      [p.x-ca*s*.45-nx*s*.52,p.y-sa*s*.45-ny*s*.52]],P[3]);
    pxLine(g,p.x-ca*s*.2,p.y-sa*s*.2,p.x+ca*s*1.15,p.y+sa*s*1.15,2,P[0]);
  }
}

/* ブレイブバード：青い猛禽の翼・頭・尾が一体の突進殻になる。 */
class BraveBirdMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const p=this.pos(),s=(this.sp.size||66)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||12,5),a=this.ang;
    const ca=Math.cos(a),sa=Math.sin(a),nx=-sa,ny=ca;
    rmPoly(g,[[p.x+ca*s*1.25,p.y+sa*s*1.25],[p.x+nx*s*.34,p.y+ny*s*.34],[p.x-ca*s*.2,p.y-sa*s*.2]],P[0]);
    rmPoly(g,[[p.x-ca*s*.05,p.y-sa*s*.05],[p.x-ca*s*.72+nx*s*1.2,p.y-sa*s*.72+ny*s*1.2],
      [p.x-ca*s*.48+nx*s*.18,p.y-sa*s*.48+ny*s*.18]],P[1]);
    rmPoly(g,[[p.x-ca*s*.05,p.y-sa*s*.05],[p.x-ca*s*.72-nx*s*1.2,p.y-sa*s*.72-ny*s*1.2],
      [p.x-ca*s*.48-nx*s*.18,p.y-sa*s*.48-ny*s*.18]],P[2]);
    rmPoly(g,[[p.x-ca*s*.38,p.y-sa*s*.38],[p.x-ca*s*1.5+nx*s*.38,p.y-sa*s*1.5+ny*s*.38],
      [p.x-ca*s*1.22,p.y-sa*s*1.22],[p.x-ca*s*1.5-nx*s*.38,p.y-sa*s*1.5-ny*s*.38]],P[3]);
    for(let i=0;i<n;i++){
      const lag=s*(1.2+i*.19),side=Math.sin(i*2.4+this.time*10)*s*.42;
      pxLine(g,p.x-ca*lag+nx*side,p.y-sa*lag+ny*side,p.x-ca*(lag+s*.5)+nx*side,p.y-sa*(lag+s*.5)+ny*side,1,P[i%3]);
    }
    if(this.hit) rmStar(g,this.t.x,this.t.y,s*1.2,7,P[0],a);
  }
}

/* つばめがえし：燕の軌跡が一度通り過ぎ、反転して戻る必中の二重飛跡。 */
class AerialAceMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||52)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||10,4);
    const u=q<this.hitRatio*.55?q/(this.hitRatio*.55):1-(q-this.hitRatio*.55)/(this.hitRatio*.45);
    const v=q<this.hitRatio*.55?rmClamp(u,0,1):rmClamp(1-u,0,1);
    const x=rmLerp(this.f.x,this.t.x,v),y=rmLerp(this.f.y,this.t.y,v)-Math.sin(v*Math.PI)*s*.9;
    const dir=q<this.hitRatio*.55?this.ang:this.ang+Math.PI,ca=Math.cos(dir),sa=Math.sin(dir),nx=-sa,ny=ca;
    rmPoly(g,[[x+ca*s*.8,y+sa*s*.8],[x-ca*s*.25+nx*s*.62,y-sa*s*.25+ny*s*.62],
      [x-ca*s*.05,y-sa*s*.05],[x-ca*s*.25-nx*s*.62,y-sa*s*.25-ny*s*.62]],P[0]);
    for(let i=0;i<n;i++){
      const t=i/n,xx=rmLerp(this.f.x,this.t.x,t),yy=rmLerp(this.f.y,this.t.y,t)-Math.sin(t*Math.PI)*s*.9*(i%2?1:-.4);
      pxDisc(g,xx,yy,1+(i%2),P[1+(i%3)]);
    }
    if(this.hit){ pxLine(g,this.t.x-s,this.t.y+s*.5,this.t.x+s,this.t.y-s*.5,3,P[0]); pxLine(g,this.t.x+s,this.t.y+s*.5,this.t.x-s,this.t.y-s*.5,1,P[1]); }
  }
}

/* シザークロス：左右の昆虫大顎が閉じてXを作る。 */
class XScissorMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=rmClamp(this.q/this.hitRatio,0,1),s=(this.sp.size||78)*this.sizeMul,P=this.sp.palette,x=this.t.x,y=this.t.y;
    const close=(1-rmEase(q))*s*.7,n=this.amount(this.sp.amount||9,4);
    for(const side of [-1,1]){
      const sx=x+side*(s*.75+close),sy=y-s*.7;
      const pts=[];
      for(let i=0;i<=n;i++){
        const u=i/n,xx=rmLerp(sx,x-side*s*.65,u),yy=rmLerp(sy,y+s*.72,u)+Math.sin(u*Math.PI)*side*s*.18;
        pts.push({x:xx,y:yy});
      }
      for(let i=1;i<pts.length;i++) rmLine(g,pts[i-1],pts[i],s*.10,P[side<0?1:2]);
      for(let i=2;i<n;i+=2){
        const p=pts[i],a=Math.atan2(p.y-y,p.x-x)+side*.7;
        rmPoly(g,[[p.x,p.y],[p.x+Math.cos(a)*s*.28,p.y+Math.sin(a)*s*.28],[p.x+Math.cos(a+side*.55)*s*.12,p.y+Math.sin(a+side*.55)*s*.12]],P[0]);
      }
    }
    if(this.hit) rmDiamond(g,x,y,s*.22,s*.22,P[0]);
  }
}

/* つじぎり：夜の水平線が一瞬だけ開き、黒い三日月が通り抜ける。 */
class NightSlashMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=rmClamp(this.q/this.hitRatio,0,1),s=(this.sp.size||82)*this.sizeMul,P=this.sp.palette,x=this.t.x,y=this.t.y;
    const sweep=rmLerp(-s*1.4,s*1.4,rmEase(q)),n=this.amount(this.sp.amount||8,3);
    rmAlpha(g,Math.sin(Math.PI*q),()=>{
      pxLine(g,x-s*1.55,y,x+s*1.55,y,s*.13,P[2]);
      pxLine(g,x-s*1.45,y-2,x+s*1.45,y-2,2,P[0]);
      pxArc(g,x+sweep*.55,y,s*.62,Math.PI*.62,Math.PI*1.38,s*.12,P[1]);
      pxArc(g,x+sweep*.55+s*.12,y,s*.48,Math.PI*.62,Math.PI*1.38,s*.05,P[0]);
      for(let i=0;i<n;i++){
        const xx=x-s*1.3+i/(n-1)*s*2.6;
        pxLine(g,xx,y-s*.12,xx+Math.sin(i)*s*.22,y-s*(.35+.12*(i%3)),1,P[2]);
      }
    });
    if(this.hit) rmStar(g,x,y,s*.40,4,P[0],Math.PI*.25);
  }
}

/* かみくだく：骨質の上下顎と一本ずつ異なる歯が対象を噛み砕く。 */
class CrunchMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=rmClamp(this.q/this.hitRatio,0,1),s=(this.sp.size||88)*this.sizeMul,P=this.sp.palette,x=this.t.x,y=this.t.y;
    const gap=(1-rmEase(q))*s*.62,n=this.amount(this.sp.amount||9,5);
    for(const side of [-1,1]){
      const yy=y+side*(s*.18+gap);
      pxArc(g,x,yy,s*.78,side<0?Math.PI*.12:Math.PI*1.12,side<0?Math.PI*.88:Math.PI*1.88,s*.13,P[3]);
      for(let i=0;i<n;i++){
        const xx=x-s*.62+i/(n-1)*s*1.24,h=s*(.22+.10*hash3(i,side,41));
        rmPoly(g,[[xx-s*.08,yy],[xx+s*.08,yy],[xx,yy-side*h]],i%3===0?P[0]:P[1]);
      }
    }
    pxDisc(g,x-s*.38,y-s*.12-gap*.4,s*.07,P[0]); pxDisc(g,x+s*.38,y-s*.12-gap*.4,s*.07,P[0]);
    if(this.hit){ pxLine(g,x-s*.85,y,x+s*.85,y,4,P[2]); rmRingBurst(g,x,y,s,n,P[1],q); }
  }
}

/* メタルクロー：三本の独立した鉤爪が面を抉り、金属片を残す。 */
class MetalClawMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=rmClamp(this.q/this.hitRatio,0,1),s=(this.sp.size||72)*this.sizeMul,P=this.sp.palette,x=this.t.x,y=this.t.y;
    const n=this.amount(this.sp.amount||3,3),grow=rmEase(q);
    for(let i=0;i<n;i++){
      const off=(i-(n-1)/2)*s*.34,st={x:x-s*.95,y:y+off+s*.36},en={x:x+s*.78,y:y+off-s*.42};
      const mid={x:rmLerp(st.x,en.x,grow),y:rmLerp(st.y,en.y,grow)-Math.sin(grow*Math.PI)*s*.30};
      rmLine(g,st,mid,s*.13,P[3]); rmLine(g,{x:st.x+3,y:st.y-2},{x:mid.x+3,y:mid.y-2},s*.05,P[0]);
      rmDiamond(g,mid.x,mid.y,s*.12,s*.24,P[1]);
    }
    if(this.hit){
      const bits=this.amount(this.sp.shards||10,4);
      for(let i=0;i<bits;i++){
        const a=RM_TAU*i/bits,r=s*(.55+.35*hash3(i,6,2));
        rmDiamond(g,x+Math.cos(a)*r,y+Math.sin(a)*r,s*.07,s*.14,P[1+(i%2)]);
      }
    }
  }
}

/* かみなりパンチ：稲妻で組んだ拳骨が指から順に締まる。 */
class ThunderPunchMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=rmClamp(this.q/this.hitRatio,0,1),s=(this.sp.size||68)*this.sizeMul,P=this.sp.palette,x=rmLerp(this.f.x,this.t.x,rmEase(q)),y=rmLerp(this.f.y,this.t.y,rmEase(q));
    const n=this.amount(this.sp.amount||10,4),a=this.ang;
    pxDisc(g,x,y,s*.42,P[2]); pxDisc(g,x-s*.10,y-s*.12,s*.25,P[0]);
    for(let i=0;i<4;i++){
      const ox=(i-1.5)*s*.24,oy=-s*(.38+.05*(i%2));
      rmPoly(g,[[x+ox-s*.10,y+oy],[x+ox+s*.10,y+oy],[x+ox+s*.13,y+oy+s*.34],[x+ox-s*.13,y+oy+s*.34]],P[i%2?1:3]);
      pxLine(g,x+ox,y+oy,x+ox,y+oy+s*.25,1,P[0]);
    }
    rmPoly(g,[[x-s*.48,y+s*.05],[x-s*.80,y+s*.30],[x-s*.60,y+s*.55],[x-s*.15,y+s*.40]],P[3]);
    for(let i=0;i<n;i++){
      const th=RM_TAU*i/n+this.time*7,r=s*(.55+.18*(i%3));
      rmBolt(g,x+Math.cos(th)*r*.35,y+Math.sin(th)*r*.35,x+Math.cos(th)*r,y+Math.sin(th)*r,3,s*.18,1+(i%2),P[1],i+71);
    }
    if(this.hit) rmStar(g,this.t.x,this.t.y,s*1.2,9,P[0],a);
  }
}

/* エアスラッシュ：圧縮された空気の羽根が層になって進む。 */
class AirSlashMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const u=this.travelP,s=(this.sp.size||48)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||7,3);
    for(let i=0;i<n;i++){
      const v=rmClamp(u-i*.055,0,1),lane=(i-(n-1)/2)*s*.22;
      const x=rmLerp(this.f.x,this.t.x,v),y=rmLerp(this.f.y,this.t.y,v)+lane;
      const ca=Math.cos(this.ang),sa=Math.sin(this.ang),nx=-sa,ny=ca,L=s*(.75+.08*i),W=s*(.34-.02*Math.min(i,5));
      rmPoly(g,[[x+ca*L,y+sa*L],[x-ca*L*.8+nx*W,y-sa*L*.8+ny*W],[x-ca*L*.45,y-sa*L*.45],
        [x-ca*L*.8-nx*W,y-sa*L*.8-ny*W]],P[3]);
      pxLine(g,x-ca*L*.5,y-sa*L*.5,x+ca*L*.82,y+sa*L*.82,1,P[0]);
    }
    if(this.hit){
      for(let i=0;i<n;i++) pxRing(g,this.t.x,this.t.y,s*(.45+i*.15),s*(.14+i*.04),1,P[i%3]);
    }
  }
}

/* サイコカッター：念力結晶が軌道上で組み替わり、一枚の刃になる。 */
class PsychoCutMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const u=this.travelP,s=(this.sp.size||62)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||9,4);
    const p=this.pos(),spin=this.time*5;
    for(let i=0;i<n;i++){
      const a=spin+i*RM_TAU/n,r=s*(.42+.15*Math.sin(i*3));
      rmDiamond(g,p.x+Math.cos(a)*r,p.y+Math.sin(a)*r*.55,s*.08,s*.25,P[1+(i%3)]);
    }
    const ca=Math.cos(this.ang),sa=Math.sin(this.ang),nx=-sa,ny=ca;
    rmPoly(g,[[p.x+ca*s,p.y+sa*s],[p.x-ca*s*.75+nx*s*.28,p.y-sa*s*.75+ny*s*.28],
      [p.x-ca*s*.35,p.y-sa*s*.35],[p.x-ca*s*.75-nx*s*.28,p.y-sa*s*.75-ny*s*.28]],P[2]);
    pxLine(g,p.x-ca*s*.55,p.y-sa*s*.55,p.x+ca*s*.8,p.y+sa*s*.8,2,P[0]);
    if(this.hit) for(let i=0;i<3;i++) pxRing(g,this.t.x,this.t.y,s*(.55+i*.2),s*(.32+i*.08),2,P[i]);
  }
}

/* げきりん：二色の竜巻が対象を囲み、頭・尾・爪の順に暴れる。 */
class OutrageMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=rmClamp(this.q/this.hitRatio,0,1),s=(this.sp.size||92)*this.sizeMul,P=this.sp.palette,x=this.t.x,y=this.t.y,n=this.amount(this.sp.amount||16,7);
    for(let i=0;i<n;i++){
      const u=i/(n-1),a=this.time*9+u*Math.PI*5,r=s*(.25+.68*u)*(1-.25*q);
      const xx=x+Math.cos(a)*r,yy=y+(u-.5)*s*1.3+Math.sin(a)*r*.28;
      pxDisc(g,xx,yy,s*(.08+.07*(1-u)),i%2?P[1]:P[2]);
      if(i>0){
        const up=(i-1)/(n-1),aa=this.time*9+up*Math.PI*5,rr=s*(.25+.68*up)*(1-.25*q);
        pxLine(g,x+Math.cos(aa)*rr,y+(up-.5)*s*1.3+Math.sin(aa)*rr*.28,xx,yy,s*.06,i%2?P[2]:P[3]);
      }
    }
    const headA=this.time*9+Math.PI*5,hx=x+Math.cos(headA)*s*.72,hy=y+s*.65+Math.sin(headA)*s*.20;
    rmPoly(g,[[hx+s*.28,hy],[hx-s*.18,hy-s*.18],[hx-s*.08,hy],[hx-s*.18,hy+s*.18]],P[0]);
    for(let i=0;i<4;i++){
      const a=-.9+i*.6+this.time*2;
      pxLine(g,x,y,x+Math.cos(a)*s*(.7+.15*i),y+Math.sin(a)*s*(.7+.15*i),2,P[1+(i%3)]);
    }
    if(this.hit) rmRingBurst(g,x,y,s*1.25,n,P[0],q*4);
  }
}

/* れいとうビーム：六角氷晶が鎖になり、結晶面を連結して凍らせる。 */
class IceBeamMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const u=Math.min(this.travelP,this.limit||1),s=(this.sp.size||30)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||14,6);
    const end=this.endPoint();
    for(let i=0;i<n;i++){
      const v=i/(n-1)*u,x=rmLerp(this.f.x,this.t.x,v),y=rmLerp(this.f.y,this.t.y,v),r=s*(.22+.08*Math.sin(i*2));
      const pts=[]; for(let k=0;k<6;k++){ const a=RM_TAU*k/6+this.ang; pts.push([x+Math.cos(a)*r,y+Math.sin(a)*r]); }
      rmPoly(g,pts,i%3===0?P[1]:P[2]); pxDisc(g,x,y,r*.25,P[0]);
      if(i>0) pxLine(g,rmLerp(this.f.x,this.t.x,(i-1)/(n-1)*u),rmLerp(this.f.y,this.t.y,(i-1)/(n-1)*u),x,y,2,P[0]);
    }
    if(this.hit){
      for(let k=0;k<6;k++){
        const a=RM_TAU*k/6; rmDiamond(g,this.t.x+Math.cos(a)*s*.72,this.t.y+Math.sin(a)*s*.72,s*.12,s*.45,P[k%3]);
      }
      pxRing(g,end.x,end.y,s,s,2,P[0]);
    }
  }
}

/* ラスターカノン：金属絞りが開き、四角い圧力節を射出する。 */
class FlashCannonMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||42)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||10,5),u=Math.min(this.travelP,this.limit||1);
    const charge=rmClamp(q/.18,0,1),a=this.time*5;
    for(let i=0;i<6;i++){
      const th=i*RM_TAU/6+a,x=this.f.x+Math.cos(th)*s*(.65-.30*charge),y=this.f.y+Math.sin(th)*s*(.65-.30*charge);
      rmDiamond(g,x,y,s*.14,s*.30,P[1+(i%3)]);
    }
    for(let i=0;i<n;i++){
      const v=i/(n-1)*u,x=rmLerp(this.f.x,this.t.x,v),y=rmLerp(this.f.y,this.t.y,v),r=s*(.16+.12*Math.sin(v*Math.PI));
      g.fillStyle=P[3]; g.fillRect(Math.round(x-r),Math.round(y-r),Math.round(r*2),Math.round(r*2));
      g.fillStyle=P[0]; g.fillRect(Math.round(x-r*.35),Math.round(y-r*.35),Math.max(1,Math.round(r*.7)),Math.max(1,Math.round(r*.7)));
    }
    if(this.hit){ for(let i=0;i<4;i++) pxRing(g,this.t.x,this.t.y,s*(.42+i*.2),s*(.42+i*.2),2,P[i]); }
  }
}

/* マジカルシャイン：宝石の面が一枚ずつ開き、虹色の光を反射する。 */
class DazzlingGleamMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||76)*this.sizeMul,P=this.sp.palette,x=this.t.x,y=this.t.y,n=this.amount(this.sp.amount||12,6),a=this.time*1.8;
    const open=rmEase(rmClamp(q/this.hitRatio,0,1));
    for(let i=0;i<n;i++){
      const th=i*RM_TAU/n+a,r=s*(.22+.82*open),w=s*(.12+.05*(i%3));
      rmPoly(g,[[x+Math.cos(th)*r,y+Math.sin(th)*r],[x+Math.cos(th-.12)*(r-w*2),y+Math.sin(th-.12)*(r-w*2)],
        [x+Math.cos(th+Math.PI)*w*.5,y+Math.sin(th+Math.PI)*w*.5],[x+Math.cos(th+.12)*(r-w*2),y+Math.sin(th+.12)*(r-w*2)]],P[i%P.length]);
    }
    rmDiamond(g,x,y,s*.28,s*.44,P[1]); rmDiamond(g,x,y,s*.12,s*.22,P[0]);
    pxRing(g,x,y,s*.75*open,s*.38*open,2,P[0]);
    if(this.hit) rmStar(g,x,y,s*1.15,12,'#ffffff',a);
  }
}

/* はかいこうせん：橙のエネルギー節を白い中央レールへ束ねる。 */
class HyperBeamMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||54)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||16,7),u=Math.min(this.travelP,this.limit||1);
    const ex=rmLerp(this.f.x,this.t.x,u),ey=rmLerp(this.f.y,this.t.y,u),nx=-Math.sin(this.ang),ny=Math.cos(this.ang);
    for(let i=0;i<n;i++){
      const v=i/(n-1)*u,x=rmLerp(this.f.x,this.t.x,v),y=rmLerp(this.f.y,this.t.y,v),pulse=.65+.35*Math.sin(this.time*18-i*1.7);
      pxDisc(g,x+nx*Math.sin(i*2.2)*s*.13,y+ny*Math.sin(i*2.2)*s*.13,s*.25*pulse,P[i%2?2:3]);
      pxDisc(g,x,y,s*.10,P[0]);
    }
    pxLine(g,this.f.x,this.f.y,ex,ey,s*.11,P[0]);
    for(let k=0;k<4;k++) pxRing(g,this.f.x,this.f.y,s*(.35+k*.18),s*(.18+k*.09),2,P[1+(k%3)]);
    if(this.hit){ rmStar(g,this.t.x,this.t.y,s*1.5,10,P[1],this.time); pxDisc(g,this.t.x,this.t.y,s*.32,P[0]); }
  }
}

/* りゅうのはどう：節を持つ光竜が蛇行し、顎を開いて噛み抜く。 */
class DragonPulseMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const u=Math.min(this.travelP,this.limit||1),s=(this.sp.size||44)*this.sizeMul,P=this.sp.palette,n=this.amount(this.sp.amount||14,7);
    let prev=null;
    for(let i=0;i<n;i++){
      const v=i/(n-1)*u,wave=Math.sin(v*Math.PI*4-this.time*8)*s*.34*(1-v*.45);
      const x=rmLerp(this.f.x,this.t.x,v)-Math.sin(this.ang)*wave,y=rmLerp(this.f.y,this.t.y,v)+Math.cos(this.ang)*wave;
      if(prev) rmLine(g,prev,{x,y},s*(.22-.09*v),i%2?P[2]:P[3]);
      pxDisc(g,x,y,s*(.13-.04*v),P[1]); prev={x,y};
    }
    const h=this.endPoint(),ca=Math.cos(this.ang),sa=Math.sin(this.ang),nx=-sa,ny=ca;
    rmPoly(g,[[h.x+ca*s*.72,h.y+sa*s*.72],[h.x-ca*s*.12+nx*s*.38,h.y-sa*s*.12+ny*s*.38],
      [h.x-ca*s*.40,h.y-sa*s*.40],[h.x-ca*s*.12-nx*s*.38,h.y-sa*s*.12-ny*s*.38]],P[2]);
    pxDisc(g,h.x+nx*s*.16,h.y+ny*s*.16,s*.06,P[0]);
    for(const side of [-1,1]) pxLine(g,h.x-ca*s*.05,h.y-sa*s*.05,h.x+ca*s*.48+nx*side*s*.32,h.y+sa*s*.48+ny*side*s*.32,2,P[0]);
    if(this.hit) rmRingBurst(g,this.t.x,this.t.y,s*1.3,n,P[1],this.time);
  }
}

/* りゅうのまい：使用者の周囲を二頭の竜帯が反対向きに舞う。 */
class DragonDanceMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||86)*this.sizeMul,P=this.sp.palette,x=this.f.x,y=this.f.y,n=this.amount(this.sp.amount||16,8);
    for(const side of [-1,1]){
      let prev=null;
      for(let i=0;i<n;i++){
        const u=i/(n-1),a=side*(this.time*5+u*Math.PI*3),r=s*(.25+.62*u)*(1-.18*q);
        const xx=x+Math.cos(a)*r,yy=y+(u-.5)*s*1.25+Math.sin(a)*r*.28;
        if(prev) rmLine(g,prev,{x:xx,y:yy},s*(.08+.04*(1-u)),side<0?P[1]:P[2]);
        pxDisc(g,xx,yy,s*.07,P[(i+side+4)%P.length]); prev={x:xx,y:yy};
      }
      const a=side*(this.time*5+Math.PI*3),hx=x+Math.cos(a)*s*.75,hy=y+s*.62+Math.sin(a)*s*.20;
      rmDiamond(g,hx,hy,s*.18,s*.12,P[0]);
    }
    pxRing(g,x,y+s*.45,s*(.45+.25*q),s*(.16+.08*q),2,P[1]);
    rmStar(g,x,y-s*.35,s*.16,4,P[0],this.time);
  }
}

/* どくどく：毒腺の滴が髑髏を組み、対象へ垂れて覆う。 */
class ToxicMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||78)*this.sizeMul,P=this.sp.palette,x=this.t.x,y=this.t.y,n=this.amount(this.sp.amount||13,6);
    const fall=rmEase(rmClamp(q/this.hitRatio,0,1));
    pxDisc(g,x,y-s*(.65-.72*fall),s*.48,P[2]);
    pxDisc(g,x-s*.18,y-s*(.72-.72*fall),s*.12,P[0]); pxDisc(g,x+s*.18,y-s*(.72-.72*fall),s*.12,P[0]);
    rmPoly(g,[[x-s*.28,y-s*(.45-.72*fall)],[x+s*.28,y-s*(.45-.72*fall)],[x+s*.18,y-s*(.18-.72*fall)],
      [x+s*.05,y-s*(.31-.72*fall)],[x-s*.05,y-s*(.18-.72*fall)],[x-s*.18,y-s*(.31-.72*fall)]],P[3]);
    for(let i=0;i<n;i++){
      const xx=x+(hash3(i,2,5)-.5)*s*1.7,yy=y-s*1.2+((q*1.8+hash3(i,8,3))%1.4)*s*1.25;
      rmPoly(g,[[xx,yy-s*.18],[xx+s*.11,yy],[xx,yy+s*.14],[xx-s*.11,yy]],P[1+(i%3)]);
    }
    if(this.hit){ pxRing(g,x,y+s*.28,s*1.05,s*.28,4,P[2]); pxDisc(g,x,y+s*.2,s*.22,P[0]); }
  }
}

/* うずしお：水の螺旋壁が下から上へ細まり、対象を閉じ込める。 */
class WhirlpoolMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||92)*this.sizeMul,P=this.sp.palette,x=this.t.x,y=this.t.y,n=this.amount(this.sp.amount||18,8);
    for(let i=0;i<n;i++){
      const u=i/(n-1),a=this.time*8+u*Math.PI*5,r=s*(.92-.60*u)*(0.78+.22*Math.sin(Math.PI*q));
      const xx=x+Math.cos(a)*r,yy=y+s*.58-u*s*1.32+Math.sin(a)*r*.20;
      pxDisc(g,xx,yy,s*(.07+.04*(1-u)),P[1+(i%3)]);
      if(i){
        const up=(i-1)/(n-1),aa=this.time*8+up*Math.PI*5,rr=s*(.92-.60*up)*(0.78+.22*Math.sin(Math.PI*q));
        pxLine(g,x+Math.cos(aa)*rr,y+s*.58-up*s*1.32+Math.sin(aa)*rr*.20,xx,yy,s*.08,P[2+(i%2)]);
      }
    }
    pxRing(g,x,y+s*.55,s*.98,s*.24,3,P[1]); pxRing(g,x,y-s*.68,s*.33,s*.10,2,P[0]);
    if(this.hit) for(let i=0;i<6;i++) pxLine(g,x,y,x+Math.cos(i*RM_TAU/6)*s*.9,y+Math.sin(i*RM_TAU/6)*s*.55,2,P[0]);
  }
}

/* いわなだれ：空中に傾いた岩棚が現れ、異なる岩塊が斜面を転げ落ちる。 */
class RockSlideMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||54)*this.sizeMul,P=this.sp.palette,x=this.t.x,y=this.t.y,n=this.amount(this.sp.amount||9,4);
    pxLine(g,x-s*1.6,y-s*1.2,x+s*1.35,y-s*.58,s*.12,P[3]);
    for(let i=0;i<n;i++){
      const delay=i/n*.38,u=rmEase(rmClamp((q-delay)/(this.hitRatio-delay),0,1));
      const sx=x-s*1.35+i/(n-1)*s*2.45,sy=y-s*(1.1-.5*i/(n-1));
      const ex=x-s*.75+i/(n-1)*s*1.5,ey=y+s*.45;
      const xx=rmLerp(sx,ex,u),yy=rmLerp(sy,ey,u),r=s*(.22+.15*hash3(i,9,4));
      const pts=[]; const sides=5+(i%3);
      for(let k=0;k<sides;k++){ const a=k*RM_TAU/sides+q*8*(i%2?1:-1); pts.push([xx+Math.cos(a)*r,yy+Math.sin(a)*r]); }
      rmPoly(g,pts,P[2+(i%2)]); pxLine(g,xx-r*.4,yy-r*.2,xx+r*.28,yy-r*.35,1,P[0]);
    }
    if(this.hit) pxRing(g,x,y+s*.48,s*1.15,s*.25,3,P[1]);
  }
}

/* ストーンエッジ：地中の稜線が対象へ走り、鋭い石柱を順番に押し上げる。 */
class StoneEdgeMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||48)*this.sizeMul,P=this.sp.palette,x=this.t.x,y=this.t.y,n=this.amount(this.sp.amount||7,4);
    pxLine(g,x-s*1.45,y+s*.55,x+s*1.45,y+s*.55,4,P[3]);
    for(let i=0;i<n;i++){
      const delay=i/n*.48,u=rmEase(rmClamp((q-delay)/Math.max(.08,this.hitRatio-delay),0,1));
      const xx=x+(i-(n-1)/2)*s*.42,h=s*(.45+.68*hash3(i,4,12))*u,w=s*(.18+.08*(i%3));
      rmPoly(g,[[xx-w,y+s*.55],[xx+w,y+s*.55],[xx+w*.35,y+s*.55-h*.68],[xx,y+s*.55-h],[xx-w*.4,y+s*.55-h*.55]],P[2+(i%2)]);
      pxLine(g,xx-w*.25,y+s*.48,xx,y+s*.55-h*.82,1,P[0]);
    }
    if(this.hit) for(let i=0;i<n;i++){
      const a=-Math.PI*.9+i/(n-1)*Math.PI*.8;
      rmDiamond(g,x+Math.cos(a)*s*1.2,y+Math.sin(a)*s*.6,s*.08,s*.18,P[1]);
    }
  }
}

/* だいちのちから：地脈の輪が収束し、土柱と熱光が脈打って噴き上がる。 */
class EarthPowerMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||66)*this.sizeMul,P=this.sp.palette,x=this.t.x,y=this.t.y,n=this.amount(this.sp.amount||8,4);
    const pulse=Math.sin(Math.PI*rmClamp(q/this.hitRatio,0,1));
    for(let r=0;r<4;r++) pxRing(g,x,y+s*.5,s*(1.35-r*.28)*(1-.5*q),s*(.28-r*.04),2,P[3-r]);
    for(let i=0;i<n;i++){
      const a=RM_TAU*i/n+this.time*.7,rr=s*(.25+.75*hash3(i,2,13)),xx=x+Math.cos(a)*rr,base=y+s*.52;
      const h=s*(.45+.72*hash3(i,6,7))*pulse;
      rmPoly(g,[[xx-s*.12,base],[xx+s*.12,base],[xx+s*.07,base-h*.72],[xx,base-h],[xx-s*.08,base-h*.62]],i%2?P[2]:P[1]);
      pxLine(g,xx,base-h*.86,xx,base-h*.18,1,P[0]);
    }
    if(this.hit){ pxDisc(g,x,y+s*.18,s*.28,P[0]); rmRingBurst(g,x,y+s*.2,s*1.4,n,P[1],q); }
  }
}

/* じしん：ガラス割れではなく、地面のプレートが隆起・沈降して波打つ。 */
class EarthquakeMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,s=(this.sp.size||92)*this.sizeMul,P=this.sp.palette,w=g.canvas.width,h=g.canvas.height,n=this.amount(this.sp.amount||11,5);
    const ground=h*.72,amp=s*.24*Math.sin(Math.PI*rmClamp(q/this.hitRatio,0,1));
    for(let i=0;i<n;i++){
      const x0=i*w/n,x1=(i+1)*w/n+1,phase=i%2?1:-1,yy=ground+phase*amp*(.45+.55*hash3(i,3,9))*Math.sin(q*18+i);
      rmPoly(g,[[x0,yy],[x1,ground-phase*amp*.35],[x1,h],[x0,h]],P[3-(i%3)]);
      pxLine(g,x0,yy,x1,ground-phase*amp*.35,2,P[0]);
      const cx=x1-2,depth=s*(.18+.35*hash3(i,8,5))*Math.sin(Math.PI*q);
      rmPoly(g,[[cx-2,ground],[cx+3,ground],[cx+8,ground+depth],[cx-5,ground+depth*.62]],P[3]);
    }
    for(let i=0;i<n;i++){
      const x=hash3(i,19,4)*w,y=ground-4-hash3(i,11,2)*amp*1.2;
      rmDiamond(g,x,y,s*(.05+.06*(i%3)),s*(.10+.12*(i%2)),P[1+(i%3)]);
    }
    if(this.hit){ pxLine(g,0,ground,w,ground,s*.08,P[1]); rmRingBurst(g,this.t.x,ground,s*1.55,n,P[0],q); }
  }
}

/* 爆撃：飛行する本体とは別に、爆弾・爆炎・火の粉を全画面へ積み上げる。 */
class BombingMoveFX extends RebuiltMoveFX{
  drawMaterial(g){
    const q=this.q,w=g.canvas.width,h=g.canvas.height,s=(this.sp.size||62)*this.sizeMul,P=this.sp.palette;
    const bombs=this.amount(this.sp.amount||12,5),flames=this.amount(this.sp.flames||22,9),ground=h*.78;
    /* 投下弾。個別の軌道と着弾時刻を固定seedで決める。 */
    for(let i=0;i<bombs;i++){
      const drop=.08+i/(bombs+2)*.72,life=.20+.08*hash3(i,8,31),u=(q-drop)/life;
      const x=(.08+.84*hash3(i,13,7))*w,top=-s*(.3+.5*hash3(i,2,19));
      if(u>=0&&u<1){
        const yy=rmLerp(top,ground,rmEase(u));
        rmPoly(g,[[x,yy+s*.42],[x-s*.24,yy],[x,yy-s*.34],[x+s*.24,yy]],P[3]);
        pxLine(g,x,yy-s*.30,x+Math.sin(i)*s*.25,yy-s*.62,2,P[1]);
        rmFlame(g,x+Math.sin(i)*s*.25,yy-s*.67,s*.16,P[2],P[0],0);
      }
      if(u>=1&&u<1.55){
        const e=rmClamp((u-1)/.55,0,1),r=s*(.35+1.4*e)*(1-.35*e);
        rmFlame(g,x,ground,r,P[3],P[1],Math.sin(i)*r*.12);
        rmStar(g,x,ground,r*.72,7,P[0],i+q*6);
      }
    }
    /* 業火。背景色ではなく、本演出キャンバス上の独立した炎柱。 */
    const blaze=rmClamp((q-.10)/.28,0,1)*rmClamp((1-q)/.12,0,1);
    for(let i=0;i<flames;i++){
      const x=(i+.5)/flames*w+(hash3(i,6,23)-.5)*w/flames*.8;
      const beat=.68+.32*Math.sin(q*38+i*2.7),r=s*(.45+1.05*hash3(i,9,14))*blaze*beat;
      rmAlpha(g,.88,()=>rmFlame(g,x,ground+8,r,P[3-(i%2)],P[1],Math.sin(i+q*12)*r*.16));
      if(i%3===0) rmFlame(g,x+s*.18,ground-r*.72,r*.42,P[2],P[0],-2);
    }
    const embers=this.amount(this.sp.embers||42,14);
    for(let i=0;i<embers;i++){
      const x=(hash3(i,37,5)*w+q*w*(.18+.22*hash3(i,4,8)))%w;
      const y=ground-((q*(40+80*hash3(i,3,9))+hash3(i,17,2)*h*.75)%(h*.78));
      pxDisc(g,x,y,1+(i%3),i%4===0?P[0]:P[1+(i%2)]);
    }
    if(this.hit){ rmAlpha(g,1-q,()=>{ rmStar(g,this.t.x,this.t.y,s*2.2,12,P[0],q*10); pxRing(g,this.t.x,this.t.y,s*2.5,s*.72,5,P[1]); }); }
  }
}

/* generator名は技名と1対1。制作ツール・分類・検証もこの表を読む。 */
globalThis.REBUILT_MOVE_META={
  ember_move:{jp:'ひのこ',desc:'火種の群れと小火口',range:'ranged',size:18,amount:9,duration:.78,hitAt:.76,arc:-16,clashKind:'bullet',palette:['#fff7c0','#ffd23f','#ff721c','#8f190b'],powerVisual:{size:[.80,1.55],amount:[.60,1.85]}},
  razor_leaf_move:{jp:'はっぱカッター',desc:'旋回する葉刃の扇',range:'melee',size:22,amount:7,duration:.72,hitAt:.70,arc:-20,clashKind:'none',palette:['#f4ffe8','#a9ed5b','#3f9e28','#154d1d'],powerVisual:{size:[.78,1.48],amount:[.58,1.80]}},
  seed_machine_gun_move:{jp:'タネマシンガン',desc:'莢から連射する硬質種子',range:'ranged',size:12,amount:8,duration:.82,hitAt:.82,arc:-5,clashKind:'bullet',palette:['#f5ffd0','#b2dc4b','#477d22','#20340f'],powerVisual:{size:[.85,1.35],amount:[.55,2.10]}},
  tri_attack_move:{jp:'トライアタック',desc:'三属性を結ぶ移動三角形',range:'ranged',size:34,amount:3,duration:.92,hitAt:.74,arc:-10,clashKind:'bullet',palette:['#ffffff','#ffcf48','#7bdcff','#9a5cff'],powerVisual:{size:[.74,1.65],amount:[.75,1.65]}},
  future_sight_move:{jp:'みらいよち',desc:'未来の着弾を告げる時計眼',range:'ranged',size:74,amount:12,duration:1.55,hitAt:.82,arc:0,clashKind:'bullet',palette:['#ffffff','#ffb6dc','#b45cff','#351060'],powerVisual:{size:[.72,1.62],amount:[.60,1.85]}},
  icicle_spear_move:{jp:'つららばり',desc:'長さの違う連続氷槍',range:'ranged',size:18,amount:6,duration:.82,hitAt:.80,arc:-8,clashKind:'bullet',palette:['#ffffff','#c9f5ff','#62c6ee','#22608c'],powerVisual:{size:[.82,1.42],amount:[.55,2.05]}},
  focus_blast_move:{jp:'きあいだま',desc:'拳法方位印の圧縮弾',range:'ranged',size:42,amount:8,duration:1.12,hitAt:.76,arc:-24,clashKind:'bullet',palette:['#ffffff','#ffe59a','#e0893d','#67351d'],powerVisual:{size:[.70,1.72],amount:[.62,1.82]}},
  sludge_bomb_move:{jp:'ヘドロばくだん',desc:'変形する毒塊と飛沫池',range:'ranged',size:31,amount:11,duration:.96,hitAt:.76,arc:-28,clashKind:'bullet',palette:['#fff0ff','#df8cff','#8e35b8','#3e174e'],powerVisual:{size:[.72,1.65],amount:[.60,1.90]}},
  pin_missile_move:{jp:'ミサイルばり',desc:'翅付き針弾の編隊',range:'ranged',size:14,amount:7,duration:.78,hitAt:.84,arc:-4,clashKind:'bullet',palette:['#fff8d0','#cadb55','#708328','#2e3614'],powerVisual:{size:[.85,1.38],amount:[.50,2.15]}},
  shadow_ball_move:{jp:'シャドーボール',desc:'影の手を伸ばす吸光核',range:'ranged',size:38,amount:9,duration:1.02,hitAt:.76,arc:-18,clashKind:'bullet',palette:['#f8eaff','#bc84e8','#66369a','#160c2c'],powerVisual:{size:[.70,1.72],amount:[.60,1.90]}},
  will_o_wisp_move:{jp:'おにび',desc:'互いを追う鬼火群',range:'ranged',size:25,amount:5,duration:1.12,hitAt:.80,arc:-16,clashKind:'bullet',palette:['#ffffff','#8fc9ff','#7761db','#2d185d'],powerVisual:{size:[.78,1.50],amount:[.60,2.00]}},
  moon_force_move:{jp:'ムーンフォース',desc:'月相と潮汐光の着弾',range:'ranged',size:48,amount:10,duration:1.16,hitAt:.74,arc:-34,clashKind:'bullet',palette:['#ffffff','#ffe2f4','#d485d9','#67306e'],powerVisual:{size:[.70,1.70],amount:[.58,1.90]}},
  quick_attack_move:{jp:'でんこうせっか',desc:'白い速度殻と連続残像',range:'ranged',size:30,amount:8,duration:.48,hitAt:.82,arc:0,clashKind:'bullet',palette:['#ffffff','#e9f3ff','#9fb7d0','#4a5968'],powerVisual:{size:[.82,1.42],amount:[.60,1.85]}},
  fire_blast_move:{jp:'だいもんじ',desc:'五本の炎路が描く大文字',range:'ranged',size:74,amount:22,duration:1.18,hitAt:.76,arc:-16,clashKind:'bullet',palette:['#ffffff','#ffd42f','#ff6918','#981c0b'],powerVisual:{size:[.66,1.82],amount:[.52,2.10]}},
  aqua_jet_move:{jp:'アクアジェット',desc:'使用者を包む水滴型突進殻',range:'ranged',size:38,amount:16,duration:.62,hitAt:.84,arc:-7,clashKind:'bullet',palette:['#ffffff','#c9f8ff','#39bcef','#07568d'],powerVisual:{size:[.76,1.58],amount:[.58,1.90]}},
  drill_run_move:{jp:'ドリルライナー',desc:'回転する土層円錐',range:'ranged',size:45,amount:9,duration:.74,hitAt:.82,arc:0,clashKind:'bullet',palette:['#fff3d0','#c89b56','#76502d','#302014'],powerVisual:{size:[.74,1.62],amount:[.60,1.90]}},
  brave_bird_move:{jp:'ブレイブバード',desc:'猛禽を象る翼付き突進殻',range:'ranged',size:66,amount:12,duration:1.02,hitAt:.86,arc:-42,clashKind:'bullet',palette:['#ffffff','#a8e8ff','#2c8fd0','#17436f'],powerVisual:{size:[.67,1.78],amount:[.55,2.00]}},
  aerial_ace_move:{jp:'つばめがえし',desc:'通過後に反転する燕の飛跡',range:'melee',size:52,amount:10,duration:.88,hitAt:.80,arc:0,clashKind:'none',palette:['#ffffff','#d7f5ff','#6cb8d7','#28536d'],powerVisual:{size:[.76,1.56],amount:[.62,1.85]}},
  x_scissor_move:{jp:'シザークロス',desc:'左右から閉じる昆虫大顎',range:'melee',size:78,amount:9,duration:.82,hitAt:.74,arc:0,clashKind:'none',palette:['#ffffff','#d9f47a','#70a930','#25451b'],powerVisual:{size:[.72,1.60],amount:[.62,1.85]}},
  night_slash_move:{jp:'つじぎり',desc:'夜の水平線を走る黒い月刃',range:'melee',size:82,amount:8,duration:.76,hitAt:.72,arc:0,clashKind:'none',palette:['#ffffff','#c8a8ed','#59337d','#12091e'],powerVisual:{size:[.72,1.60],amount:[.62,1.82]}},
  crunch_move:{jp:'かみくだく',desc:'骨質の上下顎と不揃いな歯',range:'melee',size:88,amount:9,duration:.86,hitAt:.72,arc:0,clashKind:'none',palette:['#ffffff','#dfc797','#7c623e','#2a2119'],powerVisual:{size:[.70,1.68],amount:[.65,1.80]}},
  metal_claw_move:{jp:'メタルクロー',desc:'三本の鉤爪と金属片',range:'melee',size:72,amount:3,duration:.72,hitAt:.72,arc:0,clashKind:'none',palette:['#ffffff','#dce8f2','#8796a5','#39424c'],powerVisual:{size:[.76,1.55],amount:[.75,1.75]}},
  thunder_punch_move:{jp:'かみなりパンチ',desc:'稲妻で組んだ拳骨',range:'melee',size:68,amount:10,duration:.78,hitAt:.72,arc:0,clashKind:'none',palette:['#ffffff','#fff28a','#ffc928','#775100'],powerVisual:{size:[.72,1.62],amount:[.60,1.90]}},
  air_slash_move:{jp:'エアスラッシュ',desc:'層をなす空気圧の羽根',range:'melee',size:48,amount:7,duration:.78,hitAt:.76,arc:-10,clashKind:'none',palette:['#ffffff','#d8f7ff','#80cfe0','#36758b'],powerVisual:{size:[.77,1.53],amount:[.58,1.95]}},
  psycho_cut_move:{jp:'サイコカッター',desc:'組み替わる念力結晶刃',range:'melee',size:62,amount:9,duration:.76,hitAt:.74,arc:-12,clashKind:'none',palette:['#ffffff','#ffb9e3','#cb54b6','#63245c'],powerVisual:{size:[.74,1.58],amount:[.60,1.88]}},
  outrage_move:{jp:'げきりん',desc:'二色の竜巻と暴れる竜頭',range:'melee',size:92,amount:16,duration:1.24,hitAt:.78,arc:0,clashKind:'none',palette:['#ffffff','#ff725f','#704ddb','#28145c'],powerVisual:{size:[.65,1.85],amount:[.52,2.10]}},
  ice_beam_move:{jp:'れいとうビーム',desc:'連結する六角氷晶の鎖',range:'ranged',size:30,amount:14,duration:1.30,hitAt:.48,arc:0,clashKind:'beam',palette:['#ffffff','#d4f8ff','#71d1ef','#256d9b'],powerVisual:{size:[.72,1.65],amount:[.58,1.95]}},
  flash_cannon_move:{jp:'ラスターカノン',desc:'金属絞りと四角い圧力節',range:'ranged',size:42,amount:10,duration:1.38,hitAt:.48,arc:0,clashKind:'beam',palette:['#ffffff','#e4edf4','#9baab8','#44505c'],powerVisual:{size:[.70,1.70],amount:[.60,1.90]}},
  dazzling_gleam_move:{jp:'マジカルシャイン',desc:'開く宝石面の虹色反射',range:'ranged',size:76,amount:12,duration:1.12,hitAt:.66,arc:0,clashKind:'beam',palette:['#ffffff','#ffd3ed','#caa8ff','#7659a4'],powerVisual:{size:[.70,1.68],amount:[.55,2.00]}},
  hyper_beam_move:{jp:'はかいこうせん',desc:'中央レールへ束ねる橙色エネルギー節',range:'ranged',size:54,amount:16,duration:1.72,hitAt:.54,arc:0,clashKind:'beam',palette:['#ffffff','#ffe071','#ff8a20','#8b2a0d'],powerVisual:{size:[.64,1.90],amount:[.50,2.20]}},
  dragon_pulse_move:{jp:'りゅうのはどう',desc:'蛇行する節持ち光竜',range:'ranged',size:44,amount:14,duration:1.32,hitAt:.52,arc:0,clashKind:'beam',palette:['#ffffff','#cfb6ff','#7256d0','#28155f'],powerVisual:{size:[.68,1.78],amount:[.55,2.05]}},
  dragon_dance_move:{jp:'りゅうのまい',desc:'反対向きに舞う二頭の竜帯',range:'remote',size:86,amount:16,duration:1.55,hitAt:.78,arc:0,clashKind:'none',palette:['#ffffff','#cc9cff','#7351ca','#2b155f'],powerVisual:{size:[.74,1.60],amount:[.58,1.95]}},
  toxic_move:{jp:'どくどく',desc:'毒滴が組み上げる髑髏',range:'remote',size:78,amount:13,duration:1.30,hitAt:.76,arc:0,clashKind:'none',palette:['#ffffff','#e8a0ff','#a43bc4','#49145e'],powerVisual:{size:[.72,1.65],amount:[.55,2.00]}},
  whirlpool_move:{jp:'うずしお',desc:'下から上へ細まる水の螺旋壁',range:'remote',size:92,amount:18,duration:1.46,hitAt:.76,arc:0,clashKind:'none',palette:['#ffffff','#bcefff','#3aafe5','#07517d'],powerVisual:{size:[.68,1.78],amount:[.52,2.10]}},
  rock_slide_move:{jp:'いわなだれ',desc:'傾いた岩棚を転げる岩塊',range:'remote',size:54,amount:9,duration:1.24,hitAt:.80,arc:0,clashKind:'none',palette:['#fff4d2','#c7a46b','#76583b','#33251a'],powerVisual:{size:[.70,1.72],amount:[.55,2.05]}},
  stone_edge_move:{jp:'ストーンエッジ',desc:'地中の稜線から押し上がる石柱',range:'remote',size:48,amount:7,duration:1.16,hitAt:.78,arc:0,clashKind:'none',palette:['#fff2cc','#c49b61','#715036','#2f2118'],powerVisual:{size:[.72,1.68],amount:[.55,2.00]}},
  earth_power_move:{jp:'だいちのちから',desc:'地脈輪から噴く土柱と熱光',range:'remote',size:66,amount:8,duration:1.28,hitAt:.76,arc:0,clashKind:'none',palette:['#ffffff','#ffd878','#b46a32','#552715'],powerVisual:{size:[.68,1.78],amount:[.55,2.05]}},
  earthquake_move:{jp:'じしん',desc:'隆起・沈降する地面プレート',range:'remote',size:92,amount:11,duration:1.58,hitAt:.76,arc:0,clashKind:'none',palette:['#fff3d5','#cfac72','#775737','#302116'],powerVisual:{size:[.62,1.95],amount:[.50,2.20]}},
  bombing_move:{jp:'爆撃',desc:'飛行周回中に全画面へ爆弾と業火を重ねる',range:'remote',size:62,amount:12,duration:4.55,hitAt:.94,arc:0,clashKind:'none',flames:22,embers:42,lockTarget:4.55,palette:['#ffffff','#ffd33c','#ff6418','#8e1609'],powerVisual:{size:[.62,2.00],amount:[.50,2.30]}}
};

globalThis.REBUILT_MOVE_FX={
  ember_move:EmberMoveFX,razor_leaf_move:RazorLeafMoveFX,seed_machine_gun_move:SeedMachineGunMoveFX,
  tri_attack_move:TriAttackMoveFX,future_sight_move:FutureSightMoveFX,icicle_spear_move:IcicleSpearMoveFX,
  focus_blast_move:FocusBlastMoveFX,sludge_bomb_move:SludgeBombMoveFX,pin_missile_move:PinMissileMoveFX,
  shadow_ball_move:ShadowBallMoveFX,will_o_wisp_move:WillOWispMoveFX,moon_force_move:MoonForceMoveFX,
  quick_attack_move:QuickAttackMoveFX,fire_blast_move:FireBlastMoveFX,aqua_jet_move:AquaJetMoveFX,
  drill_run_move:DrillRunMoveFX,brave_bird_move:BraveBirdMoveFX,aerial_ace_move:AerialAceMoveFX,
  x_scissor_move:XScissorMoveFX,night_slash_move:NightSlashMoveFX,crunch_move:CrunchMoveFX,
  metal_claw_move:MetalClawMoveFX,thunder_punch_move:ThunderPunchMoveFX,air_slash_move:AirSlashMoveFX,
  psycho_cut_move:PsychoCutMoveFX,outrage_move:OutrageMoveFX,ice_beam_move:IceBeamMoveFX,
  flash_cannon_move:FlashCannonMoveFX,dazzling_gleam_move:DazzlingGleamMoveFX,hyper_beam_move:HyperBeamMoveFX,
  dragon_pulse_move:DragonPulseMoveFX,dragon_dance_move:DragonDanceMoveFX,toxic_move:ToxicMoveFX,
  whirlpool_move:WhirlpoolMoveFX,rock_slide_move:RockSlideMoveFX,stone_edge_move:StoneEdgeMoveFX,
  earth_power_move:EarthPowerMoveFX,earthquake_move:EarthquakeMoveFX,bombing_move:BombingMoveFX
};

for(const [generator,m] of Object.entries(globalThis.REBUILT_MOVE_META)){
  DEFAULTS[generator]={generator,size:m.size,amount:m.amount,duration:m.duration,hitAt:m.hitAt,
    arc:m.arc||0,clashKind:m.clashKind||'none',flames:m.flames,embers:m.embers,
    lockTarget:m.lockTarget,palette:[...m.palette],impact:null,
    powerVisual:{size:[...m.powerVisual.size],amount:[...m.powerVisual.amount]}};
}
