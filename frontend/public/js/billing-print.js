/**
 * billing-print.js - Printable receipt or quote (print styles in billing.css):
 * the document is drawn in #print-area and only that is printed. Always carries
 * the "sin valor fiscal" legend.
 */

const BillingPrint = (function() {
    const esc = (v) => UI.escapeHtml(v ?? '');

    function html(kind, doc) {
        const c = doc.company || {};
        const invoice = kind === 'invoice';
        const rows = doc.items.map(i => `<tr><td>${esc(i.description)}</td><td class="num">${UI.formatNumber(i.quantity)}</td>
            <td class="num">${UI.formatMoney(i.unitPrice)}</td><td class="num">${UI.formatMoney(i.quantity * i.unitPrice)}</td></tr>`).join('');
        const payments = invoice && doc.payments.length ? `
            <h3>Pagos</h3>
            <table><tbody>${doc.payments.map(p => `<tr><td>${UI.formatDate(p.date)}</td><td>${esc(p.methodName || '')}</td>
                <td class="num">${UI.formatMoney(p.amount)}</td></tr>`).join('')}</tbody></table>
            <p class="print-doc__balance">Pagado ${UI.formatMoney(doc.paidAmount)} · Saldo ${UI.formatMoney(doc.balance)}</p>` : '';
        return `
            <article class="print-doc">
                <header class="print-doc__header">
                    <div>
                        <h1>${esc(c.name || 'Consultorio')}</h1>
                        ${c.vatId ? `<p>RUC ${esc(c.vatId)}</p>` : ''}
                        <p>${[c.address, c.city].filter(Boolean).map(esc).join(', ')}</p>
                        <p>${[c.phone, c.email].filter(Boolean).map(esc).join(' · ')}</p>
                    </div>
                    <div class="print-doc__title">
                        <h2>${invoice ? 'Recibo' : 'Presupuesto'}</h2>
                        <p><strong>N.º ${esc(doc.invoiceNumber || doc.quoteNumber)}</strong></p>
                        <p>Fecha: ${UI.formatDate(doc.date || doc.createdAt)}</p>
                        ${!invoice && doc.validUntil ? `<p>Válido hasta: ${UI.formatDate(doc.validUntil)}</p>` : ''}
                        ${doc.status === 'CANCELLED' ? '<p class="print-doc__void">ANULADO</p>' : ''}
                    </div>
                </header>
                <section class="print-doc__client">
                    <span>Cliente:</span> <strong>${esc(doc.clientName || '-')}</strong>
                    ${doc.clientVatId ? ` · RUC/C.I. ${esc(doc.clientVatId)}` : ''}
                </section>
                <table class="print-doc__items">
                    <thead><tr><th>Descripción</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Importe</th></tr></thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        ${doc.discount ? `<tr><td colspan="3" class="num">Descuento</td><td class="num">− ${UI.formatMoney(doc.discount)}</td></tr>` : ''}
                        <tr><td colspan="3" class="num"><strong>Total</strong></td><td class="num"><strong>${UI.formatMoney(doc.total)}</strong></td></tr>
                    </tfoot>
                </table>
                ${payments}
                ${doc.notes ? `<p class="print-doc__notes">${esc(doc.notes)}</p>` : ''}
                <footer class="print-doc__legend">Documento interno sin valor fiscal. No reemplaza a la factura legal.</footer>
            </article>`;
    }

    function print(kind, doc) {
        const area = document.getElementById('print-area');
        area.innerHTML = html(kind, doc);
        document.body.classList.add('printing-document');
        const done = () => {
            document.body.classList.remove('printing-document');
            area.innerHTML = '';
            window.removeEventListener('afterprint', done);
        };
        window.addEventListener('afterprint', done);
        window.print();
    }

    return { print, html };
})();
