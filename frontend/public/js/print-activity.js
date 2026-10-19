/**
 * print-activity.js - "Actividad física semanal" for the patient: one block per
 * day with its exercises (series × repeticiones, carga, descanso) or
 * activities (minutos e intensidad), only the days that have some; the rest
 * days go in one line. Calories only when the option is on.
 */

const PrintActivity = (function() {
    const esc = (v) => UI.escapeHtml(v ?? '');
    const INTENSITY = { low: 'suave', moderate: 'moderada', high: 'intensa' };

    const hasItems = (plan) => Boolean(plan) && State.DAYS.some(d => (plan[d] || []).length);

    function detail(item) {
        if (item.kind === 'exercise') {
            const parts = [`${item.sets || '?'} series × ${item.reps || '?'} repeticiones`];
            if (item.weightKg) parts.push(`${UI.formatDecimal(item.weightKg)} kg`);
            parts.push(`descanso ${item.restSec ?? 60} seg`);
            return parts.join(' · ');
        }
        return [`${UI.formatNumber(item.minutes || 0)} min`, INTENSITY[item.intensity]].filter(Boolean).join(' · ');
    }

    function dayBlock(day, items, opts, person) {
        const kcal = (item) => (opts.calories ? PlannerEnergy.itemKcal(item, person) : null);
        const total = items.reduce((sum, i) => sum + (kcal(i) || 0), 0);
        return `
            <div class="pdoc-day pdoc-day--activity pdoc__block">
                <h3>${esc(UI.label('day', day))}${total ? ` <small>${UI.formatCalories(total)}</small>` : ''}</h3>
                <dl>${items.map(item => `
                    <dt>${esc(item.name)}</dt>
                    <dd>${esc(detail(item))}${kcal(item) != null ? ` <small>${UI.formatCalories(kcal(item))}</small>` : ''}</dd>`).join('')}
                </dl>
            </div>`;
    }

    // Document for PrintDialog; plan = { monday: [items], ... }
    function doc({ plan, patient }) {
        return {
            id: 'activity',
            label: 'Actividad física semanal',
            options: ['calories'],
            build: (opts) => {
                if (!hasItems(plan)) throw new Error(patient ? 'La semana del paciente no tiene actividad guardada' : 'La semana no tiene actividad');
                const person = patient ? PlannerEnergy.person(patient.id) : null;
                // Only the days with activity; the rest go in one line (a block each would waste the page)
                const active = State.DAYS.filter(d => (plan[d] || []).length);
                const rest = State.DAYS.filter(d => !active.includes(d)).map(d => UI.label('day', d));
                const body = `<section class="pdoc__section"><div class="pdoc-week">
                    ${active.map(d => dayBlock(d, plan[d], opts, person)).join('')}</div>
                    ${rest.length ? `<p class="pdoc-week__avg">Descanso: <strong>${esc(rest.join(', '))}</strong></p>` : ''}</section>`;
                return {
                    title: Print.fileTitle('Actividad semanal', patient),
                    html: Print.page({ title: 'Actividad física semanal', patient, body,
                        legend: patient ? `Actividad para ${Print.fullName(patient)}. Ante dolor o mareo, pará y consultá.` : undefined })
                };
            }
        };
    }

    return { doc, hasItems };
})();
