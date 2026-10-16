/**
 * print-progress.js - "Evolución de medidas" for the patient: one row per
 * measurement (oldest first) with only the columns that have some value, the
 * change from the first to the last one, and a simple weight chart (SVG) when
 * there are two or more weights. The measurement notes never go out.
 */

const PrintProgress = (function() {
    const esc = (v) => UI.escapeHtml(v ?? '');

    // [label, unit, decimals, value(m)]; hips and cadera are the same measure (old and new field)
    const COLUMNS = [
        ['Peso', 'kg', 1, m => m.weight],
        ['IMC', '', 1, m => m.bmi],
        ['Grasa', '%', 1, m => m.bodyFat],
        ['Masa muscular', '%', 1, m => m.muscleMass],
        ['Cintura', 'cm', 1, m => m.waist],
        ['Abdomen', 'cm', 1, m => m.ciaAbdominal],
        ['Cadera', 'cm', 1, m => m.hips ?? m.cadera],
        ['Pecho', 'cm', 1, m => m.chest],
        ['Brazo', 'cm', 1, m => m.ciaBrazo],
        ['Pierna', 'cm', 1, m => m.ciaPierna]
    ];
    const has = (v) => v != null && v !== '' && !Number.isNaN(Number(v));
    // Centimeters without ",0" when whole (98 cm, 97,5 cm); the rest with their decimals
    const fmt = (v, col) => (col[1] === 'cm' && Number.isInteger(Number(v)) ? UI.formatNumber(v) : UI.formatDecimal(v, col[2]));

    const ordered = (patientId) => [...State.getPatientMetrics(patientId)].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    function change(col, metrics) {
        const values = metrics.map(col[3]).filter(has).map(Number);
        if (values.length < 2) return '';
        const diff = values[values.length - 1] - values[0];
        const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
        return `${sign}${fmt(Math.round(Math.abs(diff) * 10) / 10, col)}${col[1] ? ` ${col[1]}` : ''}`;
    }

    function table(metrics) {
        const cols = COLUMNS.filter(c => metrics.some(m => has(c[3](m))));
        const head = [{ label: 'Fecha' }, ...cols.map(c => ({ label: c[1] ? `${c[0]} (${c[1]})` : c[0], num: true }))];
        const rows = metrics.map(m => [UI.formatDate(m.date), ...cols.map(c => (has(c[3](m)) ? fmt(c[3](m), c) : '–'))]);
        if (metrics.length > 1) rows.push(['<strong>Cambio</strong>', ...cols.map(c => `<strong>${change(c, metrics)}</strong>`)]);
        return Print.table(head, rows, 'pdoc-progress__table');
    }

    // Weight over time; x by date, so uneven gaps show as such
    function chart(metrics) {
        const points = metrics.filter(m => has(m.weight)).map(m => ({ t: Date.parse(String(m.date).slice(0, 10)), w: Number(m.weight), date: m.date }));
        if (points.length < 2) return '';
        const W = 600, H = 170, pad = { l: 44, r: 16, t: 14, b: 26 };
        const t0 = points[0].t, t1 = points[points.length - 1].t || t0 + 1;
        let lo = Math.min(...points.map(p => p.w)), hi = Math.max(...points.map(p => p.w));
        if (hi - lo < 2) { lo -= 1; hi += 1; }
        const margin = (hi - lo) * 0.15; // the points do not sit on the axis lines
        lo -= margin; hi += margin;
        const x = (t) => pad.l + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
        const y = (w) => pad.t + (1 - (w - lo) / (hi - lo)) * (H - pad.t - pad.b);
        const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.w).toFixed(1)}`).join(' ');
        const ticks = [lo, (lo + hi) / 2, hi];
        const showLabels = points.length <= 12; // more than that would overlap
        return `
            <figure class="pdoc-progress__chart pdoc__block">
                <figcaption>Peso (kg)</figcaption>
                <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del peso">
                    ${ticks.map(v => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/>
                        <text x="${pad.l - 6}" y="${(y(v) + 3).toFixed(1)}" class="axis" text-anchor="end">${UI.formatDecimal(v, 1)}</text>`).join('')}
                    <path d="${path}" class="line"/>
                    ${points.map((p, i) => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.w).toFixed(1)}" r="3.5" class="dot"/>
                        ${showLabels || i === 0 || i === points.length - 1 ? `
                        <text x="${x(p.t).toFixed(1)}" y="${H - 8}" class="axis" text-anchor="middle">${esc(UI.formatDate(p.date).slice(0, 5))}</text>
                        <text x="${x(p.t).toFixed(1)}" y="${(y(p.w) - 7).toFixed(1)}" class="value" text-anchor="middle">${UI.formatDecimal(p.w, 1)}</text>` : ''}`).join('')}
                </svg>
            </figure>`;
    }

    function doc(patient) {
        return {
            id: 'progress',
            label: 'Evolución de medidas',
            options: [],
            build: () => {
                const metrics = ordered(patient.id);
                if (!metrics.length) throw new Error('El paciente todavía no tiene mediciones');
                const height = [...metrics].reverse().find(m => has(m.height))?.height;
                const subtitle = [`${UI.plural(metrics.length, 'medición', 'mediciones')}`,
                    metrics.length > 1 ? `del ${UI.formatDate(metrics[0].date)} al ${UI.formatDate(metrics[metrics.length - 1].date)}`
                        : `del ${UI.formatDate(metrics[0].date)}`,
                    height ? `talla ${UI.formatNumber(height)} cm` : ''].filter(Boolean).join(' · ');
                return {
                    title: Print.fileTitle('Evolución de medidas', patient),
                    html: Print.page({ title: 'Evolución de medidas', subtitle: esc(subtitle), patient,
                        body: `<section class="pdoc__section">${chart(metrics)}${table(metrics)}</section>`,
                        legend: `Medidas de ${Print.fullName(patient)}.` })
                };
            }
        };
    }

    return { doc };
})();
