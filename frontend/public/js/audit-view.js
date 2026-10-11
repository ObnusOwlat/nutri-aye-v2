/**
 * audit-view.js - Shows audit log entries in Spanish (used by the Activity
 * screen and the patient's History tab)
 */

const AuditView = (function() {
    const ACTIONS = {
        create: 'creó', update: 'modificó', deactivate: 'desactivó', reactivate: 'reactivó',
        login: 'inició sesión', login_failed: 'intento fallido de inicio de sesión', logout: 'cerró sesión',
        password_change: 'cambió su contraseña', password_reset: 'generó una contraseña temporal para',
        switch_org: 'cambió de consultorio', export: 'exportó', import: 'importó'
    };

    const ENTITIES = {
        patient: 'paciente', metric: 'medición', condition: 'condición', planner: 'semana del planificador',
        recipe: 'receta', ingredient: 'alimento', billing_client: 'cliente', invoice: 'factura', quote: 'presupuesto',
        payment_method: 'medio de pago', company: 'datos del consultorio', pdf_config: 'formato de PDF',
        user: 'usuario', session: 'sesión', backup: 'respaldo', plan: 'plan de alimentación', progress: 'seguimiento',
        template: 'plantilla de dieta', browser_data: 'datos del navegador'
    };

    // Field names; unknown fields are shown as they are
    const FIELDS = {
        first_name: 'nombre', last_name: 'apellido', email: 'email', phone: 'teléfono', date_of_birth: 'nacimiento',
        gender: 'sexo', street: 'dirección', city: 'ciudad', zip_code: 'código postal', notes: 'notas', status: 'estado',
        emergency_name: 'contacto de emergencia', emergency_phone: 'teléfono de emergencia', emergency_relation: 'parentesco',
        billing_client_id: 'cliente de facturación', deactivated_at: 'desactivado el', deactivated_by: 'desactivado por',
        name: 'nombre', role: 'rol', category_id: 'categoría', instructions: 'instrucciones', ingredients: 'ingredientes',
        meals: 'comidas', items: 'ítems', date: 'fecha', weight: 'peso', height: 'talla', bmi: 'IMC', body_fat: '% grasa',
        muscle_mass: 'masa muscular', waist: 'cintura', hips: 'cadera', chest: 'pecho', type: 'tipo', severity: 'severidad',
        description: 'descripción', dietary_notes: 'notas dietarias', medications: 'medicación', total: 'total',
        subtotal: 'subtotal', discount: 'descuento', client_id: 'cliente', due_date: 'vencimiento', valid_until: 'válido hasta',
        invoice_number: 'número', quote_number: 'número', kcal_per_100g: 'kcal/100 g', count: 'cantidad',
        diet_goal: 'objetivo', daily_target: 'calorías diarias', start_date: 'inicio', end_date: 'fin', adherence: 'adherencia',
        energy_level: 'energía', sleep_quality: 'sueño', mood: 'ánimo', symptoms: 'síntomas', physical_activity: 'actividad física',
        week_plan: 'semana', goal: 'objetivo', cia_abdominal: 'circ. abdominal', cia_brazo: 'circ. brazo', cia_pierna: 'circ. pierna', cadera: 'cadera'
    };

    const esc = (v) => UI.escapeHtml(v);
    const dateTime = (iso) => new Date(iso).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' });

    function value(v) {
        if (v === null || v === undefined || v === '') return '<em>vacío</em>';
        if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'línea' : 'líneas'}`;
        if (typeof v === 'object') return esc(JSON.stringify(v));
        if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return esc(dateTime(v));
        return esc(String(v).length > 80 ? `${String(v).slice(0, 80)}…` : v);
    }

    // "campo: antes → después" for each changed field (creations show only the value)
    function changesHtml(entry) {
        if (!entry.changes) return '';
        const rows = Object.entries(entry.changes)
            .filter(([field]) => entry.action !== 'deactivate' || field === 'deactivated_at')
            .map(([field, [before, after]]) => {
                const label = esc(FIELDS[field] || field);
                return entry.action === 'create' || before === null && entry.entity === 'backup'
                    ? `<li><span>${label}:</span> ${value(after)}</li>`
                    : `<li><span>${label}:</span> ${value(before)} → ${value(after)}</li>`;
            });
        return rows.length ? `<details class="audit-entry__changes"><summary>Ver detalle</summary><ul>${rows.join('')}</ul></details>` : '';
    }

    function entryHtml(entry, { showPatient = true } = {}) {
        const who = entry.userName ? esc(entry.userName) : '<em>Sin usuario</em>';
        const what = `${esc(ACTIONS[entry.action] || entry.action)} ${['session'].includes(entry.entity) ? '' : esc(ENTITIES[entry.entity] || entry.entity)}`;
        const patient = showPatient && entry.patientName ? ` · <span class="audit-entry__patient">${esc(entry.patientName)}</span>` : '';
        return `
            <li class="audit-entry audit-entry--${esc(entry.action)}">
                <div class="audit-entry__line">
                    <time>${esc(dateTime(entry.createdAt))}</time>
                    <span><strong>${who}</strong> ${what}${patient}</span>
                </div>
                ${changesHtml(entry)}
            </li>`;
    }

    function listHtml(entries, options) {
        if (!entries.length) return '<p class="text-muted">No hay movimientos para mostrar.</p>';
        return `<ul class="audit-list">${entries.map(e => entryHtml(e, options)).join('')}</ul>`;
    }

    return { listHtml, ACTIONS, ENTITIES };
})();
