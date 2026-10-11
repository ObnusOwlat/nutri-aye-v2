/**
 * browser-migration.js - One-time import of the data that the old version kept
 * in this browser (before everything was saved in the server). Records that the
 * server already has are left untouched; after the import the browser copy is
 * removed, since the browser no longer keeps data.
 */

const BrowserMigration = (function() {
    const KEYS = {
        ingredients: 'mp_ingredients_v1', recipes: 'mp_dishes_v3', weekPlans: 'mp_week_plans_v1',
        dietTemplates: 'mp_diet_templates_v1', patients: 'mp_patients_v1', patientMetrics: 'mp_patient_metrics_v1',
        patientConditions: 'mp_patient_conditions_v1', patientPlans: 'mp_patient_plans_v1', patientProgress: 'mp_patient_progress_v1'
    };
    const OLD_ONLY_KEYS = ['mp_diet_v3', 'mp_week_v3'];
    const LABELS = {
        ingredients: 'alimentos propios', recipes: 'recetas', patients: 'pacientes', patientMetrics: 'mediciones',
        patientConditions: 'condiciones', patientPlans: 'planes', patientProgress: 'seguimientos', dietTemplates: 'plantillas'
    };

    function readBrowserData() {
        const data = {};
        for (const [name, key] of Object.entries(KEYS)) {
            try { data[name] = JSON.parse(localStorage.getItem(key) || 'null'); } catch { data[name] = null; }
        }
        return data;
    }

    const clearBrowserData = () => [...Object.values(KEYS), ...OLD_ONLY_KEYS].forEach(key => localStorage.removeItem(key));

    // How many records exist only in this browser, per type
    function pendingCounts(data) {
        const counts = {};
        for (const name of Object.keys(LABELS)) {
            const list = Array.isArray(data[name]) ? data[name] : [];
            const serverIds = new Set((State._data[name] || []).map(x => x.id));
            const onlyHere = list.filter(x => x?.id && !serverIds.has(x.id) && !x.isDefault && (name !== 'ingredients' || !x.source || x.source === 'user'));
            if (onlyHere.length) counts[name] = onlyHere.length;
        }
        return counts;
    }

    async function check() {
        const data = readBrowserData();
        if (!Object.values(data).some(Boolean)) return;
        const counts = pendingCounts(data);
        if (!Object.keys(counts).length) return clearBrowserData(); // just old copies of server data
        if (!['admin', 'nutricionista'].includes(Auth.current()?.role)) return;

        const summary = Object.entries(counts).map(([name, n]) => `<li><strong>${n}</strong> ${LABELS[name]}</li>`).join('');
        UI.openModal({
            title: 'Datos guardados en este navegador',
            content: `
                <p>Este navegador tiene datos de la versión anterior que todavía no están en el servidor:</p>
                <ul>${summary}</ul>
                <p>Importalos para no perderlos. Lo que el servidor ya tiene no se modifica.</p>`,
            confirmText: 'Importar al servidor',
            cancelText: 'Más tarde',
            onConfirm: async () => {
                const res = await fetch('/api/migration/browser-data', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
                clearBrowserData();
                UI.toastSuccess('Datos importados al servidor');
                await State.load();
                return true;
            }
        });
    }

    State.subscribe('state:ready', () => setTimeout(check, 300));

    return { check };
})();
