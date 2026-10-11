/**
 * progress.js - Progress Tracking
 */
const Progress = (function() {
    let currentPatientId = null;

    function render(patientId) {
        currentPatientId = patientId;
        const content = document.querySelector('[data-tab="progress"]');
        if (!content) return;

        const progress = State.getPatientProgress(patientId);
        const metrics = State.getPatientMetrics(patientId);

        content.innerHTML = `
            <div class="progress-section">
                <div class="progress-section__header">
                    <h4>Progress Tracking</h4>
                    <button class="btn btn--primary btn--sm" id="btn-add-progress">+ Add Check-in</button>
                </div>

                ${renderSummary(progress, metrics)}

                ${progress.length > 0 ? `<div class="progress-timeline">${progress.map(renderCard).join('')}</div>` : 
                    `<div class="empty-state"><div class="empty-state__icon"></div><p class="empty-state__text">No check-ins recorded</p></div>`}
            </div>
        `;
    }

    function renderSummary(progress, metrics) {
        if (progress.length === 0 && metrics.length === 0) return '';
        const avgAdherence = progress.length > 0 ? progress.reduce((s, p) => s + (p.adherence || 0), 0) / progress.length : 0;
        const avgEnergy = progress.length > 0 ? (progress.reduce((s, p) => s + (p.energyLevel || 0), 0) / progress.length).toFixed(1) : '-';
        const latest = metrics[0], first = metrics[metrics.length - 1];
        const weightChange = (latest?.weight && first?.weight) ? (latest.weight - first.weight).toFixed(1) : null;

        return `<div class="progress-summary">
            <div class="progress-summary__card"><span class="progress-summary__value">${avgAdherence.toFixed(0)}%</span><span class="progress-summary__label">Avg Adherence</span></div>
            <div class="progress-summary__card"><span class="progress-summary__value">${avgEnergy}</span><span class="progress-summary__label">Avg Energy</span></div>
            ${weightChange !== null ? `<div class="progress-summary__card ${weightChange < 0 ? 'negative' : weightChange > 0 ? 'positive' : ''}"><span class="progress-summary__value">${weightChange > 0 ? '+' : ''}${weightChange} kg</span><span class="progress-summary__label">Weight Change</span></div>` : ''}
            <div class="progress-summary__card"><span class="progress-summary__value">${progress.length}</span><span class="progress-summary__label">Check-ins</span></div>
        </div>`;
    }

    function renderCard(p) {
        return `<div class="progress-card" data-id="${p.id}">
            <div class="progress-card__date"><span>${new Date(p.date).toLocaleDateString('en-US', { weekday: 'short' })}</span><span>${p.date}</span></div>
            <div class="progress-card__content">
                ${p.weight ? `<span><strong>${p.weight.toFixed(1)}</strong> kg</span>` : ''}
                <span><strong>${p.adherence || 0}%</strong> adherence</span>
                <span>Energy: <strong>${p.energyLevel || '-'}/10</strong></span>
                ${p.symptoms?.length > 0 ? `<div><strong>Symptoms:</strong> ${p.symptoms.join(', ')}</div>` : ''}
                ${p.notes ? `<p>${UI.escapeHtml(p.notes)}</p>` : ''}
            </div>
            <div class="progress-card__actions"><button class="btn btn--danger btn--sm btn-delete-progress" data-id="${p.id}">Delete</button></div>
        </div>`;
    }

    function showAddModal() {
        if (!currentPatientId) return;
        const today = new Date().toISOString().split('T')[0];
        const latest = State.getLatestMetrics(currentPatientId);

        const content = document.createElement('div');
        content.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="progress-date">Date *</label>
                    <input type="date" id="progress-date" class="form-input" value="${today}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="progress-weight">Weight (kg)</label>
                    <input type="number" id="progress-weight" class="form-input" value="${latest?.weight || ''}" min="20" max="500" step="0.1">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Meal Adherence: <span id="adherence-value">50</span>%</label>
                <input type="range" id="progress-adherence" class="form-range" min="0" max="100" value="50" step="5"
                    oninput="document.getElementById('adherence-value').textContent = this.value">
                <div class="form-range-labels"><span>0%</span><span>100%</span></div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Energy: <span id="energy-value">5</span>/10</label>
                    <input type="range" id="progress-energy" class="form-range" min="1" max="10" value="5"
                        oninput="document.getElementById('energy-value').textContent = this.value">
                    <div class="form-range-labels"><span>Low</span><span>High</span></div>
                </div>
                <div class="form-group">
                    <label class="form-label">Sleep: <span id="sleep-value">5</span>/10</label>
                    <input type="range" id="progress-sleep" class="form-range" min="1" max="10" value="5"
                        oninput="document.getElementById('sleep-value').textContent = this.value">
                    <div class="form-range-labels"><span>Poor</span><span>Great</span></div>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="progress-notes">Notes</label>
                <textarea id="progress-notes" class="form-input" rows="3" placeholder="Observations..."></textarea>
            </div>
        `;

        UI.openModal({ title: 'Add Check-in', content, confirmText: 'Add', onConfirm: handleAdd, size: 'medium' });
    }

    function handleAdd() {
        const data = {
            date: document.getElementById('progress-date')?.value,
            weight: document.getElementById('progress-weight')?.value ? parseFloat(document.getElementById('progress-weight').value) : null,
            adherence: parseInt(document.getElementById('progress-adherence')?.value) || 50,
            energyLevel: parseInt(document.getElementById('progress-energy')?.value) || 5,
            sleepQuality: parseInt(document.getElementById('progress-sleep')?.value) || 5,
            notes: document.getElementById('progress-notes')?.value?.trim()
        };
        if (!data.date) { UI.toastError('Date is required'); return false; }
        try {
            if (data.weight) {
                const latest = State.getLatestMetrics(currentPatientId);
                State.addPatientMetric(currentPatientId, { date: data.date, weight: data.weight, height: latest?.height });
            }
            State.addPatientProgress(currentPatientId, data);
            UI.toastSuccess('Check-in added'); render(currentPatientId); return true;
        } catch (e) { UI.toastError(e.message); return false; }
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-add-progress')) showAddModal();
        if (e.target.closest('.btn-delete-progress')) {
            UI.confirmDanger('Delete this check-in?', () => { State.deletePatientProgress(e.target.closest('.btn-delete-progress').dataset.id); UI.toastSuccess('Deleted'); render(currentPatientId); });
        }
    });

    return { render };
})();
