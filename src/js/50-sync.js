/* ---------- sync between devices without accounts ----------
   A random code is the only secret. Its hash names the record on the server and a key derived from it
   encrypts the data in the browser, so the server stores ciphertext it cannot read. Images stay on each device. */
var SYNC_OK=!!SYNC_ENDPOINT&&location.origin==='https://salmilabi.github.io';
var SY={code:'',last:0,hash:'',busy:false,msg:'',kind:'',k:null,timer:null};
var CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
var CODE_LEN=20;

function newCode(){
  var a=new Uint8Array(CODE_LEN),s='';
  crypto.getRandomValues(a);
  for(var i=0;i<CODE_LEN;i++){s+=CODE_CHARS[a[i]&31];}
  return s;
}
function showCode(c){return c.replace(/(.{4})(?=.)/g,'$1-');}
function cleanCode(s){
  var t=String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,''),o='';
  for(var i=0;i<t.length;i++){if(CODE_CHARS.indexOf(t[i])>-1){o+=t[i];}}
  return o;
}
function hex(buf){return Array.prototype.map.call(new Uint8Array(buf),function(b){return b.toString(16).padStart(2,'0');}).join('');}
function b64enc(buf){
  var a=new Uint8Array(buf),s='';
  for(var i=0;i<a.length;i+=0x8000){s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000));}
  return btoa(s);
}
function b64dec(t){var s=atob(t),a=new Uint8Array(s.length);for(var i=0;i<s.length;i++){a[i]=s.charCodeAt(i);}return a;}

async function deriveSync(code){
  var enc=new TextEncoder();
  var id=hex(await crypto.subtle.digest('SHA-256',enc.encode('tr-sync-id:'+code))).slice(0,40);
  var base=await crypto.subtle.importKey('raw',enc.encode(code),'PBKDF2',false,['deriveKey']);
  var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:enc.encode('tr-sync-key-v1'),iterations:120000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  return {id:id,key:key};
}
async function syncKey(){
  if(!SY.k||SY.k.code!==SY.code){var d=await deriveSync(SY.code);d.code=SY.code;SY.k=d;}
  return SY.k;
}
async function sealState(obj,key){
  var iv=crypto.getRandomValues(new Uint8Array(12));
  var ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,new TextEncoder().encode(JSON.stringify(obj)));
  return {iv:b64enc(iv),ct:b64enc(ct),t:Date.now()};
}
async function openState(o,key){
  var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64dec(o.iv)},key,b64dec(o.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function hashState(st){
  var core=JSON.stringify({p:st.profiles,r:st.reports});
  return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(core)));
}
function saveSync(){return kvSet('sync',{code:SY.code,last:SY.last,hash:SY.hash});}
async function loadSync(){
  try{var o=await kvGet('sync');if(o&&o.code){SY.code=o.code;SY.last=o.last||0;SY.hash=o.hash||'';}}catch(e){}
}
function syncErr(code){var e=new Error(code);e.code=code;return e;}
function pristine(){
  var l=liveProfiles();
  if(l.length!==1){return false;}
  var P=l[0];
  if(P.name||P.logo||P.sign||P.stamp||P.students.length){return false;}
  if(Object.keys(P.p).some(function(k){return String(P.p[k]||'').trim();})){return false;}
  return !Object.keys(S.reports).some(function(id){var r=S.reports[id];return !r.deleted&&!isBlank(r);});
}
function typing(){var a=document.activeElement;return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&$('#form').contains(a));}
function setSyncMsg(kind,msg){SY.kind=kind;SY.msg=msg;updateSyncCard();}
function updateSyncCard(){
  var c=$('#syncCard');
  if(c&&S.view==='settings'&&!(document.activeElement&&c.contains(document.activeElement)&&document.activeElement.id==='syncJoin')){c.outerHTML=syncCardHTML();}
}
function whenText(t){
  if(!t){return 'لم تتم المزامنة بعد';}
  var m=Math.round((Date.now()-t)/60000);
  if(m<1){return 'الآن';}
  if(m<60){return 'قبل '+m+' دقيقة';}
  var h=Math.round(m/60);
  if(h<24){return 'قبل '+h+' ساعة';}
  return 'قبل '+Math.round(h/24)+' يومًا';
}
function syncCardHTML(){
  if(!SYNC_OK){
    return '<section class="card" id="syncCard"><h2>المزامنة بين الأجهزة</h2><p class="muted">المزامنة متاحة من الصفحة المنشورة على الموقع فقط. افتحها من هناك لتفعيلها.</p></section>';
  }
  var msg=SY.msg?'<p class="sync-msg '+SY.kind+'" role="status">'+esc(SY.msg)+'</p>':'';
  if(!SY.code){
    return '<section class="card" id="syncCard"><h2>المزامنة بين الأجهزة <small>بلا حساب ولا كلمة مرور</small></h2>'+
      '<p class="muted">تجمع تقاريرك على هاتفك وحاسوبك. تُشفَّر البيانات في جهازك قبل الإرسال برمز سري تحتفظ به أنت، فلا يستطيع الخادم قراءتها. الصور تبقى على كل جهاز ولا تُرفع.</p>'+
      '<div class="btnrow"><button type="button" class="btn primary" data-sync="on"'+(SY.busy?' disabled':'')+'>'+icon('sync')+'تفعيل المزامنة في هذا الجهاز</button></div>'+
      '<div class="sync-join"><input type="text" id="syncJoin" placeholder="لدي رمز من جهاز آخر" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="رمز المزامنة"><button type="button" class="btn" data-sync="join"'+(SY.busy?' disabled':'')+'>ربط</button></div>'+msg+'</section>';
  }
  return '<section class="card" id="syncCard"><h2>المزامنة بين الأجهزة <small>مفعّلة</small></h2>'+
    '<p class="muted">اكتب هذا الرمز في الجهاز الآخر من خانة «لدي رمز». احتفظ به في مكان آمن: من يملكه يستطيع قراءة بياناتك، وإن ضاع لا يمكن استرجاعه.</p>'+
    '<div class="sync-code" aria-label="رمز المزامنة">'+esc(showCode(SY.code))+'</div>'+
    '<div class="btnrow"><button type="button" class="btn primary" data-sync="now"'+(SY.busy?' disabled':'')+'>'+icon('sync')+(SY.busy?'جارٍ المزامنة...':'مزامنة الآن')+'</button>'+
    '<button type="button" class="btn" data-sync="copy">'+icon('copy')+'نسخ الرمز</button>'+
    '<button type="button" class="btn" data-sync="off">إيقاف في هذا الجهاز</button>'+
    '<button type="button" class="btn danger" data-sync="wipe">'+icon('trash')+'حذف النسخة السحابية</button></div>'+
    '<p class="sync-msg">آخر مزامنة: '+whenText(SY.last)+'</p>'+msg+'</section>';
}

async function syncRequest(method,id,body){
  var h={'X-Sync-Id':id};
  if(body){h['Content-Type']='application/json';}
  var res=await fetch(SYNC_ENDPOINT,{method:method,headers:h,body:body?JSON.stringify(body):undefined});
  return res;
}
/* opts.join: the remote copy must already exist (guards against a mistyped code). */
async function syncNow(opts){
  opts=opts||{};
  if(!SYNC_OK||!SY.code||SY.busy){return false;}
  SY.busy=true;SY.msg='';updateSyncCard();
  try{
    var k=await syncKey(),res=await syncRequest('GET',k.id),changed=0,exists=false;
    if(res.status===200){
      exists=true;
      var remote=await openState(await res.json(),k.key).catch(function(){throw syncErr('decrypt');});
      /* A device that was never used adopts the synced profiles instead of keeping an empty one beside them. */
      if(pristine()){S.profiles=[];S.reports={};}
      changed=mergeState(remote,true);
    }else if(res.status===404){
      if(opts.join){throw syncErr('notfound');}
    }else{throw syncErr(res.status===429?'rate':'http');}
    if(changed){await saveNow();if(!typing()){renderAll(true);}}
    var st=exportState(true),h=await hashState(st);
    if(!exists||h!==SY.hash){
      var put=await syncRequest('PUT',k.id,await sealState(st,k.key));
      if(put.status===413){throw syncErr('big');}
      if(put.status===429){throw syncErr('rate');}
      if(!put.ok){throw syncErr('http');}
    }
    SY.hash=h;SY.last=Date.now();await saveSync();
    SY.busy=false;
    setSyncMsg('ok',changed?('تم دمج '+changed+' عنصرًا من أجهزتك الأخرى.'):'البيانات متطابقة.');
    return true;
  }catch(e){
    SY.busy=false;
    var m={notfound:'لم يُعثر على بيانات بهذا الرمز. تأكد من كتابته كما هو.',decrypt:'تعذر فك التشفير. الرمز غير صحيح.',rate:'طلبات كثيرة، حاول بعد قليل.',big:'حجم البيانات أكبر من المسموح.'}[e&&e.code]||'تعذرت المزامنة، تحقق من الاتصال وحاول مرة أخرى.';
    if(e&&(e.code==='notfound'||e.code==='decrypt')&&opts.join){SY.code='';SY.k=null;await saveSync();}
    setSyncMsg('err',m);
    return false;
  }
}
function schedulePush(){
  if(!SYNC_OK||!SY.code){return;}
  clearTimeout(SY.timer);
  SY.timer=setTimeout(function(){syncNow();},6000);
}
saveHooks.push(schedulePush);

async function syncAction(a){
  if(!SYNC_OK){return;}
  if(a==='on'){
    if(!(window.crypto&&crypto.subtle)){setSyncMsg('err','هذا المتصفح لا يدعم التشفير المطلوب.');return;}
    SY.code=newCode();SY.k=null;SY.hash='';SY.last=0;await saveSync();
    await syncNow();
  }else if(a==='join'){
    var c=cleanCode($('#syncJoin').value);
    if(c.length!==CODE_LEN){setSyncMsg('err','الرمز يتكون من '+CODE_LEN+' حرفًا ورقمًا، تأكد من نسخه كاملًا.');return;}
    if(!(window.crypto&&crypto.subtle)){setSyncMsg('err','هذا المتصفح لا يدعم التشفير المطلوب.');return;}
    SY.code=c;SY.k=null;SY.hash='';SY.last=0;
    await syncNow({join:true});
    if(SY.code){await saveSync();}
  }else if(a==='now'){
    await syncNow();
  }else if(a==='copy'){
    try{await navigator.clipboard.writeText(SY.code);toast('تم نسخ الرمز.');}catch(e){toast('تعذر النسخ، انسخ الرمز يدويًا.');}
  }else if(a==='off'){
    openDlg({title:'إيقاف المزامنة في هذا الجهاز؟',text:'تبقى بياناتك هنا وفي السحابة، ولن يتبادل هذا الجهاز التحديثات حتى تعيد الربط بالرمز.',ok:'إيقاف',onOk:async function(){
      SY.code='';SY.k=null;SY.last=0;SY.hash='';SY.msg='';await saveSync();closeDlg();updateSyncCard();toast('أُوقفت المزامنة في هذا الجهاز.');
    }});
  }else if(a==='wipe'){
    openDlg({title:'حذف النسخة السحابية؟',text:'يُحذف ما على الخادم نهائيًا وتتوقف المزامنة في هذا الجهاز، وبياناتك على الأجهزة تبقى كما هي. أوقف المزامنة في أجهزتك الأخرى أولًا، وإلا أعادت رفع نسخة عند أول مزامنة.',ok:'حذف من السحابة',onOk:async function(){
      closeDlg();
      try{
        var k=await syncKey(),res=await syncRequest('DELETE',k.id);
        if(!res.ok&&res.status!==404){throw syncErr('http');}
        SY.code='';SY.k=null;SY.last=0;SY.hash='';SY.msg='';await saveSync();updateSyncCard();toast('حُذفت النسخة السحابية.');
      }catch(e){setSyncMsg('err','تعذر الحذف، تحقق من الاتصال وحاول مرة أخرى.');}
    }});
  }
}
