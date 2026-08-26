const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const EDIT_KEY = process.env.EDIT_KEY || '2026';
const MAX_BODY_BYTES = 200 * 1024;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
// base64 infla el tamaño ~33%; se agrega margen para el resto del JSON (nombre, mime, etc.)
const MAX_UPLOAD_BODY_BYTES = Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 8 * 1024;

const IMAGE_MIME_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
const DOC_EXT_MIME = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

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

function readBody(req, cb, maxBytes){
  const limit = maxBytes || MAX_BODY_BYTES;
  let size = 0;
  const chunks = [];
  let aborted = false;
  req.on('data', (chunk) => {
    if (aborted) return;
    size += chunk.length;
    if (size > limit) {
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
  if (urlPath === '/api/upload' && req.method === 'POST') {
    if (req.headers['x-edit-key'] !== EDIT_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return true;
    }
    readBody(req, (err, raw) => {
      if (err) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: `archivo demasiado grande (máx ${MAX_UPLOAD_MB}MB)` }));
      }
      let payload;
      try { payload = JSON.parse(raw); }
      catch(e){
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'invalid json' }));
      }
      const { key, kind, filename, mime, dataBase64 } = payload || {};
      if (typeof key !== 'string' || !key || (kind !== 'image' && kind !== 'doc') || typeof dataBase64 !== 'string' || !dataBase64) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'faltan campos' }));
      }
      let buf;
      try { buf = Buffer.from(dataBase64, 'base64'); }
      catch(e){
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'archivo inválido' }));
      }
      if (buf.length > MAX_UPLOAD_BYTES) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: `archivo demasiado grande (máx ${MAX_UPLOAD_MB}MB)` }));
      }
      let ext;
      if (kind === 'image') {
        ext = IMAGE_MIME_EXT[mime];
        if (!ext) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: 'tipo de imagen no permitido' }));
        }
      } else {
        ext = path.extname(filename || '').toLowerCase();
        if (!DOC_EXT_MIME[ext]) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: 'tipo de documento no permitido' }));
        }
      }
      const id = crypto.randomUUID() + ext;
      fs.mkdir(UPLOADS_DIR, { recursive: true }, (err) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: 'write failed' }));
        }
        fs.writeFile(path.join(UPLOADS_DIR, id), buf, (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ error: 'write failed' }));
          }
          readContent((err, data) => {
            const rec = (data[key + '.attach'] && typeof data[key + '.attach'] === 'object') ? data[key + '.attach'] : {};
            const prev = rec[kind];
            rec[kind] = { file: id, name: filename || id, mime: mime || DOC_EXT_MIME[ext] };
            data[key + '.attach'] = rec;
            writeContent(data, (err) => {
              if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                return res.end(JSON.stringify({ error: 'write failed' }));
              }
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: true, attach: rec }));
              if (prev && prev.file) fs.unlink(path.join(UPLOADS_DIR, prev.file), () => {});
            });
          });
        });
      });
    }, MAX_UPLOAD_BODY_BYTES);
    return true;
  }
  if (urlPath === '/api/attach' && req.method === 'DELETE') {
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
      const { key, kind } = payload || {};
      if (typeof key !== 'string' || !key || (kind !== 'image' && kind !== 'doc')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'faltan campos' }));
      }
      readContent((err, data) => {
        const rec = (data[key + '.attach'] && typeof data[key + '.attach'] === 'object') ? data[key + '.attach'] : {};
        const prev = rec[kind];
        delete rec[kind];
        if (Object.keys(rec).length) data[key + '.attach'] = rec;
        else delete data[key + '.attach'];
        writeContent(data, (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ error: 'write failed' }));
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, attach: rec }));
          if (prev && prev.file) fs.unlink(path.join(UPLOADS_DIR, prev.file), () => {});
        });
      });
    });
    return true;
  }
  if (urlPath.startsWith('/api/uploads/') && req.method === 'GET') {
    const fname = urlPath.slice('/api/uploads/'.length);
    if (!/^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i.test(fname)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return true;
    }
    fs.readFile(path.join(UPLOADS_DIR, fname), (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not found');
      }
      const ext = path.extname(fname).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable'
      });
      res.end(data);
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
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
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
