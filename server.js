const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const EDIT_KEY = process.env.EDIT_KEY || '2026';
const MAX_BODY_BYTES = 200 * 1024;

function readContent(cb){
  fs.readFile(CONTENT_FILE, 'utf8', (err, data) => {
    if (err) return cb(null, {});
    try { cb(null, JSON.parse(data)); }
    catch(e){ cb(null, {}); }
  });
}

function writeContent(obj, cb){
  fs.mkdir(DATA_DIR, { recursive: true }, (err) => {
    if (err) return cb(err);
    const tmpFile = CONTENT_FILE + '.tmp';
    fs.writeFile(tmpFile, JSON.stringify(obj), (err) => {
      if (err) return cb(err);
      fs.rename(tmpFile, CONTENT_FILE, cb);
    });
  });
}

function readBody(req, cb){
  let size = 0;
  const chunks = [];
  let aborted = false;
  req.on('data', (chunk) => {
    if (aborted) return;
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      aborted = true;
      cb(new Error('body too large'));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (aborted) return;
    cb(null, Buffer.concat(chunks).toString('utf8'));
  });
  req.on('error', (err) => { if (!aborted) cb(err); });
}

function handleApi(req, res, urlPath){
  if (urlPath === '/api/content' && req.method === 'GET') {
    readContent((err, data) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    });
    return true;
  }
  if (urlPath === '/api/content' && req.method === 'POST') {
    if (req.headers['x-edit-key'] !== EDIT_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return true;
    }
    readBody(req, (err, raw) => {
      if (err) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'body too large' }));
      }
      let payload;
      try { payload = JSON.parse(raw); }
      catch(e){
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'invalid json' }));
      }
      if (typeof payload.key !== 'string' || !payload.key || !('value' in payload)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'missing key/value' }));
      }
      readContent((err, data) => {
        data[payload.key] = payload.value;
        writeContent(data, (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ error: 'write failed' }));
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true }));
        });
      });
    });
    return true;
  }
  return false;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp'
};

const ROUTES = {
  '/': '/index.html',
  '/anteproyecto': '/anteproyecto.html',
  '/tesis': '/tesis.html'
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (handleApi(req, res, urlPath)) return;
  if (ROUTES[urlPath]) urlPath = ROUTES[urlPath];

  const filePath = path.normalize(path.join(ROOT, decodeURIComponent(urlPath)));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      headers['Cache-Control'] = 'public, max-age=604800, immutable';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}).listen(PORT, () => console.log(`Server running on port ${PORT}`));
