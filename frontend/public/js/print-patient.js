/**
 * print-patient.js - "Resumen del paciente": age, the last measurement, the
 * goal of the active plan (kcal only with "Mostrar calorías") and the
 * allergies. Nothing else of the profile goes out: no notes, medication,
 * conditions, plan name or billing.
 */

const PrintPatient = (function() {
    const esc = (v) => UI.escapeHtml(v ?? '');
    const has = (v) => v != null && v !== '' && !Number.isNaN(Number(v));
    const cm = (v) => `${Number.isInteger(Number(v)) ? UI.formatNumber(v) : UI.formatDecimal(v, 1)} cm`;

    // [label, value(m), formatted(v)]
    const MEASURES = [
        ['Peso', m => m.weight, v => `${UI.formatDecimal(v, 1)} kg`],
        ['Talla', m => m.height, cm],
        ['IMC', m => m.bmi, v => UI.formatDecimal(v, 1)],
        ['Grasa corporal', m => m.bodyFat, v => `${UI.formatDecimal(v, 1)} %`],
        ['Masa muscular', m => m.muscleMass, v => `${UI.formatDecimal(v, 1)} %`],
        ['Cintura', m => m.waist, cm],
        ['Cadera', m => m.hips ?? m.cadera, cm]
    ];

    const list = (pairs) => `<dl class="pdoc-summary">${pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;

    function body(patient, opts) {
        const age = State.calculateAge(patient.dateOfBirth);
        const latest = State.getLatestMetrics(patient.id);
        // Height may be in an older measurement
        const height = State.getPatientMetrics(patient.id).find(m => has(m.height))?.height;
        const measure = latest ? { ...latest, height: latest.height ?? height } : null;
        const plan = State.getActivePlan(patient.id);
        const allergies = State.getAllergies(patient.id).map(c => c.name).filter(Boolean);

        const sections = age != null ? [Print.section('Datos', list([['Edad', `${age} años`]]))] : [];
        if (measure) {
            const rows = MEASURES.filter(([, get]) => has(get(measure))).map(([label, get, fmt]) => [label, esc(fmt(get(measure)))]);
            if (rows.length) sections.push(Print.section(`Última medición · ${UI.formatDate(measure.date)}`, list(rows)));
        }
        if (plan) {
            const rows = [['Objetivo', esc(UI.label('dietGoal', plan.dietGoal))]];
            if (opts.calories && plan.dailyTarget) rows.push(['Energía diaria', esc(UI.formatCalories(plan.dailyTarget))]);
            if (plan.startDate) rows.push(['Desde', esc(UI.formatDate(plan.startDate))]);
            sections.push(Print.section('Plan actual', list(rows)));
        }
        sections.push(Print.section('Alergias e intolerancias', allergies.length ? `<p>Evitar: ${esc(allergies.join(', '))}</p>` : '<p class="pdoc__muted">Ninguna registrada</p>'));
        return sections.join('');
    }

    function doc(patient) {
        return {
            id: 'summary',
            label: 'Resumen del paciente',
            options: ['calories'],
            build: (opts) => ({
                title: Print.fileTitle('Resumen', patient),
                html: Print.page({ title: 'Resumen del paciente', patient, body: body(patient, opts) })
            })
        };
    }

    return { doc };
})();
