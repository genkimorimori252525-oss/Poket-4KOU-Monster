/* =========================================================
   専用技で既存の attack / charge / jump では表現できない本体の動き。
   各キー列は対象技のために新しく作り、既存ANIMSの配列を複製しない。
   ========================================================= */
Object.assign(ANIMS,{
  seed_machine_gun_burst:{dur:.82,keys:[
    K({t:0,sx:1,sy:1,dx:0,dy:0}),K({t:.08,sx:1.24,sy:.78,dx:-8,dy:3}),
    K({t:.17,sx:.82,sy:1.20,dx:14,dy:-2,ghost:.3}),K({t:.26,sx:1.16,sy:.86,dx:5,dy:1}),
    K({t:.35,sx:.84,sy:1.17,dx:16,dy:-1}),K({t:.44,sx:1.14,sy:.88,dx:6,dy:1}),
    K({t:.53,sx:.86,sy:1.14,dx:15,dy:-1}),K({t:.67,sx:1.08,sy:.94,dx:5}),
    K({t:.82,sx:.96,sy:1.04,dx:2}),K({t:1,sx:1,sy:1,dx:0})
  ],img:[[0,'normal'],[.08,'attack'],[.76,'normal']]},

  focus_blast_charge:{dur:1.10,keys:[
    K({t:0,sx:1,sy:1,dx:0,dy:0}),K({t:.12,sx:1.17,sy:.84,dx:-8,dy:4}),
    K({t:.28,sx:1.28,sy:.76,dx:-12,dy:7,flash:.12}),K({t:.45,sx:1.19,sy:.83,dx:-8,dy:1,rot:-.05}),
    K({t:.61,sx:.74,sy:1.30,dx:21,dy:-5,flash:.55}),K({t:.72,sx:1.10,sy:.92,dx:13,dy:0}),
    K({t:.86,sx:.95,sy:1.06,dx:3,dy:-1}),K({t:1,sx:1,sy:1,dx:0,dy:0})
  ],img:[[0,'normal'],[.20,'attack'],[.78,'normal']]},

  quick_attack_dash:{dur:.48,keys:[
    K({t:0,sx:1,sy:1,dx:0}),K({t:.09,sx:1.34,sy:.68,dx:-10}),
    K({t:.19,sx:1.52,sy:.60,dx:48,ghost:1,rot:-.08}),K({t:.34,sx:1.60,sy:.58,dx:112,ghost:1,rot:-.05}),
    K({t:.52,sx:1.43,sy:.66,dx:154,ghost:1}),K({t:.68,sx:.86,sy:1.15,dx:82,ghost:.6}),
    K({t:.84,sx:1.10,sy:.91,dx:22}),K({t:1,sx:1,sy:1,dx:0})
  ],img:[[0,'normal'],[.08,'attack'],[.78,'normal']]},

  aqua_jet_rush:{dur:.62,keys:[
    K({t:0,sx:1,sy:1,dx:0,dy:0}),K({t:.10,sx:1.22,sy:.76,dx:-8,dy:5}),
    K({t:.22,sx:1.46,sy:.62,dx:36,dy:-12,ghost:1,rot:-.12}),K({t:.40,sx:1.55,sy:.58,dx:96,dy:-22,ghost:1,rot:-.08}),
    K({t:.58,sx:1.45,sy:.64,dx:142,dy:-10,ghost:1}),K({t:.73,sx:.82,sy:1.18,dx:84,dy:1}),
    K({t:.88,sx:1.10,sy:.91,dx:24,dy:-2}),K({t:1,sx:1,sy:1,dx:0,dy:0})
  ],img:[[0,'normal'],[.10,'attack'],[.82,'normal']]},

  drill_run_spin:{dur:.74,keys:[
    K({t:0,sx:1,sy:1,dx:0,rot:0}),K({t:.09,sx:1.25,sy:.77,dx:-8,rot:.12}),
    K({t:.20,sx:1.38,sy:.68,dx:24,rot:-.42,ghost:.6}),K({t:.34,sx:1.42,sy:.64,dx:58,rot:.55,ghost:1}),
    K({t:.48,sx:1.40,sy:.66,dx:94,rot:-.62,ghost:1}),K({t:.62,sx:1.36,sy:.70,dx:126,rot:.48,ghost:.8}),
    K({t:.75,sx:.86,sy:1.15,dx:82,rot:-.18}),K({t:.89,sx:1.08,sy:.92,dx:24,rot:.06}),
    K({t:1,sx:1,sy:1,dx:0,rot:0})
  ],img:[[0,'normal'],[.08,'attack'],[.84,'normal']]},

  brave_bird_dive:{dur:1.02,keys:[
    K({t:0,sx:1,sy:1,dx:0,dy:0}),K({t:.07,sx:1.30,sy:.70,dx:-7,dy:6}),
    K({t:.17,sx:.70,sy:1.36,dx:18,dy:-58,ghost:1,rot:-.18}),K({t:.30,sx:.84,sy:1.20,dx:48,dy:-112,ghost:1,rot:-.28}),
    K({t:.43,sx:1.06,sy:.93,dx:84,dy:-126,rot:-.36}),K({t:.56,sx:1.38,sy:.66,dx:124,dy:-82,ghost:1,rot:.18}),
    K({t:.68,sx:1.55,sy:.57,dx:158,dy:-24,ghost:1,rot:.32}),K({t:.77,sx:1.34,sy:.72,dx:146,dy:4,flash:.28}),
    K({t:.88,sx:.88,sy:1.14,dx:62,dy:-7}),K({t:1,sx:1,sy:1,dx:0,dy:0})
  ],img:[[0,'normal'],[.07,'attack'],[.83,'normal']]},

  aerial_ace_turn:{dur:.88,keys:[
    K({t:0,sx:1,sy:1,dx:0,dy:0,rot:0}),K({t:.09,sx:1.25,sy:.76,dx:-8,dy:4}),
    K({t:.21,sx:1.42,sy:.64,dx:66,dy:-42,rot:-.28,ghost:1}),K({t:.36,sx:1.38,sy:.68,dx:150,dy:-74,rot:-.46,ghost:1}),
    K({t:.48,sx:.92,sy:1.08,dx:168,dy:-50,rot:-1.05}),K({t:.60,sx:1.34,sy:.70,dx:92,dy:-18,rot:-1.90,ghost:1}),
    K({t:.73,sx:1.44,sy:.64,dx:32,dy:-6,rot:-2.70,ghost:1}),K({t:.84,sx:.88,sy:1.13,dx:-8,dy:-2,rot:-3.12}),
    K({t:.93,sx:1.08,sy:.93,dx:-3,dy:0,rot:-.20}),K({t:1,sx:1,sy:1,dx:0,dy:0,rot:0})
  ],img:[[0,'normal'],[.08,'attack'],[.90,'normal']]},

  thunder_punch_drive:{dur:.78,keys:[
    K({t:0,sx:1,sy:1,dx:0,dy:0}),K({t:.12,sx:1.28,sy:.72,dx:-12,dy:6,rot:.08}),
    K({t:.25,sx:.80,sy:1.22,dx:34,dy:-7,flash:.25}),K({t:.36,sx:.66,sy:1.34,dx:78,dy:-3,ghost:1,flash:.65}),
    K({t:.45,sx:.74,sy:1.28,dx:116,dy:1,flash:1}),K({t:.56,sx:1.20,sy:.80,dx:94,dy:3}),
    K({t:.72,sx:.92,sy:1.09,dx:48,dy:-2}),K({t:.87,sx:1.07,sy:.94,dx:14}),K({t:1,sx:1,sy:1,dx:0})
  ],img:[[0,'normal'],[.11,'attack'],[.82,'normal']]},

  outrage_rampage:{dur:1.24,keys:[
    K({t:0,sx:1,sy:1,dx:0,dy:0,rot:0}),K({t:.08,sx:1.28,sy:.72,dx:-10,dy:5,flash:.15}),
    K({t:.17,sx:.74,sy:1.28,dx:52,dy:-14,rot:-.18,ghost:1}),K({t:.27,sx:1.30,sy:.70,dx:92,dy:3,rot:.22}),
    K({t:.37,sx:.72,sy:1.30,dx:126,dy:-10,rot:-.30,ghost:1}),K({t:.47,sx:1.34,sy:.68,dx:84,dy:5,rot:.34}),
    K({t:.58,sx:.70,sy:1.32,dx:142,dy:-16,rot:-.38,ghost:1}),K({t:.68,sx:1.32,sy:.70,dx:110,dy:4,rot:.28,flash:.35}),
    K({t:.78,sx:.76,sy:1.24,dx:54,dy:-8,rot:-.20}),K({t:.88,sx:1.18,sy:.84,dx:20,dy:3}),
    K({t:1,sx:1,sy:1,dx:0,dy:0,rot:0})
  ],img:[[0,'normal'],[.07,'attack'],[.90,'normal']]},

  hyper_beam_fire:{dur:1.72,keys:[
    K({t:0,sx:1,sy:1,dx:0,dy:0}),K({t:.10,sx:1.18,sy:.83,dx:-7,dy:3}),
    K({t:.22,sx:1.30,sy:.72,dx:-12,dy:6,flash:.20}),K({t:.34,sx:.70,sy:1.34,dx:24,dy:-4,flash:.85}),
    K({t:.52,sx:.76,sy:1.27,dx:30,dy:-3,flash:.32}),K({t:.68,sx:.80,sy:1.22,dx:27,dy:-2}),
    K({t:.79,sx:1.36,sy:.68,dx:-18,dy:7,rot:.10}),K({t:.88,sx:.90,sy:1.10,dx:-10,dy:-3,rot:-.05}),
    K({t:1,sx:1,sy:1,dx:0,dy:0})
  ],img:[[0,'normal'],[.18,'attack'],[.78,'hurt'],[.93,'normal']]},

  dragon_dance_move:{dur:1.55,keys:[
    K({t:0,sx:1,sy:1,dx:0,dy:0,rot:0}),K({t:.12,sx:.94,sy:1.07,dx:-10,dy:-5,rot:-.15}),
    K({t:.25,sx:1.08,sy:.94,dx:14,dy:-16,rot:.22}),K({t:.38,sx:.92,sy:1.08,dx:22,dy:-5,rot:.38,ghost:.3}),
    K({t:.51,sx:1.10,sy:.92,dx:2,dy:2,rot:.08}),K({t:.64,sx:.93,sy:1.07,dx:-20,dy:-8,rot:-.34,ghost:.3}),
    K({t:.77,sx:1.09,sy:.93,dx:-12,dy:-18,rot:-.18}),K({t:.88,sx:.96,sy:1.04,dx:6,dy:-6,rot:.12}),
    K({t:1,sx:1,sy:1,dx:0,dy:0,rot:0})
  ],img:[[0,'normal'],[.18,'attack'],[.88,'normal']]},

  saito_butt_hide_move:{dur:1.40,keys:[
    K({t:0,sx:1,sy:1,dx:0,dy:0,rot:0}),K({t:.10,sx:1.10,sy:.90,dx:-4,dy:5}),
    K({t:.22,sx:.86,sy:1.16,dx:10,dy:12,rot:.06}),K({t:.36,sx:1.05,sy:.93,dx:16,dy:6,rot:.10}),
    K({t:.50,sx:.90,sy:1.10,dx:14,dy:9,rot:.08,ghost:.2}),K({t:.66,sx:.95,sy:1.05,dx:8,dy:4,rot:.04}),
    K({t:.80,sx:1.02,sy:.98,dx:2,dy:1}),K({t:1,sx:1,sy:1,dx:0,dy:0,rot:0})
  ],img:[[0,'normal'],[.16,'attack'],[.86,'normal']]},

  earthquake_stomp:{dur:1.58,keys:[
    K({t:0,sx:1,sy:1,dx:0,dy:0}),K({t:.12,sx:1.34,sy:.68,dy:8}),
    K({t:.24,sx:.76,sy:1.30,dy:-52,ghost:.4}),K({t:.40,sx:.94,sy:1.08,dy:-72}),
    K({t:.52,sx:1.18,sy:.82,dy:-32}),K({t:.60,sx:1.58,sy:.48,dy:9,flash:.60}),
    K({t:.68,sx:.82,sy:1.20,dy:-13}),K({t:.76,sx:1.28,sy:.72,dy:5}),
    K({t:.86,sx:.91,sy:1.10,dy:-5}),K({t:1,sx:1,sy:1,dy:0})
  ],img:[[0,'normal'],[.10,'attack'],[.78,'normal']]},

  bombing_flight:{dur:4.55,keys:[
    K({t:0,sx:1,sy:1,dx:0,dy:0,rot:0}),K({t:.035,sx:1.30,sy:.70,dx:-8,dy:7}),
    K({t:.09,sx:.72,sy:1.34,dx:28,dy:-72,rot:-.16,ghost:1}),
    K({t:.16,sx:.82,sy:1.18,dx:104,dy:-132,rot:-.30,ghost:1}),
    K({t:.24,sx:.92,sy:1.08,dx:178,dy:-112,rot:.10,ghost:.6}),
    K({t:.32,sx:1.02,sy:.98,dx:148,dy:-42,rot:.44}),
    K({t:.40,sx:.94,sy:1.06,dx:62,dy:-76,rot:.18,ghost:.5}),
    K({t:.48,sx:.86,sy:1.14,dx:-62,dy:-138,rot:-.24,ghost:1}),
    K({t:.56,sx:.96,sy:1.04,dx:-118,dy:-72,rot:-.48}),
    K({t:.64,sx:1.04,sy:.96,dx:-42,dy:-26,rot:-.10,ghost:.4}),
    K({t:.72,sx:.84,sy:1.16,dx:74,dy:-116,rot:.26,ghost:1}),
    K({t:.80,sx:.92,sy:1.08,dx:164,dy:-76,rot:.50}),
    K({t:.87,sx:1.08,sy:.92,dx:106,dy:-18,rot:.14,ghost:.4}),
    K({t:.93,sx:.78,sy:1.24,dx:38,dy:-60,rot:-.18}),
    K({t:.97,sx:1.32,sy:.68,dx:14,dy:4,rot:.06,flash:.25}),
    K({t:1,sx:1,sy:1,dx:0,dy:0,rot:0})
  ],img:[[0,'normal'],[.03,'attack'],[.94,'normal']]}
});
