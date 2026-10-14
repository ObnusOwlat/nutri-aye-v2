# Registro de cambios

Cambios por fase del plan de trabajo. Las fechas son de merge a `master`.

## Rutinas que se apilan

- En 🏋 Rutinas, cada rutina tiene ahora el botón «+ Sumar a la semana». Agrega sus ejercicios después de lo que cada día ya tiene, así que se pueden combinar varias rutinas (por ejemplo, caminata + fuerza). «Aplicar a la semana» sigue reemplazando (`State.appendActivityPlan`).

## Arreglo: kcal de los ejercicios según la intensidad

- En calistenia, "moderada" e "intensa" daban las mismas kcal: el circuito y la calistenia intensa valen los dos 7,5 MET. Ahora los niveles quedan así: suave = calistenia moderada (3,8), moderada = calistenia intensa (7,5) e intensa = HIIT intenso (11). Con la intensidad moderada, que es la que viene por defecto, el valor no cambia.
- En pacientes de 60 años o más, las pesas en "moderada" daban menos kcal que en "suave" (los valores MET60 de esas filas no suben con la intensidad). Además, "intensa" pasaba a la tabla de adultos. Ahora se toma el MET60 del ejercicio y se escala igual que los valores de adultos, así que siempre suave < moderada < intensa (`planner-energy.js`).

## Alergias: alérgenos estructurados y control cruzado con los alimentos

- **Alérgenos de cada alimento** (`src/lib/allergen-tags.js`):
  - Son los 14 de declaración obligatoria en la UE (Reglamento 1169/2011).
  - Para calcularlos se combinan dos fuentes. Por un lado, la taxonomía de ingredientes de Open Food Facts (ODbL, `foods-data/allergens/off-allergen-terms.json`, se actualiza con `import-off-allergens.js`), buscada en el nombre en inglés de USDA y en el nombre en español. Por otro, reglas locales: manteca, avena (que la UE cuenta como gluten), salsa de soja y pescados de río.
  - Gana el término más largo: "leche de coco" no cuenta como leche y "nuez moscada" no cuenta como fruto seco.
  - 2.470 de los 8.231 alimentos llevan algún alérgeno.
- **Correcciones del consultorio:** en el detalle de un alimento, cada alérgeno se marca o desmarca con un toque (`PUT /api/ingredients/:id/allergens`). La corrección no se borra y queda en el registro de actividad.
- **Alergias del paciente sin escribir a mano:**
  - Las alergias e intolerancias ahora tienen casillas con los 14 alérgenos.
  - Lo que ya estaba escrito se tradujo solo: "Enfermedad celíaca" → gluten, "Intolerancia a la lactosa" → lácteos. Si no se marca ninguno, se deducen del nombre.
  - La ficha muestra los alérgenos como etiquetas.
- **Control cruzado:**
  - Las sugerencias, los ⚠ del Planificador y el selector de recetas usan los alérgenos reales de cada ingrediente, por ejemplo "Contiene lácteos: Queso mozzarella — intolerancia".
  - Si es una alergia grave, la receta queda `blocked` y arrastrarla al Planificador pide confirmación.
  - Las metas (`avoid`) también usan esta lista.
- **Crear receta:** cada alimento muestra sus alérgenos, y arriba aparece "⚠ Contiene: huevo, lácteos" para toda la receta.
- **Aviso:** la detección se basa en el nombre del alimento y los alimentos crudos no informan trazas. Hay que revisar siempre la etiqueta.
- **Migración 15:** agrega `ingredients.allergen_tags` (JSON), `ingredient_allergen_overrides` y `patient_conditions.allergens`, y calcula los alérgenos de todos los alimentos.
- **Tests:** de 103 a 106.

## Planificador: actividad física en la misma grilla y barra compacta

- **Selector "🍽 Comidas | 🏃 Actividad"** en la barra del Planificador. En modo Actividad, las mismas tarjetas de los días muestran una pila de ejercicios y actividades, al estilo de la ficha de Smart Fit (`js/planner-activity-grid.js`).
  - Se arrastran desde la pestaña Actividad de la columna izquierda: actividades del Compendio 2024 agrupadas, y ejercicios de wger con foto. También se pueden tocar para elegir el día. Dentro de la grilla se mueven de un día a otro.
  - Al tocar un elemento se edita. Los ejercicios tienen series × repeticiones, carga (kg), descanso e intensidad; las actividades, minutos. Ambos aceptan notas.
  - Se guarda con la plantilla (por ejemplo "Rutina A / B / C") o con "Guardar en paciente". "Vaciar semana" vacía solo lo que se está viendo.
- **Gasto vs. consumo por día** (`js/planner-energy.js`):
  - Cada día compara lo que da el plan de comidas con lo que necesita: reposo por Mifflin-St Jeor × 1,2, más la actividad del día. Marca ⚠ si queda 10 % por debajo o por encima.
  - Las kcal de actividad son MET × VO2 × kg × minutos / 200. Se usa la tabla 60+ desde los 60 años. En los ejercicios de fuerza, los minutos salen de series × (repeticiones × 3 s + descanso).
- **Barra compacta:** paciente, plantilla, objetivo, promedio, modo y botones quedan en una sola fila, en lugar de dos recuadros de unos 250 px.
- **Migración 13:** columna `activity_plan` (JSON) en `diet_templates` y `week_planner`. Validación en `src/validation/activity.js`.
- **Tests:** de 93 a 95.
## Metas: calorías y macros con la fórmula de la nutricionista

- **Pasos del cálculo** (`src/lib/energy.js`):
  1. Reposo por Mifflin-St Jeor.
  2. × factor de actividad.
  3. Objetivo en %: déficit −20 % y volumen +15 % por defecto. Antes eran −500 / +300 kcal fijos.
  4. Proteína en g/kg: 1,6 mantenimiento, 2,0 déficit, 1,8 volumen o rendimiento. Grasa 25 % de las calorías. Carbohidratos, el resto (4 / 9 / 4 kcal por gramo).
- **Ajuste por paciente:** en "Ajustar metas", la nutricionista cambia el % del objetivo, los g/kg de proteína y el % de grasa. Si deja un campo vacío, se usa el valor automático. Se guardan en `patient_targets`, sin migración, y quedan en el historial.
- **Salvaguardas:**
  - Con enfermedad renal la proteína baja a 0,8 g/kg (KDIGO).
  - Con IMC de 30 o más los g/kg se calculan sobre el peso ajustado: ideal + 0,4 × exceso.
  - Avisa si los carbohidratos quedan por debajo de 130 g o si la proteína y la grasa superan las calorías.
- **`GET /api/patients/:id/targets`:**
  - Agrega `macros`, con `protein`, `fat` y `carbs` en g, kcal y %, y `manual`.
  - `energy.suggested` trae `ree`, `tdee` y `goalPercent`.
  - Las metas de proteínas, grasas totales y carbohidratos salen de este cálculo.
- **Panel del Planificador:** muestra "Macros: P … g (…%) · G … · C …". El editor explica el cálculo con los números del paciente.
- **Tests:** 94, con los valores nuevos de déficit y proteína.
## Paraguay primero: ⭐ alimentos locales, traducciones corregidas, filtros en Crear receta y platos típicos

- **⭐ Se consigue en Paraguay** (`src/lib/paraguay.js`):
  - Marca 3.861 alimentos, por la primera palabra del nombre y con una lista de lo que hay en mercados, súper y ferias: carnes, surubí, pacú, mandioca, locote, mamón, mburucuyá, yerba, etc.
  - Quedan afuera las comidas de restaurantes y cadenas, los alimentos infantiles de EE. UU., las marcas y los alimentos nativos.
  - Los alimentos propios siempre cuentan como locales.
  - Es una guía para la búsqueda, no una certificación.
- **Búsquedas:** sin orden elegido, los ⭐ salen primero en Alimentos, en Crear receta y en el selector del Planificador. `GET /api/ingredients?py=1` filtra y `/facets` agrega `py`.
- **Filtro "⭐ Se consigue en Paraguay"** arriba del árbol de Alimentos, con su cantidad y su etiqueta.
- **Crear receta:** el buscador de alimentos ahora tiene grupo, origen (con cantidades) y "⭐ Paraguay", que viene marcado. Los resultados muestran ⭐ y el origen.
- **Traducciones corregidas** en 800 nombres del catálogo. No se tocan los editados a mano.
  - "93 % de préstamos" → "93 % magro", "broiler o fryers" → "parrillero", "pan-broiled crumbles" → "a la sartén, desmenuzado".
  - "Amplios porotos (porotos de la fava)" → "Habas", "arvejas de paloma" → "guandú", "tripe" → "mondongo", "diseminado" → "para untar".
  - "calidad choice/select" → "Choice/Select". Se borró "grado A".
- **Migración 14:** columna `available_py` y correcciones. `import-usda.js` e `import-foods.js` las aplican al importar.
- **Platos típicos** (`backend/seed-recetas-paraguay.js`):
  - Es opcional: no corre solo. Se ejecuta con `node seed-recetas-paraguay.js [orgId]`.
  - Carga chipa, sopa paraguaya, mbeju, vori vori de pollo, bife koygua, guiso de fideo y mandioca hervida como recetas del consultorio, con cantidades aproximadas por porción.
  - Si una receta ya existe, la saltea.
- **Tests:** de 93 a 95.

## Alimentos: filtro por grupo, origen y preparación

- **Columna de filtros a la izquierda** (`js/ingredient-filters.js`, `css/catalog-filters.css`).
  - Árbol de categorías con sus orígenes:
    - Proteínas: Vaca, Cerdo, Pollo y aves, Pescados, Mariscos, Cordero, ternera y caza, Embutidos y fiambres, Legumbres y soja.
    - Verduras: Hojas verdes, Crucíferas, Raíces y tubérculos, Cebolla y ajo, Tomate, zapallo y otros frutos, Hongos, Brotes, Vainas, arvejas y choclo.
    - El resto de las categorías también tiene los suyos.
  - Debajo, la forma de preparación: crudo, cocido, congelado, enlatado, seco o en polvo, sin especificar.
  - Cada opción muestra cuántos alimentos daría y se pueden marcar varias. Una categoría entera y orígenes de otra se suman. Los filtros activos aparecen como etiquetas sobre la lista y se quitan con ×.
  - Reemplaza la fila de botones de categoría. Funciona en "Mis alimentos" y en el catálogo.
  - Formato elegido según Baymard (2024): con varios niveles, una columna lateral siempre visible funciona mejor que botones horizontales o menús desplegables.
- **Clasificación** (`src/lib/food-groups.js` y `food-classify.js`):
  - Sale del nombre en inglés de USDA, después del grupo de alimentos USDA y por último del nombre en español. Las palabras de 4 letras o menos se comparan enteras: "pan" no marca "panceta".
  - Los alimentos propios se clasifican al crearlos o al renombrarlos.
- **Server:**
  - `GET /api/ingredients?category=&subgroup=protein.beef,protein.pork&form=raw,cooked` filtra.
  - `GET /api/ingredients/facets` da las cantidades del árbol. Cada filtro cuenta sin aplicarse a sí mismo.
- **Migración 12:**
  - Agrega las columnas `subgroup` y `food_form` y clasifica los 8.200 alimentos.
  - Corrige la categoría del catálogo básico: 181 alimentos de calories-in estaban mal, sobre todo en "Mixtos" (verduras, frutas, carnes, aceites) y 18 granos o harinas que figuraban como "Proteínas". No cambia los alimentos editados a mano.
  - `import-usda.js` e `import-foods.js` también clasifican al importar.
- **`migrate()`:** aplica toda versión que falte, no solo las mayores a la última. Una migración con número más bajo mergeada después (de otra rama) ya no se saltea.
- **Tests:** de 90 a 93.

## Planificador a todo el ancho: columna izquierda con paciente, recetas y actividad

- **Ancho completo solo en el Planificador:** la semana queda en el centro, con Nutrientes pegado a la derecha y una columna nueva a la izquierda.
  - Debajo de 1500 px, Nutrientes pasa abajo de la semana.
  - Debajo de 1280 px se apila todo, con la semana primero.
  - Las columnas quedan fijas al desplazar, debajo de la barra de pestañas.
- **Pestaña Paciente** (`js/planner-sidebar.js`):
  - Muestra edad, sexo, peso, IMC, objetivo, meta, condiciones con sus notas, las reglas que se aplican y qué evitar.
  - "Alertas de la semana" lista las recetas planificadas que chocan con el paciente y por qué.
  - Reemplaza la barra de datos de arriba: el selector de paciente sigue en su lugar.
- **Pestaña Recetas** (`js/planner-sidebar-recipes.js`):
  - Buscador por nombre o ingrediente, filtro por comida y orden "Sugeridas para el paciente", con motivos y advertencias de `/api/patients/:id/recipe-suggestions`.
  - Se arrastran a un hueco de la semana, o se tocan para elegir el día y la comida.
- **Pestaña Actividad** (`js/planner-sidebar-activity.js`):
  - Calcula las kcal por sesión, por semana y por día con el peso y la edad del paciente (MET 2024, tabla 60+ cuando corresponde).
  - Buscador de ejercicios de wger por zona y músculo, con foto, licencia y autor. "Estimar kcal" lleva el ejercicio a la calculadora.
  - Todavía no se guarda en el plan.
- **Advertiencias ⚠ de la grilla y del selector de recetas:** ahora usan el chequeo del server (alérgenos por grupo, por ejemplo "Intolerancia a la lactosa" → lácteos). Antes buscaban el nombre de la condición dentro del nombre del ingrediente y casi nunca avisaban.
- **CSP:** se permiten imágenes de `https://wger.de`, solo para las fotos de los ejercicios.
- **Catálogo de ejercicios:** primero los que tienen nombre en español.

## Sugerencias de recetas y ejercicios (parte del server)

- **`GET /api/patients/:id/recipe-suggestions?mealType=&limit=&week=&days=`:** ordena las recetas del consultorio para un paciente. Devuelve `score`, `reasons` ("Bajo en sodio (164 mg)", "Aporta 101 % de folato del día") y `warnings`. Son una guía; decide la nutricionista.
  - **Condiciones** (`src/lib/diet-rules.js`): diabetes, hipertensión, enfermedad renal, colesterol, anemia y embarazo. Se detectan por palabras clave en el nombre o la descripción de la condición. Cada regla cita su guía (OMS, ADA, KDIGO, DASH, NASEM).
  - **Alergias e intolerancias** (`src/lib/allergens.js`): gluten, lácteos, huevo, maní, frutos secos, pescado, mariscos y soja. Se buscan por nombre de ingrediente, como palabra completa ("pan" no marca "panceta"). La receta que choca queda al final con `excluded: true`. Solo cuentan las condiciones de tipo alergia o intolerancia, así una nota como "tomar leche" no excluye nada.
  - **Necesidades por sexo y edad** (`src/lib/dri.js`, NASEM): proteínas, fibra, hierro, calcio, folato, vitamina D, potasio, vitamina C, magnesio, zinc y B12. Con `week=` pesan más los nutrientes que la semana planificada no cubre. Es la base de la Fase 7.
- **Ejercicios (wger):**
  - `import-wger.js` baja el catálogo a `foods-data/exercises/wger-exercises.json`, versionado: 920 ejercicios, 645 con nombre en español y el resto en inglés con `translated: false`.
  - Cada ejercicio trae licencia y autor (CC-BY-SA 3/4 o CC0, con atribución).
  - Endpoints: `GET /api/exercises?search=&category=&muscle=&equipment=` y `GET /api/exercises/filters`.
- **Actividades con MET** (`foods-data/exercises/met-compendium.json`):
  - 50 actividades comunes (caminar, correr, bici, natación, gimnasio, yoga, baile, deportes y hogar) con el MET del Compendio 2024 de adultos y, cuando existe, del Compendio 60+.
  - `GET /api/activities/kcal?activityId=&minutes=&patientId=`: kcal = MET × VO2 × kg × min / 200. El VO2 es 3,5 ml/kg/min en adultos y 2,7 desde los 60 años, y el peso sale de la última medición del paciente.
- **Sin migración:** los dos catálogos son archivos que el server lee en memoria; no hay tablas nuevas.
- **Tests:** de 71 a 78.

## Planner: panel lateral de nutrientes

- **Panel "Nutrientes" a la derecha de la semana** (`js/planner-nutrients.js`, `css/planner-nutrients.css`):
  - Muestra el promedio diario de la semana (solo cuenta los días con comidas) o el total de un día. El día se elige en el selector o tocando el encabezado del día en la grilla; tocarlo de nuevo vuelve al promedio.
  - Arriba van los 26 nutrientes principales en tres bloques: energía y macronutrientes, vitaminas y minerales. Abajo, en "Ver todos", el resto de los datos USDA, plegados por grupo.
- **Cálculo:** pide a `POST /api/nutrition/analyze` solo las recetas que todavía no tiene y suma en el navegador. Si cambia una comida, se actualiza solo; si se edita una receta, se recalcula.
- **Pantallas de menos de 1280 px:** el panel pasa debajo de la semana.
- Todavía no compara contra la recomendación diaria (eso es la Fase 7).

## Planner: nutrientes de lo planificado (parte backend)

- **`POST /api/nutrition/analyze` `{ recipeIds }`:** devuelve la lista de nutrientes y la cantidad de cada uno por receta. El navegador suma por día o semana, así que cambiar de día no hace otra consulta. Las recetas de otro consultorio o desactivadas se ignoran y vuelven en `skipped`. Es solo lectura: no queda en el registro de cambios.
- **Nutrientes principales (`src/lib/key-nutrients.js`):**
  - 26 nutrientes: energía, macros, fibra, azúcares, sodio, colesterol, 11 vitaminas y 6 minerales. Van marcados con `key: true`.
  - Por cada ingrediente, el valor sale del dato USDA; si falta, del id USDA duplicado (Energía Atwater, Azúcares NLEA); si también falta, de la columna propia del alimento. Así los alimentos propios y los de calories-in también suman.
  - El resto de los nutrientes USDA vienen con `key: false`, para la sección "Ver todos".
- **Diferencia de fuente:** en algunas recetas las kcal pueden diferir un poco de las de la tarjeta (Omelette: 328 contra 324), porque la tarjeta usa la columna propia y el panel el dato USDA.
- El panel del Planner en pantalla llega después de la Fase 4.
- **Tests:** de 57 a 60.

## Fase 7: metas nutricionales por paciente

- **`lib/dri.js` ampliado:** ingestas de referencia NASEM de 23 nutrientes, para adolescentes (14-18) y adultos (19-30, 31-50, 51-70, 71+), embarazo y lactancia.
  - Incluye los niveles máximos tolerables (UL) y los límites de sodio (2.300 mg) y colesterol (300 mg).
  - El máximo tolerable de vitamina A se compara contra el retinol preformado y no contra la vitamina A total, porque los carotenos de verduras como la zanahoria o la batata no tienen máximo.
  - A los menores de 14 se les aplican los valores de adolescentes, con aviso.
  - `driFor()` mantiene su forma para las sugerencias de recetas.
- **`lib/energy.js`:** calorías sugeridas con Mifflin-St Jeor (peso, talla, edad, sexo), multiplicadas por el factor de actividad y ajustadas por el objetivo del plan (déficit −500, aumento de masa +300, rendimiento +200).
- **`GET /api/patients/:id/targets`:** metas diarias del paciente.
  - Energía, por orden de prioridad: la ajustada a mano, la del plan activo o la calculada.
  - Proteínas a 0,8 g/kg cuando se conoce el peso, y grasas saturadas por debajo del 10 % de las calorías.
  - Límites y nutrientes a destacar según sus condiciones (reglas de `lib/diet-rules.js`, con el valor diario igual a 4 veces el de cada comida).
  - Alérgenos a evitar y avisos de datos faltantes.
- **`PUT /api/patients/:id/targets`:** ajustes manuales (migración 9, tabla `patient_targets`). Un valor vacío vuelve al automático; nunca se borra nada y el cambio queda en el historial. Recepción las ve pero no las ajusta.
- **Panel de nutrientes del Planificador** (`planner-targets.js`):
  - Arriba, un resumen del paciente: meta de energía y de dónde sale, condiciones y qué evitar.
  - En cada nutriente, el % de su meta con una barra: gris si está bajo, verde si está en rango, rojo si supera el límite o el máximo tolerable.
  - ★ marca lo que destacan sus condiciones y ✎ lo ajustado a mano.
  - Ventana "Ajustar metas".
- **Tests:** de 83 a 90.

## Fase 6: catálogo de alimentos en pantalla y porciones caseras

- **Pestaña Alimentos, dos vistas:**
  - "Mis alimentos": los propios del consultorio, en memoria.
  - "Catálogo (USDA y básico)": búsqueda paginada en el server (`scope=catalog`), sin tildes y en español o inglés, con filtros por grupo y origen.
- **Ficha de cada alimento** (`GET /api/ingredients/:id`):
  - Nutrientes principales por 100 g.
  - Porciones caseras en español con su peso ("1 taza, picado — 128 g").
  - "Ver los N nutrientes", agrupados (vitaminas, minerales, aminoácidos…).
  - Los alimentos propios sin datos USDA muestran sus valores cargados.
- **Duplicar y editar** (`POST /api/ingredients/:id/duplicate`): el catálogo no se modifica, así que se crea una copia propia con todos sus nutrientes y porciones, y se abre el formulario. Queda en el registro de cambios.
- **Porciones en español:** las 1.817 descripciones de USDA se tradujeron con el traductor local gratuito (`tools/translate-portions.py`), con glosario y correcciones. El resultado está versionado en `foods-data/translations/portions-es.json`.
- **Editor de recetas:** cada alimento se carga en gramos o en porción casera ("2 × 1 taza (198 g)"). Se guarda en gramos (`recipe-lines.js`).
- **`ingredients.js` (1.015 líneas):** quedó en `ingredients.js`, `ingredient-list.js`, `ingredient-detail.js`, `ingredient-form.js` e `ingredient-import.js` (el más grande tiene 305 líneas). El formulario ahora arma sus 32 campos a partir de una lista.
- **Arreglos:**
  - Crear un alimento propio desde la pantalla fallaba, porque la unidad se mandaba como "g" y el server espera "gram".
  - La vitamina C del formulario nunca se guardaba.
  - El registro de cambios mostraba los nombres de columna de los nutrientes ("vitamin_a_per_100g").
- **Tests:** de 79 a 83.

## Fase 5 (frontend): toda la interfaz en español y formato paraguayo

- **Interfaz en español:** pestañas, formularios, ventanas, avisos, confirmaciones, estados vacíos y placeholders con ejemplos locales (0981…, Asunción). `lang="es"`.
- **Valores guardados:** se muestran con `UI.label(grupo, valor)` usando las etiquetas de `GET /api/labels`, que se cargan junto con los datos. Reemplaza los 28 `UI.capitalize` que mostraban "Breakfast", "Male" o "Severe" tal cual. Los valores siguen en inglés en la base.
- **Formato paraguayo:**
  - `UI.formatNumber` y `formatDecimal`: 1.234,5.
  - `UI.formatDate`: 05/03/2026, sin correrse por la zona horaria.
  - `UI.formatMoney`: ₲ 150.000.
  - `UI.plural` para las cantidades.
  - Se usa en pesos, IMC, medidas, calorías, montos y fechas.
- **Macros:** P/C/G (proteínas, carbohidratos, grasas) en lugar de P/C/F.
- **Registro de cambios:** el detalle muestra los valores con su nombre en español ("Objetivo: Mantenimiento → Déficit") y la actividad física en texto.
- **Catálogo básico:** los 298 alimentos (calories-in) tienen nombre en español (migración 8).
  - Se tradujeron con el mismo traductor local y gratuito que USDA (`tools/translate-basic.py`), más 125 correcciones revisadas a mano (`tools/basic-overrides-es.json`).
  - El nombre original queda en `name_en`, así que la búsqueda en inglés sigue funcionando, y se respetan los nombres editados a mano.
  - `import-foods.js` aplica la traducción y no duplica alimentos al volver a correrlo.
- **Arreglos:**
  - Abrir la app con `?tab=planner` dejaba la pestaña vacía, y hacer clic en ella no la mostraba.
  - Las pestañas Resumen, Mediciones, Condiciones, Planes y Seguimiento de la ficha escribían su contenido dentro del botón de la pestaña: se veían dos secciones a la vez y la barra de pestañas se estiraba.
  - Se quitaron las referencias a pestañas inexistentes ("billing", "reports").
- **Verificación:** un recorrido automático por todas las pantallas y ventanas no encuentra palabras en inglés. La única excepción es el tooltip del panel de nutrientes, que muestra a propósito el nombre original de USDA.
- **Tests:** de 71 a 72.

## Fase 5 (backend): textos en español

- **`src/labels.js`:** reúne los nombres en español de todos los valores guardados: tipos de comida, días, categorías, unidades, sexo, estados, nivel de actividad, condiciones, severidad, objetivos, roles, estados de factura y presupuesto, medios de pago, nutrientes y origen de los alimentos. Se sirven en `GET /api/labels`. Un test verifica que todo valor permitido tenga su nombre.
- **Errores de validación:** nombran los campos en español. Por ejemplo: "Revisá los datos: nombre: no puede estar vacío; calorías por 100 g: tipo de dato inválido". En listas indican la fila. Los mensajes de zod que quedaban en inglés tienen su versión en español.
- **"No encontrado":** concuerda con el sustantivo ("Receta no encontrada", "Paciente no encontrado").
- **Migración 7:** nombres de categorías en español (Desayuno, Proteínas…) y abreviaturas de unidades (taza, cda, cdta).
- **`seed-demo.js`:**
  - Carga los datos de prueba en el primer consultorio. Desde la Fase 2 quedaban sin consultorio y no aparecían.
  - `--remove` los desactiva en vez de borrarlos, y volver a correrlo los reactiva.
- **Scripts de importación:** muestran sus mensajes en español.
- **Tests:** un test revisa que no queden mensajes de error en inglés en el backend. De 66 a 71 tests.

## Fase 4: todo guardado en el server

### Backend
- **Migración 6:** agrega la actividad física del paciente (JSON), las medidas extra (circunferencias abdominal, de brazo y de pierna, y cadera) y la tabla `diet_templates`. Cada plantilla guarda su semana de borrador del planificador.
- **Endpoints nuevos:**
  - Planes del paciente con su semana: `/api/patients/:id/plans`. Un plan activo nuevo completa el anterior.
  - Seguimiento: `/api/patients/:id/progress`.
  - Edición de condiciones: `PUT /api/patients/:id/conditions/:conditionId`.
  - Plantillas de dieta por consultorio: `/api/diet-templates`. Cada consultorio recibe 5 plantillas predeterminadas, que no se pueden desactivar.
- **`GET /api/bootstrap`:** trae en un solo pedido todo lo que la app necesita al entrar. Reemplaza a `/api/sync/pull`.
- **`POST /api/migration/browser-data`:** importa una sola vez lo que el navegador guardaba antes.
  - Convierte esos datos al formato del respaldo y usa el mismo importador seguro, que revisa consultorio, referencias y transacción.
  - Solo agrega registros nuevos y nunca pisa lo que ya está en el server.
  - Descarta referencias a cosas que ya no existen.
- **Registro de cambios:** cubre también planes, seguimiento y plantillas.
- **Permisos:** recepción no escribe planes, seguimiento ni plantillas.

### Frontend
- **`state.js` (1.612 líneas):** reemplazado por `js/state/` (`constants`, `core`, `nutrition`, `catalog`, `patients`, `plans` y `planner`, de 70 a 196 líneas cada uno).
  - Es una copia en memoria que se carga del server después del login.
  - Cada cambio se guarda primero en el server y la copia se actualiza con su respuesta.
- **Navegador:** ya no guarda datos. Se borraron `sync.js`, `api.js` y el botón Sync.
- **Ventanas:** esperan al server. El botón se deshabilita mientras guarda, y si el server da error, la ventana queda abierta con el mensaje.
- **Planificador:** la semana de una plantilla se guarda sola en el server. La de un paciente se guarda con "Save to Patient", que también crea el plan activo. Al quitar el paciente se vuelve a la semana de la plantilla.
- **Datos viejos:** si el navegador tiene datos de la versión anterior que el server no tiene, la app ofrece importarlos una vez y después los borra del navegador.
- **Desactivar en vez de borrar:** "borrar" desactiva en el server pacientes, mediciones, condiciones, planes, seguimiento, recetas, alimentos y plantillas. Se quitó "Borrar todos los alimentos".
- **Ctrl+S:** descarga el respaldo del server (solo admin).
- **Arreglo:** varios botones de desactivar leían el elemento clickeado después de cerrar la ventana. Ahora toman el id al momento del click.

### Tests
- De 60 a 66.

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
