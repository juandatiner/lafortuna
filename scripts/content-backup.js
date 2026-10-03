#!/usr/bin/env node
/**
 * Descarga el contenido editado desde el sitio publicado y lo guarda en backups/.
 *
 *   npm run backup -- https://mi-sitio.up.railway.app
 *   npm run backup -- https://mi-sitio.up.railway.app --tag antes-del-deploy
 *
 * Guarda:
 *   backups/<fecha>/content.json   todos los textos editados desde la pagina
 *   backups/<fecha>/uploads/       las imagenes y documentos adjuntados
 *   backups/<fecha>/manifest.json  de donde salio y que trajo
 *
 * El endpoint GET /api/content es publico, asi que esto no necesita clave.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BACKUPS = path.join(ROOT, 'backups');

function parseArgs(argv){
  const args = argv.slice(2);
  const base = args.find(a => !a.startsWith('--'));
  const tagIdx = args.indexOf('--tag');
  const tag = tagIdx !== -1 ? args[tagIdx + 1] : null;
  return { base, tag };
}

function stamp(){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

/* recorre content.json y junta los adjuntos referenciados */
function collectAttachments(content){
  const out = [];
  for (const [key, value] of Object.entries(content)) {
    if (!key.endsWith('.attach') || !value || typeof value !== 'object') continue;
    for (const kind of ['image', 'doc']) {
      const rec = value[kind];
      if (rec && rec.file) {
        out.push({ contentKey: key.slice(0, -'.attach'.length), kind, ...rec });
      }
    }
  }
  return out;
}

async function main(){
  const { base, tag } = parseArgs(process.argv);
  if (!base) {
    console.error('Falta la URL del sitio.\n  npm run backup -- https://mi-sitio.up.railway.app');
    process.exit(1);
  }
  const origin = base.replace(/\/+$/, '');

  console.log(`Leyendo contenido de ${origin} ...`);
  const res = await fetch(`${origin}/api/content`);
  if (!res.ok) {
    console.error(`El servidor respondio ${res.status} ${res.statusText}. Revisa la URL.`);
    process.exit(1);
  }
  const content = await res.json();
  const keys = Object.keys(content);

  if (!keys.length) {
    console.log('\nEl sitio no tiene contenido editado guardado (respuesta vacia).');
    console.log('O nunca se edito, o el volumen de Railway no esta montado y ya se perdio.');
  }

  const dirName = tag ? `${stamp()}_${tag}` : stamp();
  const dir = path.join(BACKUPS, dirName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'content.json'), JSON.stringify(content, null, 2));

  const attachments = collectAttachments(content);
  const saved = [];
  const failed = [];

  if (attachments.length) {
    fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true });
    for (const a of attachments) {
      try {
        const r = await fetch(`${origin}/api/uploads/${a.file}`);
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const buf = Buffer.from(await r.arrayBuffer());
        fs.writeFileSync(path.join(dir, 'uploads', a.file), buf);
        saved.push({ ...a, bytes: buf.length });
      } catch (e) {
        failed.push({ ...a, error: String(e.message || e) });
      }
    }
  }

  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    origin, takenAt: new Date().toISOString(), tag: tag || null,
    contentKeys: keys.length, attachments: saved, failed
  }, null, 2));

  console.log(`\nGuardado en backups/${dirName}`);
  console.log(`  ${keys.length} campos de contenido`);
  console.log(`  ${saved.length} adjuntos descargados${failed.length ? `, ${failed.length} fallaron` : ''}`);
  for (const f of failed) console.log(`    ! ${f.file} (${f.contentKey}): ${f.error}`);
}

main().catch(e => { console.error(e); process.exit(1); });
