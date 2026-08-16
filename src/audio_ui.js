/* =========================================================
   audio_ui.js — 音の割り当てUI（音ラボ・技ラボで共用）
   ・SoundPicker … カテゴリ別の音選び（試聴つき）
   ・renderTimeline … 技ごとの音タイムライン（構え/発射/着弾 + オフセット秒）
   ・renderSysMap … システムイベント → 音
   前提: sfx_bank.js（SFX_SRC / SFX_CATS / SND / AUDIO_CFG / MOVE_PHASES / SYS_EVENTS）
   ========================================================= */

const AUDIO_UI_CSS = `
.aui-card{background:#141922;border:1px solid #2c3442;border-radius:5px;padding:8px 9px;margin-bottom:7px;}
.aui-card.play{border-color:#63d6c4;}
.aui-top{display:flex;gap:5px;align-items:center;margin-bottom:6px;}
.aui-name{flex:1;min-width:0;background:#0c0f15;border:1px solid #2c3442;border-radius:3px;
  color:#dfe6f0;padding:8px 7px;font-size:11px;font-family:inherit;text-align:left;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.aui-ph{flex:none;background:#0c0f15;border:1px solid #2c3442;border-radius:3px;color:#f0a020;
  padding:8px 4px;font-size:11px;font-family:inherit;}
.aui-x{flex:none;width:30px;background:#2a1a1a;border:1px solid #5a2a2a;border-radius:3px;
  color:#e08080;font-size:12px;padding:8px 0;font-family:inherit;}
.aui-p{flex:none;width:34px;background:#1d5a52;border:1px solid #2c8a7c;border-radius:3px;
  color:#d0f5ee;font-size:12px;padding:8px 0;font-family:inherit;}
.aui-row{display:flex;align-items:center;gap:7px;margin-top:4px;}
.aui-row label{font-size:10px;color:#8b97a8;width:62px;flex:none;}
.aui-row input[type=range]{flex:1;min-width:40px;accent-color:#63d6c4;}
.aui-row .v{font-size:10px;color:#63d6c4;width:52px;text-align:right;flex:none;}
.aui-add{width:100%;background:#1e2836;border:1px dashed #3d4a5c;border-radius:4px;color:#8fb4d8;
  padding:10px;font-size:11px;font-family:inherit;}
.aui-empty{font-size:10px;color:#66707f;padding:10px 2px;line-height:1.7;}
.aui-ov{position:fixed;inset:0;background:#0b0e14;z-index:9999;display:flex;
  flex-direction:column;padding:10px;font-family:inherit;}
.aui-ov h3{font-size:12px;color:#63d6c4;margin:2px 0 8px;letter-spacing:1px;}
.aui-cats{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;}
.aui-cats button{background:#252d3a;border:1px solid #2c3442;border-radius:3px;color:#dfe6f0;
  padding:7px 8px;font-size:10px;font-family:inherit;}
.aui-cats button.on{background:#63d6c4;color:#0f1218;border-color:#63d6c4;}
.aui-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;}
.aui-item{display:flex;align-items:center;gap:6px;background:#141922;border:1px solid #2c3442;
  border-radius:4px;padding:9px;margin-bottom:5px;}
.aui-item.on{border-color:#f0a020;background:#1d1a12;}
.aui-item .t{flex:1;min-width:0;font-size:11px;color:#dfe6f0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;}
.aui-item .s{font-size:9px;color:#66707f;}
.aui-item button{flex:none;background:#1d5a52;border:1px solid #2c8a7c;border-radius:3px;
  color:#d0f5ee;font-size:11px;padding:7px 10px;font-family:inherit;}
.aui-ovbar{display:flex;gap:6px;margin-top:8px;}
.aui-ovbar button{flex:1;background:#252d3a;border:1px solid #2c3442;border-radius:3px;color:#dfe6f0;
  padding:11px;font-size:12px;font-family:inherit;}
.aui-ovbar button.go{background:#1d5a52;border-color:#2c8a7c;color:#d0f5ee;}
.aui-sys{display:flex;align-items:center;gap:5px;margin-bottom:5px;}
.aui-sys .lb{width:104px;flex:none;font-size:10px;color:#8b97a8;}
`;

function auiInjectCSS(){
  if(document.getElementById('aui-css')) return;
  const s=document.createElement('style'); s.id='aui-css'; s.textContent=AUDIO_UI_CSS;
  document.head.appendChild(s);
}

function auiLabel(id){
  const m = SND.meta(id);
  return m ? m.label : (id||'（音なし）');
}

/* ---------- 音選びオーバーレイ ---------- */
const SoundPicker = {
  open(currentId, onPick){
    auiInjectCSS(); SND.resume();
    const ov=document.createElement('div'); ov.className='aui-ov';
    ov.innerHTML='<h3>■ 音をえらぶ（タップで試聴）</h3><div class="aui-cats"></div>'+
                 '<div class="aui-list"></div>'+
                 '<div class="aui-ovbar"><button data-a="none">音なしにする</button>'+
                 '<button data-a="close" class="go">とじる</button></div>';
    document.body.appendChild(ov);
    const cats=ov.querySelector('.aui-cats'), list=ov.querySelector('.aui-list');
    const allCats=SFX_CATS.concat(Object.keys(SND.custom).length?[{id:'custom',label:'自前の音'}]:[]);
    let cur = (SND.meta(currentId)||{}).cat || allCats[0].id;
    function drawList(){
      list.innerHTML='';
      for(const id of SND.list(cur)){
        const m=SND.meta(id);
        const d=document.createElement('div');
        d.className='aui-item'+(id===currentId?' on':'');
        d.innerHTML='<div class="t">'+m.label+'<div class="s">'+id+'</div></div>'+
                    '<button>えらぶ</button>';
        d.onclick=e=>{
          if(e.target.tagName==='BUTTON'){ onPick(id); document.body.removeChild(ov); return; }
          SND.play(id);
        };
        list.appendChild(d);
      }
    }
    function drawCats(){
      cats.innerHTML='';
      for(const c of allCats){
        const b=document.createElement('button'); b.textContent=c.label;
        b.classList.toggle('on', c.id===cur);
        b.onclick=()=>{ cur=c.id; drawCats(); drawList(); };
        cats.appendChild(b);
      }
    }
    ov.querySelector('[data-a="none"]').onclick=()=>{ onPick(null); document.body.removeChild(ov); };
    ov.querySelector('[data-a="close"]').onclick=()=>document.body.removeChild(ov);
    drawCats(); drawList();
  }
};

/* ---------- 技の音タイムライン ---------- */
/* host: 描画先 / list: エントリ配列（直接書き換える）/ onChange: 変更通知 */
function renderTimeline(host, list, onChange){
  auiInjectCSS();
  host.innerHTML='';
  if(!list.length){
    const e=document.createElement('div'); e.className='aui-empty';
    e.textContent='まだ音ば入れとらん。下の「＋音を追加」で好きなタイミングに置ける。';
    host.appendChild(e);
  }
  list.forEach((en,i)=>{
    const c=document.createElement('div'); c.className='aui-card';
    const phOpts=MOVE_PHASES.map(p=>'<option value="'+p.id+'">'+p.label+'</option>').join('');
    c.innerHTML=
      '<div class="aui-top">'+
        '<button class="aui-name"></button>'+
        '<button class="aui-p">▶</button>'+
        '<button class="aui-x">×</button>'+
      '</div>'+
      '<div class="aui-row"><label>タイミング</label>'+
        '<select style="flex:1;background:#0c0f15;border:1px solid #2c3442;color:#dfe6f0;'+
        'border-radius:3px;padding:7px;font-size:11px;font-family:inherit;min-width:0;">'+phOpts+'</select></div>'+
      '<div class="aui-row"><label>ずらす</label>'+
        '<input type="range" data-k="off" min="0" max="1.5" step="0.01"><span class="v"></span></div>'+
      '<div class="aui-row"><label>音量</label>'+
        '<input type="range" data-k="vol" min="0" max="1.5" step="0.05"><span class="v"></span></div>'+
      '<div class="aui-row"><label>高さ</label>'+
        '<input type="range" data-k="rate" min="0.4" max="2" step="0.05"><span class="v"></span></div>';
    const nameBtn=c.querySelector('.aui-name'), sel=c.querySelector('select');
    const show=()=>{
      nameBtn.textContent=auiLabel(en.id);
      sel.value=en.at||'fire';
      c.querySelectorAll('input[type=range]').forEach(r=>{
        const k=r.dataset.k;
        const dv = k==='off'?0 : (k==='vol'?1:1);
        const v = en[k]==null?dv:en[k];
        r.value=v;
        r.nextElementSibling.textContent =
          k==='off'  ? '+'+(+v).toFixed(2)+'秒' :
          k==='vol'  ? Math.round(v*100)+'%' :
                       '×'+(+v).toFixed(2);
      });
    };
    nameBtn.onclick=()=>SoundPicker.open(en.id, id=>{
      if(id===null){ list.splice(i,1); } else { en.id=id; SND.play(id,{vol:en.vol,rate:en.rate}); }
      renderTimeline(host,list,onChange); onChange&&onChange();
    });
    c.querySelector('.aui-p').onclick=()=>{ SND.resume(); SND.play(en.id,{vol:en.vol,rate:en.rate}); };
    c.querySelector('.aui-x').onclick=()=>{ list.splice(i,1);
      renderTimeline(host,list,onChange); onChange&&onChange(); };
    sel.onchange=()=>{ en.at=sel.value; onChange&&onChange(); };
    c.querySelectorAll('input[type=range]').forEach(r=>{
      r.oninput=()=>{ en[r.dataset.k]=parseFloat(r.value); show(); onChange&&onChange(); };
    });
    show();
    host.appendChild(c);
  });
  const add=document.createElement('button'); add.className='aui-add'; add.textContent='＋ 音を追加';
  add.onclick=()=>SoundPicker.open(null, id=>{
    if(!id) return;
    list.push({id, at:'fire', off:0, vol:1, rate:1});
    SND.play(id);
    renderTimeline(host,list,onChange); onChange&&onChange();
  });
  host.appendChild(add);
}

/* ---------- システムイベント → 音 ---------- */
function renderSysMap(host, sysObj, onChange){
  auiInjectCSS();
  host.innerHTML='';
  for(const ev of SYS_EVENTS){
    const d=document.createElement('div'); d.className='aui-sys';
    d.innerHTML='<div class="lb">'+ev.label+'</div>'+
      '<button class="aui-name" style="flex:1"></button>'+
      '<button class="aui-p">▶</button>';
    const btn=d.querySelector('.aui-name');
    const cur=()=>{ const e=sysObj[ev.id]; return typeof e==='string'?{id:e}:(e||{}); };
    const show=()=>{ const e=cur();
      btn.textContent=e.id?auiLabel(e.id):'— 音なし —';
      btn.style.color=e.id?'#dfe6f0':'#66707f'; };
    btn.onclick=()=>SoundPicker.open(cur().id, id=>{
      if(id===null) delete sysObj[ev.id];
      else { sysObj[ev.id]={id, off:cur().off||0, vol:cur().vol==null?1:cur().vol,
                            rate:cur().rate==null?1:cur().rate};
             SND.play(id); }
      show(); onChange&&onChange();
    });
    d.querySelector('.aui-p').onclick=()=>{ SND.resume(); const e=cur();
      if(e.id) SND.play(e.id,{vol:e.vol,rate:e.rate}); };
    show(); host.appendChild(d);
  }
}
