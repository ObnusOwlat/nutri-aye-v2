# Nutri Aye

Sistema para consultorios de nutrición: pacientes (mediciones, condiciones, alergias), recetas con cálculo nutricional completo, planificación semanal por paciente, catálogo de ~7.900 alimentos (USDA, en español) y facturación interna.

## Puesta en marcha

Requiere Node 22.9 o superior.

```bash
cd backend
npm install
cp .env.example .env      # opcional: HOST, PORT, DB_PATH
npm start                 # http://127.0.0.1:3001
```

El server sirve la app (`frontend/public/`) y la API en el mismo puerto. La base SQLite se crea sola en `backend/db/` y el esquema se actualiza con migraciones numeradas al arrancar (tabla `schema_version`).

**Primer uso:** al abrir la app sin usuarios, pide crear el consultorio y la cuenta de administrador. Desde la terminal también se puede hacer:

```bash
node scripts/create-admin.js admin@consultorio.com "Nombre" "contraseña"
```

El admin agrega a los demás usuarios desde el menú de usuario → *Usuarios del consultorio* (roles: administrador/a, nutricionista, recepción). Cada usuario nuevo recibe una contraseña temporal que debe cambiar al entrar.

Por defecto escucha solo en esta computadora (`127.0.0.1`). Para abrirlo a la red local hay que esperar a la Fase 9 (HTTPS).

## Desarrollo

```bash
cd backend
npm run dev               # reinicia al guardar
npm test                  # tests de la API contra una base en memoria
```

### Estructura

```
backend/
├── server.js                  # arranque
├── src/
│   ├── app.js                 # seguridad, logs, archivos públicos, rutas, errores
│   ├── db/                    # conexión, migraciones y esquema
│   ├── repos/                 # todo el SQL, por dominio (ingredients, recipes, patients, planner, billing/*)
│   ├── routes/                # endpoints HTTP (delgados: validan y llaman al repo)
│   ├── validation/            # esquemas zod, mensajes en español
│   ├── backup/serializer.js   # exportar / importar respaldo
│   ├── lib/                   # errores, logger, helpers HTTP
│   ├── nutrient-fields.js     # columnas de nutrientes por 100 g (única definición)
│   └── constants.js           # valores permitidos
├── test/                      # node:test + supertest
├── import-usda.js · import-foods.js · seed-demo.js
frontend/public/               # app sin compilación (HTML, CSS, JS)
  js/state/                    # copia en memoria de los datos del server (se carga con GET /api/bootstrap)
tools/                         # traducción offline de nombres USDA
foods-data/                    # datos de alimentos y traducciones
```

Reglas del código:
- Archivos chicos (unas 300 líneas como máximo), un archivo por dominio, el SQL solo en `repos/`.
- **Nada se borra:** "eliminar" desactiva (`deactivated_at`, `deactivated_by`). Un test falla si aparece un `DELETE FROM` sobre datos.
- **Todo se guarda en el server:** el navegador no guarda datos. Los métodos de `State` que cambian algo son async: llaman a la API y después actualizan la copia en memoria.
- Toda consulta filtra por el consultorio de la sesión (`req.ctx.orgId`). Los permisos por rol están en `src/lib/permissions.js`.
- **Todo cambio se registra:** las rutas que escriben envuelven la llamada al repo en `tracked(ctx, entidad, id, fn)` (`src/audit/log.js`), que guarda el antes y el después en `audit_log`, una tabla de solo agregar.

### Convenciones de la API

- Respuestas `{ success: true, data }`; las listas suman `pagination`.
- Errores `{ success: false, error, code, details? }`, con `code` en `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` / `PASSWORD_CHANGE_REQUIRED` / `CATALOG_READONLY` (403), `NOT_FOUND` (404), `CONFLICT` (409) o `INTERNAL_ERROR` (500, sin detalles internos).
- Todo requiere sesión salvo `/api/health`, `/api/auth/status`, `/api/auth/login` y `/api/auth/setup`.
- `DELETE` desactiva; `POST /…/:id/reactivate` reactiva.
- **Formato:** en el frontend, números, fechas y montos se muestran con `UI.formatNumber`, `formatDecimal`, `formatDate` y `formatMoney` (formato es-PY: 1.234,5 · 31/12/2026 · ₲ 150.000), y los valores guardados con `UI.label(grupo, valor)`.
- **Textos en español:** los valores se guardan en inglés (`breakfast`, `male`, `UNPAID`…). Sus nombres en español están en `src/labels.js` y se sirven en `GET /api/labels`. Los mensajes de error y de validación están en español y nombran los campos en español.
- Los ids los genera siempre el server. Los totales de facturas y presupuestos se calculan en el server a partir de los ítems.
- Cada respuesta lleva `X-Request-Id`, que aparece en el log. Los logs nunca incluyen el cuerpo de las solicitudes.

## Respaldo

Solo el admin, y solo para su consultorio.

- `GET /api/backup/export` descarga un JSON (`format: "nutri-aye-backup"`, `version: 5`) con los datos del consultorio, incluidos los desactivados. No incluye el catálogo USDA, salvo los alimentos que usan sus recetas.
- `POST /api/backup/import` restaura un respaldo: actualiza o agrega por id dentro de una transacción. **No borra nada**, y rechaza datos de otro consultorio. Si el archivo tiene un error, no se importa nada.

## Catálogo de alimentos (USDA FoodData Central)

Unos 7.900 alimentos (Foundation Foods + SR Legacy, dominio público/CC0) con su perfil completo (246 nutrientes) y porciones caseras.

```bash
# 1. Bajar los JSON a foods-data/usda/ (no se versionan)
mkdir -p foods-data/usda && cd foods-data/usda
curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip
curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip
unzip -o '*.zip' && cd ../..

# 2. Arrancar el server una vez (crea el esquema) e importar
cd backend && node import-usda.js
```

Los nombres se importan en español (`name`) y se conserva el original en `name_en`. La búsqueda encuentra ambos e ignora tildes ("limon" encuentra "Limón"). Volver a importar actualiza nutrientes y nombres, pero respeta los nombres y las categorías que se editaron a mano.

### Nombres en español (gratis y sin conexión)

`foods-data/translations/usda-names-es.json` está versionado, así que la importación funciona sin este paso. Para regenerarlo:

```bash
python3 -m venv tools/.venv
tools/.venv/bin/pip install ctranslate2 sentencepiece
mkdir -p tools/models && curl -L -o /tmp/en_es.zip https://argos-net.com/v1/translate-en_es-1_0.argosmodel
unzip -o /tmp/en_es.zip -d tools/models          # -> tools/models/en_es/
tools/.venv/bin/python tools/translate-usda.py   # ~40 s; después, node import-usda.js
```

Las porciones caseras se traducen con `tools/translate-portions.py` (resultado en `foods-data/translations/portions-es.json`, que el backend lee al arrancar).

El catálogo básico (calories-in) se traduce con `tools/translate-basic.py` (mismo traductor, más las correcciones de `tools/basic-overrides-es.json`); el resultado está versionado en `foods-data/translations/calories-in-names-es.json` y lo aplica la migración 8.

Usa `tools/glossary-usda-es.json` (~900 términos con nombres de la región: porotos, batata, palta, cortes de carne) y un modelo OPUS-MT local (Argos Translate) para el resto.

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/ingredients?search=&source=usda` | Búsqueda paginada (`usda`, `usda_foundation`, `usda_sr_legacy`, `calories_in`, `user`) |
| `GET /api/ingredients?scope=own\|catalog` | Alimentos propios o del catálogo compartido |
| `GET /api/ingredients/:id` | Alimento con `keyNutrients`, todos los `nutrients` (por 100 g) y `portions` en español |
| `POST /api/ingredients/:id/duplicate` | Copia propia de un alimento del catálogo, con nutrientes y porciones |
| `GET /api/nutrients?group=vitamins` | Catálogo de nutrientes |
| `GET /api/nutrients/:id/ingredients?category=vegetables` | Alimentos más ricos en un nutriente |
| `GET /api/recipes/:id` | Receta con `nutrients` (totales completos) |

## Datos de prueba

```bash
cd backend && node seed-demo.js           # 4 pacientes ficticios + 9 recetas con alimentos USDA, en el primer consultorio
node seed-demo.js --remove                # los desactiva (no se borra nada; todos los ids empiezan con "demo-")
```

## Atajos de teclado

| Atajo | Acción |
|-------|--------|
| `Alt + 1` … `Alt + 5` | Pacientes, Planificador, Alimentos, Recetas, Actividad |
| `Ctrl + S` | Respaldo |
| `Ctrl + P` | Imprimir |
| `Esc` | Cerrar ventana |

## Licencia

MIT
