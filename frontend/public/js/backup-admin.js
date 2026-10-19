/**
 * backup-admin.js - "Respaldos" window (admins, from the user menu): download
 * the consultorio's backup, restore one from a file (showing what it brings
 * before importing) and see the automatic daily copies of the server.
 */

const BackupAdmin = (function() {
    const esc = (v) => UI.escapeHtml(v ?? '');
    const MAX_BYTES = 20 * 1024 * 1024; // the server accepts up to 20 MB
    // Tables shown in the summary of a file, in this order
    const SUMMARY = [
        ['patients', 'pacientes'], ['patient_metrics', 'mediciones'], ['patient_plans', 'planes'],
        ['recipes', 'recetas'], ['ingredients', 'alimentos propios'], ['diet_templates', 'plantillas de semana'],
        ['day_templates', 'plantillas de día'], ['activity_templates', 'rutinas'],
        ['billing_invoices', 'recibos'], ['billing_payments', 'pagos']
    ];
    let pending = null; // backup read from the chosen file

    const megabytes = (bytes) => `${UI.formatDecimal(bytes / 1024 / 1024, 1)} MB`;

    function open() {
        pending = null;
        UI.openModal({
            title: 'Respaldos',
            content: `
                <div class="backups">
                    <section>
                        <h4>Descargar respaldo</h4>
                        <p class="text-muted">Un archivo con todos los datos de este consultorio. Guardalo fuera de la computadora (pendrive, correo, nube).</p>
                        <a class="btn btn--primary btn--sm" href="/api/backup/export" download>💾 Descargar respaldo</a>
                        <small class="text-muted">Atajo: Ctrl+S</small>
                    </section>
                    <section>
                        <h4>Restaurar desde un archivo</h4>
                        <p class="text-muted">Lo que ya existe se reemplaza por la versión del archivo; lo que no está en el archivo queda como está. No se borra nada.</p>
                        <input type="file" accept=".json,application/json" id="backup-file" class="form-input">
                        <div id="backup-preview"></div>
                    </section>
                    <section>
                        <h4>Copias automáticas</h4>
                        <div id="backup-auto"><p class="text-muted">Cargando...</p></div>
                    </section>
                </div>`,
            hideFooter: true,
            onOpen: bind
        });
        bind();
        loadAuto();
    }

    function bind() {
        document.getElementById('backup-file')?.addEventListener('change', (e) => read(e.target.files[0]));
        document.getElementById('backup-preview')?.addEventListener('click', (e) => {
            if (e.target.closest('[data-action=restore]')) confirmRestore();
        });
    }

    async function loadAuto() {
        const box = document.getElementById('backup-auto');
        try {
            const auto = await State._api('GET', '/api/backup/auto');
            if (!box) return;
            box.innerHTML = `
                <p>${auto.last ? `Última copia: <strong>${esc(UI.formatDate(auto.last.date))}</strong> (${esc(megabytes(auto.last.size))})`
                    : 'Todavía no hay copias: se hace una por día mientras la app está abierta.'}</p>
                <p class="text-muted">${esc(UI.plural(auto.count, 'copia guardada', 'copias guardadas'))}, se conservan las últimas ${auto.keep}.
                    Es la base entera, para recuperarla si se daña la computadora.<br>Carpeta: <code>${esc(auto.dir)}</code></p>`;
        } catch (error) {
            if (box) box.innerHTML = `<p class="text-muted">No se pudo consultar: ${esc(error.message)}</p>`;
        }
    }

    async function read(file) {
        const preview = document.getElementById('backup-preview');
        pending = null;
        if (!file) { preview.innerHTML = ''; return; }
        try {
            if (file.size > MAX_BYTES) throw new Error(`El archivo pesa ${megabytes(file.size)}; el máximo es 20 MB`);
            const backup = JSON.parse(await file.text());
            if (backup?.format !== 'nutri-aye-backup' || !backup.tables) throw new Error('No es un archivo de respaldo de Nutri Aye');
            pending = backup;
            const counts = SUMMARY.map(([table, label]) => [backup.tables[table]?.length || 0, label]).filter(([n]) => n);
            preview.innerHTML = `
                <div class="backups__preview">
                    <p>Respaldo del <strong>${esc(UI.formatDateTime(backup.exportedAt))}</strong></p>
                    <ul>${counts.map(([n, label]) => `<li>${UI.formatNumber(n)} ${esc(label)}</li>`).join('') || '<li>Sin datos</li>'}</ul>
                    <button class="btn btn--danger btn--sm" type="button" data-action="restore">📂 Restaurar este respaldo</button>
                </div>`;
        } catch (error) {
            preview.innerHTML = `<p class="form-error">${esc(error instanceof SyntaxError ? 'El archivo está dañado o no es un respaldo' : error.message)}</p>`;
        }
    }

    function confirmRestore() {
        const backup = pending;
        if (!backup) return;
        UI.confirmDanger(`¿Restaurar el respaldo del ${UI.formatDateTime(backup.exportedAt)}? Los datos que ya existen se reemplazan por los del archivo. Conviene descargar antes un respaldo de cómo está ahora.`, async () => {
            const { imported } = await State._api('POST', '/api/backup/import', backup);
            const total = Object.values(imported).reduce((a, b) => a + b, 0);
            UI.toastSuccess(`Respaldo restaurado: ${UI.formatNumber(total)} registros`);
            await State.load();
        }, 'Restaurar');
    }

    return { open };
})();
