/* ---------- grouping daily reports into weekly and monthly ones ---------- */
function normPhrase(s){return String(s).replace(/[ً-ٟـ]/g,'').replace(/[.،؛:!؟?]+$/,'').replace(/\s+/g,' ').trim();}
function freqList(reports,secId){
  var map={},order=[];
  reports.slice().sort(byDateDesc).forEach(function(r){
    for(var i=0;i<10;i++){
      var x=String(r.v[secId+'_'+i]||'').trim();if(!x){continue;}
      var k=normPhrase(x);
      if(!map[k]){map[k]={text:x,n:0};order.push(k);}
      map[k].n++;
    }
  });
  return order.map(function(k){return map[k];}).sort(function(a,b){return b.n-a.n;});
}
function topPhrases(reports,secIds,n){
  var all=[],seen={};
  secIds.forEach(function(id){freqList(reports,id).forEach(function(x){var k=normPhrase(x.text);if(!seen[k]){seen[k]=1;all.push(x);}});});
  return all.slice(0,n).map(function(x){return x.text;});
}
function inRange(r,a,b){var d=r.v.date||'';return d>=a&&d<=b;}
function emptyCells(r,s){
  var out=[];
  for(var i=0;i<s.n;i++){var key=s.id+'_'+i;if(!String(r.v[key]||'').trim()){out.push(key);}}
  return out;
}
/* Fills only empty cells and returns how many it filled. */
function fillList(r,s,arr){
  var n=0,free=emptyCells(r,s);
  for(var i=0;i<free.length&&i<arr.length;i++){r.v[free[i]]=String(arr[i]).trim().replace(/[.،؛:!؟?]+$/,'');n++;}
  return n;
}
function sectionOf(T,id){return T.sections.filter(function(s){return s.id===id;})[0];}

function sourcesFor(r){
  var P=prof(),k=r.type,d=r.v.date;
  if(!parseISO(d)){return null;}
  if(k==='weekly'){
    var w=weekRange(d);
    return {kind:'week',range:w,daily:profReports('daily',P).filter(function(x){return inRange(x,w[0],w[1])&&!isBlank(x);}),weekly:[]};
  }
  var hk=hijriKey(d);
  return {kind:'month',key:hk,
    daily:profReports('daily',P).filter(function(x){return hijriKey(x.v.date)===hk&&!isBlank(x);}),
    weekly:profReports('weekly',P).filter(function(x){return hijriKey(x.v.date)===hk&&!isBlank(x);})};
}
function localAggregate(r,src){
  var T=TABS[r.type],n=0,d=src.daily,w=src.weekly;
  function put(id,arr){var s=sectionOf(T,id);if(s&&arr.length){n+=fillList(r,s,arr);}}
  function putPct(id,val){if(val!=null&&String(r.v[id]||'')===''){r.v[id]=String(val);n++;}}
  if(r.type==='weekly'){
    if(!String(r.v.topic||'').trim()){
      r.v.topic='من '+shortHijri(src.range[0])+' إلى '+shortHijri(addDays(src.range[0],4));n++;
    }
    var topics=d.slice().sort(function(a,b){return (a.v.date||'')<(b.v.date||'')?-1:1;}).map(function(x){return String(x.v.topic||'').trim();}).filter(Boolean);
    var seen={},uniq=[];topics.forEach(function(t){var k=normPhrase(t);if(!seen[k]){seen[k]=1;uniq.push(t);}});
    put('lessons',uniq);
    putPct('ach',avgOf(d.map(function(x){return numOf(x.v.ach);}).filter(function(x){return x!=null;})));
    put('str',topPhrases(d,['ints'],3));
    put('chal',topPhrases(d,['chas'],3));
  }else{
    if(!String(r.v.topic||'').trim()){r.v.topic=hijriMonthName(r.v.date);n++;}
    var src2=w.length?w:d;
    var achs=(w.length?w.map(function(x){return numOf(x.v.ach);}):[]).concat(d.map(function(x){return numOf(x.v.ach);})).filter(function(x){return x!=null;});
    putPct('prog',avgOf(achs));
    put('imps',topPhrases(w,['imp','str'],3).concat(topPhrases(d,['ints'],3)));
    put('iss',topPhrases(w,['weak','chal'],3).concat(topPhrases(d,['chas'],3)));
    put('plans',topPhrases(w,['rec','act'],3));
  }
  return n;
}
function digestOf(r,src){
  var d=src.daily,w=src.weekly,L=[];
  var topics=d.map(function(x){return String(x.v.topic||'').trim();}).filter(Boolean);
  if(topics.length){L.push('الدروس المنفذة: '+topics.slice(0,12).join('، '));}
  var a=avgOf(d.map(function(x){return numOf(x.v.ach);}).filter(function(x){return x!=null;}));
  if(a!=null){L.push('متوسط تحقق الأهداف: '+a+'%');}
  var i=topPhrases(d,['ints'],5);if(i.length){L.push('ملاحظات التفاعل المتكررة: '+i.join('، '));}
  var c=topPhrases(d,['chas'],5);if(c.length){L.push('التحديات المتكررة: '+c.join('، '));}
  ['weak','act','imp','rec'].forEach(function(id){
    var t=topPhrases(w,[id],4);if(t.length){L.push(sectionLabel(TABS.weekly,id)+': '+t.join('، '));}
  });
  return L.join('\n');
}
