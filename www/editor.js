'use strict';
function $(id){return document.getElementById(id);}
var config=null,currentFloorId=null,currentLayerId=null,liveStates={};
var allIoBrokerObjects=null,ioBrokerTree=null,expandedPaths=new Set(),objectTreeContext=null;
var allMfdIcons=null,mfdBaseUrl='/icons-mfd-png/';
var editingDevice=null,editingLayerRef=null,editingIsNew=false,slotTarget=null,liveTimer=null,barIcon=null,iconTarget=null;
var pickerTab='emoji',pickerIcon=null;
var selectedDevices=new Set();
var CACHE_BUSTER='?v='+Date.now(),PRES_PORT=8084;
var DEF_VF={family:'Arial',weight:'400',size:'12px',color:'#fff',bgColor:'transparent',position:'overlay'};
var DEF_NF={family:'Arial',weight:'400',size:'12px',color:'#fff',bgColor:'transparent',position:'bottom'};
var FONTS=['Arial','Arial Black','Verdana','Tahoma','Trebuchet MS','Segoe UI','Roboto','Open Sans','Lato','Montserrat','Times New Roman','Georgia','Garamond','Courier New','Lucida Console','Impact','Comic Sans MS'];
var WEIGHTS=[['300','Light (300)'],['400','Regular (400)'],['500','Medium (500)'],['600','SemiBold (600)'],['700','Bold (700)']];
var emojiGroups={'Освещение':['💡','🔆','💫','🕯️','✨'],'Розетки':['🔌','⚡','🔋'],'Климат':['🌡️','💧','❄️'],'Безопасность':['🔒','📹','🚪'],'Мультимедиа':['🔊','📻','📺']};
function showDebug(m){var b=$('debugBanner');if(b){b.style.display='block';b.textContent=m;}}
window.addEventListener('error',function(e){showDebug('JS: '+e.message+' ('+e.lineno+')');});
function esc(s){return(s==null)?'':String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function splitKeep(v){v=String(v==null?'':v);if(v==='')return[];return v.split(',');}
function gv(id){return $(id).value;}
function sv(id,v){$(id).value=v;}
function ensureConfig(){if(!config||typeof config!=='object')config={};if(!Array.isArray(config.floors))config.floors=[];if(!Array.isArray(config.templates))config.templates=[];if(!Array.isArray(config.guides))config.guides=[];}
function normalizeType(t){if(t==='value_read'||t==='value_write'||t==='value')return'value';if(t==='list')return'switch';return t||'switch';}
function isValue(t){return t==='value';}
function iconStates(){return isValue(gv('deviceObjType'))?[{k:'min',l:'Тревога мин'},{k:'norm',l:'Норма'},{k:'max',l:'Тревога макс'}]:[{k:'on',l:'Вкл'},{k:'off',l:'Выкл'}];}
function defColor(k){return{on:'#0cbaba',off:'#7f8c8d',min:'#e74c3c',norm:'#2ecc71',max:'#e74c3c'}[k]||'#000';}
function getStateKey(dev,v){if(isValue(dev.objType)){var n=parseFloat(v);if(!isNaN(n)){if(dev.warnBelow!==''&&dev.warnBelow!=null&&n<+dev.warnBelow)return'min';if(dev.warnAbove!==''&&dev.warnAbove!=null&&n>+dev.warnAbove)return'max';}return'norm';}return v?'on':'off';}
function defaultSlots(t){return isValue(t)?{min:{kind:'emoji',value:'⚠️'},norm:{kind:'emoji',value:'🟢'},max:{kind:'emoji',value:'🔺'}}:{on:{kind:'emoji',value:'💡'},off:{kind:'emoji',value:'🌑'}};}
function defaultIcon(t){var keys=isValue(t)?['min','norm','max']:['on','off'];var bg={},co={},bd={};keys.forEach(function(k){bg[k]='#fff';co[k]=defColor(k);bd[k]=defColor(k);});return{size:48,opacity:1,bg:bg,color:co,border:bd,slots:defaultSlots(t)};}
function applyFont(el,f){el.style.fontFamily=f.family;el.style.fontWeight=f.weight;el.style.fontSize=f.size;el.style.color=f.color;if(f.bgColor&&f.bgColor!=='transparent')el.style.backgroundColor=f.bgColor;}
function fillFont(el,cur){cur=cur||'Arial';el.innerHTML='';var found=false;FONTS.forEach(function(f){var o=document.createElement('option');o.value=f;o.textContent=f;if(f===cur){o.selected=true;found=true;}el.appendChild(o);});if(!found){var o=document.createElement('option');o.value=cur;o.textContent=cur;o.selected=true;el.appendChild(o);}}
function fillWeight(el,cur){cur=String(cur||'400');if(cur==='normal')cur='400';if(cur==='bold')cur='700';el.innerHTML='';WEIGHTS.forEach(function(w){var o=document.createElement('option');o.value=w[0];o.textContent=w[1];if(w[0]===cur)o.selected=true;el.appendChild(o);});}
function barDefaults(){return{height:40,width:120,gap:8,radius:100,orient:'h',position:'top',align:'center',textAlign:'left',icon:null,iconPos:'left',active:{bg:'#0cbaba',border:'#0cbaba',font:{family:'Roboto',weight:'500',size:'14px',color:'#ffffff'}},inactive:{bg:'#2a2f36',border:'#3a4048',font:{family:'Roboto',weight:'500',size:'14px',color:'#e8eaed'}}};}
document.addEventListener('DOMContentLoaded',loadConfig);
function loadConfig(){fetch('/api/config').then(function(r){return r.json();}).then(function(d){config=d;ensureConfig();if(!currentFloorId&&config.floors[0])currentFloorId=config.floors[0].id;renderFloorWorkspace();}).catch(function(e){ensureConfig();renderFloorWorkspace();showDebug('Ошибка: '+e.message);});}
function saveConfig(cb){fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)}).then(function(){if(cb)cb();}).catch(function(){showDebug('Ошибка сохранения');});}
function moveFloor(i,dir){var a=config.floors;var j=i+dir;if(j<0||j>=a.length)return;var t=a[i];a[i]=a[j];a[j]=t;saveConfig(renderFloorWorkspace);}
function moveLayer(fIdx,i,dir){var a=config.floors[fIdx].layers;var j=i+dir;if(j<0||j>=a.length)return;var t=a[i];a[i]=a[j];a[j]=t;saveConfig(renderFloorWorkspace);}
function openPreview(fId){window.open('http://'+location.hostname+':'+PRES_PORT+'/?floor='+fId,'_blank');}
document.addEventListener('keydown',function(e){
if(selectedDevices.size===0)return;
if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key)===-1)return;
if(document.activeElement&&['INPUT','SELECT','TEXTAREA'].indexOf(document.activeElement.tagName)!==-1)return;
e.preventDefault();
var step=e.shiftKey?1:0.2;
var dx=0,dy=0;
if(e.key==='ArrowLeft')dx=-step;
if(e.key==='ArrowRight')dx=step;
if(e.key==='ArrowUp')dy=-step;
if(e.key==='ArrowDown')dy=step;
var cur=getCurrentFloor();if(!cur)return;
var layer=cur.floor.layers.find(function(l){return l.id===currentLayerId;});
if(!layer)return;
layer.devices.forEach(function(d){
if(selectedDevices.has(d.id)){
d.x=Math.max(0,Math.min(100,d.x+dx));
d.y=Math.max(0,Math.min(100,d.y+dy));
}
});
saveConfig(renderFloorWorkspace);
});
function scaleMode(){return(config&&config.scaleMode)||'height';}
function renderGuides(){
var inner=document.querySelector('.plan-inner');if(!inner)return;
inner.querySelectorAll('.guide').forEach(function(g){g.remove();});
if(!config.guides||config.guides.length===0)return;
config.guides.forEach(function(g){
var el=document.createElement('div');
el.className='guide '+(g.type==='h'?'horizontal':'vertical');
if(g.type==='h')el.style.top=g.position+'%';
else el.style.left=g.position+'%';
el.dataset.guideId=g.id;
var label=document.createElement('div');
label.className='guide-label';
label.textContent=g.position.toFixed(1)+'%';
el.appendChild(label);
el.addEventListener('dblclick',function(e){e.stopPropagation();if(confirm('Удалить направляющую?')){config.guides=config.guides.filter(function(x){return x.id!==g.id;});saveConfig(renderFloorWorkspace);}});
el.addEventListener('mousedown',function(e){
if(e.button!==0)return;
e.preventDefault();e.stopPropagation();
var r=inner.getBoundingClientRect();
function mv(ev){
var pos=g.type==='h'?((ev.clientY-r.top)/r.height)*100:((ev.clientX-r.left)/r.width)*100;
pos=Math.max(0,Math.min(100,pos));
pos=Math.round(pos*10)/10;
g.position=pos;
if(g.type==='h')el.style.top=pos+'%';
else el.style.left=pos+'%';
label.textContent=pos.toFixed(1)+'%';
}
function up(){
document.removeEventListener('mousemove',mv);
document.removeEventListener('mouseup',up);
if(g.position<1||g.position>99){
config.guides=config.guides.filter(function(x){return x.id!==g.id;});
}
saveConfig(renderFloorWorkspace);
}
document.addEventListener('mousemove',mv);
document.addEventListener('mouseup',up);
});
inner.appendChild(el);
});
}
function attachGuideZones(){
var inner=document.querySelector('.plan-inner');if(!inner)return;
inner.querySelectorAll('.guide-zone').forEach(function(z){z.remove();});
['top','bottom','left','right'].forEach(function(side){
var zone=document.createElement('div');
zone.className='guide-zone '+side;
zone.addEventListener('mousedown',function(e){
if(e.button!==0)return;
e.preventDefault();e.stopPropagation();
var type=(side==='top'||side==='bottom')?'h':'v';
var guide={id:'guide_'+Date.now(),type:type,position:50};
config.guides.push(guide);
renderGuides();
var el=inner.querySelector('[data-guide-id="'+guide.id+'"]');
if(!el)return;
var r=inner.getBoundingClientRect();
function mv(ev){
var p=type==='h'?((ev.clientY-r.top)/r.height)*100:((ev.clientX-r.left)/r.width)*100;
p=Math.max(0,Math.min(100,p));
p=Math.round(p*10)/10;
guide.position=p;
if(type==='h')el.style.top=p+'%';
else el.style.left=p+'%';
var lbl=el.querySelector('.guide-label');
if(lbl)lbl.textContent=p.toFixed(1)+'%';
}
function up(){
document.removeEventListener('mousemove',mv);
document.removeEventListener('mouseup',up);
if(guide.position<1||guide.position>99){
config.guides=config.guides.filter(function(x){return x.id!==guide.id;});
}
saveConfig(renderFloorWorkspace);
}
document.addEventListener('mousemove',mv);
document.addEventListener('mouseup',up);
});
inner.appendChild(zone);
});
}
function snapToGuides(dev,size){
if(!config.guides||config.guides.length===0)return{x:dev.x,y:dev.y};
var threshold=1.5;
var inner=document.querySelector('.plan-inner');if(!inner)return{x:dev.x,y:dev.y};
var halfW=(size/inner.clientWidth)*100/2;
var halfH=(size/inner.clientHeight)*100/2;
var left=dev.x-halfW;
var right=dev.x+halfW;
var top=dev.y-halfH;
var bottom=dev.y+halfH;
var centerX=dev.x;
var centerY=dev.y;
var newX=dev.x,newY=dev.y;
var snappedX=false,snappedY=false;
config.guides.forEach(function(g){
if(g.type==='v'&&!snappedX){
var edges=[left,centerX,right];
for(var i=0;i<edges.length;i++){
if(Math.abs(edges[i]-g.position)<threshold){
newX=g.position-(edges[i]-dev.x);
snappedX=true;
break;
}
}
}else if(g.type==='h'&&!snappedY){
var edges=[top,centerY,bottom];
for(var i=0;i<edges.length;i++){
if(Math.abs(edges[i]-g.position)<threshold){
newY=g.position-(edges[i]-dev.y);
snappedY=true;
break;
}
}
}
});
return{x:Math.round(newX*10)/10,y:Math.round(newY*10)/10};
}
function handleMarkerClick(dev,e){
if(e.shiftKey){if(selectedDevices.has(dev.id))selectedDevices.delete(dev.id);else selectedDevices.add(dev.id);}
else{selectedDevices.clear();selectedDevices.add(dev.id);}
updateSelectionVisuals();updateAlignPanel();
}
function clearSelection(){selectedDevices.clear();updateSelectionVisuals();updateAlignPanel();}
function updateSelectionVisuals(){document.querySelectorAll('.marker').forEach(function(m){var id=m.dataset.devId;if(selectedDevices.has(id))m.classList.add('selected');else m.classList.remove('selected');});}
function updateAlignPanel(){var p=$('alignPanel');if(selectedDevices.size>=2){p.classList.add('active');$('alignCount').textContent=selectedDevices.size;}else{p.classList.remove('active');}}
function getSelectedDevices(){var cur=getCurrentFloor();if(!cur)return[];var layer=cur.floor.layers.find(function(l){return l.id===currentLayerId;});if(!layer)return[];return layer.devices.filter(function(d){return selectedDevices.has(d.id);});}
function alignLeft(){var devs=getSelectedDevices();if(devs.length<2)return;var minX=Math.min.apply(null,devs.map(function(d){return d.x;}));devs.forEach(function(d){d.x=minX;});saveConfig(renderFloorWorkspace);}
function alignRight(){var devs=getSelectedDevices();if(devs.length<2)return;var maxX=Math.max.apply(null,devs.map(function(d){return d.x;}));devs.forEach(function(d){d.x=maxX;});saveConfig(renderFloorWorkspace);}
function alignCenterH(){var devs=getSelectedDevices();if(devs.length<2)return;var avgX=devs.reduce(function(s,d){return s+d.x;},0)/devs.length;devs.forEach(function(d){d.x=avgX;});saveConfig(renderFloorWorkspace);}
function alignTop(){var devs=getSelectedDevices();if(devs.length<2)return;var minY=Math.min.apply(null,devs.map(function(d){return d.y;}));devs.forEach(function(d){d.y=minY;});saveConfig(renderFloorWorkspace);}
function alignBottom(){var devs=getSelectedDevices();if(devs.length<2)return;var maxY=Math.max.apply(null,devs.map(function(d){return d.y;}));devs.forEach(function(d){d.y=maxY;});saveConfig(renderFloorWorkspace);}
function alignCenterV(){var devs=getSelectedDevices();if(devs.length<2)return;var avgY=devs.reduce(function(s,d){return s+d.y;},0)/devs.length;devs.forEach(function(d){d.y=avgY;});saveConfig(renderFloorWorkspace);}
function distributeH(){var devs=getSelectedDevices();if(devs.length<3)return;devs.sort(function(a,b){return a.x-b.x;});var minX=devs[0].x;var maxX=devs[devs.length-1].x;var step=(maxX-minX)/(devs.length-1);devs.forEach(function(d,i){d.x=minX+step*i;});saveConfig(renderFloorWorkspace);}
function distributeV(){var devs=getSelectedDevices();if(devs.length<3)return;devs.sort(function(a,b){return a.y-b.y;});var minY=devs[0].y;var maxY=devs[devs.length-1].y;var step=(maxY-minY)/(devs.length-1);devs.forEach(function(d,i){d.y=minY+step*i;});saveConfig(renderFloorWorkspace);}
function iconHtml(icon,size){if(!icon)return'<span style="font-size:'+size+';line-height:1">📄</span>';if(icon.kind==='emoji')return'<span style="font-size:'+size+';line-height:1">'+esc(icon.value)+'</span>';var u=icon.kind==='mfd'?(mfdBaseUrl+icon.value+'.png'):icon.value;return'<span class="im" style="width:'+size+';height:'+size+';background-color:currentColor;-webkit-mask-image:url('+u+');mask-image:url('+u+');"></span>';}
function openFloorIconModal(fIdx){iconTarget={type:'floor',idx:fIdx};pickerIcon=config.floors[fIdx].icon||null;pickerTab='emoji';$('pickerTitle').textContent='Иконка этажа: '+config.floors[fIdx].name;openIconPicker();}
function openLayerIconModal(fIdx,lIdx){iconTarget={type:'layer',fIdx:fIdx,lIdx:lIdx};var l=config.floors[fIdx].layers[lIdx];pickerIcon=l.icon||null;pickerTab='emoji';$('pickerTitle').textContent='Иконка слоя: '+l.name;openIconPicker();}
function openIconPicker(){$('iconPickerModal').classList.add('active');renderPickerTabs();renderPickerContent();updatePickerPreview();}
function closeIconPicker(){$('iconPickerModal').classList.remove('active');iconTarget=null;pickerIcon=null;}
function renderPickerTabs(){document.querySelectorAll('.picker-tab').forEach(function(t){t.classList.toggle('active',t.dataset.tab===pickerTab);});}
function switchPickerTab(tab){pickerTab=tab;renderPickerTabs();renderPickerContent();if(tab==='mfd'&&!allMfdIcons)loadMfdIcons();}
function updatePickerPreview(){var box=$('pickerPreviewBox');var name=$('pickerPreviewName');if(pickerIcon){box.innerHTML=iconHtml(pickerIcon,'40px');name.textContent=pickerIcon.kind==='emoji'?pickerIcon.value:(pickerIcon.kind==='mfd'?pickerIcon.value:'файл');}else{box.innerHTML='📄';name.textContent='не выбрано';}}
function renderPickerContent(){var c=$('pickerContent');
if(pickerTab==='emoji'){var h='<div class="ip">';for(var g in emojiGroups){h+='<div style="grid-column:1/-1;font-weight:500;color:var(--p);padding:4px 0;border-bottom:1px solid var(--ov)">'+g+'</div>';emojiGroups[g].forEach(function(e){h+='<div class="io" onclick="pickPickerEmoji(\''+e+'\')"><div class="ipv">'+e+'</div></div>';});}h+='</div>';c.innerHTML=h;}
else if(pickerTab==='mfd'){if(!allMfdIcons){c.innerHTML='<div class="tl">Загрузка MFD-иконок...</div>';return;}
var h='<div class="ots"><input id="pickerMfdSearch" oninput="filterPickerMfd()" placeholder="Поиск"></div><div class="ip" id="pickerMfdPalette"></div>';c.innerHTML=h;renderPickerMfd(allMfdIcons);}
else if(pickerTab==='file'){c.innerHTML='<div class="picker-file-area"><div style="font-size:48px">📁</div><div style="color:var(--v)">Выберите изображение с диска</div><button class="md-btn filled" onclick="$(\'pickerFileInput\').click()">Выбрать файл</button></div>';}}
function pickPickerEmoji(e){pickerIcon={kind:'emoji',value:e};updatePickerPreview();applyPickerIcon();}
function pickPickerMfd(n){pickerIcon={kind:'mfd',value:n};updatePickerPreview();applyPickerIcon();}
function applyPickerIcon(){if(!iconTarget)return;if(iconTarget.type==='floor'){config.floors[iconTarget.idx].icon=pickerIcon;saveConfig(renderFloorWorkspace);}else if(iconTarget.type==='layer'){config.floors[iconTarget.fIdx].layers[iconTarget.lIdx].icon=pickerIcon;saveConfig(renderFloorWorkspace);}}
function clearPickerIcon(){pickerIcon=null;updatePickerPreview();applyPickerIcon();}
function renderPickerMfd(icons){var s=gv('pickerMfdSearch').toLowerCase().trim();var f=icons.filter(function(n){return!s||n.indexOf(s)!==-1;});var p=$('pickerMfdPalette');if(!p)return;if(!f.length){p.innerHTML='<div class="tl">Нет</div>';return;}var h='';f.forEach(function(n){var u=mfdBaseUrl+esc(n)+'.png'+CACHE_BUSTER;var sel=pickerIcon&&pickerIcon.kind==='mfd'&&pickerIcon.value===n?' style="background:var(--pc);border-color:var(--p)"':'';h+='<div class="io"'+sel+' onclick="pickPickerMfd(\''+esc(n).replace(/'/g,"\\'")+'\')"><div class="ipv"><span class="im" style="width:32px;height:32px;background-color:#000;-webkit-mask-image:url('+u+');mask-image:url('+u+');"></span></div><div class="in">'+esc(n)+'</div></div>';});p.innerHTML=h;}
function filterPickerMfd(){if(allMfdIcons)renderPickerMfd(allMfdIcons);}
$('pickerFileInput').addEventListener('change',function(){var f=this.files[0];if(!f)return;var r=new FileReader();r.onload=function(e){fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:'picker_'+Date.now()+'.png',base64Data:e.target.result})}).then(function(x){return x.json();}).then(function(d){if(d.success){pickerIcon={kind:'url',value:d.url};updatePickerPreview();applyPickerIcon();}});};r.readAsDataURL(f);this.value='';});
function floorBarSettings(){var s=config.floorBar||barDefaults();if(!s.textAlign)s.textAlign='left';return s;}
function layerBarSettings(){var s=config.layerBar||barDefaults();if(!s.textAlign)s.textAlign='left';return s;}
function renderFloorTabs(){
var c=$('fte');var h='';
var fs=floorBarSettings();
var ta=fs.textAlign||'left';
for(var i=0;i<config.floors.length;i++){var f=config.floors[i];
h+='<div class="fte'+(f.id===currentFloorId?' active':'')+'" onclick="selectFloor(\''+f.id+'\')" style="text-align:'+ta+'">';
h+='<span class="btn-ic">'+iconHtml(f.icon,'16px')+'</span>';
h+='<span class="btn-label" style="text-align:'+ta+'">'+esc(f.name)+'</span>';
h+='<button class="act" onclick="event.stopPropagation();openFloorIconModal('+i+')" title="Иконка">🖼️</button>';
h+='<button class="act" onclick="event.stopPropagation();moveFloor('+i+',-1)">↑</button>';
h+='<button class="act" onclick="event.stopPropagation();moveFloor('+i+',1)">↓</button>';
h+='<button class="act" onclick="event.stopPropagation();removeFloor('+i+',event)">×</button>';
h+='</div>';}
h+='<button class="md-btn filled small" onclick="addFloor()">+ Этаж</button><span class="spacer"></span>'+(currentFloorId?'<button class="md-btn tonal small" onclick="openPreview(\''+currentFloorId+'\')">👁 Просмотр</button>':'');c.innerHTML=h;}
function addFloor(){ensureConfig();var id='floor_'+Date.now();config.floors.push({id:id,name:'Новый этаж',image:'',layers:[]});currentFloorId=id;currentLayerId=null;saveConfig(renderFloorWorkspace);}
function removeFloor(i,e){if(e)e.stopPropagation();if(!confirm('Удалить этаж?'))return;var rid=config.floors[i].id;config.floors.splice(i,1);if(currentFloorId===rid)currentFloorId=config.floors[0]?config.floors[0].id:null;saveConfig(renderFloorWorkspace);}
function selectFloor(id){currentFloorId=id;currentLayerId=null;clearSelection();renderFloorWorkspace();}
function getCurrentFloor(){for(var i=0;i<config.floors.length;i++)if(config.floors[i].id===currentFloorId)return{floor:config.floors[i],idx:i};return null;}
function planBg(){return(config&&config.planBg)||'#2a2f36';}
function renderFloorWorkspace(){
renderFloorTabs();
var w=$('fw');var cur=getCurrentFloor();
if(!cur){w.innerHTML='<div class="pempty" style="background:'+planBg()+'">🏠 Добавьте этаж</div>';stopLive();return;}
var floor=cur.floor,fIdx=cur.idx;
if(!currentLayerId||!floor.layers.some(function(l){return l.id===currentLayerId;}))currentLayerId=floor.layers[0]?floor.layers[0].id:null;
var ls=layerBarSettings();
var ta=ls.textAlign||'left';
var chips='';floor.layers.forEach(function(l,i){
chips+='<div class="lc'+(l.id===currentLayerId?' active':'')+'" onclick="selectLayer(\''+l.id+'\')" style="text-align:'+ta+'">';
chips+='<span class="btn-ic">'+iconHtml(l.icon,'14px')+'</span>';
chips+='<span class="btn-label" style="text-align:'+ta+'">'+esc(l.name)+'</span>';
chips+='<button class="act" onclick="event.stopPropagation();renameLayer('+fIdx+','+i+')" title="Переименовать">✏️</button>';
chips+='<button class="act" onclick="event.stopPropagation();openLayerIconModal('+fIdx+','+i+')" title="Иконка">🖼️</button>';
chips+='<button class="act" onclick="event.stopPropagation();moveLayer('+fIdx+','+i+',-1)">↑</button>';
chips+='<button class="act" onclick="event.stopPropagation();moveLayer('+fIdx+','+i+',1)">↓</button>';
chips+='<button class="act" onclick="event.stopPropagation();removeLayer('+fIdx+',\''+l.id+'\',event)">×</button>';
chips+='</div>';});
var h='<div class="ftb"><input type="text" value="'+esc(floor.name)+'" id="floorNameInput"><button class="md-btn filled small" onclick="saveFloorName('+fIdx+')">💾</button><button class="md-btn tonal small" onclick="document.getElementById(\'floorImageInput\').click()">🖼️</button><input type="file" id="floorImageInput" accept="image/*" style="display:none" onchange="handleImageUpload(this,'+fIdx+')"></div>';
h+='<div class="ftb"><strong>Слои:</strong><div class="ls">'+chips+'<button class="md-btn tonal small" onclick="addLayer('+fIdx+')">+ Слой</button></div><span class="spacer"></span><button class="md-btn filled small" onclick="openAddDeviceModal('+fIdx+')">+ Объект</button></div>';
var sm=scaleMode();
if(floor.image)h+='<div class="pea scale-'+sm+'" id="pea" style="background:'+planBg()+'" onclick="handlePlanClick(event)"><div class="plan-inner" id="planInner"><img src="'+floor.image+CACHE_BUSTER+'" id="peaImg"></div></div>';
else h+='<div class="pea scale-'+sm+'" style="background:'+planBg()+'"><div class="pempty">🖼️ Загрузите план</div></div>';
w.innerHTML=h;
if(floor.image){renderPlanMarkers(floor,fIdx);renderGuides();attachGuideZones();startLive();}
else stopLive();
updateAlignPanel();}
function handlePlanClick(e){if(e.target.id==='pea'||e.target.id==='peaImg'||e.target.id==='planInner'){clearSelection();}}
function selectLayer(id){currentLayerId=id;clearSelection();renderFloorWorkspace();}
function addLayer(fIdx){var n=prompt('Название слоя:','Новый слой');if(!n)return;var f=config.floors[fIdx];if(!f.layers)f.layers=[];var nl={id:'layer_'+Date.now(),name:n,devices:[]};f.layers.push(nl);currentLayerId=nl.id;saveConfig(renderFloorWorkspace);}
function renameLayer(fIdx,lIdx){var f=config.floors[fIdx];var l=f.layers[lIdx];var n=prompt('Новое название слоя:',l.name);if(n&&n.trim()){l.name=n.trim();saveConfig(renderFloorWorkspace);}}
function removeLayer(fIdx,lId,e){if(e)e.stopPropagation();if(!confirm('Удалить слой?'))return;var f=config.floors[fIdx];var i=f.layers.findIndex(function(l){return l.id===lId;});if(i>=0)f.layers.splice(i,1);if(currentLayerId===lId)currentLayerId=null;saveConfig(renderFloorWorkspace);}
function saveFloorName(fIdx){config.floors[fIdx].name=gv('floorNameInput')||'Без названия';saveConfig(renderFloorTabs);}
function handleImageUpload(inp,fIdx){var f=inp.files[0];if(!f)return;var r=new FileReader();r.onload=function(e){fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:'floor_'+fIdx+'_'+Date.now()+'.png',base64Data:e.target.result})}).then(function(x){return x.json();}).then(function(d){if(d.success){config.floors[fIdx].image=d.url;saveConfig(renderFloorWorkspace);}});};r.readAsDataURL(f);}
function openSettingsModal(){sv('planBg',config.planBg||'#2a2f36');sv('scaleMode',config.scaleMode||'height');fillBarFields();$('settingsModal').classList.add('active');$('settingsModal').querySelector('.modal').scrollTop=0;}
function closeSettingsModal(){$('settingsModal').classList.remove('active');}
function getBar(t){return(t==='floor'?config.floorBar:config.layerBar)||barDefaults();}
function barIconHtml(icon,h){if(!icon)return'';if(icon.kind==='emoji')return'<span style="font-size:'+h+';line-height:1">'+esc(icon.value)+'</span>';var u=icon.kind==='mfd'?(mfdBaseUrl+icon.value+'.png'):icon.value;return'<span class="im" style="width:'+h+';height:'+h+';background-color:currentColor;-webkit-mask-image:url('+u+');mask-image:url('+u+');"></span>';}
function updateBarIconPreview(){$('barIconPreview').innerHTML=barIcon?barIconHtml(barIcon,'28px'):'';}
function openBarDisk(){slotTarget='__bar';$('barIconInput').click();}
function openBarMfd(){slotTarget='__bar';openMfdPalette();}
function clearBarIcon(){barIcon=null;updateBarIconPreview();}
function fillBarFields(){var s=getBar(gv('barTarget'));sv('bar-height',s.height);sv('bar-width',s.width);sv('bar-gap',s.gap);sv('bar-radius',s.radius);sv('bar-orient',s.orient);sv('bar-position',s.position);sv('bar-align',s.align);sv('bar-textalign',s.textAlign||'left');sv('bar-iconpos',s.iconPos||'left');
barIcon=s.icon||null;updateBarIconPreview();
fillFont($('bar-a-ff'),s.active.font.family);fillWeight($('bar-a-fw'),s.active.font.weight);
fillFont($('bar-i-ff'),s.inactive.font.family);fillWeight($('bar-i-fw'),s.inactive.font.weight);
sv('bar-a-bg',s.active.bg);sv('bar-a-bd',s.active.border);sv('bar-a-fs',s.active.font.size);sv('bar-a-fc',s.active.font.color);
sv('bar-i-bg',s.inactive.bg);sv('bar-i-bd',s.inactive.border);sv('bar-i-fs',s.inactive.font.size);sv('bar-i-fc',s.inactive.font.color);}
function saveSettingsModal(){config.planBg=gv('planBg');config.scaleMode=gv('scaleMode');var t=gv('barTarget');var s={height:+gv('bar-height'),width:+gv('bar-width'),gap:+gv('bar-gap'),radius:+gv('bar-radius'),orient:gv('bar-orient'),position:gv('bar-position'),align:gv('bar-align'),textAlign:gv('bar-textalign'),icon:barIcon,iconPos:gv('bar-iconpos'),
active:{bg:gv('bar-a-bg'),border:gv('bar-a-bd'),font:{family:gv('bar-a-ff'),weight:gv('bar-a-fw'),size:gv('bar-a-fs'),color:gv('bar-a-fc')}},
inactive:{bg:gv('bar-i-bg'),border:gv('bar-i-bd'),font:{family:gv('bar-i-ff'),weight:gv('bar-i-fw'),size:gv('bar-i-fs'),color:gv('bar-i-fc')}}};
if(t==='floor')config.floorBar=s;else config.layerBar=s;closeSettingsModal();saveConfig(renderFloorWorkspace);}
function checkLocks(){
var now=Date.now();
var changed=false;
var cur=getCurrentFloor();
if(!cur)return;
(cur.floor.layers||[]).forEach(function(l){
(l.devices||[]).forEach(function(d){
if(d.lockedUntil&&now>d.lockedUntil){
d.locked=true;
d.lockedUntil=null;
changed=true;
}
});
});
if(changed){
saveConfig();
updateLocksOnly();
}
}
function updateLocksOnly(){
var cur=getCurrentFloor();if(!cur||!cur.floor.image)return;
var layer=cur.floor.layers.find(function(l){return l.id===currentLayerId;});
if(!layer)return;
(layer.devices||[]).forEach(function(dev){
var m=document.querySelector('.marker[data-dev-id="'+dev.id+'"]');
if(!m)return;
var lockEl=m.querySelector('.lock-icon');
var hasLock=!!dev.locked;
if(hasLock&&!lockEl){
var lk=document.createElement('div');
lk.className='lock-icon';
lk.textContent='🔒';
m.appendChild(lk);
}else if(!hasLock&&lockEl){
lockEl.remove();
}
});
}
function collectStates(){var ids=[];var cur=getCurrentFloor();if(!cur)return ids;(cur.floor.layers||[]).forEach(function(l){(l.devices||[]).forEach(function(d){(d.stateIds||[]).forEach(function(s){if(s&&ids.indexOf(s)<0)ids.push(s);});});});return ids;}
function startLive(){stopLive();pollLive();checkLocks();liveTimer=setInterval(function(){pollLive();checkLocks();},2000);}
function stopLive(){if(liveTimer){clearInterval(liveTimer);liveTimer=null;}}
function pollLive(){
var changed=false;
collectStates().forEach(function(sid){
fetch('/api/state/'+sid).then(function(r){return r.json();}).then(function(d){
if(d&&liveStates[sid]!==d.val){
liveStates[sid]=d.val;
changed=true;
}
}).catch(function(){});
});
if(changed)updateLiveVisuals();
}
function updateLiveVisuals(){
var cur=getCurrentFloor();if(!cur||!cur.floor.image)return;
var layer=cur.floor.layers.find(function(l){return l.id===currentLayerId;});
if(!layer)return;
(layer.devices||[]).forEach(function(dev){
var m=document.querySelector('.marker[data-dev-id="'+dev.id+'"]');
if(!m)return;
var stateVal=dev.stateIds&&dev.stateIds[0]?liveStates[dev.stateIds[0]]:null;
var ic=dev.icon||defaultIcon(dev.objType);
var key=getStateKey(dev,stateVal);
var newBg=(ic.bg&&ic.bg[key])||'#fff';
var newBd=(ic.border&&ic.border[key])||defColor(key);
if(m.style.backgroundColor!==newBg)m.style.backgroundColor=newBg;
if(m.style.borderColor!==newBd)m.style.borderColor=newBd;
var newShadow=stateVal?'0 0 15px '+newBd:'none';
if(m.style.boxShadow!==newShadow)m.style.boxShadow=newShadow;
var iconEl=m.querySelector('.mi,.im');
var newIcon=slotHtml((ic.slots||{})[key],(ic.color&&ic.color[key])||defColor(key));
if(iconEl&&iconEl.outerHTML!==newIcon)iconEl.outerHTML=newIcon;
var lockEl=m.querySelector('.lock-icon');
var hasLock=!!dev.locked;
if(hasLock&&!lockEl){var lk=document.createElement('div');lk.className='lock-icon';lk.textContent='🔒';m.appendChild(lk);}
else if(!hasLock&&lockEl)lockEl.remove();
if(dev.showValue!==false&&dev.stateIds&&dev.stateIds.length){
var vd=m.querySelector('.lbl');
if(!vd){
vd=document.createElement('span');
vd.className='lbl lp-'+({bottom:'b',top:'t',right:'r',left:'l',overlay:'o'}[(dev.valueFont&&dev.valueFont.position)||'overlay']);
applyFont(vd,dev.valueFont||DEF_VF);
m.appendChild(vd);
}
var newText='';
dev.stateIds.forEach(function(s,idx){
var val=liveStates[s];
var pr=(dev.prefixes&&dev.prefixes[idx]!=null)?dev.prefixes[idx]:'';
var po=(dev.postfixes&&dev.postfixes[idx]!=null)?dev.postfixes[idx]:'';
newText+=pr+((val!==undefined&&val!==null)?val:'N/A')+po+'\n';
});
newText=newText.trim();
if(vd.textContent!==newText){
vd.innerHTML='';
dev.stateIds.forEach(function(s,idx){
var val=liveStates[s];
var pr=(dev.prefixes&&dev.prefixes[idx]!=null)?dev.prefixes[idx]:'';
var po=(dev.postfixes&&dev.postfixes[idx]!=null)?dev.postfixes[idx]:'';
var ln=document.createElement('span');
ln.style.display='block';
ln.textContent=pr+((val!==undefined&&val!==null)?val:'N/A')+po;
vd.appendChild(ln);
});
}
}
});
}
function slotHtml(slot,color){if(!slot)return'<span class="mi">•</span>';if(slot.kind==='emoji')return'<span class="mi">'+esc(slot.value)+'</span>';var u=slot.kind==='mfd'?(mfdBaseUrl+slot.value+'.png'):slot.value;return'<span class="im" style="width:100%;height:100%;background-color:'+color+';-webkit-mask-image:url('+u+');mask-image:url('+u+');"></span>';}
function previewSlot(slot){if(!slot)return'•';if(slot.kind==='emoji')return'<span style="font-size:22px">'+esc(slot.value)+'</span>';var u=slot.kind==='mfd'?(mfdBaseUrl+slot.value+'.png'):slot.value;return'<span class="im" style="width:28px;height:28px;background-color:#000;-webkit-mask-image:url('+u+');mask-image:url('+u+');"></span>';}
function buildMarker(dev,stateVal){var ic=dev.icon||defaultIcon(dev.objType);var key=getStateKey(dev,stateVal);
var m=document.createElement('div');m.className='marker';m.dataset.devId=dev.id;m.style.left=(dev.x||50)+'%';m.style.top=(dev.y||50)+'%';m.style.width=(ic.size||48)+'px';m.style.height=(ic.size||48)+'px';m.style.opacity=ic.opacity!=null?ic.opacity:1;
m.style.backgroundColor=(ic.bg&&ic.bg[key])||'#fff';m.style.borderColor=(ic.border&&ic.border[key])||defColor(key);
if(stateVal)m.style.boxShadow='0 0 15px '+((ic.border&&ic.border[key])||defColor(key));
m.innerHTML=slotHtml((ic.slots||{})[key],(ic.color&&ic.color[key])||defColor(key));
if(dev.locked){var lock=document.createElement('div');lock.className='lock-icon';lock.textContent='🔒';m.appendChild(lock);}
if(dev.showValue!==false&&dev.stateIds&&dev.stateIds.length){var vd=document.createElement('span');vd.className='lbl lp-'+({bottom:'b',top:'t',right:'r',left:'l',overlay:'o'}[(dev.valueFont&&dev.valueFont.position)||'overlay']);applyFont(vd,dev.valueFont||DEF_VF);
dev.stateIds.forEach(function(sid,idx){var val=liveStates[sid];var pr=(dev.prefixes&&dev.prefixes[idx]!=null)?dev.prefixes[idx]:'';var po=(dev.postfixes&&dev.postfixes[idx]!=null)?dev.postfixes[idx]:'';var ln=document.createElement('span');ln.style.display='block';ln.textContent=pr+((val!==undefined&&val!==null)?val:'N/A')+po;vd.appendChild(ln);});m.appendChild(vd);}
if(dev.showName!==false){var nm=document.createElement('span');nm.className='lbl lp-'+({bottom:'b',top:'t',right:'r',left:'l',overlay:'o'}[(dev.nameFont&&dev.nameFont.position)||'bottom']);nm.textContent=dev.name||'';applyFont(nm,dev.nameFont||DEF_NF);m.appendChild(nm);}
return m;}
var ctxMenuEl=null;function hideCtxMenu(){if(ctxMenuEl)ctxMenuEl.classList.remove('active');}
function showCtxMenu(x,y,items){if(!ctxMenuEl){ctxMenuEl=document.createElement('div');ctxMenuEl.className='cm';document.body.appendChild(ctxMenuEl);document.addEventListener('click',hideCtxMenu);}ctxMenuEl.innerHTML='';items.forEach(function(it){var d=document.createElement('div');d.className='ci'+(it.danger?' d':'');d.textContent=it.label;d.onclick=function(e){e.stopPropagation();hideCtxMenu();it.action();};ctxMenuEl.appendChild(d);});ctxMenuEl.style.left=Math.min(x,innerWidth-190)+'px';ctxMenuEl.style.top=Math.min(y,innerHeight-140)+'px';ctxMenuEl.classList.add('active');}
function renderPlanMarkers(floor,fIdx){var inner=document.querySelector('.plan-inner');if(!inner)return;inner.querySelectorAll('.marker').forEach(function(m){m.remove();});if(!currentLayerId)return;
var layer=null,lIdx=-1;for(var i=0;i<floor.layers.length;i++)if(floor.layers[i].id===currentLayerId){layer=floor.layers[i];lIdx=i;break;}if(!layer)return;
(layer.devices||[]).forEach(function(dev){var m=buildMarker(dev,liveStates[dev.stateIds&&dev.stateIds[0]]);
if(selectedDevices.has(dev.id))m.classList.add('selected');
attachDrag(m,dev);
m.addEventListener('click',function(e){e.stopPropagation();handleMarkerClick(dev,e);});
m.addEventListener('dblclick',function(e){e.preventDefault();openEditDeviceModal(fIdx,lIdx,dev.id);});
m.addEventListener('contextmenu',function(e){e.preventDefault();showCtxMenu(e.clientX,e.clientY,[{label:'✏️ Редактировать',action:function(){openEditDeviceModal(fIdx,lIdx,dev.id);}},{label:'⧉ Копировать',action:function(){copyDevice(fIdx,lIdx,dev.id);}},{label:'🗑 Удалить',danger:true,action:function(){deleteDeviceById(fIdx,lIdx,dev.id);}}]);});
inner.appendChild(m);});}
function copyDevice(fIdx,lIdx,id){var l=config.floors[fIdx].layers[lIdx];var s=l.devices.find(function(d){return d.id===id;});if(!s)return;var c=JSON.parse(JSON.stringify(s));c.id='dev_'+Date.now();c.x=Math.min(100,(s.x||50)+4);c.y=Math.min(100,(s.y||50)+4);l.devices.push(c);saveConfig(renderFloorWorkspace);}
function deleteDeviceById(fIdx,lIdx,id){if(!confirm('Удалить?'))return;var l=config.floors[fIdx].layers[lIdx];l.devices=l.devices.filter(function(d){return d.id!==id;});selectedDevices.delete(id);saveConfig(renderFloorWorkspace);}
function attachDrag(m,dev){m.addEventListener('mousedown',function(e){
if(e.button!==0||e.shiftKey)return;
e.preventDefault();
var st=false;
var inner=document.querySelector('.plan-inner');if(!inner)return;
var size=(dev.icon&&dev.icon.size)||48;
function mv(ev){
var r=inner.getBoundingClientRect();
var x=((ev.clientX-r.left)/r.width)*100;
var y=((ev.clientY-r.top)/r.height)*100;
x=Math.max(0,Math.min(100,x));
y=Math.max(0,Math.min(100,y));
x=Math.round(x*10)/10;
y=Math.round(y*10)/10;
var snapped=snapToGuides({x:x,y:y},size);
dev.x=snapped.x;
dev.y=snapped.y;
m.style.left=dev.x+'%';
m.style.top=dev.y+'%';
st=true;
}
function up(){
document.removeEventListener('mousemove',mv);
document.removeEventListener('mouseup',up);
if(st)saveConfig();
}
document.addEventListener('mousemove',mv);
document.addEventListener('mouseup',up);
});}
function fillTemplateSelect(){var s=$('templateSelect');var cur=s.value||'';s.innerHTML='<option value="">— не применять —</option>';(config.templates||[]).forEach(function(t){var o=document.createElement('option');o.value=t.name;o.textContent=t.name;s.appendChild(o);});s.value=cur;}
function saveTemplate(){readDeviceFields();readIcon();var name=prompt('Имя шаблона:');if(!name)return;var d=JSON.parse(JSON.stringify(editingDevice));delete d.id;delete d.name;delete d.x;delete d.y;delete d.stateIds;
config.templates=config.templates||[];var ex=config.templates.find(function(t){return t.name===name;});if(ex)ex.data=d;else config.templates.push({name:name,data:d});
saveConfig(function(){fillTemplateSelect();alert('Шаблон сохранён: '+name);});}
function applyTemplate(name){if(!name)return;var t=(config.templates||[]).find(function(x){return x.name===name;});if(!t)return;
var keep={id:editingDevice.id,name:editingDevice.name,x:editingDevice.x,y:editingDevice.y,stateIds:editingDevice.stateIds};
editingDevice=Object.assign({},JSON.parse(JSON.stringify(t.data)),keep);fillDeviceModal();}
function openAddDeviceModal(fIdx){var f=config.floors[fIdx];if(!f.layers||!f.layers.length){alert('Добавьте слой');return;}var lIdx=f.layers.findIndex(function(l){return l.id===currentLayerId;});if(lIdx<0)lIdx=0;
editingDevice={id:'dev_'+Date.now(),name:'',stateIds:[],objType:'switch',prefixes:[],postfixes:[],x:50,y:50,showValue:true,showName:true,locked:false};editingDevice.icon=defaultIcon('switch');
editingLayerRef={fIdx:fIdx,lIdx:lIdx};editingIsNew=true;sv('dmt','Новый объект');fillDeviceModal();$('deviceModal').classList.add('active');$('deviceModal').querySelector('.modal').scrollTop=0;}
function openEditDeviceModal(fIdx,lIdx,id){var l=config.floors[fIdx].layers[lIdx];var d=l.devices.find(function(x){return x.id===id;});if(!d)return;editingDevice=JSON.parse(JSON.stringify(d));editingDevice.objType=normalizeType(d.objType);editingLayerRef={fIdx:fIdx,lIdx:lIdx};editingIsNew=false;sv('dmt','Объект: '+(d.name||''));fillDeviceModal();$('deviceModal').classList.add('active');$('deviceModal').querySelector('.modal').scrollTop=0;}
function fillDeviceModal(){var d=editingDevice,f=config.floors[editingLayerRef.fIdx];
sv('deviceName',d.name||'');sv('deviceObjType',normalizeType(d.objType));sv('deviceId',(d.stateIds&&d.stateIds[0])||'');sv('warnBelow',d.warnBelow!=null?d.warnBelow:'');sv('warnAbove',d.warnAbove!=null?d.warnAbove:'');
$('deviceLocked').checked=!!d.locked;
$('lockField').style.display=normalizeType(d.objType)==='switch'?'block':'none';
var ls=$('deviceLayer');ls.innerHTML='';f.layers.forEach(function(l,i){var o=document.createElement('option');o.value=l.id;o.textContent=l.name;if(i===editingLayerRef.lIdx)o.selected=true;ls.appendChild(o);});
fillTemplateSelect();
$('extraIdsContainer').innerHTML='';if(d.stateIds)for(var j=1;j<d.stateIds.length;j++)addExtraIdRow(d.stateIds[j]);
if(!d.icon)d.icon=defaultIcon(d.objType);if(!d.icon.slots)d.icon.slots=defaultSlots(d.objType);
sv('iconSize',d.icon.size||48);sv('iconOpacity',d.icon.opacity!=null?d.icon.opacity:1);
var vf=d.valueFont||{};$('vf-show').checked=d.showValue!==false;fillFont($('vf-family'),vf.family);fillWeight($('vf-weight'),vf.weight);sv('vf-size',vf.size||'12px');sv('vf-color',vf.color||'#ffffff');sv('vf-bg',vf.bgColor&&vf.bgColor!=='transparent'?vf.bgColor:'#000000');$('vf-nobg').checked=(vf.bgColor==='transparent'||!vf.bgColor);sv('vf-position',vf.position||'overlay');
var nf=d.nameFont||{};$('nf-show').checked=d.showName!==false;fillFont($('nf-family'),nf.family);fillWeight($('nf-weight'),nf.weight);sv('nf-size',nf.size||'12px');sv('nf-color',nf.color||'#ffffff');sv('nf-bg',nf.bgColor&&nf.bgColor!=='transparent'?nf.bgColor:'#000000');$('nf-nobg').checked=(nf.bgColor==='transparent'||!nf.bgColor);sv('nf-position',nf.position||'bottom');
sv('devicePrefixes',(d.prefixes||[]).join(','));sv('devicePostfixes',(d.postfixes||[]).join(','));
$('btnDel').style.display=editingIsNew?'none':'inline-block';onObjTypeChange();}
function buildIconUI(){var ic=editingDevice.icon,states=iconStates();var sh='';states.forEach(function(st){var slot=(ic.slots||{})[st.k];
sh+='<div class="sr"><div class="sl">'+st.l+'</div><div class="sp">'+previewSlot(slot)+'</div><button class="md-btn tonal small" onclick="openEmojiForSlot(\''+st.k+'\')">Emoji</button><button class="md-btn tonal small" onclick="openMfdForSlot(\''+st.k+'\')">MFD</button><button class="md-btn tonal small" onclick="openDiskForSlot(\''+st.k+'\')">📁 С диска</button></div>';});
$('iconSlots').innerHTML=sh;
['colBg','colIc','colBd'].forEach(function(cid,idx){var prop=['bg','color','border'][idx];var el=$(cid);el.style.gridTemplateColumns='repeat('+states.length+',1fr)';var h='';states.forEach(function(st){var v=(ic[prop]&&ic[prop][st.k])||(prop==='bg'?'#ffffff':defColor(st.k));h+='<div class="color-item"><input type="color" data-prop="'+prop+'" data-key="'+st.k+'" value="'+v+'"><span>'+st.l+'</span></div>';});el.innerHTML=h;});}
function onObjTypeChange(){var t=gv('deviceObjType');var val=isValue(t);$('thresholdFields').style.display=val?'block':'none';
$('lockField').style.display=normalizeType(t)==='switch'?'block':'none';
var d=editingDevice;if(!d.icon)d.icon=defaultIcon(t);var keys=val?['min','norm','max']:['on','off'];if(!d.icon.slots)d.icon.slots={};keys.forEach(function(k){if(!d.icon.slots[k])d.icon.slots[k]=defaultSlots(t)[k];});['bg','color','border'].forEach(function(p){if(!d.icon[p])d.icon[p]={};keys.forEach(function(k){if(!d.icon[p][k])d.icon[p][k]=(p==='bg'?'#ffffff':defColor(k));});});buildIconUI();}
function readDeviceFields(){var d=editingDevice;d.name=gv('deviceName');d.objType=gv('deviceObjType');
var main=gv('deviceId').trim();var ids=[];if(main)ids.push(main);document.querySelectorAll('.extra-id-input').forEach(function(i){var v=i.value;if(v!=='')ids.push(v);});d.stateIds=ids;
d.warnBelow=gv('warnBelow');d.warnAbove=gv('warnAbove');
d.locked=$('deviceLocked').checked;
d.showValue=$('vf-show').checked;d.showName=$('nf-show').checked;
d.valueFont={family:gv('vf-family'),weight:gv('vf-weight'),size:gv('vf-size'),color:gv('vf-color'),bgColor:$('vf-nobg').checked?'transparent':gv('vf-bg'),position:gv('vf-position')};
d.nameFont={family:gv('nf-family'),weight:gv('nf-weight'),size:gv('nf-size'),color:gv('nf-color'),bgColor:$('nf-nobg').checked?'transparent':gv('nf-bg'),position:gv('nf-position')};
d.prefixes=splitKeep(gv('devicePrefixes'));d.postfixes=splitKeep(gv('devicePostfixes'));}
function readIcon(){var ic=editingDevice.icon;ic.size=+gv('iconSize');ic.opacity=+gv('iconOpacity');document.querySelectorAll('#colBg input,#colIc input,#colBd input').forEach(function(inp){var p=inp.dataset.prop,k=inp.dataset.key;if(!ic[p])ic[p]={};ic[p][k]=inp.value;});}
function saveDevice(){readDeviceFields();readIcon();var d=editingDevice;if(!d.name){alert('Введите название');return;}
var f=config.floors[editingLayerRef.fIdx];var toIdx=f.layers.findIndex(function(l){return l.id===gv('deviceLayer');});if(toIdx<0)toIdx=editingLayerRef.lIdx;
if(editingIsNew)f.layers[toIdx].devices.push(d);else{var from=f.layers[editingLayerRef.lIdx];var i=from.devices.findIndex(function(x){return x.id===d.id;});if(i>=0)from.devices.splice(i,1);f.layers[toIdx].devices.push(d);}
closeDeviceModal();saveConfig(function(){currentLayerId=f.layers[toIdx].id;renderFloorWorkspace();});}
function cancelDevice(){closeDeviceModal();}
function deleteDevice(){if(editingIsNew)return;if(!confirm('Удалить?'))return;config.floors[editingLayerRef.fIdx].layers[editingLayerRef.lIdx].devices=config.floors[editingLayerRef.fIdx].layers[editingLayerRef.lIdx].devices.filter(function(x){return x.id!==editingDevice.id;});closeDeviceModal();saveConfig(renderFloorWorkspace);}
function closeDeviceModal(){$('deviceModal').classList.remove('active');editingDevice=null;}
function addExtraIdRow(v){var c=$('extraIdsContainer');var r=document.createElement('div');r.className='er';r.innerHTML='<input type="text" class="extra-id-input" value="'+esc(v||'')+'"><button class="md-btn tonal small" onclick="openObjectTreeForExtra(this)">🔍</button><button class="md-btn danger small" onclick="this.parentNode.remove()">×</button>';c.appendChild(r);}
function setExtraIdValue(i,v){var r=document.querySelectorAll('.extra-id-input');if(r[i])r[i].value=v;}
function openObjectTreeForExtra(btn){var c=$('extraIdsContainer');openObjectTree('extra',Array.prototype.indexOf.call(c.children,btn.parentNode));}
function openEmojiForSlot(k){slotTarget=k;var p=$('emojiPalette');var h='';for(var g in emojiGroups){h+='<div style="grid-column:1/-1;font-weight:500;color:var(--p)">'+g+'</div>';emojiGroups[g].forEach(function(e){h+='<div class="io" onclick="selectEmoji(\''+e+'\')"><div class="ipv">'+e+'</div></div>';});}p.innerHTML=h;$('emojiModal').classList.add('active');}
function selectEmoji(e){if(slotTarget==='__bar'){barIcon={kind:'emoji',value:e};updateBarIconPreview();closeEmojiModal();}else if(slotTarget&&editingDevice){if(!editingDevice.icon.slots)editingDevice.icon.slots={};editingDevice.icon.slots[slotTarget]={kind:'emoji',value:e};buildIconUI();closeEmojiModal();}}
function closeEmojiModal(){$('emojiModal').classList.remove('active');}
function openMfdForSlot(k){slotTarget=k;openMfdPalette();}
function openDiskForSlot(k){slotTarget=k;$('diskIconInput').click();}
function openMfdPalette(){CACHE_BUSTER='?v='+Date.now();$('mfdModal').classList.add('active');sv('mfdSearch','');if(!allMfdIcons)loadMfdIcons();else renderMfdPalette(allMfdIcons);}
function closeMfdModal(){$('mfdModal').classList.remove('active');}
function loadMfdIcons(){fetch('/api/iobroker/icons').then(function(r){return r.json();}).then(function(d){allMfdIcons=d.icons||[];mfdBaseUrl=d.baseUrl||'/icons-mfd-png/';renderMfdPalette(allMfdIcons);}).catch(function(){});}
function renderMfdPalette(icons){var s=gv('mfdSearch').toLowerCase().trim();var f=icons.filter(function(n){return!s||n.indexOf(s)!==-1;});var p=$('mfdPalette');if(!f.length){p.innerHTML='<div class="tl">Нет</div>';return;}var h='';f.forEach(function(n){var u=mfdBaseUrl+esc(n)+'.png'+CACHE_BUSTER;h+='<div class="io" onclick="selectMfd(\''+esc(n).replace(/'/g,"\\'")+'\')"><div class="ipv"><span class="im" style="width:32px;height:32px;background-color:#000;-webkit-mask-image:url('+u+');mask-image:url('+u+');"></span></div><div class="in">'+esc(n)+'</div></div>';});p.innerHTML=h;}
function filterMfdPalette(){if(allMfdIcons)renderMfdPalette(allMfdIcons);}
function selectMfd(n){if(slotTarget==='__bar'){barIcon={kind:'mfd',value:n};updateBarIconPreview();closeMfdModal();}else if(slotTarget&&editingDevice){if(!editingDevice.icon.slots)editingDevice.icon.slots={};editingDevice.icon.slots[slotTarget]={kind:'mfd',value:n};buildIconUI();closeMfdModal();}}
$('diskIconInput').addEventListener('change',function(){var f=this.files[0];if(!f)return;var r=new FileReader();r.onload=function(e){fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:'icon_'+Date.now()+'.png',base64Data:e.target.result})}).then(function(x){return x.json();}).then(function(d){if(d.success){if(slotTarget==='__bar'){barIcon={kind:'url',value:d.url};updateBarIconPreview();}else if(slotTarget&&editingDevice){if(!editingDevice.icon.slots)editingDevice.icon.slots={};editingDevice.icon.slots[slotTarget]={kind:'url',value:d.url};buildIconUI();}}});};r.readAsDataURL(f);this.value='';});
$('barIconInput').addEventListener('change',function(){var f=this.files[0];if(!f)return;var r=new FileReader();r.onload=function(e){fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:'baricon_'+Date.now()+'.png',base64Data:e.target.result})}).then(function(x){return x.json();}).then(function(d){if(d.success){barIcon={kind:'url',value:d.url};updateBarIconPreview();}});};r.readAsDataURL(f);this.value='';});
function buildIoBrokerTree(o){var r={children:{},leaf:null};o.forEach(function(obj){var p=obj.id.split('.');var n=r;for(var i=0;i<p.length;i++){var k=p[i];if(!n.children[k])n.children[k]={children:{},leaf:null};n=n.children[k];if(i===p.length-1)n.leaf=obj;}});return r;}
function countLeaves(n){var c=n.leaf?1:0;for(var k in n.children)c+=countLeaves(n.children[k]);return c;}
function nodeMeta(o){if(!o)return'';var a=[o.room,o.func].filter(Boolean);return a.length?' ('+a.join(', ')+')':'';}
function matchesLeaf(o,f){if(!f)return true;var fl=f.toLowerCase();return o.id.toLowerCase().indexOf(fl)!==-1||(o.name&&String(o.name).toLowerCase().indexOf(fl)!==-1);}
function computeAutoExpand(n,p,f,set){var any=false;for(var k in n.children){var c=n.children[k];var cp=p?p+'.'+k:k;var self=c.leaf&&matchesLeaf(c.leaf,f);var d=computeAutoExpand(c,cp,f,set);if(self||d){set.add(p);any=true;}}return any;}
function buildTreeHtml(n,p,depth,set,cur){var h='';var ks=Object.keys(n.children).sort();for(var i=0;i<ks.length;i++){var k=ks[i];var c=n.children[k];var cp=p?p+'.'+k:k;var br=Object.keys(c.children).length>0;
if(c.leaf){var sel=cur&&c.leaf.id===cur;h+='<div class="tn'+(sel?' sel':'')+'" style="padding-left:'+(depth*16+10)+'px" onclick="selectObject(\''+esc(c.leaf.id).replace(/'/g,"\\'")+'\')"><span>• '+esc(c.leaf.name||k)+'<span class="tm">'+nodeMeta(c.leaf)+'</span></span><span class="ti">'+esc(c.leaf.id)+'</span></div>';}
if(br){var ex=set.has(cp);var meta=c.leaf?nodeMeta(c.leaf):'';h+='<div class="tree-branch"><div class="tbh" style="padding-left:'+(depth*16+10)+'px" onclick="toggleBranchPath(\''+esc(cp).replace(/'/g,"\\'")+'\')"><span class="bt">'+(ex?'▼':'▶')+'</span><span class="bn">📁 '+esc(k)+'</span><span class="bc">('+countLeaves(c)+')</span>'+(meta?'<span class="tm">'+meta+'</span>':'')+'</div>'+(ex?'<div>'+buildTreeHtml(c,cp,depth+1,set,cur)+'</div>':'')+'</div>';}}return h;}
function getTreeCurrentId(){if(!objectTreeContext)return null;if(objectTreeContext.target==='main')return gv('deviceId').trim();var r=document.querySelectorAll('.extra-id-input');if(r[objectTreeContext.extraIndex])return r[objectTreeContext.extraIndex].value.trim();return null;}
function renderObjectTree(){if(!ioBrokerTree)return;var f=gv('treeSearch');var cur=getTreeCurrentId();var set;if(f&&f.trim()){set=new Set();computeAutoExpand(ioBrokerTree,'',f,set);}else set=expandedPaths;var c=$('objectTree');c.innerHTML=buildTreeHtml(ioBrokerTree,'',0,set,cur)||'<div class="tl">Нет</div>';if(cur){var el=c.querySelector('.sel');if(el)setTimeout(function(){el.scrollIntoView({block:'center'});},50);}}
function toggleBranchPath(p){if(expandedPaths.has(p))expandedPaths.delete(p);else expandedPaths.add(p);renderObjectTree();}
function collectAllPaths(n,p,set){for(var k in n.children){var c=n.children[k];var cp=p?p+'.'+k:k;if(Object.keys(c.children).length>0){set.add(cp);collectAllPaths(c,cp,set);}}}
function expandAllBranches(){if(ioBrokerTree){collectAllPaths(ioBrokerTree,'',expandedPaths);renderObjectTree();}}
function collapseAllBranches(){expandedPaths.clear();renderObjectTree();}
function expandPathTo(id){var p=id.split('.');var a='';for(var i=0;i<p.length-1;i++){a=a?a+'.'+p[i]:p[i];expandedPaths.add(a);}}
function openObjectTree(t,i){objectTreeContext={target:t,extraIndex:i};allIoBrokerObjects=null;ioBrokerTree=null;$('treeModal').classList.add('active');sv('treeSearch','');var cur=getTreeCurrentId();if(cur)expandPathTo(cur);else expandedPaths.clear();loadIoBrokerObjects();}
function closeTreeModal(){$('treeModal').classList.remove('active');objectTreeContext=null;}
function loadIoBrokerObjects(){fetch('/api/iobroker/objects').then(function(r){return r.json();}).then(function(d){allIoBrokerObjects=d||[];ioBrokerTree=buildIoBrokerTree(allIoBrokerObjects);renderObjectTree();}).catch(function(){$('objectTree').innerHTML='<div class="tl">Ошибка</div>';});}
function filterTree(){renderObjectTree();}
function selectObject(id){if(!objectTreeContext)return;if(objectTreeContext.target==='main')sv('deviceId',id);else setExtraIdValue(objectTreeContext.extraIndex,id);closeTreeModal();}
window.addFloor=addFloor;window.removeFloor=removeFloor;window.selectFloor=selectFloor;window.selectLayer=selectLayer;window.addLayer=addLayer;window.removeLayer=removeLayer;window.renameLayer=renameLayer;window.saveFloorName=saveFloorName;window.handleImageUpload=handleImageUpload;window.moveFloor=moveFloor;window.moveLayer=moveLayer;window.openPreview=openPreview;
window.openFloorIconModal=openFloorIconModal;window.openLayerIconModal=openLayerIconModal;window.closeIconPicker=closeIconPicker;window.switchPickerTab=switchPickerTab;window.clearPickerIcon=clearPickerIcon;window.pickPickerEmoji=pickPickerEmoji;window.pickPickerMfd=pickPickerMfd;window.filterPickerMfd=filterPickerMfd;
window.openSettingsModal=openSettingsModal;window.closeSettingsModal=closeSettingsModal;window.fillBarFields=fillBarFields;window.saveSettingsModal=saveSettingsModal;window.openBarDisk=openBarDisk;window.openBarMfd=openBarMfd;window.clearBarIcon=clearBarIcon;
window.openAddDeviceModal=openAddDeviceModal;window.openEditDeviceModal=openEditDeviceModal;window.saveDevice=saveDevice;window.cancelDevice=cancelDevice;window.deleteDevice=deleteDevice;window.onObjTypeChange=onObjTypeChange;window.addExtraIdRow=addExtraIdRow;window.openObjectTreeForExtra=openObjectTreeForExtra;
window.saveTemplate=saveTemplate;window.applyTemplate=applyTemplate;
window.openObjectTree=openObjectTree;window.closeTreeModal=closeTreeModal;window.selectObject=selectObject;window.filterTree=filterTree;window.expandAllBranches=expandAllBranches;window.collapseAllBranches=collapseAllBranches;
window.openEmojiForSlot=openEmojiForSlot;window.selectEmoji=selectEmoji;window.closeEmojiModal=closeEmojiModal;window.openMfdForSlot=openMfdForSlot;window.selectMfd=selectMfd;window.closeMfdModal=closeMfdModal;window.filterMfdPalette=filterMfdPalette;window.openDiskForSlot=openDiskForSlot;
window.handleMarkerClick=handleMarkerClick;window.clearSelection=clearSelection;window.alignLeft=alignLeft;window.alignRight=alignRight;window.alignCenterH=alignCenterH;window.alignTop=alignTop;window.alignBottom=alignBottom;window.alignCenterV=alignCenterV;window.distributeH=distributeH;window.distributeV=distributeV;window.handlePlanClick=handlePlanClick;