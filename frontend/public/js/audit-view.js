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
        template: 'plantilla de dieta', routine: 'rutina de ejercicio', dayTemplate: 'plantilla de día', browser_data: 'datos del navegador', targets: 'metas nutricionales'
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
        week_plan: 'semana', goal: 'objetivo', patient_id: 'paciente', address: 'dirección', planner_id: 'planificación',
        template_id: 'plantilla', recipe_id: 'receta', ingredient_id: 'alimento', unit_id: 'unidad', source: 'origen', email_verified: 'email verificado',
        name_en: 'nombre en inglés', name_edited: 'nombre editado', instructions_md: 'preparación', is_default: 'predeterminado', meal_distribution: 'distribución de comidas',
        payment_method_id: 'medio de pago', vat_id: 'RUC', country: 'país', currency: 'moneda', website: 'sitio web', paid_at: 'pagada el', quantity: 'cantidad', unit_price: 'precio unitario', cia_abdominal: 'circ. abdominal', cia_brazo: 'circ. brazo', cia_pierna: 'circ. pierna', cadera: 'cadera'
    };

    // Stored values shown with their Spanish label (group per field; status depends on the entity)
    const VALUE_GROUPS = {
        gender: 'gender', severity: 'severity', diet_goal: 'dietGoal', goal: 'dietGoal', meal_type: 'mealType',
        day: 'day', day_of_week: 'day', role: 'role', activity_level: 'activityLevel', bmi_category: 'bmiCategory',
        unit_id: 'unit', source: 'source'
    };
    const ENTITY_GROUPS = {
        status: { patient: 'patientStatus', plan: 'planStatus', invoice: 'invoiceStatus', quote: 'quoteStatus' },
        type: { condition: 'conditionType', payment_method: 'paymentType', billing_client: 'clientType' },
        category_id: { recipe: 'mealCategory', ingredient: 'ingredientCategory' }
    };
    const groupFor = (field, entity) => VALUE_GROUPS[field] || ENTITY_GROUPS[field]?.[entity];
    const esc = (v) => UI.escapeHtml(v);
    const dateTime = (iso) => new Date(iso).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' });

    function value(v, field, entity) {
        if (v === null || v === undefined || v === '') return '<em>vacío</em>';
        const group = groupFor(field, entity);
        if (group && typeof v === 'string') return esc(UI.label(group, v));
        if (field === 'physical_activity') return esc(activityText(v));
        if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'línea' : 'líneas'}`;
        if (typeof v === 'object') return esc(JSON.stringify(v));
        if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return esc(dateTime(v));
        return esc(String(v).length > 80 ? `${String(v).slice(0, 80)}…` : v);
    }

    // "vitamin_b12_per_100g" -> "Vitamina B12 (100 g)"
    function fieldLabel(field) {
        if (FIELDS[field]) return FIELDS[field];
        if (field === 'energy') return 'energía (kcal)';
        if (/^nutrient_\d+$/.test(field)) return `nutriente ${field.slice(9)}`;
        const per100 = /^(.+)_per_100g$/.exec(field);
        if (per100) {
            const base = per100[1].replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
            return `${UI.label('nutrient', base)} (100 g)`;
        }
        return field;
    }

    function activityText(json) {
        let a;
        try { a = typeof json === 'string' ? JSON.parse(json) : json; } catch { return String(json); }
        if (!a?.active) return 'No realiza';
        return ['Sí', a.level && UI.label('activityLevel', a.level), a.frequency && `${a.frequency} días/semana`, a.types].filter(Boolean).join(', ');
    }

    // "campo: antes → después" for each changed field (creations show only the value)
    function changesHtml(entry) {
        if (!entry.changes) return '';
        const rows = Object.entries(entry.changes)
            .filter(([field]) => entry.action !== 'deactivate' || field === 'deactivated_at')
            .map(([field, [before, after]]) => {
                const label = esc(fieldLabel(field));
                return entry.action === 'create' || before === null && entry.entity === 'backup'
                    ? `<li><span>${label}:</span> ${value(after, field, entry.entity)}</li>`
                    : `<li><span>${label}:</span> ${value(before, field, entry.entity)} → ${value(after, field, entry.entity)}</li>`;
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
