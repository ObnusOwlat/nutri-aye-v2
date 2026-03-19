/**
 * metrics.js - Body Metrics Tracking
 */
const Metrics = (function() {
    let currentPatientId = null;

    function render(patientId) {
        currentPatientId = patientId;
        const content = document.querySelector('[data-tab="metrics"]');
        if (!content) return;

        const metrics = State.getPatientMetrics(patientId);
        const latest = metrics[0];

        content.innerHTML = `
            <div class="metrics-section">
                <div class="metrics-section__header">
                    <h4>Body Metrics</h4>
                    <button class="btn btn--primary btn--sm" id="btn-add-metric">+ Add Measurement</button>
                </div>

                ${latest ? `
                    <div class="metrics-current">
                        <div class="metrics-current__card">
                            <span class="metrics-current__value">${latest.weight?.toFixed(1) || '-'}</span>
                            <span class="metrics-current__unit">kg</span>
                            <span class="metrics-current__label">Weight</span>
                        </div>
                        <div class="metrics-current__card">
                            <span class="metrics-current__value">${latest.bmi?.toFixed(1) || '-'}</span>
                            <span class="metrics-current__label">BMI (${latest.bmiCategory ? UI.capitalize(latest.bmiCategory) : '-'})</span>
                        </div>
                        <div class="metrics-current__card">
                            <span class="metrics-current__value">${latest.height || '-'}</span>
                            <span class="metrics-current__unit">cm</span>
                            <span class="metrics-current__label">Height</span>
                        </div>
                        <div class="metrics-current__card">
                            <span class="metrics-current__value">${latest.bodyFat?.toFixed(1) || '-'}</span>
                            <span class="metrics-current__unit">%</span>
                            <span class="metrics-current__label">Body Fat</span>
                        </div>
                    </div>
                    ${renderChart(metrics)}
                ` : ''}

                <div class="metrics-history">
                    ${metrics.length > 0 ? `
                        <table class="metrics-table">
                            <thead>
                                <tr><th>Date</th><th>Weight</th><th>Height</th><th>BMI</th><th>Body Fat</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                ${metrics.map(m => `
                                    <tr>
                                        <td>${m.date}</td>
                                        <td>${m.weight ? m.weight.toFixed(1) + ' kg' : '-'}</td>
                                        <td>${m.height ? m.height + ' cm' : '-'}</td>
                                        <td>${m.bmi ? m.bmi.toFixed(1) : '-'}</td>
                                        <td>${m.bodyFat ? m.bodyFat.toFixed(1) + '%' : '-'}</td>
                                        <td><button class="btn btn--danger btn--sm btn-delete-metric" data-id="${m.id}">Delete</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : `<p class="text-muted text-center" style="padding: 40px;">No measurements recorded</p>`}
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
                <h5>Weight Trend (Last ${sorted.length} measurements)</h5>
                <div class="metrics-chart__bars">
                    ${sorted.map((m, i) => {
                        if (!m.weight) return `<div class="metrics-chart__bar"><div style="height:0"></div><span>${m.date.slice(5)}</span></div>`;
                        const height = ((m.weight - min) / range) * 100;
                        const diff = i > 0 && sorted[i-1].weight ? m.weight - sorted[i-1].weight : 0;
                        const diffClass = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
                        return `<div class="metrics-chart__bar">
                            <span>${m.weight.toFixed(1)} ${diff !== 0 ? `<span class="${diffClass}">${diff > 0 ? '+' : ''}${diff.toFixed(1)}</span>` : ''}</span>
                            <div style="height:${height}%"></div>
                            <span>${m.date.slice(5)}</span>
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
                <label class="form-label" for="metric-date">Date *</label>
                <input type="date" id="metric-date" class="form-input" value="${today}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="metric-weight">Weight (kg)</label>
                    <input type="number" id="metric-weight" class="form-input" value="${latest?.weight || ''}" placeholder="e.g., 75.5" min="20" max="500" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label" for="metric-height">Height (cm)</label>
                    <input type="number" id="metric-height" class="form-input" value="${latest?.height || ''}" placeholder="e.g., 175" min="50" max="300">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="metric-bodyfat">Body Fat (%)</label>
                    <input type="number" id="metric-bodyfat" class="form-input" placeholder="e.g., 18.5" min="1" max="70" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label" for="metric-muscle">Muscle Mass (%)</label>
                    <input type="number" id="metric-muscle" class="form-input" placeholder="e.g., 35" min="10" max="90" step="0.1">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="metric-notes">Notes</label>
                <textarea id="metric-notes" class="form-input" rows="2" placeholder="Any notes..."></textarea>
            </div>
        `;

        UI.openModal({ title: 'Add Measurement', content, confirmText: 'Add', onConfirm: handleAdd });
    }

    function handleAdd() {
        const data = {
            date: document.getElementById('metric-date')?.value,
            weight: parseFloat(document.getElementById('metric-weight')?.value) || null,
            height: parseFloat(document.getElementById('metric-height')?.value) || null,
            bodyFat: document.getElementById('metric-bodyfat')?.value ? parseFloat(document.getElementById('metric-bodyfat').value) : undefined,
            muscleMass: document.getElementById('metric-muscle')?.value ? parseFloat(document.getElementById('metric-muscle').value) : undefined,
            notes: document.getElementById('metric-notes')?.value?.trim()
        };
        if (!data.date) { UI.toastError('Date is required'); return false; }
        try { State.addPatientMetric(currentPatientId, data); UI.toastSuccess('Measurement added'); render(currentPatientId); return true; }
        catch (e) { UI.toastError(e.message); return false; }
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-add-metric')) showAddModal();
        if (e.target.closest('.btn-delete-metric')) {
            const id = e.target.closest('.btn-delete-metric').dataset.id;
            UI.confirmDanger('Delete this measurement?', () => { State.deletePatientMetric(id); UI.toastSuccess('Deleted'); render(currentPatientId); });
        }
    });

    return { render };
})();
