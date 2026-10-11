const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api } = require('./helpers');

test('company, pdf config, clients, invoices, quotes, payment methods, dashboard', async () => {
    const company = await api().put('/billing-api/company').send({ name: 'Nutri Aye', currency: 'PYG', country: 'Paraguay' });
    assert.equal(company.body.data.name, 'Nutri Aye');
    assert.equal((await api().get('/billing-api/company')).body.data.currency, 'PYG');

    const pdf = await api().put('/billing-api/pdf-config').send({ fontFamily: 'Inter', padding: 30 });
    assert.equal(pdf.body.data.fontFamily, 'Inter');

    const client = (await api().post('/billing-api/clients').send({ name: 'Juan', email: 'juan@ejemplo.com' })).body.data;
    assert.equal((await api().get('/billing-api/clients?search=juan')).body.data.length, 1);
    assert.equal((await api().put(`/billing-api/clients/${client.id}`).send({ name: 'Juan P' })).body.data.name, 'Juan P');

    // total sent by the client is ignored: computed from the items
    const invoice = (await api().post('/billing-api/invoices').send({
        clientId: client.id, total: 1, items: [{ description: 'Consulta', unitPrice: 150000 }]
    })).body.data;
    assert.equal(invoice.invoiceNumber, 'INV-0001');
    assert.equal(invoice.total, 150000);
    const invDetail = await api().get(`/billing-api/invoices/${invoice.id}`);
    assert.equal(invDetail.body.data.items.length, 1);
    const paid = await api().put(`/billing-api/invoices/${invoice.id}`).send({ clientId: client.id, status: 'PAID', discount: 10000 });
    assert.equal(paid.body.data.total, 140000);
    assert.equal(paid.body.data.items.length, 1);

    const quote = (await api().post('/billing-api/quotes').send({ clientId: client.id, items: [{ description: 'Plan' }] })).body.data;
    assert.equal(quote.quoteNumber, 'QT-0001');
    assert.equal((await api().get(`/billing-api/quotes/${quote.id}`)).body.data.items.length, 1);

    const method = (await api().post('/billing-api/payment-methods').send({ name: 'Transferencia', isDefault: true })).body.data;
    assert.equal(method.isDefault, 1);
    assert.equal((await api().get('/billing-api/payment-methods')).body.data.length, 1);

    const stats = (await api().get('/billing-api/dashboard/stats')).body.data;
    assert.equal(stats.totalRevenue, 140000);
    assert.equal(stats.paidInvoices, 1);

    // A client with documents cannot be deleted
    assert.equal((await api().delete(`/billing-api/clients/${client.id}`)).status, 409);
    assert.equal((await api().delete(`/billing-api/quotes/${quote.id}`)).status, 200);
    assert.equal((await api().delete(`/billing-api/invoices/${invoice.id}`)).status, 200);
    assert.equal((await api().delete(`/billing-api/payment-methods/${method.id}`)).status, 200);
    assert.equal((await api().delete(`/billing-api/clients/${client.id}`)).status, 200);
    assert.equal((await api().delete(`/billing-api/clients/${client.id}`)).status, 404);
    assert.equal((await api().get('/billing-api/health')).body.status, 'ok');
});

test('numbering continues from the highest number; unknown client is rejected', async () => {
    await api().put('/billing-api/company').send({ name: 'Nutri Aye' });
    const client = (await api().post('/billing-api/clients').send({ name: 'Numeración' })).body.data;
    assert.equal(client.country, 'Paraguay');
    const a = (await api().post('/billing-api/invoices').send({ clientId: client.id })).body.data;
    const b = (await api().post('/billing-api/invoices').send({ clientId: client.id })).body.data;
    assert.equal(Number(b.invoiceNumber.slice(4)), Number(a.invoiceNumber.slice(4)) + 1);
    assert.equal((await api().post('/billing-api/invoices').send({ clientId: 'nope' })).status, 400);
    assert.equal((await api().post('/billing-api/invoices').send({ clientId: client.id, status: 'MAYBE' })).status, 400);
});

test('only one default payment method', async () => {
    const a = (await api().post('/billing-api/payment-methods').send({ name: 'Efectivo', type: 'CASH', isDefault: true })).body.data;
    await api().post('/billing-api/payment-methods').send({ name: 'Tarjeta', type: 'CARD', isDefault: true });
    const methods = (await api().get('/billing-api/payment-methods')).body.data;
    assert.equal(methods.filter(m => m.isDefault).length, 1);
    assert.equal(methods.find(m => m.id === a.id).isDefault, 0);
});
