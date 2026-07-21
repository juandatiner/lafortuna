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
3. No requiere variables de entorno; el servidor toma el puerto de `process.env.PORT` que Railway inyecta.
4. Deploy y listo — la ruta `/` sirve `pitch.html`.

## Estructura

- `pitch.html` — presentación completa (HTML/CSS/JS inline).
- `assets/` — imágenes usadas por la presentación.
- `server.js` — servidor estático (sin dependencias) usado en producción.
- `shot.js`, `shot2.js` — scripts de captura de pantalla con Playwright (uso de desarrollo, no se ejecutan en producción).
