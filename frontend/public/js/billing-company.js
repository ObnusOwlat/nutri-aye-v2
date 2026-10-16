/**
 * billing-company.js - Consultorio data printed on receipts and patient documents
 * (name, RUC, contact; logo and color in print-branding.js) and the payment
 * methods offered when registering a payment.
 * Removing a method deactivates it; old payments keep showing its name.
 */

const BillingCompany = (function() {
    const api = (method, path, body) => State._api(method, path, body);
    const esc = (v) => UI.escapeHtml(v ?? '');
    const FIELDS = [
        ['name', 'Nombre del consultorio', 200], ['vatId', 'RUC', 50], ['phone', 'Teléfono', 50],
        ['email', 'Email', 200], ['address', 'Dirección', 300], ['city', 'Ciudad', 100]
    ];

    async function open() {
        let company, methods, pdf;
        try {
            [company, methods, pdf] = await Promise.all([api('GET', '/billing-api/company'), api('GET', '/billing-api/payment-methods'),
                api('GET', '/billing-api/pdf-config')]);
        } catch (error) {
            UI.toastError(error.message);
            return;
        }
        company = company || { name: Auth.current()?.organization?.name || '', city: 'Asunción' };
        UI.openModal({
            title: 'Datos del consultorio',
            size: 'large',
            content: `
                <form class="billing-company" autocomplete="off">
                    <p class="text-muted">Salen en el encabezado de los recibos, presupuestos y documentos para el paciente.</p>
                    <div class="billing-editor__grid">
                        ${FIELDS.map(([key, label, max]) => `
                            <label class="form-group"><span class="form-label">${label}</span>
                                <input class="form-input" name="${key}" maxlength="${max}" value="${esc(company[key])}" ${key === 'name' ? 'required' : ''}></label>`).join('')}
                    </div>
                </form>
                ${PrintBranding.formHtml(pdf)}
                <section class="billing-methods">
                    <h4>Medios de pago</h4>
                    <ul class="billing-methods__list">${methodsHtml(methods)}</ul>
                    <form class="billing-methods__add" data-form="method">
                        <input class="form-input" name="name" placeholder="Ej.: Transferencia Banco Itaú" maxlength="100" required>
                        <select class="form-select" name="type">
                            ${['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER'].map(t => `<option value="${t}">${esc(UI.label('paymentType', t))}</option>`).join('')}
                        </select>
                        <button class="btn btn--secondary btn--sm" type="submit">Agregar</button>
                    </form>
                </section>`,
            confirmText: 'Guardar datos',
            onConfirm: () => save(pdf)
        });
        bind();
        PrintBranding.bindForm(document.querySelector('.print-brand'));
    }

    function methodsHtml(methods) {
        if (!methods.length) return '<li class="text-muted">Todavía no hay medios de pago.</li>';
        return methods.map(m => `
            <li><strong>${esc(m.name)}</strong> <span class="text-muted">${esc(UI.label('paymentType', m.type))}</span>
                ${m.isDefault ? '<span class="badge badge-paid">Predeterminado</span>'
                    : `<button class="btn btn--secondary btn--sm" type="button" data-default="${esc(m.id)}">Usar por defecto</button>`}
                <button class="btn btn--secondary btn--sm" type="button" data-remove="${esc(m.id)}">Quitar</button></li>`).join('');
    }

    async function reloadMethods() {
        const list = document.querySelector('.billing-methods__list');
        if (list) list.innerHTML = methodsHtml(await api('GET', '/billing-api/payment-methods'));
    }

    function bind() {
        const section = document.querySelector('.billing-methods');
        section.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            try {
                await api('POST', '/billing-api/payment-methods', { name: data.name, type: data.type });
                e.target.reset();
                await reloadMethods();
            } catch (error) { UI.toastError(error.message); }
        });
        section.addEventListener('click', async (e) => {
            const id = e.target.dataset.default || e.target.dataset.remove;
            if (!id) return;
            try {
                if (e.target.dataset.remove) {
                    await api('DELETE', `/billing-api/payment-methods/${encodeURIComponent(id)}`);
                } else {
                    const method = (await api('GET', '/billing-api/payment-methods')).find(m => m.id === id);
                    await api('PUT', `/billing-api/payment-methods/${encodeURIComponent(id)}`,
                        { name: method.name, type: method.type, instructions: method.instructions || '', isDefault: true });
                }
                await reloadMethods();
            } catch (error) { UI.toastError(error.message); }
        });
    }

    async function save(pdf) {
        const form = document.querySelector('.billing-company');
        const data = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, v.trim() || null]));
        if (!data.name) throw new Error('El nombre del consultorio es obligatorio');
        await api('PUT', '/billing-api/company', { ...data, country: 'Paraguay', currency: 'PYG' });
        await PrintBranding.saveForm(document.querySelector('.print-brand'), pdf);
        UI.toastSuccess('Datos del consultorio guardados');
        return true;
    }

    return { open };
})();
