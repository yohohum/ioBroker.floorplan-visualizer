'use strict';
const utils=require('@iobroker/adapter-core');const express=require('express');const http=require('http');const path=require('path');const fs=require('fs');
class FloorplanVisualizer extends utils.Adapter{
 constructor(o={}){super({...o,name:'floorplan-visualizer'});this.adminServer=null;this.presentationServer=null;this.iconsDir=null;this.uploadsDir=null;this.ioBrokerWebHost='127.0.0.1';this.ioBrokerWebPort=8082;this.on('ready',this.onReady.bind(this));this.on('unload',this.onUnload.bind(this));}
 async onReady(){this.log.info('Starting Floor Plan Visualizer v8.0...');
  await this.setObjectNotExistsAsync('config',{type:'state',common:{name:'Floor Plan Configuration',type:'json',role:'config',read:true,write:true},native:{}});
  const cs=await this.getStateAsync('config');if(!cs||!cs.val){await this.setStateAsync('config',{val:JSON.stringify({floors:[]},null,2),ack:true});}
  this.uploadsDir=this.getUploadsDir();this.migrateOldUploads();this.iconsDir=this.findIconsDirectory();await this.detectWebPort();this.removeConflictingIconsFolder();
  this.startAdminServer();this.startPresentationServer();}
 removeConflictingIconsFolder(){try{const d=path.join(__dirname,'www','icons-mfd-png');if(fs.existsSync(d))fs.rmSync(d,{recursive:true,force:true});}catch(e){}}
 getUploadsDir(){let b;try{b=utils.getAbsoluteDefaultDataDir();}catch(e){b='/opt/iobroker/iobroker-data/floorplan-visualizer.0/';}const d=path.join(b,'uploads');try{if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});}catch(e){}return d;}
 migrateOldUploads(){const o=path.join(__dirname,'www','uploads');try{if(fs.existsSync(o)){fs.readdirSync(o).forEach(f=>{const s=path.join(o,f),d=path.join(this.uploadsDir,f);try{if(fs.existsSync(s)&&!fs.existsSync(d))fs.copyFileSync(s,d);}catch(e){}});}}catch(e){}}
 findIconsDirectory(){const p=['/opt/iobroker/iobroker-data/files/icons-mfd-png','/opt/iobroker/iobroker-data/files/icons-mfd-svg',path.join(process.cwd(),'iobroker-data','files','icons-mfd-png'),path.join(__dirname,'..','..','iobroker-data','files','icons-mfd-png'),path.join(__dirname,'..','iobroker.icons-mfd-png')];for(const x of p){try{if(fs.existsSync(x)){const f=fs.readdirSync(x);if(f.some(y=>y.endsWith('.png')||y.endsWith('.svg')))return x;}}catch(e){}}return null;}
 async detectWebPort(){try{const w=await this.getObjectAsync('system.adapter.web.0');if(w&&w.native&&w.native.port)this.ioBrokerWebPort=w.native.port;}catch(e){}}
 buildApp(){const app=express();
  app.use((req,res,next)=>{res.header('Access-Control-Allow-Origin','*');res.header('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.header('Access-Control-Allow-Headers','Content-Type,Accept');if(req.method==='OPTIONS')return res.sendStatus(200);next();});
  app.get('/api/version',(req,res)=>res.json({version:'8.0'}));
  const serveIcon=(req,res)=>{let n=path.basename(req.params.name);if(!/\.(png|svg)$/i.test(n))n+='.png';res.setHeader('Cache-Control','no-cache');if(this.iconsDir){const f=path.join(this.iconsDir,n);if(fs.existsSync(f)){res.setHeader('Content-Type',n.endsWith('.svg')?'image/svg+xml':'image/png');fs.createReadStream(f).pipe(res);}else res.status(404).json({error:'Icon not found',name:n});}else{const u=`http://${this.ioBrokerWebHost}:${this.ioBrokerWebPort}/icons-mfd-png/${n}`;http.get(u,r=>{res.setHeader('Content-Type',r.headers['content-type']||'image/png');res.status(r.statusCode);r.pipe(res);}).on('error',e=>res.status(500).json({error:'Proxy error'}));}};
  app.get('/icons-mfd-png/:name',serveIcon);app.get('/icons-mfd-svg/:name',serveIcon);
  app.use('/uploads',express.static(this.uploadsDir,{maxAge:0}));
  app.use(express.static(path.join(__dirname,'www'),{maxAge:0,fallthrough:true}));
  app.get('/favicon.ico',(req,res)=>res.status(204));
  app.post('/api/upload',express.json({limit:'10mb'}),async(req,res)=>{try{const{filename,base64Data}=req.body;const s=String(filename).replace(/[^a-zA-Z0-9._-]/g,'');const f=path.join(this.uploadsDir,s);fs.writeFileSync(f,String(base64Data).split(';base64,').pop(),{encoding:'base64'});res.json({success:true,url:'/uploads/'+s});}catch(e){res.status(500).json({error:'Upload failed'});}});
  app.get('/api/config',async(req,res)=>{try{const s=await this.getStateAsync('config');res.json(s&&s.val?JSON.parse(s.val):{floors:[]});}catch(e){res.status(500).json({error:'Failed'});}});
  app.post('/api/config',express.json({limit:'10mb'}),async(req,res)=>{try{await this.setStateAsync('config',{val:JSON.stringify(req.body,null,2),ack:true});res.json({success:true});}catch(e){res.status(500).json({error:'Failed'});}});
  app.get('/api/state/:id(*)',async(req,res)=>{try{const s=await this.getForeignStateAsync(req.params.id);res.json({id:req.params.id,val:s?s.val:null});}catch(e){res.status(500).json({error:'Failed'});}});
  app.post('/api/state/:id(*)',express.json(),async(req,res)=>{try{await this.setForeignStateAsync(req.params.id,req.body.val,false);res.json({success:true});}catch(e){res.status(500).json({error:'Failed'});}});
  // === ОБЪЕКТЫ + КОМНАТА/ФУНКЦИЯ из enum ===
  app.get('/api/iobroker/objects',async(req,res)=>{try{
    const objects=await this.getForeignObjectsAsync('*','state');
    let enums={};try{enums=await this.getForeignObjectsAsync('enum.*','enum')||{};}catch(e){}
    const roomMap={},funcMap={};
    for(const id in enums){const e=enums[id];if(!e||!e.common)continue;const members=e.common.members||[];const nm=typeof e.common.name==='object'?(e.common.name.ru||e.common.name.en||id):(e.common.name||id);
      if(id.startsWith('enum.rooms.'))members.forEach(m=>{(roomMap[m]=roomMap[m]||[]).push(nm);});
      else if(id.startsWith('enum.functions.'))members.forEach(m=>{(funcMap[m]=funcMap[m]||[]).push(nm);});}
    const result=[];for(const id in objects){const o=objects[id];if(o&&o.common){const name=typeof o.common.name==='object'?(o.common.name.ru||o.common.name.en||o.common.name.de||id):(o.common.name||id);
      result.push({id,name,type:o.common.type||'unknown',role:o.common.role||'',room:(roomMap[id]||[]).join(', '),func:(funcMap[id]||[]).join(', ')});}}
    result.sort((a,b)=>a.id.localeCompare(b.id));res.json(result);}catch(e){res.status(500).json({error:e.message});}});
  app.get('/api/iobroker/icons',async(req,res)=>{try{let icons=[];let source='none';if(this.iconsDir){icons=fs.readdirSync(this.iconsDir).filter(f=>f.endsWith('.png')).map(f=>f.replace(/\.png$/,'')).sort();source=this.iconsDir;}res.json({icons,count:icons.length,baseUrl:'/icons-mfd-png/',source,diagnostics:[source]});}catch(e){res.status(500).json({error:e.message});}});
  app.use((req,res)=>res.status(404).json({error:'Not found',url:req.url}));
  return app;}
 startAdminServer(){const p=this.config.adminPort||8083,b=this.config.bind||'0.0.0.0';this.adminServer=http.createServer(this.buildApp());this.adminServer.listen(p,b,()=>this.log.info('Admin on '+b+':'+p));}
 startPresentationServer(){const p=this.config.presentationPort||8084,b=this.config.bind||'0.0.0.0';this.presentationServer=http.createServer(this.buildApp());this.presentationServer.listen(p,b,()=>this.log.info('Presentation on '+b+':'+p));}
 async onUnload(cb){try{if(this.adminServer)this.adminServer.close();if(this.presentationServer)this.presentationServer.close();cb();}catch(e){cb();}}
}
if(module===require.main){new FloorplanVisualizer();}
module.exports=(o)=>new FloorplanVisualizer(o);