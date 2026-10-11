/**
 * planner-targets.js - Daily targets of the planner's patient (GET
 * /api/patients/:id/targets) inside the nutrients panel: % of each target with a
 * bar (gray: low, green: in range, red: above the limit or the upper level),
 * notes from the patient's conditions, and the modal to adjust the targets.
 */

const PlannerTargets = (function() {
    let patientId = null;
    let targets = null;
    let requestSeq = 0;
    const listeners = [];

    function init() {
        State.subscribe('plannerPatient:changed', (id) => load(id));
        document.getElementById('planner-nutrients')?.addEventListener('click', (e) => {
            if (e.target.closest('[data-action=edit-targets]')) openEditor();
        });
    }

    async function load(id) {
        patientId = id || null;
        targets = null;
        const seq = ++requestSeq;
        if (patientId) {
            try {
                const data = await State._api('GET', `/api/patients/${encodeURIComponent(patientId)}/targets`);
                if (seq === requestSeq) targets = data;
            } catch (error) {
                console.warn('[Planner] Targets:', error.message);
            }
        }
        if (seq === requestSeq) listeners.forEach(fn => fn());
    }

    const onChange = (fn) => listeners.push(fn);

    // { pct, state: low | ok | over, limitText } for a daily amount, or null without target
    function status(nutrientId, amount) {
        const t = targets?.nutrients?.[nutrientId];
        if (!t || amount == null) return null;
        if (t.kind === 'limit') {
            const pct = amount / t.max;
            return { pct, state: pct > 1 ? 'over' : 'ok', text: `máx. ${UI.formatNumber(t.max)}` };
        }
        const target = Number(t.target);
        if (!target) return null;
        const pct = amount / target;
        if (t.kind === 'energy') return { pct, state: pct > 1.1 ? 'over' : pct >= 0.9 ? 'ok' : 'low', text: `de ${UI.formatNumber(target)}` };
        const over = t.ul && amount > t.ul;
        return { pct, state: over ? 'over' : pct >= 0.9 ? 'ok' : 'low', text: over ? `supera el máximo (${UI.formatNumber(t.ul)})` : `de ${UI.formatNumber(target, target < 10 ? 1 : 0)}` };
    }

    // Bar under a panel row (empty without target)
    function barHtml(nutrientId, amount) {
        const s = status(nutrientId, amount);
        if (!s) return '';
        const t = targets.nutrients[nutrientId];
        const tag = t.emphasis ? `<span class="target-tag" title="${UI.escapeHtml(t.emphasis)}">★</span>` : t.manual ? '<span class="target-tag" title="Meta ajustada a mano">✎</span>' : '';
        return `
            <div class="target-bar target-bar--${s.state}" title="${UI.escapeHtml(t.basis || '')}">
                <div class="target-bar__track"><div class="target-bar__fill" style="width:${Math.min(100, Math.round(s.pct * 100))}%"></div></div>
                <span class="target-bar__text">${UI.formatNumber(Math.round(s.pct * 100))} % ${UI.escapeHtml(s.text)} ${tag}</span>
            </div>`;
    }

    // Top of the panel: energy basis, conditions, foods to avoid
    function summaryHtml() {
        if (!patientId) return '<p class="nutrients-panel__note">Elegí un paciente para comparar con sus metas diarias.</p>';
        if (!targets) return '';
        const sources = { manual: 'ajustada a mano', plan: 'del plan activo', calculated: 'calculada (Mifflin-St Jeor)', default: 'estándar' };
        const items = [`<li>Meta de energía: <strong>${UI.formatNumber(targets.energy.kcal)} kcal</strong> (${sources[targets.energy.source]})</li>`];
        for (const rule of targets.rules) items.push(`<li>★ ${UI.escapeHtml(rule.label)}: <span title="${UI.escapeHtml(rule.source)}">metas adaptadas</span></li>`);
        if (targets.avoid.length) items.push(`<li>⚠ Evitar: ${targets.avoid.map(a => UI.escapeHtml(a.label)).join(', ')}</li>`);
        for (const note of targets.notes) items.push(`<li class="text-muted">${UI.escapeHtml(note)}</li>`);
        return `
            <div class="targets-summary">
                <ul>${items.join('')}</ul>
                <button class="btn btn--secondary btn--sm" type="button" data-action="edit-targets">Ajustar metas</button>
            </div>`;
    }

    // Manual adjustments: empty field = automatic value
    function openEditor() {
        if (!targets) return;
        const names = Object.fromEntries((PlannerNutrients.knownNutrients?.() || []).map(n => [n.id, n]));
        const rows = Object.entries(targets.nutrients).filter(([id, t]) => id !== '1008' && names[id]).map(([id, t]) => {
            const current = t.kind === 'limit' ? t.max : t.target;
            const auto = t.manual ? t.auto : current;
            return `<div class="targets-editor__row">
                <label for="target-${id}">${UI.escapeHtml(names[id].name)} <small>(${t.kind === 'limit' ? 'máximo' : 'meta'}, ${UI.escapeHtml(names[id].unit.toLowerCase())})</small></label>
                <input type="number" min="0" step="any" class="form-input" id="target-${id}" data-id="${id}"
                       value="${t.manual ? UI.escapeHtml(current) : ''}" placeholder="${UI.escapeHtml(UI.formatNumber(auto, auto < 10 ? 1 : 0))}">
            </div>`;
        }).join('');
        UI.openModal({
            title: 'Ajustar metas diarias',
            size: 'large',
            content: `
                <p class="text-muted">Dejá un campo vacío para usar el valor automático (el gris). Los cambios quedan en el historial del paciente.</p>
                <div class="targets-editor__row">
                    <label for="target-energy">Energía <small>(kcal/día)</small></label>
                    <input type="number" min="500" max="10000" class="form-input" id="target-energy"
                           value="${targets.energy.source === 'manual' ? targets.energy.kcal : ''}" placeholder="${UI.formatNumber(targets.energy.automatic)}">
                </div>
                <div class="targets-editor">${rows}</div>`,
            confirmText: 'Guardar metas',
            onConfirm: async () => {
                const value = (el) => (el.value === '' ? null : Number(el.value));
                const nutrients = {};
                document.querySelectorAll('.targets-editor [data-id]').forEach(el => { nutrients[el.dataset.id] = value(el); });
                targets = await State._api('PUT', `/api/patients/${encodeURIComponent(patientId)}/targets`,
                    { energy: value(document.getElementById('target-energy')), nutrients });
                listeners.forEach(fn => fn());
                UI.toastSuccess('Metas guardadas');
                return true;
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);

    return { onChange, barHtml, summaryHtml, status, current: () => targets };
})();
