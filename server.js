/*
 * Clean Air Horizons 2026 — Command Centre backend
 * Zero dependencies: runs with just `node server.js` (Node 18+). No npm install needed.
 *
 * - Serves the dashboard (public/) and a small JSON API.
 * - Data lives in data/data.json (created from data/data.default.json on first run).
 * - Only people with the editor passcode can save changes; everyone else can view.
 * - Optimistic locking (version numbers) stops two editors silently overwriting each
 *   other: if the data changed since you loaded it, your save is rejected and you are
 *   asked to refresh first.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
// CHANGE THIS before hosting. Share it only with the few people allowed to edit.
const EDITOR_PASSCODE = process.env.EDITOR_PASSCODE || 'cleanair2026';

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const DEFAULT_FILE = path.join(DATA_DIR, 'data.default.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  if (!fs.existsSync(DEFAULT_FILE)) { console.error('Missing data/data.default.json — run: node build-seed.js'); process.exit(1); }
  fs.copyFileSync(DEFAULT_FILE, DATA_FILE);
  console.log('Initialised data/data.json from default seed.');
}

const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
let writing = false;
function writeData(obj){ const tmp = DATA_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(obj, null, 2)); fs.renameSync(tmp, DATA_FILE); }

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };
const send = (res, code, body, type='application/json; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type }); res.end(body); };
const sendJson = (res, code, obj) => send(res, code, JSON.stringify(obj));

function serveStatic(req, res){
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC, rel));
  if (!filePath.startsWith(PUBLIC)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, buf, MIME[path.extname(filePath)] || 'application/octet-stream');
  });
}

function readBody(req){ return new Promise((resolve) => { let b=''; req.on('data', c=>{ b+=c; if(b.length>12e6) req.destroy(); }); req.on('end', ()=>{ try{ resolve(b? JSON.parse(b):{}); }catch(e){ resolve(null); } }); }); }

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/api/health') return sendJson(res, 200, { ok: true });

  if (req.method === 'GET' && url === '/api/data') {
    try { return send(res, 200, fs.readFileSync(DATA_FILE)); }
    catch(e){ return sendJson(res, 500, { error: 'Could not read data.' }); }
  }

  if (req.method === 'POST' && url === '/api/verify') {
    const body = await readBody(req);
    const key = req.headers['x-editor-key'] || (body && body.key) || '';
    return sendJson(res, 200, { ok: key === EDITOR_PASSCODE });
  }

  if (req.method === 'POST' && url === '/api/data') {
    const key = req.headers['x-editor-key'] || '';
    if (key !== EDITOR_PASSCODE) return sendJson(res, 401, { error: 'Wrong editor passcode. Ask the event coordinator for it.' });
    if (writing) return sendJson(res, 409, { error: 'Another save is in progress. Refresh and try again.' });
    writing = true;
    try {
      const body = await readBody(req);
      const incoming = body && body.data;
      const baseVersion = body && body.baseVersion;
      const editorName = (body && body.editorName) || 'Unknown';
      if (!incoming || !incoming.meta) { writing = false; return sendJson(res, 400, { error: 'Malformed data.' }); }
      const current = readData();
      if (typeof baseVersion === 'number' && baseVersion !== current.meta.version) {
        writing = false;
        return sendJson(res, 409, { error: 'Someone else saved changes while you were editing. Refresh to get the latest, then re-apply your edits.', current });
      }
      incoming.meta.version = (current.meta.version || 0) + 1;
      incoming.meta.updatedAt = new Date().toISOString();
      incoming.meta.updatedBy = editorName;
      writeData(incoming);
      writing = false;
      return sendJson(res, 200, { ok: true, version: incoming.meta.version, updatedAt: incoming.meta.updatedAt, updatedBy: editorName });
    } catch (e) { writing = false; return sendJson(res, 500, { error: 'Could not save. ' + e.message }); }
  }

  if (req.method === 'GET') return serveStatic(req, res);
  return send(res, 405, 'Method not allowed', 'text/plain');
});

server.listen(PORT, () => {
  console.log('\nClean Air Horizons 2026 — Command Centre');
  console.log('  Open:            http://localhost:' + PORT);
  console.log('  Editor passcode: "' + EDITOR_PASSCODE + '"  (set EDITOR_PASSCODE to change)\n');
});
