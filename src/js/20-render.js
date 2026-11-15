/* ---------- shell: profile switcher, view nav, type tabs ---------- */
var lastFocus=null;
function renderChrome(){
  var live=liveProfiles(),sel=$('#profSel');
  sel.innerHTML=live.map(function(p,i){return '<option value="'+esc(p.id)+'"'+(p.id===S.pid?' selected':'')+'>'+esc(profName(p,i))+'</option>';}).join('');
  sel.parentNode.hidden=live.length<2;
  $$('.vbtn').forEach(function(b){
    var on=b.dataset.view===S.view;
    if(on){b.setAttribute('aria-current','page');}else{b.removeAttribute('aria-current');}
  });
  document.body.dataset.view=S.view;
  renderTabs();
}
function renderTabs(){
  var h=MAIN_TABS.map(function(k){
    return '<button class="tab" role="tab" data-tab="'+k+'" aria-selected="'+(S.tab===k)+'">'+TABS[k].label+'</button>';
  }).join('');
  var inMore=TABS[S.tab].group==='more';
  h+='<button class="tab more" role="tab" data-act="moretypes" aria-selected="'+inMore+'" aria-haspopup="dialog">'+esc(inMore?TABS[S.tab].label:'أخرى')+icon('chev')+'</button>';
  $('#tabs').innerHTML=h;
}
function renderView(){
  var f=$('#form');
  f.removeAttribute('aria-labelledby');
  if(S.view==='edit'){f.innerHTML=editHTML();updateMeta();}
  else if(S.view==='archive'){f.innerHTML=archiveHTML();}
  else if(S.view==='dash'){f.innerHTML=dashHTML();}
  else{f.innerHTML=settingsHTML();}
}
function renderAll(keepOpen){
  var open=keepOpen&&$('#prof')&&$('#prof').open;
  renderChrome();renderView();
  if(open&&$('#prof')){$('#prof').open=true;}
}
function goView(v){
  S.view=v;renderAll();window.scrollTo({top:0});
}
function setTab(k){
  S.tab=k;S.view='edit';renderAll();queueSave();
  window.scrollTo({top:0});
}

/* ---------- edit view ---------- */
function inputHTML(scope,id,val,ph,extra){
  return '<input type="text" id="'+scope+'-'+id+'" data-s="'+scope+'" data-k="'+id+'" value="'+esc(val)+'" placeholder="'+esc(ph?'مثال: '+ph:'')+'" autocomplete="off" '+(extra||'')+'>';
}
function toolsHTML(k){
  var b='<button type="button" class="btn" data-act="newrep">'+icon('plus')+'تقرير جديد</button>'+
    '<button type="button" class="btn" data-act="copyprev">'+icon('copy')+'نسخ من تقرير سابق</button>';
  if(k==='daily'){b+='<button type="button" class="btn" data-act="book">'+icon('cam')+'قراءة صفحة الكتاب بالتصوير</button>';}
  if(k==='weekly'){b+='<button type="button" class="btn accent" data-act="aggregate">'+icon('wand')+'تعبئة من تقاريري اليومية</button>';}
  if(k==='monthly'){b+='<button type="button" class="btn accent" data-act="aggregate">'+icon('wand')+'تعبئة من تقارير الشهر</button>';}
  return '<section class="card tools"><div class="btnrow">'+b+'</div></section>';
}
function editHTML(){
  var k=S.tab,T=TABS[k],r=rep(k),v=r.v,imgs=r.imgs,P=prof(),h='';
  var prof_=PROFILE.map(function(f){
    if(f.type==='select'){
      var o='<option value="">اختر الفصل</option>'+f.opts.map(function(x){return '<option'+(P.p[f.id]===x?' selected':'')+'>'+x+'</option>';}).join('');
      return '<div class="field"><label class="l" for="p-'+f.id+'">'+f.label+'</label><select id="p-'+f.id+'" data-s="p" data-k="'+f.id+'">'+o+'</select></div>';
    }
    return '<div class="field"><label class="l" for="p-'+f.id+'">'+f.label+'</label>'+inputHTML('p',f.id,P.p[f.id],f.ph)+'</div>';
  }).join('');
  h+='<details class="card" id="prof"'+(P.p.school?'':' open')+'><summary><span>بيانات المدرسة والمعلم</span><small>تُدخل مرة واحدة وتظهر في كل التقارير</small></summary><div class="grid prof-grid">'+prof_+'</div></details>';
  h+=toolsHTML(k);

  var meta=T.meta.map(function(m){return '<div class="field"><label class="l" for="t-'+m.id+'">'+m.label+'</label>'+inputHTML('t',m.id,v[m.id],m.ph)+'</div>';}).join('');
  h+='<section class="card"><h2>'+T.title+'</h2><div class="grid">'+
    '<div class="field key wide'+(v.topic?'':' empty')+'" id="keyField"><label class="l" for="t-topic">'+T.topic.label+'</label>'+inputHTML('t','topic',v.topic,T.topic.ph)+'<small>يعتمد عليه الذكاء الاصطناعي عند التعبئة التلقائية</small></div>'+
    meta+
    '<div class="field"><label class="l" for="t-date">'+T.dateLabel+'</label><input type="date" id="t-date" data-s="t" data-k="date" value="'+esc(v.date)+'"><small id="hj"></small></div>'+
    '</div></section>';

  T.sections.forEach(function(s){
    if(s.t==='pct'){
      h+='<section class="card"><h2>'+s.label+(s.ai===false&&s.note?' <small>'+esc(s.note)+'</small>':'')+'</h2><div class="pct"><input type="number" id="t-'+s.id+'" data-s="t" data-k="'+s.id+'" min="0" max="100" inputmode="numeric" value="'+esc(v[s.id])+'" placeholder="مثال: '+s.ph+'" aria-label="'+s.label+'"><span aria-hidden="true">%</span></div></section>';
      return;
    }
    var rows='',withAI=s.ai!==false;
    for(var i=0;i<s.n;i++){
      var key=s.id+'_'+i,ph=s.ph[i]||s.ph[0];
      rows+='<div class="row"><span class="num" aria-hidden="true">'+(i+1)+'</span><input type="text" id="t-'+key+'" data-s="t" data-k="'+key+'" maxlength="90" value="'+esc(v[key])+'" placeholder="'+esc('مثال: '+ph)+'" aria-label="'+esc(s.label+' '+(i+1))+'" autocomplete="off">'+
        (withAI?'<button type="button" class="cellai" data-cellai="'+key+'" aria-label="اقتراحات بالذكاء الاصطناعي للخانة '+(i+1)+'">'+icon('ai')+'</button>':'')+'</div>';
    }
    var tools=(s.names&&P.students.length)?'<button type="button" class="btn mini" data-students="'+s.id+'">'+icon('users')+'من قائمة الطلاب</button>':'';
    h+='<section class="card"><div class="sec-head"><h2>'+s.label+(s.ai===false?' <small>'+esc(s.note||'تكتبها بنفسك')+'</small>':'')+'</h2>'+tools+'</div><div class="rows'+(s.n>=4?' two':'')+'">'+rows+'</div></section>';
  });

  var th=imgs.map(function(src,i){return '<figure><img src="'+src+'" alt="شاهد '+(i+1)+'"><button type="button" class="x" data-del="'+i+'" aria-label="حذف الصورة '+(i+1)+'">'+icon('x')+'</button></figure>';}).join('');
  if(imgs.length<MAXIMG){th+='<label class="add" for="imgFile">'+icon('img')+'<span>إضافة صورة</span></label>';}
  h+='<section class="card"><h2>الشواهد المصورة <small>حتى '+MAXIMG+' صور</small></h2><div class="thumbs">'+th+'</div></section>';

  h+='<section class="card"><h2>خيارات أخرى</h2><div class="btnrow">'+
    '<button type="button" class="btn" data-act="copy">'+icon('copy')+'نسخ التقرير كنص</button>'+
    '<button type="button" class="btn desk-hide" data-act="docx">'+icon('doc')+'ملف وورد</button>'+
    '<button type="button" class="btn" data-act="demo">'+icon('flask')+'ملء بيانات تجريبية</button>'+
    '<button type="button" class="btn danger" data-act="clear">'+icon('trash')+'حذف هذا التقرير</button>'+
    '</div></section>';
  return h;
}

function progress(){return progressOf(rep());}
function updateMeta(){
  var p=progress(),r=rep();
  $('#bar').style.width=p+'%';
  $('.progress').setAttribute('aria-valuenow',p);
  $('#pctTxt').textContent=p+'%';
  var d=dates(r.v.date),hj=$('#hj');
  if(hj){hj.textContent=d?(d.w+' · '+d.h):'';}
  var kf=$('#keyField');
  if(kf){kf.classList.toggle('empty',!String(r.v.topic||'').trim());}
}

/* ---------- archive view ---------- */
function reportTitle(r){return String(r.v.topic||'').trim()||'بدون عنوان';}
function reportSub(r){
  var d=dates(r.v.date),a=[];
  if(d){a.push(d.w+' '+d.h);}
  var T=TABS[r.type];
  if(r.type==='daily'&&r.v.period){a.push('الحصة '+r.v.period);}
  a.push('اكتمال '+progressOf(r)+'%');
  return a.join(' · ');
}
function archiveHTML(){
  var all=profReports().filter(function(r){return !isBlank(r);});
  var q=A.q.trim().toLowerCase();
  var list=all.filter(function(r){
    if(A.type&&r.type!==A.type){return false;}
    if(!q){return true;}
    return Object.keys(r.v).some(function(k){return String(r.v[k]).toLowerCase().indexOf(q)>-1;});
  }).sort(byDateDesc);
  var opts='<option value="">كل الأنواع</option>'+TAB_ORDER.map(function(k){return '<option value="'+k+'"'+(A.type===k?' selected':'')+'>'+TABS[k].label+'</option>';}).join('');
  var h='<section class="card"><h2>الأرشيف <small>'+all.length+' تقرير في هذا الملف</small></h2><div class="grid">'+
    '<div class="field"><label class="l" for="aq">بحث في التقارير</label><input type="text" id="aq" value="'+esc(A.q)+'" placeholder="عنوان درس أو كلمة" autocomplete="off"></div>'+
    '<div class="field"><label class="l" for="at">النوع</label><select id="at">'+opts+'</select></div></div></section>';
  if(!list.length){
    h+='<section class="card empty-state"><p>'+(all.length?'لا توجد تقارير مطابقة للبحث.':'لا توجد تقارير محفوظة بعد. ابدأ بتقرير جديد وسيظهر هنا تلقائيًا.')+'</p></section>';
    return h;
  }
  var cur=prof().cur;
  h+='<section class="card list">'+list.slice(0,A.n).map(function(r){
    var isCur=cur[r.type]===r.id;
    return '<article class="item"><div class="it-main"><div class="it-top"><span class="chip">'+esc(TABS[r.type].label)+'</span>'+(isCur?'<span class="chip on">المفتوح الآن</span>':'')+'<b>'+esc(reportTitle(r))+'</b></div><div class="it-meta">'+esc(reportSub(r))+'</div></div>'+
      '<div class="it-act"><button type="button" class="btn mini primary" data-open="'+r.id+'">فتح</button><button type="button" class="btn mini" data-dup="'+r.id+'">نسخ كجديد</button><button type="button" class="btn mini danger" data-delrep="'+r.id+'" aria-label="حذف التقرير">'+icon('trash')+'</button></div></article>';
  }).join('')+'</section>';
  if(list.length>A.n){h+='<div class="btnrow center"><button type="button" class="btn" data-act="more">عرض المزيد ('+(list.length-A.n)+')</button></div>';}
  return h;
}

/* ---------- dashboard ---------- */
function barChart(items,opts){
  /* items: [{label,value}], newest first; drawn right to left because the page is RTL */
  var W=340,H=170,padB=34,padT=18,padL=28,padR=10,n=items.length,gap=8;
  var bw=Math.max(10,(W-padL-padR-gap*(n-1))/n),max=100,svg='';
  svg+='<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+(H-padB)+'" y2="'+(H-padB)+'" class="ax"/>';
  [50,100].forEach(function(g){var y=padT+(H-padB-padT)*(1-g/max);svg+='<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+y+'" y2="'+y+'" class="gl"/><text x="'+(padL-5)+'" y="'+(y+4)+'" text-anchor="end" class="tx">'+g+'</text>';});
  items.forEach(function(it,i){
    var x=W-padR-bw-i*(bw+gap);
    if(it.value==null){svg+='<rect x="'+x+'" y="'+(H-padB-3)+'" width="'+bw+'" height="3" class="bar0"/>';}
    else{
      var h=(H-padB-padT)*it.value/max,y=H-padB-h;
      svg+='<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+h+'" rx="3" class="bar"/><text x="'+(x+bw/2)+'" y="'+(y-4)+'" text-anchor="middle" class="tv">'+it.value+'</text>';
    }
    svg+='<text x="'+(x+bw/2)+'" y="'+(H-padB+14)+'" text-anchor="middle" class="tx">'+esc(it.label)+'</text>';
  });
  return '<svg viewBox="0 0 '+W+' '+H+'" class="chart" role="img" aria-label="'+esc(opts.aria)+'">'+svg+'</svg>';
}
function dashHTML(){
  var all=profReports().filter(function(r){return !isBlank(r);});
  var daily=all.filter(function(r){return r.type==='daily';});
  var hk=hijriKey(today());
  var inMonth=all.filter(function(r){return hijriKey(r.v.date)===hk;}).length;
  var achAll=avgOf(daily.map(function(r){return numOf(r.v.ach);}).filter(function(x){return x!=null;}));
  var start=weekRange(today())[0],items=[];
  for(var i=9;i>=0;i--){
    var ws=addDays(start,-7*i),we=addDays(ws,6);
    var vals=daily.filter(function(r){return r.v.date>=ws&&r.v.date<=we;}).map(function(r){return numOf(r.v.ach);}).filter(function(x){return x!=null;});
    var d=parseISO(ws);
    items.push({label:d.getDate()+'/'+(d.getMonth()+1),value:avgOf(vals)});
  }
  items.reverse();
  var hasData=items.some(function(x){return x.value!=null;});
  var byType=TAB_ORDER.map(function(k){return {k:k,n:all.filter(function(r){return r.type===k;}).length};}).filter(function(x){return x.n;});
  var chal=freqList(daily,'chas').slice(0,5),ints=freqList(daily,'ints').slice(0,5);
  function list(a,empty){return a.length?'<ol class="rank">'+a.map(function(x){return '<li><span>'+esc(x.text)+'</span><b>'+x.n+'</b></li>';}).join('')+'</ol>':'<p class="muted">'+empty+'</p>';}
  var h='<section class="card"><h2>نظرة عامة</h2><div class="stats">'+
    '<div class="stat"><b>'+all.length+'</b><span>تقرير محفوظ</span></div>'+
    '<div class="stat"><b>'+inMonth+'</b><span>تقرير هذا الشهر الهجري</span></div>'+
    '<div class="stat"><b>'+(achAll==null?'—':achAll+'%')+'</b><span>متوسط تحقق الأهداف</span></div>'+
    '<div class="stat"><b>'+daily.length+'</b><span>تقرير يومي</span></div></div></section>';
  h+='<section class="card"><h2>تحقق الأهداف أسبوعيًا <small>آخر عشرة أسابيع، بحسب تقاريرك اليومية</small></h2>'+
    (hasData?barChart(items,{aria:'متوسط تحقق الأهداف لكل أسبوع'}):'<p class="muted">يظهر الرسم عندما تسجّل نسبة تحقق الأهداف في تقاريرك اليومية.</p>')+'</section>';
  h+='<section class="card"><h2>التحديات الأكثر تكرارًا</h2>'+list(chal,'لا توجد بيانات كافية بعد.')+'</section>';
  h+='<section class="card"><h2>أبرز ملاحظات التفاعل</h2>'+list(ints,'لا توجد بيانات كافية بعد.')+'</section>';
  if(byType.length){h+='<section class="card"><h2>التقارير حسب النوع</h2><div class="chips">'+byType.map(function(x){return '<span class="chip big">'+esc(TABS[x.k].label)+' <b>'+x.n+'</b></span>';}).join('')+'</div></section>';}
  return h;
}

/* ---------- settings view ---------- */
function identRow(kind,label,hint){
  var P=prof(),src=P[kind];
  return '<div class="ident"><div class="ident-prev">'+(src?'<img src="'+src+'" alt="'+esc(label)+'">':'<span>'+icon('img')+'</span>')+'</div>'+
    '<div class="ident-info"><b>'+label+'</b><small>'+hint+'</small><div class="btnrow">'+
    '<label class="btn mini" for="id-'+kind+'">'+(src?'تغيير':'رفع صورة')+'</label>'+(src?'<button type="button" class="btn mini danger" data-identdel="'+kind+'">إزالة</button>':'')+'</div>'+
    '<input class="sr" type="file" id="id-'+kind+'" data-ident="'+kind+'" accept="image/*"></div></div>';
}
function settingsHTML(){
  var P=prof(),live=liveProfiles(),h='';
  h+='<section class="card"><h2>الملف الحالي <small>لكل مادة أو صف أو مدرسة ملف مستقل</small></h2>'+
    '<div class="grid"><div class="field wide"><label class="l" for="pname">اسم الملف</label><input type="text" id="pname" value="'+esc(P.name)+'" placeholder="'+esc(profName(P))+'" autocomplete="off"><small>يظهر في القائمة العلوية. اتركه فارغًا ليُبنى من التخصص والصف.</small></div></div>'+
    '<div class="btnrow"><button type="button" class="btn" data-act="newprof">'+icon('plus')+'ملف جديد</button>'+
    '<button type="button" class="btn danger" data-act="delprof"'+(live.length<2?' disabled':'')+'>'+icon('trash')+'حذف هذا الملف</button></div></section>';
  h+='<section class="card"><h2>قائمة الطلاب <small>تُستخدم لاختيار الأسماء في التقارير</small></h2>'+
    '<div class="field"><label class="l" for="stuList">اسم كل طالب في سطر</label><textarea id="stuList" rows="6" placeholder="أحمد محمد&#10;خالد علي">'+esc(P.students.join('\n'))+'</textarea><small id="stuCount">'+P.students.length+' طالب</small></div></section>';
  h+='<section class="card"><h2>الهوية على الورقة <small>تظهر في أعلى التقرير وعند التوقيع</small></h2><div class="idents">'+
    identRow('logo','شعار المدرسة','يظهر بجانب اسم المدرسة')+
    identRow('sign','توقيع المعلم','يفضّل صورة على خلفية بيضاء')+
    identRow('stamp','ختم أو توقيع المدير','يظهر عند خانة المدير')+'</div></section>';
  h+='<section class="card"><h2>نسخة احتياطية <small>تحمي بياناتك عند تغيير الجهاز أو مسح المتصفح</small></h2>'+
    '<p class="muted">يحتفظ المتصفح ببياناتك على هذا الجهاز فقط. نزّل نسخة من وقت لآخر، أو فعّل المزامنة بين أجهزتك.</p>'+
    '<div class="btnrow"><button type="button" class="btn" data-act="backup">'+icon('down')+'تنزيل نسخة احتياطية</button>'+
    '<label class="btn" for="restoreFile">'+icon('up')+'استيراد نسخة</label></div></section>';
  h+=syncCardHTML();
  h+='<section class="card"><h2>تثبيت على الجوال</h2><p class="muted" id="installNote">'+installNote()+'</p>'+
    '<div class="btnrow"><button type="button" class="btn" data-act="install" id="installBtn"'+(deferredInstall?'':' hidden')+'>'+icon('phone')+'تثبيت التطبيق</button></div></section>';
  return h;
}
function installNote(){
  var ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches){return 'التطبيق مثبّت على هذا الجهاز.';}
  if(deferredInstall){return 'ثبّت الصفحة لتفتحها كتطبيق من الشاشة الرئيسية، وتعمل حتى دون إنترنت.';}
  if(ios){return 'في آيفون: افتح الصفحة في سفاري، اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية». التثبيت يحميها أيضًا من حذف المتصفح لبياناتها.';}
  return 'في كروم: افتح قائمة المتصفح ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».';
}

/* ---------- modal helpers ---------- */
var dlgAction=null;
function openDlg(o){
  lastFocus=document.activeElement;dlgAction=o.onOk;
  $('#dlgT').textContent=o.title;$('#dlgP').textContent=o.text;$('#dlgOk').textContent=o.ok||'حذف';
  $('#dlg').hidden=false;$('#dlgOk').focus();
}
function closeDlg(){$('#dlg').hidden=true;dlgAction=null;if(lastFocus&&lastFocus.focus){lastFocus.focus();}}

var pickAction=null;
function openPicker(o){
  lastFocus=document.activeElement;
  $('#pickT').textContent=o.title;
  var body='',foot=$('#pickFoot');
  if(!o.items.length){body='<p class="muted pad">'+esc(o.empty||'لا توجد عناصر.')+'</p>';}
  else if(o.multi){
    body=o.items.map(function(it){return '<label class="pitem"><input type="checkbox" value="'+esc(it.id)+'"><span><b>'+esc(it.label)+'</b>'+(it.sub?'<small>'+esc(it.sub)+'</small>':'')+'</span></label>';}).join('');
  }else{
    body=o.items.map(function(it){return '<button type="button" class="pitem" data-pick="'+esc(it.id)+'"><span><b>'+esc(it.label)+'</b>'+(it.sub?'<small>'+esc(it.sub)+'</small>':'')+'</span></button>';}).join('');
  }
  $('#pickBody').innerHTML=body;
  foot.hidden=!(o.multi&&o.items.length);
  if(o.okLabel){$('#pickOk').textContent=o.okLabel;}
  pickAction=o.onPick;
  $('#pick').hidden=false;
  var f=$('#pickBody button,#pickBody input');if(f){f.focus();}else{$('#pick [data-pickclose]').focus();}
}
function closePicker(){$('#pick').hidden=true;pickAction=null;if(lastFocus&&lastFocus.focus){lastFocus.focus();}}

/* ---------- preview ---------- */
function layoutPreview(){
  var body=$('#pvBody'),wrap=$('#pvWrap'),sheet=wrap.firstElementChild;
  if(!sheet){return;}
  var w=Math.min(794,body.clientWidth-28);if(w<200){w=200;}
  var s=w/794;
  sheet.style.transform='scale('+s+')';
  wrap.style.width=w+'px';
  wrap.style.height=Math.ceil(sheet.offsetHeight*s)+'px';
}
function openPreview(){
  lastFocus=document.activeElement;
  $('#pvWrap').innerHTML=sheetHTML(rep());
  $('#pv').hidden=false;
  layoutPreview();
  $('#pvClose').focus();
}
function closePreview(){$('#pv').hidden=true;$('#pvWrap').innerHTML='';if(lastFocus&&lastFocus.focus){lastFocus.focus();}}
