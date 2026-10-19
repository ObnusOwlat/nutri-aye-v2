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
- `frontend/public`.
- `seed/database.sqlite`: la base inicial (`make-seed-db.js`). Tiene el catálogo de alimentos, las recetas, las plantillas activas y las rutinas del consultorio. No tiene usuarios, pacientes, cobros ni registro de cambios.
- `launcher.js`: arranca el server oculto y abre el navegador.

## En la computadora
- Se instala **por usuario y sin administrador**, en `%LOCALAPPDATA%\Programs\Nutri Aye`.
- Crea accesos en el escritorio, en el menú Inicio y en **Inicio de Windows** (arranca sin abrir el navegador).
- Los **datos** van en `%LOCALAPPDATA%\NutriAye`: `database.sqlite`, `respaldos\` (copia diaria, 30 días) y `servidor.log`. Ni actualizar ni desinstalar los borra.
- La primera vez copia la base inicial y pide crear el admin. El nombre del consultorio que se escribe ahí reemplaza a «Consultorio principal».
- Solo escucha en `127.0.0.1:3001` (esta computadora). Si el puerto está ocupado: variable de entorno `NUTRI_AYE_PORT`.
- **Actualizar** = correr el instalador nuevo: cierra el server, reemplaza el programa y las migraciones corren al arrancar.

## Probado
- En Linux, el paquete con el `.node` de Linux: primer arranque, admin, segundo arranque y reinicio.
- Falta probarlo en un Windows real (Wine no llegó a iniciar).
