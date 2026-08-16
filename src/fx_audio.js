/* =========================================================
   AudioSystem — 音もコードで作る（音声ファイルを一切使わない）
   ※ 本番では AudioSystem.js として音楽ラボ／技ラボ／バトルで共有する

   このゲームの音の芯：
     ・四皇モチーフ … 4音の動機。BGMにも効果音にも埋め込む（四皇＝4）
     ・二重パルス   … 微妙にデチューンした2枚のパルス波が主旋律
     ・ビットクラッシュ … 全体を粗く量子化して、一聴で「このゲーム」と分かる質感
   ========================================================= */

const SHIOU_MOTIF = [0, 7, 3, 10];        // 主音・5度・短3度・短7度
const SCALES = {
  '自然短音階': [0,2,3,5,7,8,10],
  '都節音階'  : [0,1,5,7,8],              // 和風で暗い。遭遇・ボス向き
  '琉球音階'  : [0,4,5,7,11],             // 明るく特徴的。勝利・草むら向き
  'ドリアン'  : [0,2,3,5,7,9,10],
  '長音階'    : [0,2,4,5,7,9,11]
};
const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const midiToHz = m => 440*Math.pow(2,(m-69)/12);

/* ---- ビットクラッシュ用カーブ ---- */
function crushCurve(bits){
  const n=2048, c=new Float32Array(n), lv=Math.pow(2,Math.max(1,bits));
  for(let i=0;i<n;i++){ const x=i/(n-1)*2-1; c[i]=Math.round(x*lv)/lv; }
  return c;
}

class AudioSystem {
  constructor(){ this.ctx=null; this.master=null; this.noiseBuf=null;
                 this.waves={}; this.bgmTimer=null; this.bgm=null; this.bgmVol=0.5; this.sfxVol=0.9; }

  init(){
    if(this.ctx) return this.ctx;
    const AC = window.AudioContext||window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.42;
    this.master.connect(this.ctx.destination);
    /* ノイズ源 */
    const len=this.ctx.sampleRate*2;
    this.noiseBuf=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
    const d=this.noiseBuf.getChannelData(0);
    let s=12345;
    for(let i=0;i<len;i++){ s=(s*1103515245+12345)&0x7fffffff; d[i]=(s/0x3fffffff)-1; }
    return this.ctx;
  }
  resume(){ this.init(); if(this.ctx.state==='suspended') this.ctx.resume(); }

  /* デューティ比つきパルス波 */
  pulse(duty){
    const key='p'+duty;
    if(this.waves[key]) return this.waves[key];
    const n=48, real=new Float32Array(n), imag=new Float32Array(n);
    for(let i=1;i<n;i++) real[i]=(2/(i*Math.PI))*Math.sin(Math.PI*i*duty);
    return this.waves[key]=this.ctx.createPeriodicWave(real,imag);
  }

  /* =======================================================
     効果音：1つの spec から鳴らす（技データの "sfx" ブロック）
     ======================================================= */
  playSfx(sp, when){
    if(!sp) return;
    this.resume();
    const ctx=this.ctx, t0=when||ctx.currentTime;
    const out=ctx.createGain();
    out.gain.value=(sp.gain===undefined?0.8:sp.gain)*this.sfxVol;

    /* ビットクラッシュ */
    let node=out;
    if(sp.bits && sp.bits<16){
      const ws=ctx.createWaveShaper(); ws.curve=crushCurve(sp.bits); ws.oversample='none';
      out.connect(ws); node=ws;
    }
    /* フィルタ */
    if(sp.filter){
      const bq=ctx.createBiquadFilter();
      bq.type=sp.filter.type||'lowpass';
      bq.Q.value=sp.filter.q||1;
      bq.frequency.setValueAtTime(Math.max(40,sp.filter.f0), t0);
      bq.frequency.exponentialRampToValueAtTime(Math.max(40,sp.filter.f1), t0+sp.dur);
      node.connect(bq); node=bq;
    }
    node.connect(this.master);

    const layers=Math.max(1,sp.layers||1);
    for(let L=0;L<layers;L++){
      const det=(L-(layers-1)/2)*(sp.detune||0);
      const g=ctx.createGain();
      const atk=Math.max(0.001,sp.attack||0.004);
      const peak=1/layers;
      const hold=Math.max(0,Math.min(0.9,sp.hold===undefined?0:sp.hold));
      const holdEnd=t0+Math.max(atk, sp.dur*hold);
      g.gain.setValueAtTime(0,t0);
      g.gain.linearRampToValueAtTime(peak, t0+atk);
      if(hold>0) g.gain.setValueAtTime(peak, holdEnd);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+Math.max(atk+0.03,sp.dur));
      g.connect(out);

      if(sp.wave==='noise'){
        const src=ctx.createBufferSource();
        src.buffer=this.noiseBuf; src.loop=true;
        src.playbackRate.setValueAtTime(Math.max(0.05,sp.f0/440), t0);
        src.playbackRate.exponentialRampToValueAtTime(Math.max(0.05,sp.f1/440), t0+sp.dur);
        src.connect(g); src.start(t0); src.stop(t0+sp.dur+0.05);
      }else{
        const o=ctx.createOscillator();
        if(sp.wave==='pulse25')      o.setPeriodicWave(this.pulse(0.25));
        else if(sp.wave==='pulse12') o.setPeriodicWave(this.pulse(0.125));
        else if(sp.wave==='square')  o.type='square';
        else if(sp.wave==='saw')     o.type='sawtooth';
        else                         o.type='triangle';
        o.detune.value=det;
        const f0=Math.max(20,sp.f0), f1=Math.max(20,sp.f1);
        o.frequency.setValueAtTime(f0,t0);
        if(sp.curve==='lin') o.frequency.linearRampToValueAtTime(f1,t0+sp.dur);
        else                 o.frequency.exponentialRampToValueAtTime(f1,t0+sp.dur);
        if(sp.vib && sp.vib.depth){
          const lfo=ctx.createOscillator(), la=ctx.createGain();
          lfo.frequency.value=sp.vib.rate||6; la.gain.value=sp.vib.depth;
          lfo.connect(la); la.connect(o.detune); lfo.start(t0); lfo.stop(t0+sp.dur+0.05);
        }
        o.connect(g); o.start(t0); o.stop(t0+sp.dur+0.05);
      }
      /* ノイズを重ねる（打撃感） */
      if(sp.noise>0 && sp.wave!=='noise' && L===0){
        const src=ctx.createBufferSource(); src.buffer=this.noiseBuf; src.loop=true;
        const ng=ctx.createGain();
        ng.gain.setValueAtTime(sp.noise,t0);
        ng.gain.exponentialRampToValueAtTime(0.0001,t0+sp.dur*0.6);
        src.connect(ng); ng.connect(out); src.start(t0); src.stop(t0+sp.dur+0.05);
      }
    }

    /* 四皇モチーフを尻尾に付ける（必殺技用） */
    if(sp.motif){
      const base=sp.motifRoot||62;
      SHIOU_MOTIF.forEach((n,i)=>{
        const tt=t0+sp.dur*0.55+i*0.055;
        const o=ctx.createOscillator(), g=ctx.createGain();
        o.setPeriodicWave(this.pulse(0.25));
        o.frequency.value=midiToHz(base+n+12);
        g.gain.setValueAtTime(0,tt);
        g.gain.linearRampToValueAtTime(0.22*this.sfxVol,tt+0.004);
        g.gain.exponentialRampToValueAtTime(0.0001,tt+0.12);
        o.connect(g); g.connect(this.master); o.start(tt); o.stop(tt+0.14);
      });
    }
  }

  /* =======================================================
     BGM：シードから手続き的に作曲してループ再生
     ======================================================= */
  composeBGM(sp){
    const rng=new RNG(sp.seed);
    const scale=SCALES[sp.scale]||SCALES['自然短音階'];
    const root=sp.rootMidi;
    const bars=4, steps=16;                    // 16分 × 16 × 4小節
    const spb=60/sp.bpm/4;                     // 1ステップの秒数
    const deg=d=>{ const o=Math.floor(d/scale.length), i=((d%scale.length)+scale.length)%scale.length;
                   return root+scale[i]+o*12; };
    /* 和音進行：主音から始まる4つ */
    const prog=[0, rng.int(3,5), rng.int(2,4), rng.int(4,6)];
    const notes=[];
    for(let b=0;b<bars;b++){
      const ch=prog[b];
      /* ベース：三角波。1拍ごと */
      for(let s=0;s<steps;s+=4){
        notes.push({ch:'bass', t:(b*steps+s)*spb, dur:spb*3.4,
                    hz:midiToHz(deg(ch)-12), vel:0.55});
      }
      /* アルペジオ：16分の刻み */
      if(sp.arp>0) for(let s=0;s<steps;s++){
        if(rng.next()>sp.arp) continue;
        const step=[0,2,4,7][s%4];
        notes.push({ch:'arp', t:(b*steps+s)*spb, dur:spb*0.85,
                    hz:midiToHz(deg(ch+step)), vel:0.20});
      }
      /* 主旋律：モチーフを差し込みつつ、残りはシードで作る */
      const useMotif = (b%2===0) && rng.next()<sp.motif;
      if(useMotif){
        SHIOU_MOTIF.forEach((n,i)=>{
          notes.push({ch:'lead', t:(b*steps+i*3)*spb, dur:spb*2.6,
                      hz:midiToHz(root+n+12), vel:0.5, motif:true});
        });
      }else{
        let d=rng.int(0,4);
        for(let s=0;s<steps;s+=2){
          if(rng.next()<0.28) continue;
          d+=rng.int(-2,2);
          d=Math.max(-2,Math.min(9,d));
          notes.push({ch:'lead', t:(b*steps+s)*spb, dur:spb*1.7,
                      hz:midiToHz(deg(ch+d)+12), vel:0.42});
        }
      }
      /* ドラム */
      if(sp.drums) for(let s=0;s<steps;s++){
        const isK=(s%8===0), isS=(s%8===4), isH=(s%2===0);
        if(isK) notes.push({ch:'kick',t:(b*steps+s)*spb,dur:0.13,hz:120,vel:0.9});
        else if(isS) notes.push({ch:'snare',t:(b*steps+s)*spb,dur:0.13,hz:1800,vel:0.55});
        else if(isH&&rng.next()<0.7) notes.push({ch:'hat',t:(b*steps+s)*spb,dur:0.04,hz:6000,vel:0.22});
      }
    }
    return { notes, length: bars*steps*spb };
  }

  playNote(n, t0, sp){
    const ctx=this.ctx, g=ctx.createGain();
    const vol=n.vel*this.bgmVol*0.5;
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(vol,t0+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+n.dur);
    let dest=this.master;
    if(sp.bits<16){ const ws=ctx.createWaveShaper(); ws.curve=crushCurve(sp.bits);
                    ws.connect(this.master); dest=ws; }
    g.connect(dest);

    if(n.ch==='kick'){
      const o=ctx.createOscillator(); o.type='triangle';
      o.frequency.setValueAtTime(160,t0); o.frequency.exponentialRampToValueAtTime(45,t0+n.dur);
      o.connect(g); o.start(t0); o.stop(t0+n.dur+0.02); return;
    }
    if(n.ch==='snare'||n.ch==='hat'){
      const s=ctx.createBufferSource(); s.buffer=this.noiseBuf; s.loop=true;
      const bq=ctx.createBiquadFilter(); bq.type='highpass'; bq.frequency.value=n.ch==='hat'?7000:1600;
      s.connect(bq); bq.connect(g); s.start(t0); s.stop(t0+n.dur+0.02); return;
    }
    const o=ctx.createOscillator();
    if(n.ch==='bass') o.type='triangle';
    else if(n.ch==='arp') o.setPeriodicWave(this.pulse(0.125));
    else o.setPeriodicWave(this.pulse(sp.duty||0.5));
    o.frequency.value=n.hz;
    o.connect(g); o.start(t0); o.stop(t0+n.dur+0.02);
    /* 主旋律は二重デチューン（このゲームの声） */
    if(n.ch==='lead' && sp.detune){
      const o2=ctx.createOscillator();
      o2.setPeriodicWave(this.pulse(sp.duty||0.5));
      o2.frequency.value=n.hz; o2.detune.value=sp.detune;
      o2.connect(g); o2.start(t0); o2.stop(t0+n.dur+0.02);
    }
  }

  startBGM(sp){
    this.resume(); this.stopBGM();
    const song=this.composeBGM(sp);
    this.bgm={sp,song,next:this.ctx.currentTime+0.1};
    const tick=()=>{
      if(!this.bgm) return;
      const ahead=this.ctx.currentTime+0.4;
      while(this.bgm.next<ahead){
        const base=this.bgm.next;
        for(const n of song.notes) this.playNote(n, base+n.t, sp);
        this.bgm.next += song.length;
      }
    };
    tick();
    this.bgmTimer=setInterval(tick,120);
    return song;
  }
  stopBGM(){ if(this.bgmTimer) clearInterval(this.bgmTimer); this.bgmTimer=null; this.bgm=null; }
}
const AUDIO = new AudioSystem();

/* =========================================================
   効果音プリセット — generator ごとの既定音
   技ラボで技を作ると、この中から対応する音が初期値として付く
   ========================================================= */
const SFX_PRESETS = {
  projectile:{ id:'sfx_shot', wave:'pulse25', f0:880, f1:180, curve:'exp', dur:0.24,
               attack:0.004, hold:0.15, noise:0.10, layers:2, detune:16, bits:6,
               filter:{type:'lowpass',f0:8000,f1:1400,q:1.2}, gain:0.8, motif:false },
  impact    :{ id:'sfx_impact', wave:'noise', f0:900, f1:90, curve:'exp', dur:0.36,
               attack:0.002, hold:0.12, noise:0, layers:1, bits:5,
               filter:{type:'lowpass',f0:6000,f1:400,q:1}, gain:1.0, motif:false },
  beam      :{ id:'sfx_beam', wave:'saw', f0:220, f1:1300, curve:'exp', dur:0.80,
               attack:0.05, hold:0.72, noise:0.14, layers:3, detune:22, bits:7,
               filter:{type:'lowpass',f0:1400,f1:6000,q:2}, gain:0.75,
               vib:{rate:7,depth:22}, motif:false },
  slash     :{ id:'sfx_slash', wave:'noise', f0:2600, f1:420, curve:'exp', dur:0.22,
               attack:0.001, hold:0.06, noise:0, layers:1, bits:6,
               filter:{type:'highpass',f0:1400,f1:500,q:1.4}, gain:1.0, motif:false },
  lightning :{ id:'sfx_bolt', wave:'noise', f0:5200, f1:200, curve:'exp', dur:0.46,
               attack:0.001, hold:0.18, noise:0, layers:1, bits:4,
               filter:{type:'lowpass',f0:8000,f1:700,q:1.2}, gain:1.1, motif:false },
  aura      :{ id:'sfx_aura', wave:'pulse12', f0:220, f1:880, curve:'exp', dur:0.95,
               attack:0.10, hold:0.62, noise:0.04, layers:2, detune:9, bits:8,
               filter:{type:'lowpass',f0:1800,f1:6000,q:1.2}, gain:0.65,
               vib:{rate:5,depth:14}, motif:true },
  hurt      :{ id:'sfx_hurt', wave:'square', f0:420, f1:110, curve:'exp', dur:0.18,
               attack:0.002, hold:0.08, noise:0.30, layers:1, bits:5,
               filter:{type:'lowpass',f0:4000,f1:700,q:1}, gain:0.75, motif:false },
  clash     :{ id:'sfx_clash', wave:'square', f0:1600, f1:260, curve:'exp', dur:0.32,
               attack:0.001, hold:0.10, noise:0.45, layers:2, detune:36, bits:4,
               filter:{type:'lowpass',f0:7000,f1:900,q:1.6}, gain:1.15, motif:false },
  dodge     :{ id:'sfx_dodge', wave:'noise', f0:1400, f1:3200, curve:'exp', dur:0.16,
               attack:0.002, hold:0.05, noise:0, layers:1, bits:7,
               filter:{type:'highpass',f0:700,f1:2200,q:1}, gain:0.6, motif:false },
  faint     :{ id:'sfx_faint', wave:'pulse25', f0:520, f1:60, curve:'exp', dur:0.95,
               attack:0.01, hold:0.22, noise:0.06, layers:2, detune:24, bits:5,
               filter:{type:'lowpass',f0:3200,f1:300,q:1.2}, gain:0.85, motif:true }
};

/* ---- BGM プリセット ---- */
const BGM_PRESETS = {
  '戦闘'  :{ id:'bgm_battle', bpm:158, rootMidi:50, scale:'自然短音階', seed:918273,
             duty:0.5, detune:11, arp:0.7, motif:1.0, drums:true, bits:7 },
  '遭遇'  :{ id:'bgm_wild',   bpm:132, rootMidi:52, scale:'都節音階',   seed:5150,
             duty:0.25, detune:8, arp:0.4, motif:0.6, drums:true, bits:6 },
  '草むら':{ id:'bgm_field',  bpm:112, rootMidi:57, scale:'琉球音階',   seed:777,
             duty:0.5, detune:6, arp:0.55, motif:0.5, drums:false, bits:8 },
  '勝利'  :{ id:'bgm_win',    bpm:168, rootMidi:53, scale:'長音階',     seed:2024,
             duty:0.25, detune:14, arp:0.85, motif:1.0, drums:true, bits:7 },
  '危機'  :{ id:'bgm_pinch',  bpm:176, rootMidi:49, scale:'都節音階',   seed:31337,
             duty:0.125, detune:18, arp:0.9, motif:0.8, drums:true, bits:5 }
};
