/**
 * patient-billing.js - Billing tab of the patient profile (internal, no fiscal value)
 */

const PatientBilling = (function() {
    let container = null;
    let patientId = null;

    const money = (n) => `₲ ${Math.round(n || 0).toLocaleString('es-PY')}`;
    const date = (d) => (d ? new Date(d).toLocaleDateString('es-PY') : '-');
    const badge = (status) => `<span class="badge badge-${UI.escapeHtml(String(status).toLowerCase())}">${UI.escapeHtml(status)}</span>`;

    async function render(id, element) {
        if (!id || !element) return;
        patientId = id;
        bind(element);
        element.innerHTML = '<div class="patient-billing"><div class="loading">Loading billing information...</div></div>';

        try {
            const response = await (await fetch(`/api/patients/${id}/billing`)).json();
            if (patientId !== id) return; // another patient was opened meanwhile
            if (!response.success) {
                element.innerHTML = `<div class="empty-state"><p>Error loading billing: ${UI.escapeHtml(response.error)}</p></div>`;
                return;
            }
            element.innerHTML = response.data.linked ? linkedHtml(response.data) : notLinkedHtml();
        } catch (err) {
            console.error('Error loading billing:', err);
            element.innerHTML = '<div class="empty-state"><p>Error connecting to the server</p></div>';
        }
    }

    // One delegated listener per container
    function bind(element) {
        if (container === element) return;
        container = element;
        container.addEventListener('click', (e) => {
            const button = e.target.closest('[data-action="link-billing"]');
            if (button) linkToBilling(button);
        });
    }

    function notLinkedHtml() {
        return `
            <div class="patient-billing">
                <div class="patient-billing__not-linked">
                    <div class="empty-state">
                        <h3>Not Linked to Billing</h3>
                        <p>Link this patient to create invoices and quotes and track payments.</p>
                        <button class="btn btn--primary" data-action="link-billing">Link to Billing &amp; Create Client</button>
                    </div>
                </div>
            </div>
        `;
    }

    function linkedHtml({ client, invoices, quotes }) {
        const paid = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.total, 0);
        const pending = invoices.filter(i => i.status === 'UNPAID' || i.status === 'OVERDUE').reduce((sum, i) => sum + i.total, 0);

        return `
            <div class="patient-billing">
                <div class="patient-billing__header">
                    <div class="patient-billing__client">
                        <h4>Billing Client</h4>
                        <p><strong>${UI.escapeHtml(client.name)}</strong></p>
                        <p>${UI.escapeHtml(client.email || '')}</p>
                        <p>${UI.escapeHtml(client.phone || '')}</p>
                        <span class="badge badge-paid">Linked</span>
                    </div>
                    <div class="patient-billing__stats">
                        ${stat('Paid', money(paid), 'money')}
                        ${stat('Pending', money(pending), 'warning')}
                        ${stat('Invoices', invoices.length)}
                        ${stat('Quotes', quotes.length)}
                    </div>
                </div>
                ${table('Recent Invoices', ['Invoice #', 'Date', 'Total', 'Status'],
                    invoices.map(i => [i.invoiceNumber, date(i.date), money(i.total), i.status]))}
                ${table('Quotes', ['Quote #', 'Valid Until', 'Total', 'Status'],
                    quotes.map(q => [q.quoteNumber, date(q.validUntil), money(q.total), q.status]))}
            </div>
        `;
    }

    const stat = (label, value, modifier = '') => `
        <div class="stat-card">
            <h5>${label}</h5>
            <div class="stat-value ${modifier}">${value}</div>
        </div>
    `;

    // rows: [number, date, total, status]; only the 5 most recent
    function table(title, headers, rows) {
        if (!rows.length) return '';
        return `
            <div class="patient-billing__section">
                <h4>${title}</h4>
                <table class="data-table">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>
                        ${rows.slice(0, 5).map(([number, when, total, status]) => `
                            <tr><td>${UI.escapeHtml(number)}</td><td>${when}</td><td>${total}</td><td>${badge(status)}</td></tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    async function linkToBilling(button) {
        const id = patientId;
        button.disabled = true;
        button.textContent = 'Linking...';
        try {
            const result = await (await fetch(`/api/patients/${id}/sync-to-billing`, { method: 'POST' })).json();
            if (!result.success) throw new Error(result.error || 'Failed to link');
            State.updatePatient(id, { ...State.getPatient(id), billingClientId: result.data.id });
            UI.toastSuccess(result.alreadyLinked ? 'Patient already linked to billing' : 'Patient linked to billing');
            render(id, container);
        } catch (error) {
            console.error('Link error:', error);
            UI.toastError(error.message);
            button.disabled = false;
            button.textContent = 'Link to Billing & Create Client';
        }
    }

    return { render };
})();
