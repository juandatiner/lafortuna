# La Fortuna — Pitch

Presentación interactiva (single-page, `pitch.html`) servida con un servidor Node estático mínimo (`server.js`).

## Correr localmente

```bash
npm install
npm start
```

Abre `http://localhost:3000`.

## Deploy en Railway

1. Conecta este repo en Railway (New Project → Deploy from GitHub repo).
2. Railway detecta Node automáticamente (Nixpacks) y usa el script `start` (`node server.js`).
3. El servidor toma el puerto de `process.env.PORT` que Railway inyecta.
4. Deploy y listo — la ruta `/` sirve `index.html`, `/tesis` sirve `tesis.html`, `/anteproyecto` sirve `anteproyecto.html`.

### Contenido editable (`/tesis`)

Las cajas de contenido de `/tesis` se pueden editar desde la página ("Editar
contenido") y se guardan en el servidor vía `/api/content`, no en el
navegador. Para que esos cambios sobrevivan a un redeploy en Railway:

1. En el proyecto de Railway, agregá un **Volume** y montalo en `/data`.
2. Seteá la variable de entorno `DATA_DIR=/data`.
3. (Opcional) Seteá `EDIT_KEY` con una clave propia — por defecto usa `2026`,
   la misma clave del gate de acceso del sitio. Esa clave se manda en el
   header `X-Edit-Key` al guardar.

Sin volumen montado, el contenido igual se guarda (en `./data/content.json`
dentro del contenedor) pero se pierde en cada redeploy.

Las imágenes y documentos que se adjuntan a un campo se suben vía
`/api/upload` y se guardan como archivos en `data/uploads/`, dentro del mismo
Volume — no hace falta ningún Volume ni variable extra.

## Estructura

- `index.html`, `anteproyecto.html`, `tesis.html` — páginas de la app.
- `assets/` — imágenes usadas por las páginas.
- `server.js` — servidor estático + API de contenido (`/api/content`), sin dependencias.
- `data/` — (generado en runtime, no versionado) guarda `content.json` con el contenido editado de `/tesis`.
