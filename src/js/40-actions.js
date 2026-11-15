/* ---------- files, sharing, export ---------- */
var deferredInstall=null;
function busy(btns,on){btns.forEach(function(b){b.disabled=on;});}
function actBtns(a){return $$('[data-act="'+a+'"]');}
function dataUrlToBlob(u){
  var m=/^data:([^;]+);base64,(.*)$/.exec(u),bin=atob(m[2]),a=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++){a[i]=bin.charCodeAt(i);}
  return new Blob([a],{type:m[1]});
}
async function saveFile(blob,name){
  await capsReady;
  if(caps.dl){await caps.dl.save({filename:name,data:blob});return true;}
  if(window.claude){toast('التنزيل غير متاح في هذا العرض.');return false;}
  var u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(u);},4000);
  return true;
}
/* A4 with 12 mm top and bottom margins; the sheet is 794 px wide, so one page holds about 1031 px of it. */
var PDF_MARGIN=[12,0,12,0];
function pageHeightPx(){return Math.floor((297-PDF_MARGIN[0]-PDF_MARGIN[2])/210*794);}
/* Moves any block that would straddle a page edge to the top of the next page, so nothing is cut in half. */
function keepBlocksWhole(sheet){
  var H=pageHeightPx(),base=sheet.getBoundingClientRect().top;
  Array.prototype.forEach.call(sheet.children,function(k,i){
    var r=k.getBoundingClientRect(),top=r.top-base,bottom=r.bottom-base;
    if(i===0||r.height>H){return;}
    var edge=(Math.floor(top/H)+1)*H;
    if(bottom>edge){
      var m=parseFloat(getComputedStyle(k).marginTop)||0;
      k.style.marginTop=(m+(edge-top)+3)+'px';
    }
  });
}
async function makePdf(r){
  await needLib('html2pdf');
  var holder=$('#sheetHolder');
  try{
    holder.innerHTML=sheetHTML(r);
    if(document.fonts&&document.fonts.ready){await document.fonts.ready;}
    await Promise.all($$('img',holder).map(function(im){return im.decode?im.decode().catch(function(){}):null;}));
    var el=holder.firstElementChild;
    keepBlocksWhole(el);
    return await html2pdf().set({
      margin:PDF_MARGIN,
      image:{type:'jpeg',quality:0.95},
      html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff',windowWidth:794},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
      pagebreak:{mode:[]}
    }).from(el).outputPdf('blob');
  }finally{holder.innerHTML='';}
}
function failMsg(e,what){
  if(e&&e.code==='declined'){toast('أُلغي حفظ الملف.');}
  else if(e&&/load /.test(String(e.message))){toast('تعذر تحميل أداة إنشاء الملف، تحقق من الاتصال ثم أعد المحاولة.');}
  else{toast('تعذر '+what+'، أعد المحاولة.');}
}
async function exportPdf(){
  var btns=actBtns('pdf');busy(btns,true);toast('جارٍ تجهيز الملف...');
  try{
    var r=rep(),blob=await makePdf(r);
    if(await saveFile(blob,fileBase(r)+'.pdf')){toast('تم تجهيز الملف.');}
  }catch(e){failMsg(e,'إنشاء الملف');}
  finally{busy(btns,false);}
}
async function exportDocx(){
  var btns=actBtns('docx');busy(btns,true);toast('جارٍ تجهيز ملف وورد...');
  try{
    var r=rep(),blob=await buildDocx(r);
    if(await saveFile(blob,fileBase(r)+'.docx')){toast('تم تجهيز ملف وورد.');}
  }catch(e){failMsg(e,'إنشاء ملف وورد');}
  finally{busy(btns,false);}
}
var pendingShare=null;
async function shareReport(){
  var r=rep(),T=TABS[r.type],title=T.title+(r.v.topic?' - '+r.v.topic:''),text=reportText(r);
  var btns=actBtns('share');busy(btns,true);
  try{
    if(navigator.canShare&&navigator.share){
      toast('جارٍ تجهيز الملف للمشاركة...');
      var blob=await makePdf(r),file=new File([blob],fileBase(r)+'.pdf',{type:'application/pdf'});
      if(navigator.canShare({files:[file]})){
        try{await navigator.share({files:[file],title:title,text:title});return;}
        catch(e){
          if(e&&e.name==='AbortError'){return;}
          if(e&&e.name==='NotAllowedError'){
            pendingShare={files:[file],title:title,text:title};
            openPicker({title:'الملف جاهز للمشاركة',items:[],html:true,empty:''});
            $('#pickBody').innerHTML='<p class="muted pad">اضغط الزر لاختيار التطبيق الذي ترسل منه الملف.</p><div class="btnrow pad"><button type="button" class="btn primary" data-sharenow="1">'+icon('share')+'مشاركة الملف</button></div>';
            return;
          }
        }
      }
    }
    if(navigator.share){
      try{await navigator.share({title:title,text:text});return;}catch(e2){if(e2&&e2.name==='AbortError'){return;}}
    }
    var w=window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener');
    if(!w){await copyText();}
  }catch(e3){failMsg(e3,'تجهيز المشاركة');}
  finally{busy(btns,false);}
}
async function copyText(){
  var t=reportText(rep());
  try{await navigator.clipboard.writeText(t);toast('تم نسخ التقرير.');return;}catch(e){}
  try{
    var ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
    var ok=document.execCommand('copy');ta.remove();
    toast(ok?'تم نسخ التقرير.':'تعذر النسخ في هذا العرض.');
  }catch(e2){toast('تعذر النسخ في هذا العرض.');}
}

/* ---------- images ---------- */
function readImg(file,max,type,q){
  return new Promise(function(res,rej){
    var fr=new FileReader();
    fr.onerror=rej;
    fr.onload=function(){
      var im=new Image();
      im.onerror=rej;
      im.onload=function(){
        var M=max||1100,w=im.naturalWidth,h=im.naturalHeight,k=Math.min(1,M/Math.max(w,h));
        w=Math.max(1,Math.round(w*k));h=Math.max(1,Math.round(h*k));
        var c=document.createElement('canvas');c.width=w;c.height=h;
        var x=c.getContext('2d');
        if(type!=='png'){x.fillStyle='#fff';x.fillRect(0,0,w,h);}
        x.drawImage(im,0,0,w,h);
        res(type==='png'?c.toDataURL('image/png'):c.toDataURL('image/jpeg',q||0.72));
      };
      im.src=fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function addImages(files){
  var r=rep(),list=r.imgs,room=MAXIMG-list.length;
  if(room<=0){toast('الحد الأقصى '+MAXIMG+' صور.');return;}
  var pick=Array.prototype.slice.call(files).slice(0,room);
  if(files.length>room){toast('أُضيف '+room+' فقط، فالحد الأقصى '+MAXIMG+' صور.');}
  for(var i=0;i<pick.length;i++){
    try{list.push(await readImg(pick[i]));}catch(e){toast('تعذرت قراءة إحدى الصور.');}
  }
  touch(r);renderAll(true);queueSave();
}
async function setIdent(kind,file){
  try{
    var P=prof();P[kind]=await readImg(file,kind==='logo'?420:520,'png');touchProfile();
    renderView();queueSave();toast('تم حفظ الصورة.');
  }catch(e){toast('تعذرت قراءة الصورة.');}
}

/* ---------- AI ---------- */
/* Inside the Claude viewer only its own capability works; the relay Worker accepts requests from the published site alone. */
function aiReady(){return !!(caps.ai||(!window.claude&&AI_ENDPOINT));}
function aiError(code){var e=new Error(code);e.code=code;return e;}
async function askAI(prompt,imgs,fresh){
  if(caps.ai){
    var opts={modelTier:'quick'};
    if(fresh){opts.cache=false;}
    if(imgs&&imgs.length){
      if(!caps.aiImages){throw aiError('no_images');}
      opts.images=imgs.map(dataUrlToBlob);
    }
    return await caps.ai.json(prompt,opts);
  }
  if(!AI_ENDPOINT||window.claude){throw aiError('unavailable');}
  var body={prompt:prompt};if(imgs&&imgs.length){body.images=imgs;}
  var res=await fetch(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok){throw aiError(res.status===429?'rate_limited':(res.status===413?'too_big':'failed'));}
  var d=await res.json(),t=String(d.text||''),a=t.indexOf('{'),b=t.lastIndexOf('}');
  if(a<0||b<=a){throw aiError('failed');}
  try{return JSON.parse(t.slice(a,b+1));}catch(e){throw aiError('failed');}
}
function aiFail(e){
  if(e&&e.code==='not_granted'){document.body.classList.add('no-ai');toast('لم يُسمح باستخدام الذكاء الاصطناعي.');}
  else if(e&&e.code==='rate_limited'){toast('بلغت الحد المسموح حاليًا، حاول لاحقًا.');}
  else if(e&&(e.code==='no_images'||e.code==='images_unavailable')){toast('قراءة الصور غير متاحة في هذا العرض.');}
  else if(e&&e.code==='image_rejected'){toast('تعذر استخدام هذه الصورة، جرّب صورة أخرى.');}
  else if(e&&e.code==='too_big'){toast('الصورة كبيرة، جرّب صورة أوضح وأصغر.');}
  else{toast('تعذر تنفيذ الطلب، أعد المحاولة.');}
}
function ctxLine(r){
  var T=TABS[r.type],p=prof().p;
  return 'أنت خبير تربوي في التعليم العام بالمملكة العربية السعودية.\n'+
    'السياق: '+T.title+' لمعلم'+(p.spec?' تخصصه '+p.spec:'')+(p.grade?' في '+p.grade:'')+'.\n'+
    T.topic.label+': «'+(r.v.topic||'')+'».\n';
}
function specFor(secs){
  return secs.map(function(s){
    var what=s.hint||s.label;
    return s.t==='list'
      ? '"'+s.id+'": مصفوفة من '+s.n+' عبارات تمثل «'+what+'»'
      : '"'+s.id+'": رقم صحيح بين '+s.ai[0]+' و '+s.ai[1]+' يمثل «'+what+'»';
  }).join('\n');
}
var STYLE_RULE='كل عبارة بحد أقصى 5 كلمات، بالعربية الفصحى المبسطة، بلا علامات ترقيم في النهاية، وبلا تكرار بين العبارات.';
/* Applies an AI answer to empty cells only and returns how many were filled. */
function applyAnswer(r,ans){
  var T=TABS[r.type],n=0;
  if(!ans||typeof ans!=='object'){return 0;}
  T.sections.forEach(function(s){
    if(!s.ai||ans[s.id]==null){return;}
    if(s.t==='pct'){
      var num=Math.round(Number(ans[s.id]));
      if(!isNaN(num)&&String(r.v[s.id]||'')===''){r.v[s.id]=String(Math.max(0,Math.min(100,num)));n++;}
    }else if(Array.isArray(ans[s.id])){
      n+=fillList(r,s,ans[s.id].filter(function(x){return typeof x==='string'&&x.trim();}));
    }
  });
  return n;
}
function refreshFields(r){
  $$('#form [data-s="t"]').forEach(function(el){var k=el.dataset.k;if(r.v[k]!=null&&el.value!==String(r.v[k])){el.value=r.v[k];}});
  updateMeta();
}
async function aiFill(){
  var r=rep(),T=TABS[r.type];
  if(!String(r.v.topic||'').trim()){
    toast('اكتب '+T.topic.label+' أولًا ليعتمد عليه الذكاء الاصطناعي.');
    var f=$('#t-topic');if(f){f.focus();}return;
  }
  await capsReady;
  if(!aiReady()){toast('التعبئة الذكية غير متاحة في هذا العرض.');return;}
  var btns=actBtns('ai');busy(btns,true);toast('جارٍ التعبئة...');
  var secs=T.sections.filter(function(s){return s.ai;});
  var prompt=ctxLine(r)+'أعد كائن JSON فقط بلا شرح وبلا علامات كود، وفيه المفاتيح التالية:\n'+specFor(secs)+'\n'+STYLE_RULE;
  try{
    var n=applyAnswer(r,await askAI(prompt));
    touch(r);refreshFields(r);queueSave();
    toast(n?('تمت تعبئة '+n+' خانة فارغة.'):'لا توجد خانات فارغة لتعبئتها.');
  }catch(e){aiFail(e);}
  finally{busy(btns,false);}
}
async function cellAI(key){
  var r=rep(),T=TABS[r.type],m=/^(.*)_(\d+)$/.exec(key),s=m&&sectionOf(T,m[1]);
  if(!s){return;}
  if(!String(r.v.topic||'').trim()){toast('اكتب '+T.topic.label+' أولًا ليعتمد عليه الذكاء الاصطناعي.');var f=$('#t-topic');if(f){f.focus();}return;}
  await capsReady;
  if(!aiReady()){toast('الذكاء الاصطناعي غير متاح في هذا العرض.');return;}
  var cur=String(r.v[key]||'').trim(),others=[];
  for(var i=0;i<s.n;i++){var k2=s.id+'_'+i,x=String(r.v[k2]||'').trim();if(k2!==key&&x){others.push(x);}}
  var btn=$('[data-cellai="'+key+'"]');if(btn){btn.disabled=true;}
  toast('جارٍ توليد الاقتراحات...');
  var prompt=ctxLine(r)+'القسم: «'+(s.hint||s.label)+'».\n'+
    (cur?'العبارة الحالية: «'+cur+'». اكتب 4 صياغات بديلة لها بالمعنى نفسه.\n':'اقترح 4 عبارات مناسبة لخانة جديدة في هذا القسم.\n')+
    (others.length?'لا تكرر هذه العبارات الموجودة: '+others.join('، ')+'.\n':'')+
    'أعد JSON فقط على الشكل {"options":["...","...","...","..."]}.\n'+STYLE_RULE;
  try{
    var ans=await askAI(prompt,null,true),opts=(ans&&Array.isArray(ans.options)?ans.options:[]).filter(function(x){return typeof x==='string'&&x.trim();}).map(function(x){return x.trim().replace(/[.،؛:!؟?]+$/,'');}).slice(0,5);
    if(!opts.length){toast('لم تصل اقتراحات، أعد المحاولة.');return;}
    $('#toast').classList.remove('on');
    openPicker({title:cur?'صياغات بديلة':'اقتراحات للخانة',items:opts.map(function(x,i){return {id:String(i),label:x};}),onPick:function(id){
      var r2=rep();r2.v[key]=opts[+id];touch(r2);var el=$('#t-'+key);if(el){el.value=opts[+id];}updateMeta();queueSave();
    }});
  }catch(e){aiFail(e);}
  finally{if(btn){btn.disabled=false;}}
}
async function bookRead(file){
  var r=rep();
  await capsReady;
  if(!aiReady()){toast('الذكاء الاصطناعي غير متاح في هذا العرض.');return;}
  toast('جارٍ قراءة الصفحة...');
  try{
    var data=await readImg(file,1100,'jpeg',0.7);
    var prompt='أنت خبير تربوي في التعليم العام بالمملكة العربية السعودية.\n'+
      'هذه صورة صفحة من كتاب مدرسي أو دفتر تحضير'+(prof().p.spec?' في مادة '+prof().p.spec:'')+'.\n'+
      'استخرج منها: عنوان الدرس كما يظهر، واسم الوحدة إن ظهر وإلا اتركه فارغًا، ثم اكتب 6 أهداف سلوكية مناسبة للدرس.\n'+
      'أعد JSON فقط بلا شرح على الشكل {"topic":"...","unit":"...","objs":["...","...","...","...","...","..."]}.\n'+
      'كل هدف يبدأ بفعل مضارع بحد أقصى 5 كلمات، وبلا علامات ترقيم في النهاية. إن لم تكن الصورة صفحة درس فأعد {"topic":"","unit":"","objs":[]}.';
    var ans=await askAI(prompt,[data]),n=0;
    if(ans&&typeof ans==='object'){
      if(typeof ans.topic==='string'&&ans.topic.trim()&&!String(r.v.topic||'').trim()){r.v.topic=ans.topic.trim();n++;}
      if(typeof ans.unit==='string'&&ans.unit.trim()&&!String(r.v.unit||'').trim()){r.v.unit=ans.unit.trim();n++;}
      if(Array.isArray(ans.objs)){n+=fillList(r,sectionOf(TABS.daily,'objs'),ans.objs.filter(function(x){return typeof x==='string'&&x.trim();}));}
    }
    touch(r);refreshFields(r);queueSave();
    toast(n?('قُرئت الصفحة وتمت تعبئة '+n+' خانة.'):'لم أجد درسًا واضحًا في الصورة، جرّب صورة أقرب.');
  }catch(e){aiFail(e);}
}
async function aggregate(){
  var r=rep(),T=TABS[r.type],src=sourcesFor(r);
  if(!src){toast('اختر تاريخ التقرير أولًا.');return;}
  if(!src.daily.length){toast(src.kind==='week'?'لا توجد تقارير يومية محفوظة في أسبوع هذا التاريخ.':'لا توجد تقارير يومية محفوظة في شهر هذا التاريخ.');return;}
  var btns=actBtns('aggregate');busy(btns,true);
  try{
    var n=localAggregate(r,src);
    var secs=T.sections.filter(function(s){return s.ai&&s.t==='list'&&emptyCells(r,s).length;});
    await capsReady;
    if(secs.length&&aiReady()){
      toast('جارٍ إكمال بقية الأقسام بالذكاء الاصطناعي...');
      try{
        var prompt=ctxLine(r)+'ملخص تقارير '+(src.kind==='week'?'الأسبوع':'الشهر')+':\n'+digestOf(r,src)+'\n\n'+
          'اعتمادًا على هذا الملخص فقط اكتب محتوى الأقسام التالية، وأعد كائن JSON فقط بلا شرح وبلا علامات كود:\n'+specFor(secs)+'\n'+STYLE_RULE;
        n+=applyAnswer(r,await askAI(prompt));
      }catch(e){aiFail(e);}
    }
    touch(r);renderAll(true);queueSave();
    toast(n?('تمت تعبئة '+n+' خانة من '+src.daily.length+' تقرير يومي.'):'كل الخانات القابلة للتعبئة ممتلئة.');
  }finally{busy(btns,false);}
}

/* ---------- report management ---------- */
function openReport(id){
  var r=S.reports[id];if(!r||r.deleted){return;}
  prof().cur[r.type]=id;S.tab=r.type;S.view='edit';renderAll();queueSave();window.scrollTo({top:0});
}
function copyOf(from){
  var cur=rep(from.type);
  if(isBlank(cur)&&cur.id!==from.id){
    Object.keys(from.v).forEach(function(k){if(k!=='date'){cur.v[k]=from.v[k];}});
    touch(cur);return cur;
  }
  return newReport(from.type,from);
}
function newRep(){
  var cur=rep();
  if(isBlank(cur)){toast('التقرير الحالي فارغ، ابدأ الكتابة فيه.');var f=$('#t-topic');if(f){f.focus();}return;}
  newReport(S.tab);renderAll(true);queueSave();
  toast('بدأ تقرير جديد، والسابق محفوظ في الأرشيف.');
  var f2=$('#t-topic');if(f2){f2.focus();}
}
function copyPrev(){
  var cur=rep(),list=profReports(S.tab).filter(function(r){return r.id!==cur.id&&!isBlank(r);}).sort(byDateDesc).slice(0,15);
  openPicker({title:'نسخ من تقرير سابق',empty:'لا توجد تقارير سابقة من هذا النوع.',items:list.map(function(r){return {id:r.id,label:reportTitle(r),sub:reportSub(r)};}),onPick:function(id){
    var from=S.reports[id];if(!from){return;}
    copyOf(from);renderAll(true);queueSave();toast('نُسخ المحتوى، عدّل التاريخ والتفاصيل.');
  }});
}
function chooseType(){
  openPicker({title:'أنواع أخرى من التقارير',items:MORE_TABS.map(function(k){return {id:k,label:TABS[k].label};}),onPick:function(id){setTab(id);}});
}
function pickStudents(secId){
  var P=prof(),r=rep(),s=sectionOf(TABS[r.type],secId);
  if(!s){return;}
  var taken={};for(var i=0;i<s.n;i++){var x=String(r.v[s.id+'_'+i]||'').trim();if(x){taken[x]=1;}}
  var free=emptyCells(r,s).length;
  if(!free){toast('كل خانات هذا القسم ممتلئة.');return;}
  openPicker({title:'اختر الطلاب (حتى '+free+')',multi:true,okLabel:'إضافة المحدد',empty:'أضف أسماء الطلاب من صفحة الإعدادات أولًا.',
    items:P.students.filter(function(n){return !taken[n];}).map(function(n){return {id:n,label:n};}),
    onPick:function(ids){
      var r2=rep(),n=fillList(r2,s,ids);touch(r2);renderAll(true);queueSave();
      toast(n?('أُضيف '+n+' من الأسماء.'):'لم يُضف شيء.');
    }});
}
function demo(){
  var r=rep(),T=TABS[r.type],P=prof();
  PROFILE.forEach(function(f){if(P.p[f.id]){return;}P.p[f.id]=f.type==='select'?f.opts[0]:f.ph;});
  touchProfile();
  if(!r.v.topic){r.v.topic=T.topic.ph;}
  T.meta.forEach(function(m){if(!r.v[m.id]){r.v[m.id]=m.ph;}});
  T.sections.forEach(function(s){
    if(s.t==='pct'){if(!r.v[s.id]){r.v[s.id]=s.ph;}return;}
    if(s.ai===false){return;}
    for(var i=0;i<s.n;i++){var key=s.id+'_'+i;if(!r.v[key]){r.v[key]=s.ph[i]||s.ph[0];}}
  });
  touch(r);renderAll(true);queueSave();toast('تمت إضافة بيانات تجريبية، عدّلها أو احذفها.');
}
function clearReport(){
  openDlg({title:'حذف هذا التقرير؟',text:'سيُحذف التقرير وصوره من الأرشيف أيضًا.',ok:'حذف التقرير',onOk:function(){
    removeReport(rep());closeDlg();renderAll();queueSave();toast('تم حذف التقرير.');
  }});
}
function newProfile(){
  var cur=prof(),P=blankProfile();
  ['eduDept','school','term','teacher','principal'].forEach(function(k){if(cur.p[k]){P.p[k]=cur.p[k];}});
  P.logo=cur.logo;P.sign=cur.sign;P.stamp=cur.stamp;
  S.profiles.push(P);S.pid=P.id;renderAll();queueSave();window.scrollTo({top:0});
  toast('ملف جديد بنفس بيانات المدرسة، أضف التخصص والصف.');
  var el=$('#pname');if(el){el.focus();}
}
function deleteProfile(){
  var P=prof();if(liveProfiles().length<2){return;}
  openDlg({title:'حذف هذا الملف؟',text:'ستُحذف كل تقارير هذا الملف من هذا الجهاز.',ok:'حذف الملف',onOk:function(){
    Object.keys(S.reports).forEach(function(id){var r=S.reports[id];if(r.pid===P.id&&!r.deleted){removeReport(r);}});
    P.deleted=true;P.updatedAt=Date.now();
    var l=liveProfiles();S.pid=l[0].id;
    closeDlg();renderAll();queueSave();toast('تم حذف الملف.');
  }});
}

/* ---------- backup ---------- */
async function backup(){
  var blob=new Blob([JSON.stringify(exportState(false))],{type:'application/json'});
  if(await saveFile(blob,'teacher-reports-backup-'+today()+'.json')){toast('تم تجهيز النسخة الاحتياطية.');}
}
async function restore(file){
  try{
    var o=JSON.parse(await file.text());
    if(!o||o.v!==2||!Array.isArray(o.profiles)||!o.reports){toast('هذا الملف ليس نسخة احتياطية صالحة.');return;}
    var n=mergeState(o,false);
    renderAll();queueSave();
    toast(n?('تم استيراد '+n+' عنصرًا ودمجها مع بياناتك.'):'لا جديد في هذه النسخة، بياناتك محدّثة.');
  }catch(e){toast('تعذرت قراءة الملف.');}
}
async function installApp(){
  if(!deferredInstall){return;}
  deferredInstall.prompt();
  try{await deferredInstall.userChoice;}catch(e){}
  deferredInstall=null;renderView();
}

/* ---------- capabilities ---------- */
var capsReady=(async function(){
  var C=window.claude;
  if(!C||!C.use){document.body.classList.toggle('no-ai',!AI_ENDPOINT);return;}
  try{
    var r=await Promise.all([C.use('downloads').catch(function(){return null;}),C.use('sample').catch(function(){return null;})]);
    caps.dl=r[0];caps.ai=r[1];
    if(caps.ai&&caps.ai.limits){try{caps.aiImages=!!((await caps.ai.limits()).images);}catch(e){}}
  }catch(e){}
  document.body.classList.toggle('no-ai',!aiReady());
})();
