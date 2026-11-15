/* ---------- printed sheet ---------- */
function gridClass(n){return (n===4||n===2)?'c2':'c3';}
function sheetCells(r){
  var T=TABS[r.type],v=r.v,p=prof().p,dt=dates(v.date);
  var dtxt=dt?(dt.w+' '+dt.h+' الموافق '+dt.g):'';
  var info=[['التخصص',p.spec],['الفصل الدراسي',p.term],['الصف',p.grade]];
  if(r.type==='daily'){
    info.push(['الوحدة الدراسية',v.unit],[T.topic.label,v.topic],['الحصة',v.period],[T.dateLabel,dtxt,'w3']);
  }else{
    var items=[[T.topic.label,v.topic]].concat(T.meta.map(function(m){return [m.label,v[m.id]];}));
    if(items.length===1){info.push(items[0],[T.dateLabel,dtxt,'w2']);}
    else{info=info.concat(items);info.push([T.dateLabel,dtxt,'w3']);}
  }
  return info;
}
function sheetHTML(r){
  var T=TABS[r.type],v=r.v,P=prof(),p=P.p,imgs=r.imgs||[];
  function cell(c){return '<div class="sh-c '+(c[2]||'')+'"><b>'+esc(c[0])+'</b><span>'+esc(c[1]||'')+'</span></div>';}
  var info=sheetCells(r).map(cell).join('');
  var secs=T.sections.map(function(s){
    if(s.t==='pct'){var x=v[s.id];return '<div class="sh-sec"><div class="sh-h">'+esc(s.label)+'</div><div class="sh-pct">'+(x!==''&&x!=null?esc(x)+'%':'&nbsp;')+'</div></div>';}
    var cells='';
    for(var i=0;i<s.n;i++){cells+='<div class="sh-cell"><span class="sh-n">'+(i+1)+'</span><span>'+esc(v[s.id+'_'+i]||'')+'</span></div>';}
    return '<div class="sh-sec"><div class="sh-h">'+esc(s.label)+'</div><div class="sh-cells '+gridClass(s.n)+'">'+cells+'</div></div>';
  }).join('');
  var im=imgs.length?'<div class="sh-sec"><div class="sh-h">الشواهد المصورة</div><div class="sh-imgs">'+imgs.map(function(s){return '<img src="'+s+'" alt="">';}).join('')+'</div></div>':'';
  var brand='<div class="sh-brand"><div class="sh-org"><b>'+esc(p.school||'')+'</b>'+esc(p.eduDept||'')+'</div>'+(P.logo?'<img class="sh-logo" src="'+P.logo+'" alt="">':'')+'</div>';
  return '<div class="sheet">'+
    '<div class="sh-head"><div><div class="sh-title">'+esc(T.title)+'</div><div class="sh-sub">'+esc(p.teacher?('المعلم: '+p.teacher):'')+'</div></div>'+brand+'</div>'+
    '<div class="sh-info">'+info+'</div>'+secs+im+
    '<div class="sh-sign"><div><b>المعلم</b> '+esc(p.teacher||'')+'<br><b>التوقيع</b> '+(P.sign?'<img class="sh-sig" src="'+P.sign+'" alt="">':'')+'</div>'+
    '<div><b>مدير المدرسة</b> '+esc(p.principal||'')+'<br><b>التوقيع والختم</b> '+(P.stamp?'<img class="sh-sig sh-stamp" src="'+P.stamp+'" alt="">':'')+'</div></div>'+
  '</div>';
}
function reportText(r){
  var T=TABS[r.type],v=r.v,p=prof().p,dt=dates(v.date),L=[];
  L.push(T.title);
  if(p.school){L.push(p.school+(p.eduDept?' - '+p.eduDept:''));}
  var meta=[];
  if(p.teacher){meta.push('المعلم: '+p.teacher);}
  if(p.spec){meta.push('التخصص: '+p.spec);}
  if(p.grade){meta.push('الصف: '+p.grade);}
  if(p.term){meta.push(p.term);}
  if(meta.length){L.push(meta.join(' | '));}
  if(dt){L.push('التاريخ: '+dt.w+' '+dt.h+' الموافق '+dt.g);}
  if(v.topic){L.push(T.topic.label+': '+v.topic);}
  T.meta.forEach(function(m){if(v[m.id]){L.push(m.label+': '+v[m.id]);}});
  T.sections.forEach(function(s){
    if(s.t==='pct'){if(v[s.id]!==''&&v[s.id]!=null){L.push('');L.push(s.label+': '+v[s.id]+'%');}return;}
    var items=[];
    for(var i=0;i<s.n;i++){var x=String(v[s.id+'_'+i]||'').trim();if(x){items.push((items.length+1)+'. '+x);}}
    if(items.length){L.push('');L.push(s.label+':');items.forEach(function(x){L.push(x);});}
  });
  return L.join('\n');
}
/* ASCII names: some browsers drop the whole name when it holds Arabic letters */
function fileBase(r){return 'report-'+r.type+'-'+(r.v.date||today());}

/* ---------- Word (.docx) built by hand so Arabic stays right to left ---------- */
function xesc(s){return String(s==null?'':s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function wRun(text,o){
  o=o||{};var sz=o.sz||24;
  return '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'+(o.b?'<w:b/><w:bCs/>':'')+(o.color?'<w:color w:val="'+o.color+'"/>':'')+'<w:sz w:val="'+sz+'"/><w:szCs w:val="'+sz+'"/><w:rtl/></w:rPr><w:t xml:space="preserve">'+xesc(text)+'</w:t></w:r>';
}
function wPara(runs,o){
  o=o||{};
  var pad=o.fill?'<w:pBdr><w:top w:val="single" w:sz="4" w:space="2" w:color="'+o.fill+'"/><w:left w:val="single" w:sz="4" w:space="6" w:color="'+o.fill+'"/><w:bottom w:val="single" w:sz="4" w:space="2" w:color="'+o.fill+'"/><w:right w:val="single" w:sz="4" w:space="6" w:color="'+o.fill+'"/></w:pBdr>':'';
  return '<w:p><w:pPr>'+(o.keep?'<w:keepNext/>':'')+pad+(o.fill?'<w:shd w:val="clear" w:color="auto" w:fill="'+o.fill+'"/>':'')+'<w:bidi/><w:spacing w:before="'+(o.before||0)+'" w:after="'+(o.after==null?60:o.after)+'"/>'+(o.center?'<w:jc w:val="center"/>':'')+'</w:pPr>'+(runs||'')+'</w:p>';
}
var DOCX_W=10306;
function wCell(w,inner,o){
  o=o||{};
  return '<w:tc><w:tcPr><w:tcW w:w="'+w+'" w:type="dxa"/>'+(o.span?'<w:gridSpan w:val="'+o.span+'"/>':'')+(o.noBorder?'<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>':'')+(o.fill?'<w:shd w:val="clear" w:color="auto" w:fill="'+o.fill+'"/>':'')+'</w:tcPr>'+(inner||wPara(''))+'</w:tc>';
}
function wTable(cols,rows,o){
  o=o||{};var bd=o.noBorder?'':'<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CBD3DC"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CBD3DC"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD3DC"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CBD3DC"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD3DC"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD3DC"/></w:tblBorders>';
  return '<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="'+DOCX_W+'" w:type="dxa"/>'+bd+'<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+cols.map(function(c){return '<w:gridCol w:w="'+c+'"/>';}).join('')+'</w:tblGrid>'+
    rows.map(function(r){return '<w:tr><w:trPr><w:cantSplit/></w:trPr>'+r+'</w:tr>';}).join('')+'</w:tbl>'+wPara('',{after:0});
}
function dataUrlBytes(u){
  var m=/^data:image\/(png|jpeg|jpg);base64,(.*)$/.exec(u||'');if(!m){return null;}
  var bin=atob(m[2]),a=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++){a[i]=bin.charCodeAt(i);}
  return {ext:m[1]==='png'?'png':'jpeg',bytes:a};
}
function imgSize(u){
  return new Promise(function(res){var im=new Image();im.onload=function(){res({w:im.naturalWidth||1,h:im.naturalHeight||1});};im.onerror=function(){res({w:4,h:3});};im.src=u;});
}
async function buildDocx(r){
  await needLib('jszip');
  var T=TABS[r.type],v=r.v,P=prof(),p=P.p,zip=new window.JSZip(),rels=[],media=0,docId=1;
  async function pic(u,maxW,maxH){
    var d=dataUrlBytes(u);if(!d){return '';}
    var sz=await imgSize(u),k=Math.min(maxW/sz.w,maxH/sz.h),cx=Math.round(sz.w*k),cy=Math.round(sz.h*k);
    media++;var name='image'+media+'.'+d.ext,rid='rId'+(media+10);
    zip.file('word/media/'+name,d.bytes);rels.push('<Relationship Id="'+rid+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/'+name+'"/>');
    var id=docId++;
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+id+'" name="Picture '+id+'"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="'+id+'" name="'+name+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+rid+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }
  var body='';
  var brand=wRun(p.school||'',{b:true,sz:26})+(p.eduDept?'<w:r><w:br/></w:r>'+wRun(p.eduDept,{sz:20,color:'5A6672'}):'');
  var logo=P.logo?await pic(P.logo,900000,700000):'';
  var headRight=wPara(wRun(T.title,{b:true,sz:40,color:'2D4A9E'}),{after:20})+wPara(p.teacher?wRun('المعلم: '+p.teacher,{sz:22,color:'5A6672'}):'',{after:0});
  var headLeft=wPara(brand,{after:20})+(logo?wPara(logo,{after:0}):'');
  body+=wTable([6200,4106],[wCell(6200,headRight,{noBorder:true})+wCell(4106,headLeft,{noBorder:true})],{noBorder:true});
  /* info grid, three columns */
  var cells=sheetCells(r),colW=Math.floor(DOCX_W/3),rows=[],cur=[],used=0;
  cells.forEach(function(c){
    var span=c[2]==='w3'?3:(c[2]==='w2'?2:1);
    if(used+span>3){rows.push(cur.join(''));cur=[];used=0;}
    var w=colW*span+(span===3?DOCX_W-colW*3:0);
    cur.push(wCell(w,wPara(wRun(c[0],{sz:18,color:'5A6672'}),{after:0})+wPara(wRun(c[1]||' ',{b:true,sz:22}),{after:20}),{span:span>1?span:0}));
    used+=span;
    if(used===3){rows.push(cur.join(''));cur=[];used=0;}
  });
  if(cur.length){while(used<3){cur.push(wCell(colW,wPara('')));used++;}rows.push(cur.join(''));}
  body+=wTable([colW,colW,DOCX_W-colW*2],rows);
  T.sections.forEach(function(s){
    body+=wPara(wRun(s.label,{b:true,sz:24,color:'FFFFFF'}),{fill:'2D4A9E',before:100,after:60,keep:true});
    if(s.t==='pct'){
      var x=v[s.id];body+=wTable([DOCX_W],[wCell(DOCX_W,wPara(wRun(x!==''&&x!=null?x+'%':' ',{b:true,sz:28}),{after:20}))]);
      return;
    }
    var nc=gridClass(s.n)==='c2'?2:3,cw=Math.floor(DOCX_W/nc),rr=[],cc=[];
    for(var i=0;i<s.n;i++){
      cc.push(wCell(i%nc===nc-1?DOCX_W-cw*(nc-1):cw,wPara(wRun((i+1)+'. ',{b:true,color:'2D4A9E',sz:22})+wRun(v[s.id+'_'+i]||' ',{sz:22}),{after:20})));
      if(cc.length===nc){rr.push(cc.join(''));cc=[];}
    }
    if(cc.length){while(cc.length<nc){cc.push(wCell(cw,wPara('')));}rr.push(cc.join(''));}
    body+=wTable(Array.apply(null,Array(nc)).map(function(_,i){return i===nc-1?DOCX_W-cw*(nc-1):cw;}),rr);
  });
  if((r.imgs||[]).length){
    body+=wPara(wRun('الشواهد المصورة',{b:true,color:'FFFFFF'}),{fill:'2D4A9E',before:100,after:60,keep:true});
    var half=Math.floor(DOCX_W/2),ir=[],ic=[];
    for(var j=0;j<r.imgs.length;j++){
      ic.push(wCell(j%2===1?DOCX_W-half:half,wPara(await pic(r.imgs[j],3100000,2300000),{center:true,after:20})));
      if(ic.length===2){ir.push(ic.join(''));ic=[];}
    }
    if(ic.length){ic.push(wCell(DOCX_W-half,wPara('')));ir.push(ic.join(''));}
    body+=wTable([half,DOCX_W-half],ir);
  }
  var sig=P.sign?await pic(P.sign,1300000,520000):'',stamp=P.stamp?await pic(P.stamp,1000000,800000):'';
  body+=wPara('',{before:200,after:0});
  body+=wTable([Math.floor(DOCX_W/2),DOCX_W-Math.floor(DOCX_W/2)],[
    wCell(Math.floor(DOCX_W/2),wPara(wRun('المعلم: ',{sz:20,color:'5A6672'})+wRun(p.teacher||'',{b:true,sz:22}),{after:40})+wPara(wRun('التوقيع: ',{sz:20,color:'5A6672'})+sig,{after:0})) +
    wCell(DOCX_W-Math.floor(DOCX_W/2),wPara(wRun('مدير المدرسة: ',{sz:20,color:'5A6672'})+wRun(p.principal||'',{b:true,sz:22}),{after:40})+wPara(wRun('التوقيع والختم: ',{sz:20,color:'5A6672'})+stamp,{after:0}))
  ],{noBorder:true});
  var NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  var XML='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  zip.file('[Content_Types].xml',XML+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  zip.file('_rels/.rels',XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels',XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+rels.join('')+'</Relationships>');
  zip.file('word/styles.xml',XML+'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="ar-SA" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>');
  zip.file('word/document.xml',XML+'<w:document '+NS+'><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="800" w:bottom="900" w:left="800" w:header="500" w:footer="500" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>');
  return await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
