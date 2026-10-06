'use strict';
const utils = require('@iobroker/adapter-core');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

class FPV extends utils.Adapter {
  constructor(o = {}) {
    super({ ...o, name: 'floorplan-visualizer' });
    this.aS = null; this.pS = null; this.iconsDir = null; this.upDir = null;
    this.wh = '127.0.0.1'; this.wp = 8082;
    this.on('ready', this.onReady.bind(this));
    this.on('unload', this.onUnload.bind(this));
  }
  async onReady() {
    this.log.info('FPV v12 start');
    await this.setObjectNotExistsAsync('config', { type: 'state', common: { name: 'cfg', type: 'json', role: 'config', read: true, write: true }, native: {} });
    const cs = await this.getStateAsync('config');
    if (!cs || !cs.val) await this.setStateAsync('config', { val: JSON.stringify({ floors: [] }), ack: true });
    this.upDir = this.getUp();
    this.iconsDir = this.findIcons();
    await this.detectWeb();
    this.start(this.config.adminPort || 8083, 'admin');
    this.start(this.config.presentationPort || 8084, 'pres');
  }
  getUp() {
    let b; try { b = utils.getAbsoluteDefaultDataDir(); } catch (e) { b = '/opt/iobroker/iobroker-data/floorplan-visualizer.0/'; }
    const d = path.join(b, 'uploads');
    try { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); } catch (e) {}
    return d;
  }
  findIcons() {
    const p = ['/opt/iobroker/iobroker-data/files/icons-mfd-png', path.join(process.cwd(), 'iobroker-data', 'files', 'icons-mfd-png'), path.join(__dirname, '..', '..', 'iobroker-data', 'files', 'icons-mfd-png'), path.join(__dirname, '..', 'iobroker.icons-mfd-png')];
    for (const x of p) { try { if (fs.existsSync(x) && fs.readdirSync(x).some(f => f.endsWith('.png'))) return x; } catch (e) {} }
    return null;
  }
  async detectWeb() { try { const w = await this.getObjectAsync('system.adapter.web.0'); if (w && w.native && w.native.port) this.wp = w.native.port; } catch (e) {} }
  start(port, kind) {
    const app = this.build();
    const s = http.createServer(app);
    s.listen(port, this.config.bind || '0.0.0.0', () => this.log.info(kind + ' on ' + port));
    s.on('error', e => this.log.error(e.message));
    if (kind === 'admin') this.aS = s; else this.pS = s;
  }
  build() {
    const app = express(); const self = this;
    app.use((req, res, n) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') return res.sendStatus(200);
      n();
    });
    app.get('/api/version', (q, r) => r.json({ v: 12 }));
    const icon = (req, res) => {
      let n = path.basename(req.params.name);
      if (!/\.(png|svg)$/i.test(n)) n += '.png';
      res.setHeader('Cache-Control', 'no-cache');
      if (self.iconsDir) {
        const f = path.join(self.iconsDir, n);
        if (fs.existsSync(f)) { res.setHeader('Content-Type', n.endsWith('.svg') ? 'image/svg+xml' : 'image/png'); fs.createReadStream(f).pipe(res); }
        else res.status(404).send('nf');
      } else {
        http.get('http://' + self.wh + ':' + self.wp + '/icons-mfd-png/' + n, r => { res.setHeader('Content-Type', r.headers['content-type'] || 'image/png'); res.status(r.statusCode); r.pipe(res); }).on('error', () => res.status(500).send('pe'));
      }
    };
    app.get('/icons-mfd-png/:name', icon);
    app.use('/uploads', express.static(this.upDir, { maxAge: 0 }));
    app.use(express.static(path.join(__dirname, 'www'), { maxAge: 0, fallthrough: true }));
    app.get('/favicon.ico', (q, r) => r.status(204));
    app.post('/api/upload', express.json({ limit: '10mb' }), async (req, res) => {
      try {
        const { filename, base64Data } = req.body;
        const s = String(filename).replace(/[^a-zA-Z0-9._-]/g, '');
        fs.writeFileSync(path.join(this.upDir, s), String(base64Data).split(';base64,').pop(), { encoding: 'base64' });
        res.json({ success: true, url: '/uploads/' + s });
      } catch (e) { res.status(500).json({ error: 'up' }); }
    });
    app.get('/api/config', async (q, r) => { try { const s = await this.getStateAsync('config'); r.json(s && s.val ? JSON.parse(s.val) : { floors: [] }); } catch (e) { r.status(500).json({}); } });
    app.post('/api/config', express.json({ limit: '10mb' }), async (req, res) => { try { await this.setStateAsync('config', { val: JSON.stringify(req.body), ack: true }); res.json({ success: true }); } catch (e) { res.status(500).json({}); } });
    app.get('/api/state/:id(*)', async (req, res) => { try { const s = await this.getForeignStateAsync(req.params.id); res.json({ val: s ? s.val : null }); } catch (e) { res.status(500).json({}); } });
    app.post('/api/state/:id(*)', express.json(), async (req, res) => { try { await this.setForeignStateAsync(req.params.id, req.body.val, false); res.json({ success: true }); } catch (e) { res.status(500).json({}); } });
    // ОБЪЕКТЫ + КОМНАТА/ФУНКЦИЯ (префикс-матчинг членов enum)
    app.get('/api/iobroker/objects', async (req, res) => {
      try {
        const objs = await this.getForeignObjectsAsync('*', 'state');
        let enums = {}; try { enums = await this.getForeignObjectsAsync('enum.*', 'enum') || {}; } catch (e) {}
        const rooms = [], funcs = [];
        for (const id in enums) {
          const e = enums[id]; if (!e || !e.common) continue;
          const nm = typeof e.common.name === 'object' ? (e.common.name.ru || e.common.name.en || id) : (e.common.name || id);
          const m = e.common.members || [];
          if (id.startsWith('enum.rooms.')) rooms.push({ m, n: nm });
          else if (id.startsWith('enum.functions.')) funcs.push({ m, n: nm });
        }
        const match = (list, id) => list.filter(g => g.m.some(x => id === x || id.startsWith(x + '.'))).map(g => g.n).join(', ');
        const out = [];
        for (const id in objs) {
          const o = objs[id];
          if (o && o.common) {
            const name = typeof o.common.name === 'object' ? (o.common.name.ru || o.common.name.en || o.common.name.de || id) : (o.common.name || id);
            out.push({ id, name, role: o.common.role || '', room: match(rooms, id), func: match(funcs, id) });
          }
        }
        out.sort((a, b) => a.id.localeCompare(b.id));
        res.json(out);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });
    app.get('/api/iobroker/icons', async (q, r) => {
      try {
        let i = [];
        if (this.iconsDir) i = fs.readdirSync(this.iconsDir).filter(f => f.endsWith('.png')).map(f => f.replace(/\.png$/, '')).sort();
        r.json({ icons: i, count: i.length, baseUrl: '/icons-mfd-png/' });
      } catch (e) { r.status(500).json({}); }
    });
    app.use((q, r) => r.status(404).json({}));
    return app;
  }
  async onUnload(cb) { try { if (this.aS) this.aS.close(); if (this.pS) this.pS.close(); cb(); } catch (e) { cb(); } }
}
if (module === require.main) { new FPV(); }
module.exports = o => new FPV(o);