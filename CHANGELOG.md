# Registro de cambios

Cambios por fase del plan de trabajo. Las fechas son de merge a `master`.

## Fase 3: registro de cambios

- **Tabla `audit_log` (migración 5):** guarda consultorio, usuario, acción, tipo de dato, id, paciente relacionado, cambios (antes → después de los campos que cambiaron), IP y fecha.
- **Solo agregar:** dos triggers de SQLite rechazan cualquier `UPDATE` o `DELETE`, incluso hecho directo en la base.
- **Atomicidad:** cada cambio se registra en la misma transacción que el cambio. Si una de las dos cosas falla, no queda ninguna. Un cambio rechazado (400/404) o sin diferencias no registra nada.
- **Qué se registra:**
  - Alta, modificación, desactivación y reactivación de pacientes, mediciones, condiciones, semanas del Planner, recetas (con sus ingredientes), alimentos propios, clientes, facturas y presupuestos (con sus ítems), medios de pago, datos del consultorio y formato PDF.
  - Usuarios: alta, rol, desactivación, reactivación y contraseña temporal.
  - Sesiones: inicio, cierre, intentos fallidos, cambio de contraseña y cambio de consultorio.
  - Respaldos exportados e importados, con la cantidad de filas por tabla.
- **Privacidad:** la contraseña, la foto y el logo nunca se copian al registro. Un intento fallido con un email que no existe no guarda ese email.
- **`GET /api/activity` (solo admin):** filtra por usuario, tipo de dato, acción y fechas, y muestra solo el consultorio propio.
- **`GET /api/patients/:id/history`:** todo lo del paciente, incluidas sus mediciones, condiciones y semanas del Planner.
- **Interfaz:** pestaña "Actividad" (solo admin) con filtros y páginas, y pestaña "Historial" en la ficha del paciente. Los cambios se ven en español ("teléfono: 0981 100100 → 0981 200200"). Alt+5 abre Actividad.
- **Tests:** de 50 a 57.

## Frontend y CSS: archivos chicos (2)

- **`planner.js`** (783 líneas) quedó en `planner.js` (grilla), `planner-templates.js`, `planner-patient.js` y `planner-recipe-picker.js`.
- **`recipes.js`** (626 líneas) quedó en `recipes.js` (lista), `recipe-editor.js` y `recipe-ingredient-search.js`.
- **`ui.js`** (526 líneas) quedó en `ui.js` (punto de entrada), `ui-modal.js` y `ui-toast.js`. Se borraron funciones que no usaba nadie: ayudantes de formularios, indicadores de carga, `formatWeight`, `App.reset` (borraba todos los datos del navegador) y `handleConfirmClick`.
- **CSS:** los 4 archivos (3.693 líneas) quedaron en 16 archivos por pantalla o componente, cargados en el mismo orden. Un script comprobó que el resultado es idéntico al original. Se quitó la sección de la lista de compras, que ya no tenía pantalla.
- **Confirmaciones:** el botón dice "Desactivar" por defecto, porque nada se borra. Vaciar la semana y borrar los alimentos guardados en el navegador tienen su propio texto.
- **Formularios:** el nombre de la receta, la búsqueda de alimentos y "¿Realiza actividad física?" ya no pierden lo escrito si se completan antes de que la ventana termine de abrirse.
- **Pendientes a propósito:** `state.js` se reemplaza en la Fase 4, `ingredients.js` se rehace en la Fase 6 y `api.js` se reescribe en la Fase 4.

## Fase 2: usuarios, consultorios y permisos

### Usuarios y sesiones
- **Tablas nuevas:** `organizations` (consultorios), `users`, `memberships` (usuario × consultorio × rol) y `sessions`.
- **Contraseñas:** se guardan con scrypt (incluido en Node). Las sesiones usan una cookie `HttpOnly` y `SameSite=Lax`, y en la base se guarda solo el hash del token.
- **Duración:** la sesión se cierra tras 12 h sin uso o 7 días en total (configurable en `.env`). Cerrar sesión revoca la sesión en el server.
- **Primer uso:** si no hay usuarios, la app pide crear el consultorio y su admin. También está `node scripts/create-admin.js` para instalar desde la terminal.
- **Login:** el mismo mensaje para contraseña incorrecta y para email inexistente, y un límite de 20 intentos fallidos cada 15 minutos.
- **Contraseña temporal:** el usuario que entra con una debe cambiarla antes de poder usar la app. Cambiar la contraseña cierra las demás sesiones.
- **Varios consultorios:** una misma persona puede pertenecer a más de uno y cambiar entre ellos desde el menú.

### Roles (`src/lib/permissions.js`, una sola tabla)
- **Administrador/a:** todo, más los usuarios del consultorio, el respaldo y los datos de facturación del consultorio.
- **Nutricionista:** pacientes, datos clínicos, recetas, alimentos, Planner y facturación.
- **Recepción:** pacientes (datos personales) y facturación. Puede ver, pero no editar, mediciones, condiciones, recetas, alimentos ni el Planner. En la interfaz no ve esas pestañas.
- **Escrituras desde otros sitios:** se rechazan revisando el header `Origin` (protección CSRF).

### Datos aislados por consultorio
- Pacientes, recetas, alimentos propios y facturación llevan `org_id`. Cada consulta filtra por el consultorio de la sesión, así que otro consultorio recibe 404.
- **Catálogo compartido:** USDA y calories-in son comunes a todos y de solo lectura (`403 CATALOG_READONLY`).
- **Migración:** los datos existentes pasaron al "Consultorio principal".
- **Numeración:** facturas y presupuestos se numeran por consultorio, lo que obligó a reconstruir esas dos tablas en la migración 4.
- **Respaldo (versión 5):** exporta solo el consultorio propio. Al importar rechaza filas o referencias de otro consultorio, y no modifica el catálogo.

### Nada se borra: todo se desactiva
- Pacientes, mediciones, condiciones, recetas, alimentos propios, semanas del Planner, clientes, facturas, presupuestos, medios de pago y usuarios se desactivan (`deactivated_at`, `deactivated_by`), con endpoints para reactivarlos.
- Un alimento o receta desactivado deja de aparecer en búsquedas, pero las recetas y planes que lo usan siguen funcionando.
- Un test revisa que ningún archivo del backend tenga un `DELETE FROM` sobre datos. Solo se permite reemplazar las líneas de una receta, una semana o una factura al editarla.

### Interfaz
- Pantallas de login, alta del primer admin y cambio de contraseña, todas en español.
- Menú de usuario: consultorio, rol, cambiar de consultorio, usuarios, contraseña y cerrar sesión.
- Ventana de usuarios del consultorio: agregar con contraseña temporal, cambiar rol, desactivar, reactivar y generar una contraseña nueva.
- **Datos del navegador:** se guardan aparte para cada usuario. Si otra persona entra en el mismo navegador, los datos del anterior se apartan y se le devuelven cuando vuelve a entrar.

### Tests
- De 35 a 50. Cubren login, cookie, cierre de sesión, contraseña temporal, roles, origen de las escrituras, usuarios, cambio de consultorio, alta del primer admin, aislamiento entre consultorios, desactivación y ausencia de `DELETE`.

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
