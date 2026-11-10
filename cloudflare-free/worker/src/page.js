import { MARKUP } from "./ui/markup.js";
import { STYLES } from "./ui/styles.js";
import { CORE } from "./ui/client-core.js";
import { DATA } from "./ui/client-data.js";
import { VIEWS } from "./ui/client-views.js";
import { CREATE } from "./ui/client-create.js";

function makeNonce(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);let bin="";for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin);}
const COMPOSITION_TEMPLATE=String.raw`<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <!-- Struktur mengikuti template resmi "blank" (packages/cli/src/templates/blank). -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      :root {
        --ground: #0b1020;
        --ink: #ffffff;
        --accent: #38bdf8;
        --font-display: sans-serif;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: var(--ground);
      }
      #root {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 28px;
        font-family: var(--font-display);
        background: linear-gradient(135deg, #0b1020 0%, #172554 100%);
      }
      #bar {
        width: 480px;
        height: 10px;
        border-radius: 5px;
        background: var(--accent);
        transform-origin: left center;
      }
      #title {
        color: var(--ink);
        font-size: 120px;
        font-weight: 700;
        letter-spacing: -0.03em;
      }
      #subtitle {
        color: #cbd5e1;
        font-size: 48px;
        font-weight: 400;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="5"
      data-width="1920"
      data-height="1080"
    >
      <div id="bar" class="clip" data-start="0" data-duration="5" data-track-index="0"></div>
      <h1 id="title" class="clip" data-start="0" data-duration="5" data-track-index="1">Halo, HyperFrames</h1>
      <p id="subtitle" class="clip" data-start="0.6" data-duration="4.4" data-track-index="2">
        Dirender di Cloudflare Free + GitHub Actions
      </p>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      // Aksen sudah tampil di frame 0 (thumbnail tidak kosong), lalu melebar.
      tl.fromTo("#bar", { scaleX: 0.2 }, { scaleX: 1, duration: 1.2, ease: "power3.out" }, 0);
      tl.fromTo("#title", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 0.1);
      tl.fromTo("#subtitle", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 0.6);
      // Gerak lambat sampai akhir supaya tidak ada "dead stretch" > 3 detik.
      tl.to("#root", { backgroundPosition: "20% 20%", duration: 5, ease: "none" }, 0);
      tl.to("#title", { scale: 1.04, duration: 3.8, ease: "none" }, 1.2);
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
const TEMPLATE_JSON=JSON.stringify(COMPOSITION_TEMPLATE).replace(/</g,"\\u003c");
const CLIENT_JS=[CORE.replace("__TEMPLATE_JSON__",TEMPLATE_JSON),DATA,VIEWS,CREATE,String.raw`
var mediaFilter='all';
function renderMedia(){
 updateKeyBars();
 var q=$('mSearch').value.trim().toLowerCase(), all=loadAssets();
 var list=all.filter(function(a){return(mediaFilter==='all'||a.cat===mediaFilter)&&(!q||(a.filename+' '+a.composition).toLowerCase().indexOf(q)>=0);});
 var ul=$('mList');ul.textContent='';
 list.forEach(function(a){
  var li=h('li','row'),info=h('div','h-info'),acts=h('div','row-acts');
  info.appendChild(h('b',null,a.filename));info.appendChild(h('span','h-meta',a.composition+' · '+a.cat+' · '+fmtBytes(a.bytes)));
  acts.appendChild(button('Salin path','sm','copy',function(){copyText('cloudflare-free/compositions/'+a.composition+'/assets/'+a.filename,'Path disalin');}));
  acts.appendChild(iconButton('trash','Hapus dari daftar','sm danger',function(){saveAssets(loadAssets().filter(function(x){return x.id!==a.id;}));renderMedia();}));
  li.appendChild(info);li.appendChild(acts);ul.appendChild(li);
 });
 $('mEmpty').hidden=list.length>0;
 $('mEmptyTitle').textContent=all.length?'Tidak ada hasil':'Belum ada aset';
 $('mEmptyText').textContent=all.length?'Ubah pencarian atau filter.':'Unggah aset untuk mulai.';
}
function mediaUpload(file){
 var comp=$('mComp').value.trim()||'contoh';
 if(!apiKey){setMsg($('mMsg'),'Pasang API key di Pengaturan terlebih dahulu.','err');return;}
 if(!ID_RE.test(comp)){setMsg($('mMsg'),'Nama komposisi tidak valid.','err');return;}
 if(!file||!file.size||file.size>MAX_ASSET_BYTES){setMsg($('mMsg'),'File kosong atau melebihi batas 8 MB.','err');return;}
 var name=String(file.name).replace(/[^a-zA-Z0-9._-]/g,'-').replace(/^[^a-zA-Z0-9]+/,'').slice(0,128);
 if(!ASSET_NAME_RE.test(name)){setMsg($('mMsg'),'Nama file tidak valid.','err');return;}
 var reader=new FileReader();
 reader.onerror=function(){setMsg($('mMsg'),'File gagal dibaca.','err');};
 reader.onload=async function(){
  try{
   var b64=String(reader.result).split(',')[1];
   var res=await fetch('/asset',{method:'POST',headers:{'x-api-key':apiKey,'content-type':'application/json'},body:JSON.stringify({composition:comp,filename:name,data:b64}),cache:'no-store'});
   var d={};try{d=await res.json();}catch(e){}
   if(res.status!==201||!d.ok)throw Error(describeError(res.status,d));
   var type=file.type||'',cat=$('mCat').value;
   if(cat==='auto')cat=type.indexOf('video/')===0?'video':type.indexOf('image/')===0?'image':type.indexOf('audio/')===0?'audio':'other';
   var arr=loadAssets().filter(function(a){return !(a.composition===comp&&a.filename===name);});
   arr.unshift({id:comp+'/'+name,composition:comp,filename:name,bytes:file.size,cat:cat,ts:Date.now()});saveAssets(arr);
   setMsg($('mMsg'),'Berhasil diunggah dan di-commit ke GitHub.','ok');renderMedia();renderSettings();
  }catch(e){setMsg($('mMsg'),e.message||'Unggah gagal.','err');}
 };
 reader.readAsDataURL(file);
}
function initMedia(){
 $('mComp').value=prefs.composition;
 $('mFile').addEventListener('change',function(){Array.prototype.forEach.call($('mFile').files||[],mediaUpload);$('mFile').value='';});
 $('mSearch').addEventListener('input',debounce(renderMedia,150));
 qsa('#mFilter button').forEach(function(b){b.addEventListener('click',function(){mediaFilter=b.getAttribute('data-value');qsa('#mFilter button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});renderMedia();});});
 var drop=$('mDrop');
 ['dragenter','dragover'].forEach(function(n){drop.addEventListener(n,function(e){e.preventDefault();drop.classList.add('over');});});
 ['dragleave','drop'].forEach(function(n){drop.addEventListener(n,function(e){e.preventDefault();drop.classList.remove('over');});});
 drop.addEventListener('drop',function(e){Array.prototype.forEach.call(e.dataTransfer.files||[],mediaUpload);});
}
function renderSettings(){
 $('stHist').textContent=String(loadHist().length);$('stDrafts').textContent=String(loadDrafts().length);$('stAssets').textContent=String(loadAssets().length);
 $('setOrigin').textContent=location.origin;if(document.activeElement!==$('setKey'))$('setKey').value=apiKey;
 $('setRemember').checked=!!sGet('session',K.key);$('setComp').value=prefs.composition;
}
function initSettings(){
 $('setKey').value=apiKey;$('setRemember').checked=!!sGet('session',K.key);
 $('setKeyToggle').addEventListener('click',function(){var v=$('setKey').type==='password';$('setKey').type=v?'text':'password';$('setKeyToggle').textContent=v?'Sembunyikan':'Tampilkan';});
 $('setKeyTest').addEventListener('click',async function(){
  var key=$('setKey').value.trim();if(!key){setMsg($('setMsg'),'Masukkan API key.','err');return;}
  setMsg($('setMsg'),'Menguji API key…');
  try{var r=await fetch('/asset',{method:'POST',headers:{'x-api-key':key,'content-type':'application/json'},body:JSON.stringify({composition:'contoh',filename:'probe.txt',data:''})});
   if(r.status===401){setMsg($('setMsg'),'API key salah.','err');return;}
   if(r.status===500){setMsg($('setMsg'),'Worker belum dikonfigurasi.','err');return;}
   setApiKey(key,$('setRemember').checked);setMsg($('setMsg'),'API key diterima Worker.','ok');
  }catch(e){setMsg($('setMsg'),'Tidak dapat menghubungi Worker.','err');}
 });
 $('setConn').addEventListener('click',async function(){try{var r=await fetch('/api'),d=await r.json();setMsg($('setMsg'),r.ok&&d.service==='hyperframes-render'?'Server terhubung.':'Respons server tidak sesuai.',r.ok?'ok':'err');}catch(e){setMsg($('setMsg'),'Koneksi gagal.','err');}});
 seg($('segTheme'),function(v){sSet('local',K.theme,v);applyTheme(v);});
 seg($('segDefQuality'),function(v){prefs.quality=v;savePrefs();});
 $('setComp').addEventListener('change',function(){var v=$('setComp').value.trim();if(v&&!ID_RE.test(v)){setMsg($('setMsg'),'Nama komposisi tidak valid.','err');return;}prefs.composition=v||'contoh';savePrefs();});
 $('clrHist').addEventListener('click',function(){sDel('local',K.hist);Object.keys(jobs).forEach(stopTracking);renderSettings();});
 $('clrDrafts').addEventListener('click',function(){sDel('local',K.drafts);renderSettings();});
 $('clrAssets').addEventListener('click',function(){sDel('local',K.assets);renderSettings();renderMedia();});
 $('clrAll').addEventListener('click',async function(){if(!await confirmBox('Hapus semua data lokal?','Data browser dihapus; file GitHub dan video server tetap ada.','Hapus semua',true))return;
  ['hf_history','hf_drafts','hf_assets','hf_prefs','hf_theme','hf_onboard_done'].forEach(function(k){sDel('local',k);});sDel('session',K.key);apiKey='';prefs={quality:'standard',composition:'contoh'};applyTheme('auto');renderSettings();renderMedia();updateKeyBars();});
}
function initApp(){
 loadPrefs();applyTheme(loadTheme());apiKey=sGet('session',K.key)||'';
 initViews();initCreate();initMedia();initSettings();
 if(!location.hash)location.hash='#/dashboard';
 window.addEventListener('hashchange',onRoute);onRoute();resumePending();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initApp);else initApp();
`].join("\n");
export function htmlPage(){
 const nonce=makeNonce();
 const body=MARKUP.replace("__CSS__",STYLES).replace("__JS__",CLIENT_JS).replaceAll("__NONCE__",nonce);
 return new Response(body,{status:200,headers:{
  "content-type":"text/html; charset=utf-8","cache-control":"no-store",vary:"accept",
  "content-security-policy":"default-src 'none'; "+"script-src 'nonce-"+nonce+"'; "+"style-src 'nonce-"+nonce+"'; "+"connect-src 'self'; media-src 'self'; img-src 'self' data:; "+"base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"no-referrer"
 }});
}
