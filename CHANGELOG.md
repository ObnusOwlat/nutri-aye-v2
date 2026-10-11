# Registro de cambios

Cambios por fase del plan de trabajo. Las fechas son de merge a `master`.

## Frontend: pacientes en archivos chicos

- **División:** `patients.js` pasó de 1.048 líneas a 162. El resto quedó en `patient-form.js` (alta y edición), `patient-profile.js` (ficha, pestañas y resumen) y `patient-billing.js` (pestaña de facturación).
- **Botones de la ficha:** "Edit Patient" y "Export" no tenían nada conectado. Ya funcionan.
- **Borrar un paciente:** ahora también se borra en el server. Antes volvía a aparecer al sincronizar.
- **Alta de paciente:** ya no se pierde la actividad física.
- **Nombres con `&` o comillas:** se mostraban escapados dos veces en el formulario.
- **Pestaña "Billing":** ya existía en el código, pero ningún botón la abría. Ahora muestra el vínculo con el cliente y los montos en ₲.

## Fase 1: backend modular y calidad

### Estructura
- Todo el SQL pasó a `backend/src/repos/` (alimentos, recetas, pacientes, Planner, facturación). Las rutas solo validan y llaman al repo. Ningún archivo del backend supera las 150 líneas.
- `nutrient-fields.js` define una sola vez las 32 columnas de nutrientes por 100 g. De ahí salen el alta, la edición y la respuesta de la API. Antes estaban escritas a mano en 3 lugares, y editar un alimento solo actualizaba 11 de ellas.
- Facturas y presupuestos comparten una sola implementación (`repos/billing/documents.js`), en lugar de dos copias casi iguales.
- Migraciones numeradas con la tabla `schema_version` (`src/db/migrations.js`).

### Validación y respuestas
- Validación con zod en todos los endpoints que escriben, con mensajes en español que indican el campo (`400 VALIDATION_ERROR`).
- Respuestas uniformes: `{ success, data }` en camelCase (también en Planner, facturación, estadísticas y sincronización).
- `404` al editar o borrar algo que no existe. `409` al borrar un alimento usado en recetas, un cliente con facturas o una receta asignada a un plan.
- Un manejador central de errores reemplaza los ~60 `try/catch` repetidos.

### Datos
- Transacciones en recetas, Planner, facturas, presupuestos, medios de pago y vínculo paciente → cliente: si algo falla, no queda nada a medias.
- Recetas y Planner cargan sus ingredientes y comidas en una sola consulta, en lugar de una por receta.
- Facturación:
  - Los totales se calculan en el server a partir de los ítems.
  - La numeración sigue el número más alto, en vez de la fecha de creación.
  - Estados como lista cerrada.
  - Solo un medio de pago predeterminado.
  - País y moneda por defecto: Paraguay y PYG.
- Editar un paciente cambia solo los campos enviados.
- La búsqueda de pacientes, recetas y clientes ignora tildes.

### Respaldo
- Nuevo formato (`version: 4`) con todas las tablas del consultorio, sin pérdida de datos al exportar y volver a importar.
- La importación vuelve a funcionar:
  - Actualiza o agrega por id y nunca borra.
  - Verifica tablas y columnas contra el esquema, lo que impide inyecciones SQL.
  - Corre en una sola transacción: si hay un error, no importa nada.

### Logs
- `pino` con un id por solicitud (header `X-Request-Id`), sin los datos enviados en las solicitudes.
- Se quitaron 35 `console.log` del frontend, algunos con nombres de pacientes.

### Código eliminado
- `event-handlers.js`, `import-script.js` y `shopping.js` (no se cargaban), la lista de compras sin pantalla, `frontend/src` (TypeScript sin uso), `vite.config.ts`, `tsconfig.json` y `frontend/package.json`.
- `POST /api/sync/push` (no hacía nada), `GET /api/sync/init` (duplicado), `POST /billing-api/clients/from-patient` (duplicado del vínculo paciente → cliente).
- La dependencia `uuid`, reemplazada por `crypto.randomUUID()`.

### Bugs corregidos
- **Planner:** al recargar, las semanas se convertían a claves viejas en español (`desayuno`, `almuerzo`…) y la grilla quedaba vacía. Ahora se migran a las claves actuales.
- **Buscador del editor de recetas:**
  - Tenía el mismo id que el de la pestaña Alimentos, así que no buscaba nada.
  - Ahora busca en el server (alimentos propios y USDA).
  - Un alimento USDA elegido ya no queda como "Unknown" con 0 kcal.
- **Plan del paciente:** las calorías de cada receta salían en 0 (`totalKcal` no existía).
- **Botón "+ Add Template":** no hacía nada.
- **Abrir un paciente que no estaba en el navegador:** creaba una copia con otro id.
- **`.gitignore`:** ignoraba `.env.example`.

### Tests
- De 23 a 35 tests. Cubren validación, 404/409, transacciones, respaldo de ida y vuelta, respaldo con referencias rotas, numeración de facturas, totales y migraciones.

## Fase 0: seguridad urgente (PR #4, 2026-10-11)
- Sin CORS, `helmet` con CSP, límite de pedidos por minuto, 1 MB por solicitud y el server escuchando solo en `127.0.0.1`.
- Solo se sirve `frontend/public/`; antes se podían descargar `node_modules` y el código fuente.
- Errores genéricos hacia el cliente; los ids los genera siempre el server.
- XSS: `escapeHtml` escapa comillas, y los datos de usuario se escapan en 63 lugares. Se quitaron los `onclick` escritos en el HTML.
- `server.js` (2.669 líneas) se dividió en módulos. Primeros 23 tests de la API contra una base en memoria.
