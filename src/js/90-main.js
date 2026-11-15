/* ---------- events ---------- */
var ACTS={
  ai:aiFill,preview:openPreview,pdf:exportPdf,share:shareReport,docx:exportDocx,copy:copyText,demo:demo,clear:clearReport,
  newrep:newRep,copyprev:copyPrev,aggregate:aggregate,moretypes:chooseType,newprof:newProfile,delprof:deleteProfile,
  backup:backup,install:installApp,
  book:function(){$('#bookFile').click();},
  more:function(){A.n+=30;renderView();}
};
document.addEventListener('click',function(e){
  var t=e.target.closest?e.target:e.target.parentNode;
  var el;
  if((el=t.closest('[data-act]'))){var f=ACTS[el.dataset.act];if(f){f();}return;}
  if((el=t.closest('.vbtn[data-view]'))){goView(el.dataset.view);return;}
  if((el=t.closest('[data-tab]'))){setTab(el.dataset.tab);return;}
  if((el=t.closest('[data-cellai]'))){cellAI(el.dataset.cellai);return;}
  if((el=t.closest('[data-students]'))){pickStudents(el.dataset.students);return;}
  if((el=t.closest('[data-del]'))){
    var r=rep();r.imgs.splice(+el.dataset.del,1);touch(r);renderAll(true);queueSave();return;
  }
  if((el=t.closest('[data-open]'))){openReport(el.dataset.open);return;}
  if((el=t.closest('[data-dup]'))){
    var from=S.reports[el.dataset.dup];if(!from){return;}
    newReport(from.type,from);S.tab=from.type;S.view='edit';renderAll();queueSave();window.scrollTo({top:0});
    toast('نُسخ كتقرير جديد، عدّل التاريخ والتفاصيل.');return;
  }
  if((el=t.closest('[data-delrep]'))){
    var id=el.dataset.delrep;
    openDlg({title:'حذف هذا التقرير؟',text:'سيُحذف من الأرشيف نهائيًا.',ok:'حذف التقرير',onOk:function(){
      var x=S.reports[id];if(x){removeReport(x);}closeDlg();renderView();queueSave();toast('تم حذف التقرير.');
    }});return;
  }
  if((el=t.closest('[data-identdel]'))){
    prof()[el.dataset.identdel]='';touchProfile();renderView();queueSave();return;
  }
  if((el=t.closest('[data-sync]'))){syncAction(el.dataset.sync);return;}
  if((el=t.closest('[data-dlg]'))){
    if(el.dataset.dlg==='ok'){var a=dlgAction;if(a){a();}}else{closeDlg();}
    return;
  }
  if((el=t.closest('[data-pick]'))){var pa=pickAction,pid=el.dataset.pick;closePicker();if(pa){pa(pid);}return;}
  if(t.closest('[data-pickclose]')){closePicker();return;}
  if(t.closest('#pickOk')){
    var ids=$$('#pickBody input:checked').map(function(c){return c.value;}),pb=pickAction;
    closePicker();if(pb&&ids.length){pb(ids);}return;
  }
  if(t.closest('[data-sharenow]')){
    var sh=pendingShare;pendingShare=null;closePicker();
    if(sh){navigator.share(sh).catch(function(){});}
    return;
  }
  if(t.closest('[data-pvclose]')){closePreview();return;}
  if(t.classList&&t.classList.contains('overlay')){
    if(t.id==='dlg'){closeDlg();}else if(t.id==='pick'){closePicker();}else if(t.id==='pv'){closePreview();}
  }
});
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape'){return;}
  if(!$('#dlg').hidden){closeDlg();}else if(!$('#pick').hidden){closePicker();}else if(!$('#pv').hidden){closePreview();}
});

var aTimer=null;
document.addEventListener('input',function(e){
  var el=e.target;
  if(el.dataset&&el.dataset.s){
    var k=el.dataset.k;
    if(el.dataset.s==='p'){prof().p[k]=el.value;touchProfile();}
    else{var r=rep();r.v[k]=el.value;touch(r);updateMeta();}
    queueSave();return;
  }
  if(el.id==='pname'){prof().name=el.value;touchProfile();renderChrome();queueSave();return;}
  if(el.id==='stuList'){
    var seen={},list=[];
    el.value.split(/\n/).forEach(function(x){x=x.trim();if(x&&!seen[x]){seen[x]=1;list.push(x);}});
    prof().students=list;touchProfile();$('#stuCount').textContent=list.length+' طالب';queueSave();return;
  }
  if(el.id==='aq'){
    A.q=el.value;A.n=30;
    clearTimeout(aTimer);
    aTimer=setTimeout(function(){
      var pos=el.selectionStart;renderView();
      var n=$('#aq');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(x){}}
    },200);
  }
});
document.addEventListener('change',function(e){
  var el=e.target;
  if(el.id==='profSel'){S.pid=el.value;renderAll();queueSave();window.scrollTo({top:0});return;}
  if(el.id==='at'){A.type=el.value;A.n=30;renderView();return;}
  if(el.dataset&&el.dataset.s==='p'){renderChrome();return;}
  if(el.id==='imgFile'){if(el.files.length){addImages(el.files);}el.value='';return;}
  if(el.id==='bookFile'){if(el.files[0]){bookRead(el.files[0]);}el.value='';return;}
  if(el.id==='restoreFile'){if(el.files[0]){restore(el.files[0]);}el.value='';return;}
  if(el.dataset&&el.dataset.ident){if(el.files[0]){setIdent(el.dataset.ident,el.files[0]);}el.value='';}
});
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&e.target.id==='syncJoin'){e.preventDefault();syncAction('join');}
});
window.addEventListener('resize',function(){if(!$('#pv').hidden){layoutPreview();}});
window.addEventListener('pagehide',function(){saveNow();});
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden'){saveNow();}
  else if(SY.code&&Date.now()-SY.last>60000){syncNow();}
});
window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault();deferredInstall=e;
  if(S.view==='settings'){renderView();}
});
window.addEventListener('appinstalled',function(){deferredInstall=null;if(S.view==='settings'){renderView();}});

/* ---------- start ---------- */
(async function init(){
  await loadState();
  await loadSync();
  renderAll();
  if(SY.code){syncNow();}
  if('serviceWorker' in navigator&&location.protocol==='https:'&&/github\.io$/.test(location.hostname)){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  }
})();
