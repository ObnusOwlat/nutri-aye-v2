/**
 * patient-billing.js - Billing tab of the patient profile (internal, no fiscal value)
 */

const PatientBilling = (function() {
    let container = null;
    let patientId = null;

    const money = (n) => UI.formatMoney(n);
    const date = (d) => UI.formatDate(d);
    const badge = (status) => `<span class="badge badge-${UI.escapeHtml(String(status).toLowerCase())}">${UI.escapeHtml(UI.label('invoiceStatus', status) || UI.label('quoteStatus', status))}</span>`;

    async function render(id, element) {
        if (!id || !element) return;
        patientId = id;
        bind(element);
        element.innerHTML = '<div class="patient-billing"><div class="loading">Cargando facturación...</div></div>';

        try {
            const response = await (await fetch(`/api/patients/${id}/billing`)).json();
            if (patientId !== id) return; // another patient was opened meanwhile
            if (!response.success) {
                element.innerHTML = `<div class="empty-state"><p>Error loading billing: ${UI.escapeHtml(response.error)}</p></div>`;
                return;
            }
            element.innerHTML = response.data.linked ? linkedHtml(response.data) : notLinkedHtml();
        } catch (err) {
            console.error('Error al cargar la facturación:', err);
            element.innerHTML = '<div class="empty-state"><p>Error de conexión con el servidor</p></div>';
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
                        <h3>Sin vincular a facturación</h3>
                        <p>Vinculá a este paciente para hacerle facturas y presupuestos y seguir sus pagos.</p>
                        <button class="btn btn--primary" data-action="link-billing">Vincular y crear cliente</button>
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
                        <h4>Cliente de facturación</h4>
                        <p><strong>${UI.escapeHtml(client.name)}</strong></p>
                        <p>${UI.escapeHtml(client.email || '')}</p>
                        <p>${UI.escapeHtml(client.phone || '')}</p>
                        <span class="badge badge-paid">Vinculado</span>
                    </div>
                    <div class="patient-billing__stats">
                        ${stat('Cobrado', money(paid), 'money')}
                        ${stat('Pendiente', money(pending), 'warning')}
                        ${stat('Facturas', invoices.length)}
                        ${stat('Presupuestos', quotes.length)}
                    </div>
                </div>
                ${table('Últimas facturas', ['Factura N.º', 'Fecha', 'Total', 'Estado'],
                    invoices.map(i => [i.invoiceNumber, date(i.date), money(i.total), i.status]))}
                ${table('Presupuestos', ['Presupuesto N.º', 'Válido hasta', 'Total', 'Estado'],
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
        button.textContent = 'Vinculando...';
        try {
            const result = await (await fetch(`/api/patients/${id}/sync-to-billing`, { method: 'POST' })).json();
            if (!result.success) throw new Error(result.error || 'No se pudo vincular');
            await State.refreshPatient(id);
            UI.toastSuccess(result.alreadyLinked ? 'El paciente ya estaba vinculado a facturación' : 'Paciente vinculado a facturación');
            render(id, container);
        } catch (error) {
            console.error('Link error:', error);
            UI.toastError(error.message);
            button.disabled = false;
            button.textContent = 'Vincular y crear cliente';
        }
    }

    return { render };
})();
