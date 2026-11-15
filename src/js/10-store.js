/* ---------- storage: IndexedDB with localStorage and memory fallbacks ---------- */
var DBNAME='teacher-reports',DBSTORE='kv',idb=null,mem={};
function idbOpen(){
  return new Promise(function(res){
    try{
      var r=indexedDB.open(DBNAME,1);
      r.onupgradeneeded=function(){r.result.createObjectStore(DBSTORE);};
      r.onsuccess=function(){res(r.result);};
      r.onerror=function(){res(null);};
      r.onblocked=function(){res(null);};
    }catch(e){res(null);}
  });
}
async function kvGet(k){
  if(idb){
    try{return await new Promise(function(res,rej){var q=idb.transaction(DBSTORE).objectStore(DBSTORE).get(k);q.onsuccess=function(){res(q.result);};q.onerror=function(){rej(q.error);};});}catch(e){}
  }
  try{var s=localStorage.getItem('tr2:'+k);if(s){return JSON.parse(s);}}catch(e2){}
  return mem[k];
}
async function kvSet(k,v){
  if(idb){
    try{await new Promise(function(res,rej){var tx=idb.transaction(DBSTORE,'readwrite');tx.objectStore(DBSTORE).put(v,k);tx.oncomplete=function(){res();};tx.onerror=function(){rej(tx.error);};tx.onabort=function(){rej(tx.error);};});return true;}catch(e){}
  }
  try{localStorage.setItem('tr2:'+k,JSON.stringify(v));return true;}catch(e2){}
  mem[k]=v;return false;
}

/* ---------- state ---------- */
var S={profiles:[],reports:{},pid:'',tab:'daily',view:'edit'};
var caps={dl:null,ai:null,aiImages:false};
var A={q:'',type:'',n:30};
var saveHooks=[];

function blankProfile(name){return {id:uid(),name:name||'',p:{},students:[],logo:'',sign:'',stamp:'',cur:{},updatedAt:Date.now()};}
function liveProfiles(){return S.profiles.filter(function(p){return !p.deleted;});}
function prof(){
  var l=liveProfiles();
  for(var i=0;i<l.length;i++){if(l[i].id===S.pid){return l[i];}}
  return l[0];
}
function profName(P,idx){
  if(P.name){return P.name;}
  var a=[P.p.spec,P.p.grade].filter(Boolean).join(' - ');
  return a||P.p.school||('ملف '+((idx==null?liveProfiles().indexOf(P):idx)+1));
}
/* A report is blank when nothing was typed; values carried over automatically (r.seed) do not count. */
function isBlank(r){
  if(r.imgs&&r.imgs.length){return false;}
  var seed=r.seed||{};
  return !Object.keys(r.v||{}).some(function(k){
    if(k==='date'){return false;}
    var x=String(r.v[k]==null?'':r.v[k]).trim();
    return x!==''&&x!==String(seed[k]==null?'':seed[k]).trim();
  });
}
function profReports(type,P){
  P=P||prof();
  return Object.keys(S.reports).map(function(k){return S.reports[k];}).filter(function(r){return !r.deleted&&r.pid===P.id&&(!type||r.type===type);});
}
function byDateDesc(a,b){
  var x=a.v.date||'',y=b.v.date||'';
  if(x!==y){return x<y?1:-1;}
  return (b.updatedAt||0)-(a.updatedAt||0);
}
function latest(type,exceptId){
  return profReports(type).filter(function(r){return r.id!==exceptId&&!isBlank(r);}).sort(byDateDesc)[0]||null;
}
function newReport(type,from){
  var P=prof(),r={id:uid(),type:type,pid:P.id,v:{date:today()},imgs:[],created:Date.now(),updatedAt:Date.now()};
  if(from){
    Object.keys(from.v).forEach(function(k){if(k!=='date'){r.v[k]=from.v[k];}});
  }else if(type==='daily'){
    var last=latest('daily');
    if(last&&last.v.unit){r.v.unit=last.v.unit;r.seed={unit:last.v.unit};}
  }
  S.reports[r.id]=r;P.cur[type]=r.id;
  return r;
}
function rep(type){
  type=type||S.tab;
  var P=prof(),id=P.cur[type],r=id&&S.reports[id];
  if(!r||r.deleted||r.pid!==P.id){r=newReport(type);}
  return r;
}
function touch(r){(r||rep()).updatedAt=Date.now();}
function touchProfile(){prof().updatedAt=Date.now();}
function removeReport(r){
  r.deleted=true;r.v={};r.imgs=[];r.updatedAt=Date.now();
  liveProfiles().forEach(function(P){if(P.cur[r.type]===r.id){delete P.cur[r.type];}});
}
function progressOf(r){
  var ks=keysFor(r.type),v=r.v;
  var f=ks.filter(function(x){return String(v[x]==null?'':v[x]).trim()!=='';}).length;
  return Math.round(f/ks.length*100);
}

function fixup(){
  S.profiles=S.profiles.filter(Boolean);
  if(!liveProfiles().length){S.profiles.push(blankProfile());}
  var live=liveProfiles();
  if(!live.some(function(p){return p.id===S.pid;})){S.pid=live[0].id;}
  live.forEach(function(p){
    p.cur=p.cur||{};p.p=p.p||{};p.students=p.students||[];
    if(p.p.term&&TERMS.indexOf(p.p.term)<0){p.p.term='';}
  });
  if(!TABS[S.tab]){S.tab='daily';}
}

function migrateV1(){
  try{
    var r=JSON.parse(localStorage.getItem(LEGACY_KEY)||'null');
    if(!r){S.profiles=[blankProfile()];return;}
    var P=blankProfile();P.p=r.p||{};S.profiles=[P];S.pid=P.id;
    Object.keys(r.t||{}).forEach(function(k){
      if(!TABS[k]){return;}
      var o=r.t[k];if(!o){return;}
      var rr={id:uid(),type:k,pid:P.id,v:o.v||{},imgs:o.imgs||[],created:Date.now(),updatedAt:Date.now()};
      if(!rr.v.date){rr.v.date=today();}
      if(!isBlank(rr)){S.reports[rr.id]=rr;P.cur[k]=rr.id;}
    });
    if(TABS[r.tab]){S.tab=r.tab;}
  }catch(e){S.profiles=[blankProfile()];}
}

async function loadState(){
  idb=await idbOpen();
  try{if(navigator.storage&&navigator.storage.persist){navigator.storage.persist();}}catch(e){}
  var st=await kvGet('state');
  if(st&&st.v===2){
    S.profiles=st.profiles||[];S.reports=st.reports||{};S.pid=st.pid||'';
    if(TABS[st.tab]){S.tab=st.tab;}
  }else{migrateV1();}
  fixup();
}

/* ---------- saving ---------- */
var saveTimer=null,warned=false;
function prune(){
  var keep={};
  liveProfiles().forEach(function(p){Object.keys(p.cur).forEach(function(t){keep[p.cur[t]]=1;});});
  var now=Date.now();
  Object.keys(S.reports).forEach(function(id){
    var r=S.reports[id];
    if(r.deleted){if(now-(r.updatedAt||0)>90*864e5){delete S.reports[id];}return;}
    if(!keep[id]&&isBlank(r)){delete S.reports[id];}
  });
}
function setSaveNote(t){var n=$('#saveNote');if(n){n.textContent=t;}}
function queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,400);}
async function saveNow(){
  clearTimeout(saveTimer);
  prune();
  var ok=await kvSet('state',{v:2,profiles:S.profiles,reports:S.reports,pid:S.pid,tab:S.tab});
  if(!ok&&!warned){warned=true;toast('تعذر الحفظ التلقائي على هذا الجهاز، نزّل التقرير قبل إغلاق الصفحة.');}
  setSaveNote(ok?'محفوظ تلقائيًا في الأرشيف على هذا الجهاز.':'تعذر الحفظ على هذا الجهاز، نزّل نسخة احتياطية.');
  saveHooks.forEach(function(f){try{f();}catch(e){}});
}

/* ---------- export, import and merge ---------- */
function exportState(strip){
  var st={v:2,app:'teacher-reports',exportedAt:Date.now(),profiles:[],reports:{}};
  S.profiles.forEach(function(p){
    var c={};Object.keys(p).forEach(function(k){if(k!=='cur'){c[k]=p[k];}});
    if(strip){c.logo='';c.sign='';c.stamp='';}
    st.profiles.push(c);
  });
  Object.keys(S.reports).forEach(function(id){
    var r=S.reports[id],c={id:r.id,type:r.type,pid:r.pid,v:r.v,created:r.created,updatedAt:r.updatedAt,imgs:strip?[]:(r.imgs||[])};
    if(r.deleted){c.deleted=true;}
    st.reports[id]=c;
  });
  return st;
}
function mergeState(R,stripped){
  var changed=0;
  (R.profiles||[]).forEach(function(rp){
    if(!rp||!rp.id){return;}
    var lp=S.profiles.filter(function(x){return x.id===rp.id;})[0];
    if(!lp){var np={};Object.keys(rp).forEach(function(k){np[k]=rp[k];});np.cur={};S.profiles.push(np);changed++;}
    else if((rp.updatedAt||0)>(lp.updatedAt||0)){
      var keep={cur:lp.cur,logo:lp.logo,sign:lp.sign,stamp:lp.stamp};
      Object.keys(rp).forEach(function(k){lp[k]=rp[k];});
      lp.cur=keep.cur;
      if(stripped){['logo','sign','stamp'].forEach(function(k){if(!rp[k]){lp[k]=keep[k];}});}
      changed++;
    }
  });
  Object.keys(R.reports||{}).forEach(function(id){
    var rr=R.reports[id],lr=S.reports[id];
    if(!rr||!rr.v&&!rr.deleted){return;}
    rr.v=rr.v||{};rr.imgs=rr.imgs||[];
    if(!lr){S.reports[id]=rr;changed++;}
    else if((rr.updatedAt||0)>(lr.updatedAt||0)){
      if(!rr.imgs.length&&!rr.deleted){rr.imgs=lr.imgs||[];}
      S.reports[id]=rr;changed++;
    }
  });
  fixup();
  return changed;
}
