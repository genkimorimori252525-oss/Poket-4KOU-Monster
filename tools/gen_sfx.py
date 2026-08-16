#!/usr/bin/env python3
# sfx_bank.js 生成スクリプト（CC0素材 → base64 data URI）
import os, base64, json, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
ROOT = os.path.join(REPO, 'assets')
A = ROOT + '/webgameattacksfxcc0/webgame-attack-sfx-cc0/audio'
K = ROOT + '/webgamesfxcc0kenney/webgame-sfx-cc0-kenney/audio'

# (id, 表示名, カテゴリ, パス)
PICKS = [
 # ── 発射・弾 ──────────────────────────────
 ('shot_light',  '発射・軽い',      'shot', A+'/retro512_weapons/Single Shot Sounds/sfx_weapon_singleshot1.ogg'),
 ('shot_mid',    '発射・中',        'shot', A+'/retro512_weapons/Single Shot Sounds/sfx_weapon_singleshot5.ogg'),
 ('shot_heavy',  '発射・重い',      'shot', A+'/retro512_weapons/Shotgun/sfx_weapon_shotgun1.ogg'),
 ('shot_pop',    '発射・ポップ',    'shot', K+'/digital-audio/pepSound1.ogg'),
 ('shot_air',    '発射・空気',      'shot', A+'/firearms_explosions/spit.ogg'),
 ('shot_whistle','発射・ヒュー',    'shot', A+'/retro512_weapons/Grenade Whistles/sfx_wpn_grenadewhistle1.ogg'),

 # ── 光線・レーザー ────────────────────────
 ('laser_small', '光線・細い',      'beam', K+'/sci-fi-sounds/laserSmall_000.ogg'),
 ('laser_large', '光線・太い',      'beam', K+'/sci-fi-sounds/laserLarge_000.ogg'),
 ('laser_retro', '光線・レトロ',    'beam', K+'/sci-fi-sounds/laserRetro_001.ogg'),
 ('laser_deep',  '光線・低音',      'beam', A+'/retro512_weapons/Lasers/sfx_wpn_laser1.ogg'),
 ('laser_sharp', '光線・鋭い',      'beam', A+'/retro512_weapons/Lasers/sfx_wpn_laser8.ogg'),
 ('laser_wide',  '光線・広がる',    'beam', A+'/retro2_lasers/Laser-weapon 3 - Sound effects Pack 2.ogg'),
 ('beam_charge', '光線・チャージ',  'beam', K+'/digital-audio/phaserUp3.ogg'),

 # ── 大砲・重火力 ──────────────────────────
 ('cannon1',     '大砲・低い',      'heavy', A+'/retro512_weapons/Cannon/sfx_wpn_cannon1.ogg'),
 ('cannon2',     '大砲・唸り',      'heavy', A+'/retro512_weapons/Cannon/sfx_wpn_cannon3.ogg'),
 ('missile',     'ミサイル発射',    'heavy', A+'/retro512_weapons/Grenade Whistles/sfx_wpn_missilelaunch.ogg'),
 ('boom_far',    '遠雷・轟音',      'heavy', A+'/firearms_explosions/boom.ogg'),

 # ── 爆発・着弾 ────────────────────────────
 ('exp_short',   '爆発・短い',      'explo', A+'/retro512_explosions/Shortest/sfx_exp_shortest_hard1.ogg'),
 ('exp_mid',     '爆発・中',        'explo', A+'/retro512_explosions/Medium Length/sfx_exp_medium1.ogg'),
 ('exp_long',    '爆発・長い',      'explo', A+'/retro512_explosions/Long/sfx_exp_long2.ogg'),
 ('exp_double',  '爆発・二段',      'explo', A+'/retro512_explosions/Double/sfx_exp_double1.ogg'),
 ('exp_cluster', '爆発・連鎖',      'explo', A+'/retro512_explosions/Clusters/sfx_exp_cluster2.ogg'),
 ('exp_odd',     '爆発・歪み',      'explo', A+'/retro512_explosions/Odd/sfx_exp_odd3.ogg'),
 ('exp_crunch',  '爆発・砕ける',    'explo', K+'/sci-fi-sounds/explosionCrunch_000.ogg'),
 ('exp_low',     '爆発・重低音',    'explo', K+'/sci-fi-sounds/lowFrequency_explosion_000.ogg'),
 ('exp_retro',   '爆発・レトロ',    'explo', A+'/retro2_explosions/Explosion 4 - Sound effects Pack 2.ogg'),

 # ── 斬撃 ──────────────────────────────────
 ('slash1',      '斬撃・鋭い',      'slash', A+'/sword_attacks/sword.1.ogg'),
 ('slash2',      '斬撃・重い',      'slash', A+'/sword_attacks/sword.5.ogg'),
 ('slash3',      '斬撃・細い',      'slash', A+'/sword_attacks/sword.8.ogg'),
 ('slash_wpn',   '斬撃・剣',        'slash', A+'/retro512_weapons/Melee/sfx_wpn_sword1.ogg'),
 ('slash_dagger','斬撃・短剣',      'slash', A+'/retro512_weapons/Melee/sfx_wpn_dagger.ogg'),
 ('slash_chop',  '斬撃・叩き斬る',  'slash', K+'/rpg-audio/chop.ogg'),

 # ── 金属・相殺 ────────────────────────────
 ('clash1',      '相殺・キィン',    'clash', A+'/sword_clashes/sword_clash.1.ogg'),
 ('clash2',      '相殺・重い',      'clash', A+'/sword_clashes/sword_clash.4.ogg'),
 ('clash3',      '相殺・高い',      'clash', A+'/sword_clashes/sword_clash.7.ogg'),
 ('metal_hit',   '金属衝突',        'clash', K+'/sci-fi-sounds/impactMetal_000.ogg'),
 ('shield',      'フォースフィールド','clash', K+'/sci-fi-sounds/forceField_003.ogg'),

 # ── 打撃・近接 ────────────────────────────
 ('punch1',      '殴打・軽い',      'melee', A+'/retro512_weapons/Melee/sfx_wpn_punch1.ogg'),
 ('punch2',      '殴打・重い',      'melee', A+'/retro512_weapons/Melee/sfx_wpn_punch3.ogg'),
 ('bat',         '打撃・鈍器',      'melee', A+'/rpg_melee_explosions/baseballbat.ogg'),
 ('impact1',     '衝撃・小',        'melee', A+'/retro512_impacts/sfx_sounds_impact1.ogg'),
 ('impact2',     '衝撃・大',        'melee', A+'/retro512_impacts/sfx_sounds_impact6.ogg'),

 # ── 被弾 ──────────────────────────────────
 ('hurt1',       '被弾・軽い',      'hurt', A+'/retro512_damage/sfx_damage_hit1.ogg'),
 ('hurt2',       '被弾・中',        'hurt', A+'/retro512_damage/sfx_damage_hit5.ogg'),
 ('hurt3',       '被弾・重い',      'hurt', A+'/retro512_damage/sfx_damage_hit9.ogg'),
 ('hurt_retro',  '被弾・レトロ',    'hurt', A+'/retro2_hits/Hit 3 - Sound effects Pack 2.ogg'),
 ('hurt_mon',    '被弾・怪物',      'hurt', A+'/monster_damage_death/monster-2.ogg'),

 # ── 断末魔・戦闘不能 ──────────────────────
 ('faint_mon',   '断末魔・怪物',    'faint', A+'/monster_damage_death/monster-8.ogg'),
 ('faint_alien', '断末魔・異形',    'faint', A+'/retro512_death/Alien/sfx_deathscream_alien1.ogg'),
 ('faint_robot', '断末魔・機械',    'faint', A+'/retro512_death/Robot/sfx_deathscream_robot1.ogg'),
 ('faint_android','断末魔・電子',   'faint', A+'/retro512_death/Android/sfx_deathscream_android1.ogg'),

 # ── 電子・強化・空間 ──────────────────────
 ('magic1',      '魔法・詠唱',      'magic', A+'/magic_attacks/magical_1.ogg'),
 ('magic2',      '魔法・展開',      'magic', A+'/magic_attacks/magical_4.ogg'),
 ('magic3',      '魔法・炸裂',      'magic', A+'/magic_attacks/magical_6.ogg'),
 ('zap1',        '電撃・短',        'magic', K+'/digital-audio/zap1.ogg'),
 ('zap2',        '電撃・長',        'magic', K+'/digital-audio/zapThreeToneDown.ogg'),
 ('powerup',     '強化・上昇',      'magic', K+'/digital-audio/powerUp4.ogg'),
 ('phase',       '空間・跳躍',      'magic', K+'/digital-audio/phaseJump1.ogg'),
 ('warp',        '空間・歪み',      'magic', K+'/digital-audio/lowRandom.ogg'),

 # ── UI・システム ──────────────────────────
 ('ui_click',    'UI・カチッ',      'ui', K+'/interface-sounds/click_001.ogg'),
 ('ui_click2',   'UI・コッ',        'ui', K+'/interface-sounds/click_004.ogg'),
 ('ui_select',   'UI・選択',        'ui', K+'/interface-sounds/select_002.ogg'),
 ('ui_confirm',  'UI・決定',        'ui', K+'/interface-sounds/confirmation_001.ogg'),
 ('ui_back',     'UI・戻る',        'ui', K+'/interface-sounds/back_001.ogg'),
 ('ui_open',     'UI・開く',        'ui', K+'/interface-sounds/open_004.ogg'),
 ('ui_close',    'UI・閉じる',      'ui', K+'/interface-sounds/close_003.ogg'),
 ('ui_switch',   'UI・切替',        'ui', K+'/interface-sounds/switch_004.ogg'),
 ('ui_error',    'UI・エラー',      'ui', K+'/interface-sounds/error_004.ogg'),
 ('ui_tick',     'UI・チッ',        'ui', K+'/interface-sounds/tick_002.ogg'),
 ('ui_pluck',    'UI・ポン',        'ui', K+'/interface-sounds/pluck_001.ogg'),
 ('ui_bong',     'UI・ボーン',      'ui', K+'/interface-sounds/bong_001.ogg'),
 ('ui_question', 'UI・問いかけ',    'ui', K+'/interface-sounds/question_002.ogg'),
 ('ui_maximize', 'UI・展開',        'ui', K+'/interface-sounds/maximize_003.ogg'),
 ('ui_minimize', 'UI・収納',        'ui', K+'/interface-sounds/minimize_003.ogg'),
 ('ui_scroll',   'UI・スクロール',  'ui', K+'/interface-sounds/scroll_003.ogg'),
 ('jingle_win',  'ジングル・勝利',  'ui', K+'/digital-audio/threeTone1.ogg'),
 ('jingle_lose', 'ジングル・敗北',  'ui', K+'/digital-audio/lowThreeTone.ogg'),
 ('jingle_up',   'ジングル・上昇',  'ui', K+'/digital-audio/phaserUp1.ogg'),
 ('jingle_down', 'ジングル・下降',  'ui', K+'/digital-audio/phaserDown1.ogg'),
]

CATS = [
 ('shot',  '発射・弾'),
 ('beam',  '光線'),
 ('heavy', '大砲・重火力'),
 ('explo', '爆発・着弾'),
 ('slash', '斬撃'),
 ('clash', '金属・相殺'),
 ('melee', '打撃・近接'),
 ('hurt',  '被弾'),
 ('faint', '断末魔'),
 ('magic', '魔法・電撃・空間'),
 ('ui',    'UI・システム'),
]

def mime(p):
    e = p.rsplit('.',1)[-1].lower()
    return {'ogg':'audio/ogg','wav':'audio/wav','mp3':'audio/mpeg'}.get(e,'audio/ogg')

import subprocess, tempfile
TMP = tempfile.mkdtemp()
def shrink(path, sid):
    """モノラル22kHz・低ビットレートのOgg Vorbisへ再圧縮（容量削減）"""
    out = os.path.join(TMP, sid + '.ogg')
    r = subprocess.run(['ffmpeg','-y','-loglevel','error','-i',path,
                        '-ac','1','-ar','22050','-c:a','libvorbis','-q:a','0', out],
                       capture_output=True)
    if r.returncode != 0 or not os.path.exists(out):
        return path
    # 元より大きくなったら元を使う
    if os.path.getsize(out) >= os.path.getsize(path):
        return path
    return out

ok, ng, total = [], [], 0
for sid, label, cat, path in PICKS:
    if not os.path.exists(path):
        ng.append((sid, path)); continue
    raw = open(shrink(path, sid),'rb').read()
    b64 = base64.b64encode(raw).decode('ascii')
    total += len(b64)
    ok.append((sid, label, cat, 'data:%s;base64,%s' % (mime(path), b64), os.path.relpath(path, ROOT)))

print('採用: %d / 失敗: %d / base64合計: %.0f KB' % (len(ok), len(ng), total/1024))
for sid, p in ng: print('  ✗', sid, p)

out = []
out.append('/* ===== sfx_bank.js — CC0効果音バンク（自動生成・編集しないで） ===== */')
out.append('const SFX_CATS = %s;' % json.dumps([{'id':c,'label':l} for c,l in CATS], ensure_ascii=False))
out.append('const SFX_SRC = {')
for sid, label, cat, uri, rel in ok:
    out.append('  %s:{label:%s,cat:%s,src:%s,data:"%s"},' % (
        json.dumps(sid), json.dumps(label, ensure_ascii=False),
        json.dumps(cat), json.dumps(rel, ensure_ascii=False), uri))
out.append('};')
out.append(r'''
const CREDITS = {
  title: '効果音クレジット',
  note : 'すべて CC0（パブリックドメイン）。HTMLへ直接焼き込んどる。',
  authors: [
    'Juhani Junkala — Retro Game Weapons / Explosions / Impacts / Death Screams',
    'Kenney (kenney.nl) — Interface, UI, Digital, Sci-Fi, Impact, RPG Audio',
    'Michel Baradari (apollo-music.de) — RPG Melee / Magic',
    'p0ss / rubberduck / Little Robot Sound Factory ほか OpenGameArt CC0 提供者',
  ],
  source: '出典: OpenGameArt.org / kenney.nl（CC0 1.0 Universal）',
};

/* ---- SoundBank: data URI を AudioContext にデコードして鳴らす ---- */
class SoundBank{
  constructor(){ this.ctx=null; this.buf={}; this.custom={}; this.master=0.55; this.ready=false; this.loading=null; }
  ensure(){
    if(this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.gain = this.ctx.createGain(); this.gain.gain.value = this.master;
    this.gain.connect(this.ctx.destination);
    return this.ctx;
  }
  async load(onProgress){
    if(this.loading) return this.loading;
    this.loading = (async()=>{
      const ctx = this.ensure();
      const ids = Object.keys(SFX_SRC).concat(Object.keys(this.custom));
      let n=0;
      for(const id of ids){
        try{
          const uri = (SFX_SRC[id]||this.custom[id]).data;
          const bin = atob(uri.split(',')[1]);
          const ab = new ArrayBuffer(bin.length); const u8 = new Uint8Array(ab);
          for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
          this.buf[id] = await ctx.decodeAudioData(ab);
          n++;
        }catch(e){ console.warn('[SND] decode失敗', id, e); }
        if(onProgress) onProgress(n, ids.length);
      }
      this.ready = true;
      return n;
    })();
    return this.loading;
  }
  addCustom(id, label, dataURI){
    this.custom[id] = {label:label||id, cat:'custom', src:'ユーザー追加', data:dataURI};
    this.buf[id] = null;
    return this.decodeOne(id);
  }
  async decodeOne(id){
    const ctx = this.ensure();
    const uri = (SFX_SRC[id]||this.custom[id]).data;
    const bin = atob(uri.split(',')[1]);
    const ab = new ArrayBuffer(bin.length); const u8 = new Uint8Array(ab);
    for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    this.buf[id] = await ctx.decodeAudioData(ab);
    return this.buf[id];
  }
  meta(id){ return SFX_SRC[id] || this.custom[id] || null; }
  list(cat){ const o=[]; for(const id in SFX_SRC) if(!cat||SFX_SRC[id].cat===cat) o.push(id);
             for(const id in this.custom) if(!cat||cat==='custom') o.push(id); return o; }
  setMaster(v){ this.master=v; if(this.gain) this.gain.gain.value=v; }
  setVol(v){ this.setMaster(v); }                 /* 旧API互換 */
  resume(){ this.ensure(); if(this.ctx.state==='suspended') this.ctx.resume();
            if(!this.loading) this.load(); return this.loading; }
  play(id,opt){
    opt = opt||{};
    if(!this.ctx || !this.buf[id]) return false;
    if(this.ctx.state==='suspended') this.ctx.resume();
    const s = this.ctx.createBufferSource(); s.buffer = this.buf[id];
    s.playbackRate.value = opt.rate==null?1:opt.rate;
    const g = this.ctx.createGain(); g.gain.value = opt.vol==null?1:opt.vol;
    s.connect(g); g.connect(this.gain);
    s.start(0, opt.from||0);
    return true;
  }
}
const SND = new SoundBank();

/* ---- 音の割り当て設定（鴨川が全部決める層） ---- */
const MOVE_PHASES = [
  {id:'cast',   label:'構え（技を出した瞬間）'},
  {id:'fire',   label:'発射・振り抜き'},
  {id:'impact', label:'着弾・命中'},
];
const SYS_EVENTS = [
  {id:'ui_tab',    label:'タブを押した'},
  {id:'ui_pick',   label:'作戦を決めた'},
  {id:'ui_order',  label:'指示を出した'},
  {id:'ui_swap',   label:'交代した'},
  {id:'ui_drawer', label:'指示画面を開く'},
  {id:'q_start',   label:'クォーター開始'},
  {id:'q_end',     label:'クォーター終了'},
  {id:'hurt',      label:'被弾'},
  {id:'flinch',    label:'ひるみ'},
  {id:'faint',     label:'戦闘不能'},
  {id:'dodge',     label:'回避成功'},
  {id:'clash',     label:'相殺'},
  {id:'pierce',    label:'貫通'},
  {id:'win',       label:'勝利'},
  {id:'lose',      label:'敗北'},
];
/* moves: { 技ID: [ {id,at,off,vol,rate}, ... ] }  system: { イベントID: {id,off,vol,rate} }
   ↓ これはあくまで「初期値」。音ラボで上書きすれば全部そっちが勝つ。 */
const AUDIO_CFG_DEFAULT = {
  master: 0.55,
  moves: {
    shakunetsu: [ {id:'magic1',   at:'cast',   off:0,    vol:0.7, rate:1.1},
                  {id:'shot_mid', at:'fire',   off:0,    vol:0.9, rate:1.0},
                  {id:'exp_short',at:'impact', off:0,    vol:0.9, rate:1.0} ],
    suidan:     [ {id:'shot_pop', at:'fire',   off:0,    vol:0.9, rate:0.9},
                  {id:'exp_crunch',at:'impact',off:0,    vol:0.8, rate:1.1} ],
    beam:       [ {id:'beam_charge',at:'cast', off:0,    vol:0.8, rate:1.0},
                  {id:'laser_large',at:'fire', off:0,    vol:0.9, rate:1.0},
                  {id:'exp_mid',  at:'impact', off:0,    vol:0.9, rate:1.0} ],
    slash:      [ {id:'slash1',   at:'fire',   off:0,    vol:1.0, rate:1.0},
                  {id:'impact1',  at:'impact', off:0,    vol:0.9, rate:1.0} ],
    bolt:       [ {id:'zap1',     at:'cast',   off:0,    vol:0.7, rate:1.0},
                  {id:'zap2',     at:'fire',   off:0,    vol:0.9, rate:0.9},
                  {id:'exp_low',  at:'impact', off:0,    vol:0.9, rate:1.0} ],
    akuu:       [ {id:'warp',     at:'cast',   off:0,    vol:0.8, rate:0.8},
                  {id:'slash2',   at:'fire',   off:0,    vol:1.0, rate:0.85},
                  {id:'laser_sharp',at:'fire', off:0.06, vol:0.6, rate:0.7},
                  {id:'clash1',   at:'impact', off:0,    vol:0.9, rate:1.3},
                  {id:'exp_crunch',at:'impact',off:0.10, vol:0.7, rate:0.9} ],
  },
  system: {
    ui_tab:{id:'ui_click',vol:0.8}, ui_pick:{id:'ui_select',vol:0.9},
    ui_order:{id:'ui_confirm',vol:0.9}, ui_swap:{id:'ui_switch',vol:0.9},
    ui_drawer:{id:'ui_open',vol:0.7},
    q_start:{id:'jingle_up',vol:0.9}, q_end:{id:'jingle_down',vol:0.9},
    hurt:{id:'hurt2',vol:0.9}, flinch:{id:'hurt1',vol:0.9},
    faint:{id:'faint_mon',vol:1.0}, dodge:{id:'shot_air',vol:0.7,rate:1.2},
    clash:{id:'clash1',vol:1.0}, pierce:{id:'metal_hit',vol:0.9},
    win:{id:'jingle_win',vol:1.0}, lose:{id:'jingle_lose',vol:1.0},
  },
};
const AUDIO_CFG = JSON.parse(JSON.stringify(AUDIO_CFG_DEFAULT));

function audioApply(cfg){
  if(!cfg) return;
  if(cfg.moves)  AUDIO_CFG.moves  = cfg.moves;
  if(cfg.system) AUDIO_CFG.system = cfg.system;
  if(cfg.master!=null){ AUDIO_CFG.master = cfg.master; SND.setMaster(cfg.master); }
}
function playAt(e, speed){
  if(!e || !e.id) return;
  const d = (e.off||0)*1000/(speed||1);
  if(d<=1) SND.play(e.id,{vol:e.vol,rate:e.rate});
  else setTimeout(()=>SND.play(e.id,{vol:e.vol,rate:e.rate}), d);
}
function playMovePhase(moveId, phase, speed){
  const list = AUDIO_CFG.moves[moveId];
  if(!list) return;
  for(const e of list) if(e.at===phase) playAt(e, speed);
}
function playSys(ev){
  const e = AUDIO_CFG.system[ev];
  if(e) playAt(typeof e==='string' ? {id:e} : e, 1);
}
/* localStorage に保存された音設定を自動で読む（音ラボと共有） */
const AUDIO_CFG_KEY = 'shioumon_audio_cfg_v1';
function audioLoadSaved(){
  try{ const s = localStorage.getItem(AUDIO_CFG_KEY);
       if(s){ audioApply(JSON.parse(s)); return true; } }catch(e){}
  return false;
}
function audioSave(cfg){
  try{ localStorage.setItem(AUDIO_CFG_KEY, JSON.stringify(cfg||AUDIO_CFG)); return true; }
  catch(e){ return false; }
}
''')
open(os.path.join(REPO,'src','sfx_bank.js'),'w').write('\n'.join(out))
print('書き出し: src/sfx_bank.js  %.0f KB' % (os.path.getsize(os.path.join(REPO,'src','sfx_bank.js'))/1024))
