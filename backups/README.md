# Respaldos del contenido editado

Cada carpeta de acá es una foto del contenido que se editó **desde la página**
(no desde el código), tomada del sitio publicado.

```
<fecha>_<etiqueta>/
  content.json    los textos
  uploads/        las imágenes y documentos adjuntados
  manifest.json   de dónde salió y qué trajo
```

Estas carpetas **sí se versionan en git**, a propósito: son la única copia
fuera del servidor.

## Tomar un respaldo

```bash
npm run backup -- https://TU-SITIO --tag antes-del-deploy
```

## Devolver un respaldo al sitio

```bash
EDIT_KEY=tuclave npm run restore -- https://TU-SITIO backups/2026-10-03_1430
```

Agregá `--dry-run` para ver qué haría sin enviar nada.
