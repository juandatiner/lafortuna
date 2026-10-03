#!/usr/bin/env node
/**
 * Vuelve a cargar un respaldo de backups/ en el sitio publicado.
 *
 *   npm run restore -- https://mi-sitio.up.railway.app backups/2026-10-03_1430
 *   npm run restore -- https://mi-sitio.up.railway.app backups/... --dry-run
 *
 * La clave de edicion sale de la variable EDIT_KEY (por defecto 2026):
 *   EDIT_KEY=miclave npm run restore -- <url> <carpeta>
 *
 * Primero sube los adjuntos (el servidor reescribe su registro .attach con el
 * id nuevo) y despues manda los textos, salteando las claves .attach para no
 * pisar esos ids recien creados.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EDIT_KEY = process.env.EDIT_KEY || '2026';

function parseArgs(argv){
  const args = argv.slice(2);
  const positional = args.filter(a => !a.startsWith('--'));
  return { base: positional[0], dir: positional[1], dryRun: args.includes('--dry-run') };
}

async function post(origin, endpoint, body){
  const res = await fetch(`${origin}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Edit-Key': EDIT_KEY },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 160)}`);
  return text;
}

async function main(){
  const { base, dir, dryRun } = parseArgs(process.argv);
  if (!base || !dir) {
    console.error('Uso:\n  npm run restore -- <url> <carpeta-de-backup> [--dry-run]');
    process.exit(1);
  }
  const origin = base.replace(/\/+$/, '');
  const dirPath = path.isAbsolute(dir) ? dir : path.join(ROOT, dir);
  const contentPath = path.join(dirPath, 'content.json');
  if (!fs.existsSync(contentPath)) {
    console.error(`No encuentro ${contentPath}`);
    process.exit(1);
  }

  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  const manifest = fs.existsSync(path.join(dirPath, 'manifest.json'))
    ? JSON.parse(fs.readFileSync(path.join(dirPath, 'manifest.json'), 'utf8'))
    : { attachments: [] };

  const textKeys = Object.keys(content).filter(k => !k.endsWith('.attach'));
  const attachments = manifest.attachments || [];

  console.log(`Destino: ${origin}`);
  console.log(`Respaldo: ${path.relative(ROOT, dirPath)}`);
  console.log(`  ${textKeys.length} campos de texto, ${attachments.length} adjuntos`);
  if (dryRun) { console.log('\n--dry-run: no se envia nada.'); return; }

  let okFiles = 0, okKeys = 0;
  const errors = [];

  for (const a of attachments) {
    const file = path.join(dirPath, 'uploads', a.file);
    if (!fs.existsSync(file)) { errors.push(`falta el archivo ${a.file}`); continue; }
    try {
      await post(origin, '/api/upload', {
        key: a.contentKey, kind: a.kind, filename: a.name,
        mime: a.mime, dataBase64: fs.readFileSync(file).toString('base64')
      });
      okFiles++;
    } catch (e) { errors.push(`adjunto ${a.contentKey}: ${e.message}`); }
  }

  for (const key of textKeys) {
    try {
      await post(origin, '/api/content', { key, value: content[key] });
      okKeys++;
    } catch (e) { errors.push(`campo ${key}: ${e.message}`); }
  }

  console.log(`\nRestaurado: ${okKeys}/${textKeys.length} campos, ${okFiles}/${attachments.length} adjuntos`);
  if (errors.length) {
    console.log(`\n${errors.length} errores:`);
    for (const e of errors) console.log(`  ! ${e}`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
