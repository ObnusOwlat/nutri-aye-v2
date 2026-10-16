/**
 * print-dialog.js - The "Imprimir" window: choose a document and its options,
 * then print it. Each document is { id, label, options: [keys], build(opts) },
 * where build returns { title, html } or throws with the reason (e.g. an
 * empty week). The chosen options are remembered per browser.
 */

const PrintDialog = (function() {
    const esc = (v) => UI.escapeHtml(v ?? '');
    const KEY = 'nutri-aye.printOptions';
    const OPTIONS = {
        calories: { label: 'Mostrar calorías', hint: 'kcal y macronutrientes' },
        recipes: { label: 'Incluir recetario', hint: 'cada receta de la semana, con alimentos y preparación' },
        notes: { label: 'Incluir notas de las recetas', hint: 'revisalas antes: pueden tener referencias internas' }
    };
    const defaults = { calories: false, recipes: true, notes: false };

    function readOptions() {
        try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...defaults }; }
    }
    function writeOptions(opts) {
        try { localStorage.setItem(KEY, JSON.stringify(opts)); } catch { /* private window: not remembered */ }
    }

    async function open({ title = 'Imprimir', docs }) {
        await PrintBranding.load();
        const opts = readOptions();
        const optionKeys = [...new Set(docs.flatMap(d => d.options || []))];
        UI.openModal({
            title,
            content: `
                <form class="print-dialog">
                    <fieldset class="print-dialog__docs" ${docs.length === 1 ? 'hidden' : ''}>
                        <legend class="form-label">Documento</legend>
                        ${docs.map((d, i) => `<label><input type="radio" name="doc" value="${esc(d.id)}" ${i === 0 ? 'checked' : ''}> ${esc(d.label)}</label>`).join('')}
                    </fieldset>
                    ${optionKeys.length ? `<fieldset class="print-dialog__opts"><legend class="form-label">Opciones</legend>
                        ${optionKeys.map(k => `<label data-opt="${k}"><input type="checkbox" name="${k}" ${opts[k] ? 'checked' : ''}>
                            ${esc(OPTIONS[k].label)} <small class="text-muted">${esc(OPTIONS[k].hint || '')}</small></label>`).join('')}
                    </fieldset>` : ''}
                    <p class="text-muted print-dialog__hint">En la ventana de impresión elegí «Guardar como PDF» para mandarlo por correo o WhatsApp.</p>
                </form>`,
            confirmText: 'Imprimir',
            onOpen: () => syncOptions(docs),
            onConfirm: () => confirm(docs, optionKeys)
        });
        document.querySelector('.print-dialog')?.addEventListener('change', () => syncOptions(docs));
        syncOptions(docs);
    }

    const chosen = (docs) => docs.find(d => d.id === document.querySelector('.print-dialog [name=doc]:checked')?.value) || docs[0];

    // Only the options of the chosen document are shown; the notes go with the recetario
    function syncOptions(docs) {
        const doc = chosen(docs);
        const form = document.querySelector('.print-dialog');
        const noRecetario = (doc.options || []).includes('recipes') && !form?.elements.recipes?.checked;
        document.querySelectorAll('.print-dialog [data-opt]').forEach(el => {
            el.hidden = !(doc.options || []).includes(el.dataset.opt) || (el.dataset.opt === 'notes' && noRecetario);
        });
    }

    function confirm(docs, optionKeys) {
        const form = document.querySelector('.print-dialog');
        const opts = { ...readOptions() };
        for (const k of optionKeys) opts[k] = form.elements[k].checked;
        writeOptions(opts);
        const result = chosen(docs).build(opts); // throws: the message shows and the window stays open
        setTimeout(() => Print.run(result), 0);   // after the window closes
        return true;
    }

    // Documents of one patient (patient profile)
    function openForPatient(patientId) {
        const patient = State.getPatient(patientId);
        if (!patient) return;
        let week = null;
        State.loadPatientWeek(patientId)
            .then(w => { week = w; })
            .catch(error => { UI.toastError('No se pudo cargar la semana del paciente: ' + error.message); })
            .finally(() => open({
                title: `Imprimir · ${Print.fullName(patient)}`,
                docs: [PrintPlan.doc({ week, patient })]
            }));
    }

    return { open, openForPatient };
})();
