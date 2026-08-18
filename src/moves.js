/* =========================================================
   タイプ（分類）
   相性表は作らない（計画1.2(b)）。効果は「タイプ一致ボーナス」だけ
   ========================================================= */
const TYPES = {
  'ノーマル':'#a8a878','ほのお':'#f08030','みず':'#6890f0','でんき':'#f8d030',
  'くさ':'#78c850','こおり':'#98d8d8','かくとう':'#c03028','どく':'#a040a0',
  'じめん':'#e0c068','ひこう':'#a890f0','エスパー':'#f85888','むし':'#a8b820',
  'いわ':'#b8a038','ゴースト':'#705898','ドラゴン':'#7038f8','あく':'#705848',
  'はがね':'#b8b8d0','フェアリー':'#ee99ac'
};
const TYPE_LIST = Object.keys(TYPES);
const STAB = { value:1.25 };          // タイプ一致ボーナス。調整可能
function stabOf(f,m){ return (m.type && f.types.includes(m.type)) ? STAB.value : 1.0; }
function typeTag(t){
  return '<span style="background:'+TYPES[t]+';color:#141820;border-radius:2px;'+
         'padding:0 3px;font-size:9px;margin-right:3px;">'+t+'</span>';
}

/* =========================================================
   技データ（技ラボの JSON をそのまま貼れる）
   ========================================================= */
const MOVE_SHAKUNETSU = makeSpec('projectile', 918273, '灼熱弾', '炎');
const MOVE_SUIDAN     = makeSpec('projectile', 5150,   '水弾',   '水');
MOVE_SUIDAN.travel.speed = 280; MOVE_SUIDAN.travel.arc = -18;
MOVE_SUIDAN.impact.size  = 48;

const MOVE_BEAM  = makeSpec('beam',      31337, '白熱光線', '雷');
const MOVE_SLASH = makeSpec('slash',     777,   '三連爪',   '鋼');
const MOVE_BOLT  = makeSpec('lightning', 2024,  '落雷',     '雷');
const MOVE_AURA  = makeSpec('aura',      555,   '闘気',     '草');

/* 亜空切断：空間を裂く2連斬。着弾で空間がガラスのように割れる */
const MOVE_AKUU = makeSpec('slash', 404040, '亜空切断', '闇');
Object.assign(MOVE_AKUU,{
  id:'akuu_setsudan', size:190, arcDeg:150, thickness:30, count:2, interval:0.19, spread:26,
  taper:1.9, hollow:0.52, jitter:0.30, squash:0.78, specks:22,
  palette:['#ffffff','#e8c0ff','#8a3ce0','#160430']
});
MOVE_AKUU.impact={size:110,frames:12,shards:22,
                  palette:['#ffffff','#f0c8ff','#a35ce0','#2a0a50']};
MOVE_AKUU.shatter={ generator:'shatter', seed:404041, size:215, cracks:30, jag:0.45,
  drift:92, spin:4.6, dust:70, duration:1.25,
  palette:['#f6e2ff','#c98cff','#8a3ce0','#3a0f78'] };

/* 画面演出（背景変化）は技データの一部。大技ほど画面が動く */
MOVE_SHAKUNETSU.screen = {
  shake:{power:5,dur:0.28,at:'impact'},
  tint :{color:'#ff6a10',strength:0.28,dur:0.35,at:'impact'}
};
MOVE_SUIDAN.screen = {
  shake:{power:4,dur:0.22,at:'impact'},
  tint :{color:'#3fa9f5',strength:0.26,dur:0.35,at:'impact'}
};
MOVE_BEAM.screen = {                       /* 溜めで暗転 → 直撃で白飛び */
  darken:{strength:0.60,dur:0.55,at:'cast'},
  lines :{color:'#fff7a0',strength:0.35,dur:0.45,at:'cast',dir:'v'},
  flash :{color:'#ffffff',strength:0.90,dur:0.18,at:'impact'},
  shake :{power:9,dur:0.40,at:'impact'}
};
MOVE_SLASH.screen = {
  lines:{color:'#ffffff',strength:0.45,dur:0.30,at:'impact',dir:'v'},
  shake:{power:6,dur:0.24,at:'impact'}
};
MOVE_BOLT.screen = {                       /* 背景が激しく点滅 */
  darken:{strength:0.55,dur:0.30,at:'cast'},
  blink :{color:'#fff7a0',strength:0.80,times:5,dur:0.55,at:'impact'},
  shake :{power:11,dur:0.45,at:'impact'}
};
MOVE_AURA.screen = {
  tint :{color:'#b8e986',strength:0.30,dur:0.9,at:'cast'},
  blink:{color:'#f0ffd8',strength:0.35,times:3,dur:0.9,at:'cast'}
};
MOVE_AKUU.screen = {
  darken:{strength:0.62,dur:0.45,at:'cast'},
  lines :{color:'#d8a8ff',strength:0.45,dur:0.40,at:'cast',dir:'v'},
  flash :{color:'#f4e0ff',strength:0.92,dur:0.16,at:'impact'},
  shake :{power:10,dur:0.42,at:'impact'},
  tint  :{color:'#7a3ad0',strength:0.34,dur:0.55,at:'impact'}
};

const BUILT = new Map();
const builtOf = m => { if(!BUILT.has(m.id)) BUILT.set(m.id, buildEffect(m)); return BUILT.get(m.id); };

/* 技データ。数値はここに集約し、コードへ直書きしない */
const MOVES = {
  shakunetsu:{ id:'shakunetsu', range:'ranged', name:'灼熱弾',   type:'ほのお', power:26, cast:0.30, cooldown:2.4, fx:MOVE_SHAKUNETSU,
               tags:['遠距離向き','連発向き','迎撃向き'] },
  suidan    :{ id:'suidan', range:'ranged',     name:'水弾',     type:'みず',   power:22, cast:0.24, cooldown:1.9, fx:MOVE_SUIDAN,
               tags:['遠距離向き','連発向き','低リスク','迎撃向き'] },
  beam      :{ id:'beam', range:'ranged',       name:'白熱光線', type:'でんき', power:40, cast:0.72, cooldown:5.6, fx:MOVE_BEAM,
               tags:['高威力','とどめ向き','瀕死時危険'] },
  slash     :{ id:'slash', range:'melee',      name:'三連爪',   type:'はがね', power:30, cast:0.18, cooldown:2.8, fx:MOVE_SLASH,
               tags:['近距離向き','低リスク'] },
  bolt      :{ id:'bolt', range:'remote',       name:'落雷',     type:'でんき', power:34, cast:0.68, cooldown:4.6, fx:MOVE_BOLT,
               tags:['高威力','回避されやすい','瀕死時危険'] },
  akuu      :{ id:'akuu', range:'melee',       name:'亜空切断', type:'ドラゴン', power:44, cast:0.42, cooldown:5.0, fx:MOVE_AKUU,
               tags:['近距離向き','高威力','とどめ向き','瀕死時危険'] }
};

/* =========================================================
   CostCalculator（仮式・Phase 15 で本採用）
   賢さは有利にも不利にも働くため重みを低くしてある（計画18.5）
   ========================================================= */
const COST_W={atk:1.15,def:0.95,hp:1.00,spd:1.05,eva:0.90,int:0.85};
function costOf(m){
  let sum=0; for(const k in COST_W) sum+=(m.stats[k]||0)*COST_W[k];
  const avg=sum/6;
  const base=27*Math.pow(Math.max(1,avg)/50, 2.45);
  const ids=(m.moves||[]).map(x=>typeof x==='string'?x:x.id);
  const mv=ids.reduce((a,id)=>a+(MOVES[id]?MOVES[id].power:0),0)*0.12
           + Math.max(0,ids.length-1)*2;
  return { cost:Math.max(1,Math.round(base+mv)), avg, base, mv };
}
