/**
 * metrics.js - Body Metrics Tracking
 */
const Metrics = (function() {
    let currentPatientId = null;

    function render(patientId) {
        currentPatientId = patientId;
        const content = document.querySelector('.patient-tab-content[data-tab="metrics"]');
        if (!content) return;

        const metrics = State.getPatientMetrics(patientId);
        const latest = metrics[0];

        content.innerHTML = `
            <div class="metrics-section">
                <div class="metrics-section__header">
                    <h4>Medidas corporales</h4>
                    <button class="btn btn--primary btn--sm" id="btn-add-metric">+ Agregar medición</button>
                </div>

                ${latest ? `
                    <div class="metrics-current">
                        <div class="metrics-current__card">
                            <span class="metrics-current__value">${UI.formatDecimal(latest.weight, 1) || '-'}</span>
                            <span class="metrics-current__unit">kg</span>
                            <span class="metrics-current__label">Peso</span>
                        </div>
                        <div class="metrics-current__card">
                            <span class="metrics-current__value">${UI.formatDecimal(latest.bmi, 1) || '-'}</span>
                            <span class="metrics-current__label">IMC (${latest.bmiCategory ? UI.label('bmiCategory', latest.bmiCategory) : '-'})</span>
                        </div>
                        <div class="metrics-current__card">
                            <span class="metrics-current__value">${latest.height || '-'}</span>
                            <span class="metrics-current__unit">cm</span>
                            <span class="metrics-current__label">Talla</span>
                        </div>
                        <div class="metrics-current__card">
                            <span class="metrics-current__value">${UI.formatDecimal(latest.bodyFat, 1) || '-'}</span>
                            <span class="metrics-current__unit">%</span>
                            <span class="metrics-current__label">Grasa corporal</span>
                        </div>
                    </div>
                    ${renderChart(metrics)}
                ` : ''}

                <div class="metrics-history">
                    ${metrics.length > 0 ? `
                        <table class="metrics-table">
                            <thead>
                                <tr><th>Fecha</th><th>Peso</th><th>Talla</th><th>IMC</th><th>Grasa corporal</th><th>Acciones</th></tr>
                            </thead>
                            <tbody>
                                ${metrics.map(m => `
                                    <tr>
                                        <td>${UI.formatDate(m.date)}</td>
                                        <td>${m.weight ? UI.formatDecimal(m.weight, 1) + ' kg' : '-'}</td>
                                        <td>${m.height ? m.height + ' cm' : '-'}</td>
                                        <td>${m.bmi ? UI.formatDecimal(m.bmi, 1) : '-'}</td>
                                        <td>${m.bodyFat ? UI.formatDecimal(m.bodyFat, 1) + '%' : '-'}</td>
                                        <td><button class="btn btn--danger btn--sm btn-delete-metric" data-id="${m.id}">Desactivar</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : `<p class="text-muted text-center" style="padding: 40px;">Sin mediciones registradas</p>`}
                </div>
            </div>
        `;
    }

    function renderChart(metrics) {
        if (metrics.length < 2) return '';
        const sorted = [...metrics].reverse().slice(-7);
        const weights = sorted.map(m => m.weight).filter(w => w);
        if (weights.length < 2) return '';

        const min = Math.min(...weights) - 2;
        const max = Math.max(...weights) + 2;
        const range = max - min;

        return `
            <div class="metrics-chart">
                <h5>Evolución del peso (últimas ${sorted.length} mediciones)</h5>
                <div class="metrics-chart__bars">
                    ${sorted.map((m, i) => {
                        if (!m.weight) return `<div class="metrics-chart__bar"><div style="height:0"></div><span>${UI.formatDate(m.date).slice(0, 5)}</span></div>`;
                        const height = ((m.weight - min) / range) * 100;
                        const diff = i > 0 && sorted[i-1].weight ? m.weight - sorted[i-1].weight : 0;
                        const diffClass = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
                        return `<div class="metrics-chart__bar">
                            <span>${UI.formatDecimal(m.weight, 1)} ${diff !== 0 ? `<span class="${diffClass}">${diff > 0 ? '+' : ''}${UI.formatDecimal(diff, 1)}</span>` : ''}</span>
                            <div style="height:${height}%"></div>
                            <span>${UI.formatDate(m.date).slice(0, 5)}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    function showAddModal() {
        if (!currentPatientId) return;
        const today = new Date().toISOString().split('T')[0];
        const latest = State.getLatestMetrics(currentPatientId);

        const content = `
            <div class="form-group">
                <label class="form-label" for="metric-date">Fecha *</label>
                <input type="date" id="metric-date" class="form-input" value="${today}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="metric-weight">Peso (kg)</label>
                    <input type="number" id="metric-weight" class="form-input" value="${UI.escapeHtml(latest?.weight || '')}" placeholder="e.g., 75.5" min="20" max="500" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label" for="metric-height">Talla (cm)</label>
                    <input type="number" id="metric-height" class="form-input" value="${UI.escapeHtml(latest?.height || '')}" placeholder="e.g., 175" min="50" max="300">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="metric-bodyfat">Grasa corporal (%)</label>
                    <input type="number" id="metric-bodyfat" class="form-input" placeholder="e.g., 18.5" min="1" max="70" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label" for="metric-muscle">Muscle Mass (%)</label>
                    <input type="number" id="metric-muscle" class="form-input" placeholder="e.g., 35" min="10" max="90" step="0.1">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="metric-notes">Notas</label>
                <textarea id="metric-notes" class="form-input" rows="2" placeholder="Notas..."></textarea>
            </div>
        `;

        UI.openModal({ title: 'Agregar medición', content, confirmText: 'Agregar', onConfirm: handleAdd });
    }

    async function handleAdd() {
        const data = {
            date: document.getElementById('metric-date')?.value,
            weight: parseFloat(document.getElementById('metric-weight')?.value) || null,
            height: parseFloat(document.getElementById('metric-height')?.value) || null,
            bodyFat: document.getElementById('metric-bodyfat')?.value ? parseFloat(document.getElementById('metric-bodyfat').value) : undefined,
            muscleMass: document.getElementById('metric-muscle')?.value ? parseFloat(document.getElementById('metric-muscle').value) : undefined,
            notes: document.getElementById('metric-notes')?.value?.trim()
        };
        if (!data.date) { UI.toastError('La fecha es obligatoria'); return false; }
        try { await State.addPatientMetric(currentPatientId, data); UI.toastSuccess('Medición agregada'); render(currentPatientId); return true; }
        catch (e) { UI.toastError(e.message); return false; }
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-add-metric')) showAddModal();
        if (e.target.closest('.btn-delete-metric')) {
            const id = e.target.closest('.btn-delete-metric').dataset.id;
            UI.confirmDanger('¿Desactivar esta medición?', async () => { await State.deletePatientMetric(id); UI.toastSuccess('Medición desactivada'); render(currentPatientId); });
        }
    });

    return { render };
})();
