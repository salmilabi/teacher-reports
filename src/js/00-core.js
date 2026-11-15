'use strict';
var MAXIMG=4;
var LEGACY_KEY='teacher-reports:v1';
/* Address of the Cloudflare Worker that relays AI requests and encrypted sync blobs. Leave empty to hide those features outside Claude. */
var AI_ENDPOINT='https://teacher-reports-ai.taj-academy.workers.dev/';
var SYNC_ENDPOINT=AI_ENDPOINT?AI_ENDPOINT+'sync':'';
var CDN={
  html2pdf:'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  jszip:'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
};

var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function icon(id){return '<svg class="i" aria-hidden="true"><use href="#i-'+id+'"/></svg>';}

/* ---------- dates ---------- */
function pad(n){return String(n).padStart(2,'0');}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function today(){return iso(new Date());}
function parseISO(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');return m?new Date(+m[1],+m[2]-1,+m[3],12):null;}
function fmt(loc,o,dt){try{return new Intl.DateTimeFormat(loc,o).format(dt);}catch(e){return '';}}
function dates(s){
  var dt=parseISO(s);if(!dt){return null;}
  return {
    w:fmt('ar-SA-u-ca-gregory',{weekday:'long'},dt),
    h:fmt('ar-SA-u-ca-islamic-umalqura-nu-latn',{day:'numeric',month:'long',year:'numeric'},dt),
    g:fmt('ar-SA-u-ca-gregory-nu-latn',{day:'numeric',month:'long',year:'numeric'},dt)
  };
}
function shortHijri(s){var dt=parseISO(s);return dt?fmt('ar-SA-u-ca-islamic-umalqura-nu-latn',{day:'numeric',month:'long'},dt):'';}
function addDays(s,n){var d=parseISO(s);if(!d){return s;}d.setDate(d.getDate()+n);return iso(d);}
function numOf(x){if(x==null||String(x).trim()===''){return null;}var n=Number(x);return isNaN(n)?null:n;}
function avgOf(a){return a.length?Math.round(a.reduce(function(x,y){return x+y;},0)/a.length):null;}
/* The school week runs Sunday to Saturday here; reports are grouped by it. */
function weekRange(s){
  var d=parseISO(s);if(!d){return null;}
  var a=new Date(d);a.setDate(d.getDate()-d.getDay());
  var b=new Date(a);b.setDate(a.getDate()+6);
  return [iso(a),iso(b)];
}
function hijriKey(s){
  var d=parseISO(s);if(!d){return '';}
  try{
    var o={};
    new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn',{year:'numeric',month:'numeric',day:'numeric'}).formatToParts(d).forEach(function(x){o[x.type]=x.value;});
    return o.year+'-'+o.month;
  }catch(e){return String(s).slice(0,7);}
}
function hijriMonthName(s){var d=parseISO(s);return d?fmt('ar-SA-u-ca-islamic-umalqura-nu-latn',{month:'long'},d):'';}

var timer=null;
function toast(msg){var t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(timer);timer=setTimeout(function(){t.classList.remove('on');},3400);}

function loadScript(url){
  return new Promise(function(res,rej){
    var s=document.createElement('script');s.src=url;s.onload=function(){res();};s.onerror=function(){rej(new Error('load '+url));};
    document.head.appendChild(s);
  });
}
var libs={};
function needLib(name){
  var test={html2pdf:function(){return window.html2pdf;},jszip:function(){return window.JSZip;}}[name];
  if(test()){return Promise.resolve();}
  if(!libs[name]){libs[name]=loadScript(CDN[name]).catch(function(e){libs[name]=null;throw e;});}
  return libs[name];
}

/* ---------- configuration ---------- */
var TERMS=['الفصل الدراسي الأول','الفصل الدراسي الثاني'];
var PROFILE=[
  {id:'eduDept',label:'إدارة التعليم',ph:'إدارة تعليم المنطقة'},
  {id:'school',label:'اسم المدرسة',ph:'المدرسة المتوسطة'},
  {id:'spec',label:'التخصص',ph:'رياضيات'},
  {id:'term',label:'الفصل الدراسي',type:'select',opts:TERMS},
  {id:'grade',label:'الصف',ph:'الثاني المتوسط'},
  {id:'teacher',label:'اسم المعلم',ph:'الاسم الثلاثي'},
  {id:'principal',label:'مدير المدرسة',ph:'الاسم الثلاثي'}
];

var TABS={
  daily:{group:'main',label:'اليومي',title:'التقرير اليومي',topic:{label:'عنوان الدرس',ph:'الكسور العشرية'},
    meta:[{id:'unit',label:'الوحدة الدراسية',ph:'الوحدة الثالثة'},{id:'period',label:'الحصة',ph:'الثالثة'}],
    dateLabel:'تاريخ الحصة',
    sections:[
      {t:'list',id:'objs',label:'أهداف الدرس',n:6,ai:true,ph:['يقارن بين كسرين عشريين','يرتب الكسور العشرية تصاعديًا','يحول الكسر العادي إلى عشري','يحل مسائل على الجمع والطرح','يمثل الكسر العشري على خط الأعداد','يوظف الكسور في مواقف حياتية']},
      {t:'pct',id:'ach',label:'نسبة تحقق الأهداف',ai:[80,100],ph:'90'},
      {t:'list',id:'ints',label:'ملاحظات حول تفاعل الطلاب',n:6,ai:true,ph:['مشاركة نشطة في النقاش','حماس عند العمل الجماعي','أسئلة جيدة من الطلاب','تعاون واضح بين المجموعات','التزام بتعليمات النشاط','استجابة سريعة للتغذية الراجعة']},
      {t:'list',id:'chas',label:'التحديات الصفية',n:6,ai:true,ph:['ضيق وقت الحصة','تفاوت مستويات الطلاب','ضعف التركيز لدى بعض الطلاب','قلة الوسائل المتاحة','كثافة عدد الطلاب','غياب بعض الطلاب']}
    ]},
  weekly:{group:'main',label:'الأسبوعي',title:'التقرير الأسبوعي',topic:{label:'الأسبوع',ph:'الأسبوع الرابع'},meta:[],dateLabel:'تاريخ التقرير',
    sections:[
      {t:'list',id:'lessons',label:'أهم الدروس المنفذة',n:6,ai:true,ph:['مفهوم الكسر العشري','مقارنة الكسور العشرية','ترتيب الكسور العشرية','جمع الكسور العشرية','طرح الكسور العشرية','مراجعة عامة وتقويم']},
      {t:'pct',id:'ach',label:'متوسط تحقق الأهداف',ai:false,note:'يُحسب من تقاريرك اليومية',ph:'90'},
      {t:'list',id:'str',label:'أبرز نقاط القوة لدى الطلاب',n:3,ai:true,ph:['إتقان المهارات الأساسية','المشاركة الصفية الفاعلة','الالتزام بإنجاز الواجبات']},
      {t:'list',id:'weak',label:'أبرز نقاط الضعف لدى الطلاب',n:3,ai:true,ph:['ضعف في حل المسائل اللفظية','أخطاء في ترتيب العمليات','تردد في المشاركة الفردية']},
      {t:'list',id:'chal',label:'أبرز التحديات التعليمية',n:3,ai:true,ph:['تفاوت مستويات الطلاب','ضيق الوقت المخصص','قلة التطبيقات العملية']},
      {t:'list',id:'act',label:'الإجراءات العلاجية',n:3,ai:true,ph:['حصص تقوية قصيرة','أوراق عمل علاجية','تنويع أساليب الشرح']},
      {t:'list',id:'imp',label:'أثر الإجراءات على تقدم الطلاب',n:3,ai:true,ph:['تحسن ملحوظ في التطبيق','ارتفاع نسبة المشاركة','انخفاض الأخطاء المتكررة']},
      {t:'list',id:'rec',label:'توصيات الأسبوع القادم',n:3,ai:true,ph:['تكثيف التدريب الفردي','توظيف التقنية في الشرح','متابعة الطلاب المتعثرين']}
    ]},
  monthly:{group:'main',label:'الشهري',title:'التقرير الشهري',topic:{label:'الشهر',ph:'ربيع الآخر'},meta:[],dateLabel:'تاريخ التقرير',
    sections:[
      {t:'pct',id:'prog',label:'نسبة الإنجاز',ai:[85,100],ph:'95'},
      {t:'list',id:'imps',label:'أبرز التحسينات في أداء الطلاب',n:3,ai:true,ph:['ارتفاع مستوى التحصيل','تحسن في الانضباط الصفي','زيادة المشاركة الصفية']},
      {t:'list',id:'iss',label:'القضايا المستمرة التي تحتاج متابعة',n:3,ai:true,ph:['تأخر بعض الطلاب في الواجبات','ضعف مهارات الحساب الذهني','تكرار الغياب لدى بعض الطلاب']},
      {t:'list',id:'plans',label:'خطط المعالجة المقترحة',n:3,ai:true,ph:['برنامج تقوية أسبوعي','التواصل مع أولياء الأمور','تنويع أنشطة التعلم']},
      {t:'list',id:'top',label:'الطلاب المتميزون',n:4,ai:false,names:true,note:'أسماء تكتبها بنفسك',ph:['اسم الطالب']},
      {t:'list',id:'enr',label:'الخطة الإثرائية للطلاب المتميزين',n:3,ai:true,ph:['مسائل إثرائية متقدمة','مشاريع بحثية قصيرة','قيادة مجموعات التعلم']},
      {t:'list',id:'fail',label:'الطلاب المخفقون',n:4,ai:false,names:true,note:'أسماء تكتبها بنفسك',ph:['اسم الطالب']},
      {t:'list',id:'rem',label:'خطة المعالجة للمخفقين',n:3,ai:true,ph:['حصص علاجية فردية','تبسيط المهارات خطوة بخطوة','متابعة أسبوعية مع ولي الأمر']}
    ]},
  remedial:{group:'more',label:'الخطة العلاجية',title:'الخطة العلاجية',topic:{label:'المهارة المستهدفة',ph:'مقارنة الكسور العشرية'},
    meta:[{id:'dur',label:'مدة الخطة',ph:'أسبوعان'},{id:'cnt',label:'عدد الطلاب المستهدفين',ph:'8'}],dateLabel:'تاريخ بدء الخطة',
    sections:[
      {t:'list',id:'stu',label:'الطلاب المستهدفون',n:6,ai:false,names:true,note:'أسماء تكتبها بنفسك',ph:['اسم الطالب']},
      {t:'list',id:'cause',label:'أسباب الضعف',n:3,ai:true,ph:['ضعف في إتقان الأساسيات','قلة التدريب المنزلي','صعوبة في فهم المفهوم']},
      {t:'list',id:'proc',label:'الإجراءات العلاجية',n:4,ai:true,ph:['حصص علاجية قصيرة','أوراق عمل متدرجة','تعلم بالأقران','متابعة فردية أسبوعية']},
      {t:'list',id:'tools',label:'الأنشطة والوسائل',n:3,ai:true,ph:['بطاقات تعليمية','ألعاب تعليمية','عروض تقنية مبسطة']},
      {t:'pct',id:'gain',label:'نسبة التحسن بعد التنفيذ',ai:false,note:'تسجلها بعد انتهاء الخطة',ph:'80'}
    ]},
  initiative:{group:'more',label:'مبادرة',title:'تقرير مبادرة',topic:{label:'اسم المبادرة',ph:'مبادرة قارئ الرياضيات'},
    meta:[{id:'aud',label:'الفئة المستهدفة',ph:'طلاب الصف الثاني المتوسط'},{id:'dur',label:'مدة التنفيذ',ph:'فصل دراسي'}],dateLabel:'تاريخ التقرير',
    sections:[
      {t:'list',id:'goals',label:'أهداف المبادرة',n:4,ai:true,ph:['رفع مستوى التحصيل','تنمية حب المادة','تعزيز التعلم الذاتي','دعم الطلاب المتعثرين']},
      {t:'list',id:'steps',label:'مراحل التنفيذ',n:4,ai:true,ph:['التخطيط والإعداد','الإعلان للطلاب','التنفيذ الميداني','القياس والتقويم']},
      {t:'list',id:'res',label:'الشركاء والموارد',n:3,ai:true,ph:['إدارة المدرسة','رائد النشاط','أولياء الأمور']},
      {t:'list',id:'kpi',label:'مؤشرات النجاح',n:3,ai:true,ph:['نسبة المشاركة','ارتفاع متوسط الدرجات','رضا الطلاب']},
      {t:'list',id:'out',label:'النتائج والأثر',n:3,ai:false,note:'تكتبها بعد التنفيذ',ph:['النتيجة الأولى','النتيجة الثانية','النتيجة الثالثة']}
    ]},
  visits:{group:'more',label:'زيارة صفية',title:'سجل الزيارة الصفية',topic:{label:'الدرس المزار',ph:'الكسور العشرية'},
    meta:[{id:'vis',label:'الزائر',ph:'اسم الزائر'},{id:'role',label:'صفة الزائر',ph:'مشرف تربوي'}],dateLabel:'تاريخ الزيارة',
    sections:[
      {t:'list',id:'pos',label:'نقاط القوة المرصودة',n:3,ai:false,note:'من ملاحظات الزائر',ph:['تنوع أساليب الشرح','إدارة صفية جيدة','تفاعل الطلاب']},
      {t:'list',id:'obs',label:'الملاحظات والتوصيات',n:3,ai:false,note:'من ملاحظات الزائر',ph:['زيادة التقويم التكويني','توظيف الوسائل الحديثة','ضبط زمن الحصة']},
      {t:'list',id:'dev',label:'خطة التطوير بعد الزيارة',n:3,ai:true,ph:['حضور ورشة تدريبية','تطبيق استراتيجية جديدة','زيارة تبادلية لزميل']},
      {t:'pct',id:'score',label:'درجة التقييم',ai:false,note:'اختيارية',ph:'90'}
    ]},
  weekplan:{group:'more',label:'الخطة الأسبوعية',title:'الخطة الأسبوعية',topic:{label:'الأسبوع',ph:'الأسبوع الخامس'},meta:[],dateLabel:'تاريخ بداية الأسبوع',
    sections:[
      {t:'list',id:'sun',label:'الأحد',hint:'الدروس والأنشطة المخططة ليوم الأحد',n:2,ai:true,ph:['الكسور العشرية','تدريبات الكتاب']},
      {t:'list',id:'mon',label:'الاثنين',hint:'الدروس والأنشطة المخططة ليوم الاثنين',n:2,ai:true,ph:['مقارنة الكسور','نشاط جماعي']},
      {t:'list',id:'tue',label:'الثلاثاء',hint:'الدروس والأنشطة المخططة ليوم الثلاثاء',n:2,ai:true,ph:['ترتيب الكسور','ورقة عمل']},
      {t:'list',id:'wed',label:'الأربعاء',hint:'الدروس والأنشطة المخططة ليوم الأربعاء',n:2,ai:true,ph:['جمع الكسور','مسائل حياتية']},
      {t:'list',id:'thu',label:'الخميس',hint:'الدروس والأنشطة المخططة ليوم الخميس',n:2,ai:true,ph:['مراجعة الأسبوع','اختبار قصير']}
    ]}
};
var TAB_ORDER=['daily','weekly','monthly','remedial','initiative','visits','weekplan'];
var MAIN_TABS=TAB_ORDER.filter(function(k){return TABS[k].group==='main';});
var MORE_TABS=TAB_ORDER.filter(function(k){return TABS[k].group==='more';});

function keysFor(k){
  var T=TABS[k],a=['topic'];
  T.meta.forEach(function(m){a.push(m.id);});
  T.sections.forEach(function(s){if(s.t==='pct'){a.push(s.id);}else{for(var i=0;i<s.n;i++){a.push(s.id+'_'+i);}}});
  return a;
}
function sectionLabel(T,id){var s=T.sections.filter(function(x){return x.id===id;})[0];return s?s.label:'';}
