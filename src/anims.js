/* =========================================================
   アニメーション定義
   画像は変えず、変形（squash & stretch）で動かす
   sx/sy=拡縮  dx/dy=移動  rot=回転  flash=白点滅  ghost=残像
   ========================================================= */
const K = o => Object.assign({sx:1,sy:1,dx:0,dy:0,rot:0,alpha:1,flash:0,ghost:0},o);

const ANIMS = {
  idle:{ dur:2.6, loop:true, keys:[
    K({t:0,   sx:1.00, sy:1.00, dy:0}),
    K({t:0.5, sx:0.975,sy:1.035,dy:-3}),
    K({t:1,   sx:1.00, sy:1.00, dy:0})
  ], img:[[0,'normal']]},

  /* 溜めてつぶれる → 伸びて突き出す → 戻る */
  attack:{ dur:0.75, keys:[
    K({t:0,    sx:1.00,sy:1.00,dx:0}),
    K({t:0.20, sx:1.26,sy:0.76,dx:-9, rot:0.05}),      // かがむ
    K({t:0.32, sx:0.74,sy:1.28,dx:22, rot:-0.10}),     // 突き出す
    K({t:0.42, sx:1.10,sy:0.92,dx:14, rot:-0.04}),
    K({t:0.60, sx:0.97,sy:1.03,dx:4}),
    K({t:1,    sx:1.00,sy:1.00,dx:0})
  ], img:[[0,'normal'],[0.18,'attack'],[0.60,'normal']]},

  /* のけぞる＋点滅＋震え */
  hurt:{ dur:0.62, keys:[
    K({t:0,    sx:1.00,sy:1.00}),
    K({t:0.08, sx:1.22,sy:0.80,dx:-14,rot:-0.14,flash:1}),
    K({t:0.20, sx:0.90,sy:1.12,dx:-9, rot:0.08, flash:0}),
    K({t:0.32, sx:1.08,sy:0.94,dx:-4, rot:-0.05,flash:1}),
    K({t:0.46, sx:0.97,sy:1.03,dx:-1, rot:0.02, flash:0}),
    K({t:1,    sx:1.00,sy:1.00})
  ], img:[[0,'hurt'],[0.7,'normal']]},

  /* 横へシュッと避けて戻る（残像つき） */
  dodge:{ dur:0.62, keys:[
    K({t:0,    sx:1.00,sy:1.00}),
    K({t:0.10, sx:1.20,sy:0.82,dx:-6}),
    K({t:0.24, sx:1.34,sy:0.78,dx:-42,ghost:1}),
    K({t:0.40, sx:0.94,sy:1.08,dx:-46,ghost:1}),
    K({t:0.58, sx:1.16,sy:0.88,dx:-18,ghost:1}),
    K({t:0.78, sx:0.96,sy:1.05,dx:-2}),
    K({t:1,    sx:1.00,sy:1.00})
  ], img:[[0,'normal']]},

  /* 往復横跳び：左右へ跳んで戻る。かく乱・回り込みの前ぶり向き。
     dx は描画側で dir を掛けるけん、味方と敵で自然に鏡になる。 */
  zigzag:{ dur:0.95, keys:[
    K({t:0,    sx:1.00,sy:1.00,dx:0}),
    K({t:0.07, sx:1.26,sy:0.78,dx:-5}),                        // 沈んで溜め
    K({t:0.19, sx:1.32,sy:0.80,dx:-46,ghost:1,rot:-0.06}),     // 左へ跳ぶ
    K({t:0.27, sx:0.94,sy:1.08,dx:-50,rot:0.03}),
    K({t:0.33, sx:1.22,sy:0.84,dx:-44}),                       // 踏み替え
    K({t:0.45, sx:1.32,sy:0.80,dx:44, ghost:1,rot:0.06}),      // 右へ跳ぶ
    K({t:0.53, sx:0.94,sy:1.08,dx:48, rot:-0.03}),
    K({t:0.59, sx:1.22,sy:0.84,dx:42}),
    K({t:0.71, sx:1.30,sy:0.82,dx:-30,ghost:1,rot:-0.05}),     // もう一往復
    K({t:0.79, sx:0.96,sy:1.06,dx:-32}),
    K({t:0.90, sx:1.16,sy:0.88,dx:-6, ghost:1}),               // 戻る
    K({t:0.96, sx:0.94,sy:1.06,dx:2}),
    K({t:1,    sx:1.00,sy:1.00,dx:0})
  ], img:[[0,'normal']]},

  /* その場でジャンプ（画面内に収まる） */
  jump:{ dur:1.45, keys:[
    K({t:0,    sx:1.00,sy:1.00,dy:0}),
    K({t:0.10, sx:1.34,sy:0.68,dy:6}),                 // 沈む
    K({t:0.14, sx:1.20,sy:0.80,dy:2}),
    K({t:0.22, sx:0.66,sy:1.42,dy:-34,ghost:1}),       // 伸びて飛ぶ
    K({t:0.32, sx:0.86,sy:1.16,dy:-62,ghost:1}),
    K({t:0.42, sx:1.02,sy:0.99,dy:-74,rot:-0.05}),     // 頂点
    K({t:0.55, sx:0.99,sy:1.02,dy:-70,rot:0.05}),      // 漂う
    K({t:0.66, sx:1.02,sy:0.98,dy:-74,rot:-0.04}),
    K({t:0.80, sx:0.80,sy:1.24,dy:-34,ghost:1}),       // 落ちる
    K({t:0.89, sx:1.36,sy:0.66,dy:5}),                 // 着地
    K({t:0.94, sx:0.90,sy:1.10,dy:-8}),
    K({t:1,    sx:1.00,sy:1.00,dy:0})
  ], img:[[0,'normal'],[0.10,'attack'],[0.86,'normal']]},

  /* 飛ぶ：画面の上へ抜けて消える → 戻ってきて着地 */
  fly:{ dur:2.7, keys:[
    K({t:0,    sx:1.00,sy:1.00,dy:0}),
    K({t:0.05, sx:1.38,sy:0.64,dy:8}),                        // 深く沈む
    K({t:0.09, sx:1.16,sy:0.86,dy:3}),
    K({t:0.15, sx:0.58,sy:1.54,dy:-80, ghost:1,rot:-0.04}),   // 打ち上がる
    K({t:0.22, sx:0.66,sy:1.44,dy:-200,ghost:1,rot:-0.02}),
    K({t:0.30, sx:0.74,sy:1.34,dy:-340,ghost:1}),             // 画面外へ
    K({t:0.40, sx:0.80,sy:1.26,dy:-420}),                     // 不在
    K({t:0.58, sx:0.80,sy:1.26,dy:-420}),
    K({t:0.68, sx:0.76,sy:1.32,dy:-330,ghost:1}),             // 戻ってくる
    K({t:0.78, sx:0.80,sy:1.28,dy:-190,ghost:1,rot:0.03}),
    K({t:0.86, sx:0.86,sy:1.20,dy:-70, ghost:1,rot:0.02}),
    K({t:0.91, sx:1.42,sy:0.60,dy:9}),                        // 着地
    K({t:0.95, sx:0.86,sy:1.14,dy:-12}),
    K({t:0.98, sx:1.06,sy:0.96,dy:0}),
    K({t:1,    sx:1.00,sy:1.00,dy:0})
  ], img:[[0,'normal'],[0.05,'attack'],[0.90,'normal']]},

  /* 出現（召喚）：光の中から降ってきて、ズシンと着地する。トレーナー戦の出方。
     高さは -96px に抑えとる。上げすぎると画面外へ抜けて、何が来たか分からんくなる。
     光そのものは絵やけん fx_core.js の drawSummon() が描く（ここは変形だけ）。
     landAt = 着地した瞬間の t。着地モーション（mon.summon.land）はここから流れる。 */
  appear:{ dur:1.15, landAt:0.46, keys:[
    K({t:0,    sx:0.52,sy:1.60,dy:-96,alpha:0,  flash:1}),              // 光の中
    K({t:0.12, sx:0.60,sy:1.50,dy:-90,alpha:1,  flash:1}),
    K({t:0.28, sx:0.70,sy:1.36,dy:-56,alpha:1,  flash:0.55,ghost:1}),  // 落ちる
    K({t:0.40, sx:0.78,sy:1.26,dy:-16,alpha:1,  flash:0.20,ghost:1}),
    K({t:0.46, sx:1.48,sy:0.54,dy:7,  alpha:1,  flash:0.40}),          // ズシン
    K({t:0.55, sx:1.28,sy:0.74,dy:3}),
    K({t:0.66, sx:0.86,sy:1.16,dy:-11}),                               // 反動
    K({t:0.77, sx:1.12,sy:0.92,dy:2}),
    K({t:0.88, sx:0.95,sy:1.05,dy:-3}),
    K({t:1,    sx:1.00,sy:1.00,dy:0})
  ], img:[[0,'normal']]},

  /* 出現（草むら）：光は出らん。草をかき分けて飛び出し、着地する。
     野生の四皇モンはこっち。トレーナーが繰り出す appear とは出方が違う。 */
  appearWild:{ dur:1.15, landAt:0.56, keys:[
    K({t:0,    sx:1.34,sy:0.60,dy:26, alpha:0}),                       // 草の中で沈んどる
    K({t:0.09, sx:1.26,sy:0.70,dy:20, alpha:0.4}),
    K({t:0.20, sx:0.70,sy:1.34,dy:-38,alpha:1, ghost:1}),              // 飛び出す
    K({t:0.32, sx:0.82,sy:1.20,dy:-58,alpha:1, ghost:1}),              // 頂点
    K({t:0.44, sx:0.94,sy:1.06,dy:-36,alpha:1}),
    K({t:0.56, sx:1.36,sy:0.64,dy:7}),                                 // 着地
    K({t:0.64, sx:1.18,sy:0.84,dy:2}),
    K({t:0.74, sx:0.88,sy:1.13,dy:-9}),
    K({t:0.86, sx:1.09,sy:0.94,dy:1}),
    K({t:1,    sx:1.00,sy:1.00,dy:0})
  ], img:[[0,'normal']]},

  /* 力を溜める（脈打つ） */
  charge:{ dur:1.1, loop:true, keys:[
    K({t:0,    sx:1.00,sy:1.00}),
    K({t:0.25, sx:1.12,sy:0.90,dy:2, flash:0.25}),
    K({t:0.50, sx:0.92,sy:1.10,dy:-4,flash:0.6}),
    K({t:0.75, sx:1.10,sy:0.92,dy:1, flash:0.25}),
    K({t:1,    sx:1.00,sy:1.00})
  ], img:[[0,'attack']]},

  /* 大きくふっとぶ */
  knockback:{ dur:0.9, keys:[
    K({t:0,    sx:1.00,sy:1.00}),
    K({t:0.07, sx:1.30,sy:0.74,dx:-8, flash:1}),
    K({t:0.22, sx:0.80,sy:1.20,dx:-58,dy:-26,rot:-0.4,ghost:1}),
    K({t:0.40, sx:1.05,sy:0.95,dx:-72,dy:-6, rot:-0.7}),
    K({t:0.52, sx:1.34,sy:0.70,dx:-70,dy:4,  rot:-0.5}),
    K({t:0.68, sx:0.95,sy:1.06,dx:-52,dy:-10,rot:-0.3}),
    K({t:0.84, sx:1.06,sy:0.96,dx:-24,dy:0,  rot:-0.1}),
    K({t:1,    sx:1.00,sy:1.00})
  ], img:[[0,'hurt'],[0.85,'normal']]},

  /* 倒れる（その試合のみの死亡） */
  faint:{ dur:1.1, hold:true, keys:[
    K({t:0,    sx:1.00,sy:1.00}),
    K({t:0.12, sx:1.18,sy:0.84,flash:1}),
    K({t:0.28, sx:0.92,sy:1.08,dy:-6,flash:0}),
    K({t:0.60, sx:1.05,sy:0.92,dy:6, rot:-0.7,alpha:0.9}),
    K({t:1,    sx:1.22,sy:0.70,dy:12,rot:-1.35,alpha:0.55})
  ], img:[[0,'hurt']]}
};

function lerp(a,b,t){ return a+(b-a)*t; }
function easeIO(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }

function sampleAnim(def,t){
  const ks=def.keys;
  let i=0; while(i<ks.length-1 && ks[i+1].t<=t) i++;
  const a=ks[i], b=ks[Math.min(i+1,ks.length-1)];
  const span=Math.max(1e-6,b.t-a.t);
  const u=easeIO(Math.min(1,Math.max(0,(t-a.t)/span)));
  const out={};
  for(const p of ['sx','sy','dx','dy','rot','alpha','flash','ghost']) out[p]=lerp(a[p],b[p],u);
  let key='normal';
  for(const [tt,k] of def.img) if(t>=tt) key=k;
  out.img=key;
  return out;
}

