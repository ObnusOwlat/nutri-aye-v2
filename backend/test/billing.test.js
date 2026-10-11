const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api } = require('./helpers');

test('company, pdf config, clients, invoices, quotes, payment methods, dashboard', async () => {
    const company = await api().put('/billing-api/company').send({ name: 'Nutri Aye', currency: 'PYG', country: 'Paraguay' });
    assert.equal(company.body.data.name, 'Nutri Aye');
    assert.equal((await api().get('/billing-api/company')).body.data.currency, 'PYG');

    const pdf = await api().put('/billing-api/pdf-config').send({ fontFamily: 'Inter', padding: 30 });
    assert.equal(pdf.body.data.font_family, 'Inter');

    const client = (await api().post('/billing-api/clients').send({ name: 'Juan', email: 'juan@ejemplo.com' })).body.data;
    assert.equal((await api().get('/billing-api/clients?search=juan')).body.data.length, 1);
    assert.equal((await api().put(`/billing-api/clients/${client.id}`).send({ name: 'Juan P' })).body.data.name, 'Juan P');

    const invoice = (await api().post('/billing-api/invoices').send({
        clientId: client.id, total: 150000, items: [{ description: 'Consulta', unitPrice: 150000 }]
    })).body.data;
    assert.equal(invoice.invoice_number, 'INV-0001');
    const invDetail = await api().get(`/billing-api/invoices/${invoice.id}`);
    assert.equal(invDetail.body.data.items.length, 1);
    await api().put(`/billing-api/invoices/${invoice.id}`).send({ clientId: client.id, status: 'PAID', total: 150000 });

    const quote = (await api().post('/billing-api/quotes').send({ clientId: client.id, items: [{ description: 'Plan' }] })).body.data;
    assert.equal(quote.quote_number, 'QT-0001');
    assert.equal((await api().get(`/billing-api/quotes/${quote.id}`)).body.data.items.length, 1);

    const method = (await api().post('/billing-api/payment-methods').send({ name: 'Transferencia', isDefault: true })).body.data;
    assert.equal(method.is_default, 1);
    assert.equal((await api().get('/billing-api/payment-methods')).body.data.length, 1);

    const stats = (await api().get('/billing-api/dashboard/stats')).body.data;
    assert.equal(stats.totalRevenue, 150000);
    assert.equal(stats.paidInvoices, 1);

    assert.equal((await api().delete(`/billing-api/quotes/${quote.id}`)).status, 200);
    assert.equal((await api().delete(`/billing-api/invoices/${invoice.id}`)).status, 200);
    assert.equal((await api().delete(`/billing-api/payment-methods/${method.id}`)).status, 200);
    assert.equal((await api().delete(`/billing-api/clients/${client.id}`)).status, 200);
    assert.equal((await api().get('/billing-api/health')).body.status, 'ok');
});
