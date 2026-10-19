# Instalador para Windows

`installer/build.sh` arma `installer/dist/NutriAye-Setup-<versión>.exe` (Windows 10/11, 64 bits) desde Linux.

```bash
sudo dnf install mingw32-nsis ImageMagick   # una sola vez
installer/build.sh                          # base inicial desde backend/db/database.sqlite
installer/build.sh otra-base.sqlite         # o desde otra base
```

## Qué lleva
- `nutri-aye-server.exe`: Node 22 para Windows (renombrado, así el instalador lo cierra sin tocar otros Node).
- El backend con sus dependencias de producción y el `better_sqlite3.node` de Windows.
- `frontend/public` y los datos que el backend lee al correr: `foods-data/exercises`, `allergens` y `translations` (los USDA no).
- `seed/database.sqlite`: la base inicial (`make-seed-db.js`). Tiene el catálogo de alimentos, las recetas, las plantillas activas y las rutinas del consultorio. No tiene usuarios, pacientes, cobros ni registro de cambios.
- `launcher.js`: arranca el server oculto y abre el navegador.

## En la computadora
- Se instala **por usuario y sin administrador**, en `%LOCALAPPDATA%\Programs\Nutri Aye`.
- Crea accesos en el escritorio, en el menú Inicio y en **Inicio de Windows** (arranca sin abrir el navegador).
- Los **datos** van en `%LOCALAPPDATA%\NutriAye`: `database.sqlite`, `respaldos\` (copia diaria, 30 días) y `servidor.log`. Ni actualizar ni desinstalar los borra.
- La primera vez copia la base inicial y pide crear el admin. El nombre del consultorio que se escribe ahí reemplaza a «Consultorio principal».
- Solo escucha en `127.0.0.1:3001` (esta computadora). Si el puerto está ocupado: variable de entorno `NUTRI_AYE_PORT`.
- **Actualizar** = correr el instalador nuevo: cierra el server, reemplaza el programa y las migraciones corren al arrancar.

## Probar con Wine (Fedora)
Hace falta el metapaquete **`wine`** completo (`sudo dnf install wine`). Con solo `wine-core` falta Mono:
la creación del prefijo abre una ventana para descargarlo y se queda esperando (parece colgada).
Siempre con `winemenubuilder` apagado, para que no deje accesos ni asociaciones en el escritorio de KDE:

```bash
export WINEPREFIX=/tmp/prueba-wine WINEDEBUG=-all WINEDLLOVERRIDES="winemenubuilder.exe=d" NUTRI_AYE_PORT=3401
wine wineboot -i                                   # ~1 min la primera vez
wine installer/dist/NutriAye-Setup-*.exe /S        # instalación silenciosa
P="$WINEPREFIX/drive_c/users/$USER/AppData/Local/Programs/Nutri Aye"
wine "$P/nutri-aye-server.exe" "C:\users\$USER\AppData\Local\Programs\Nutri Aye\launcher.js" --background
curl 127.0.0.1:3401/api/auth/status                # setupRequired: true la primera vez
wine "$P/Desinstalar.exe" /S
```

## Probado (18/10, Wine 11 en Fedora 44)
- Instalación silenciosa: archivos, accesos (escritorio, menú Inicio, Inicio de Windows) y registro de desinstalación.
- Node y SQLite de Windows: primer arranque con base inicial y copia diaria, primer admin, 194 recetas, las 6 pestañas sin errores.
- Actualizar con el server corriendo: lo cierra, reemplaza el programa y conserva los datos.
- Desinstalar: borra el programa y los accesos, conserva los datos.
- Falta: Windows real (arranque al prender, navegador por defecto, SmartScreen).
