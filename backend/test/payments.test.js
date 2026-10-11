const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, sessionFor } = require('./helpers');

async function receipt(total = 200000) {
    const client = (await api().post('/billing-api/clients').send({ name: 'Cobros' })).body.data;
    const invoice = (await api().post('/billing-api/invoices').send({ clientId: client.id, items: [{ description: 'Consulta', unitPrice: total }] })).body.data;
    return { client, invoice };
}

test('partial and full payments update the balance and status', async () => {
    const { client, invoice } = await receipt();
    assert.equal(invoice.balance, 200000);
    assert.equal(invoice.paidAmount, 0);

    const method = (await api().post('/billing-api/payment-methods').send({ name: 'Efectivo', type: 'CASH' })).body.data;
    const first = await api().post(`/billing-api/invoices/${invoice.id}/payments`).send({ amount: 50000, methodId: method.id, date: '2026-10-01' });
    assert.equal(first.status, 201);
    assert.equal(first.body.data.status, 'UNPAID');
    assert.equal(first.body.data.balance, 150000);
    assert.equal(first.body.data.payments[0].methodName, 'Efectivo');

    assert.equal((await api().post(`/billing-api/invoices/${invoice.id}/payments`).send({ amount: 999999 })).status, 400);
    assert.equal((await api().post(`/billing-api/invoices/${invoice.id}/payments`).send({ amount: 0 })).status, 400);
    assert.equal((await api().post(`/billing-api/invoices/${invoice.id}/payments`).send({ amount: 1, methodId: 'nope' })).status, 400);

    const full = (await api().post(`/billing-api/invoices/${invoice.id}/payments`).send({ amount: 150000, date: '2026-10-05' })).body.data;
    assert.equal(full.status, 'PAID');
    assert.equal(full.paidAt, '2026-10-05');
    assert.equal(full.balance, 0);

    const balances = (await api().get('/billing-api/balances')).body.data;
    assert.equal(balances.find(b => b.id === client.id).balance, 0);

    // removing a payment deactivates it and the receipt is owed again
    const removed = (await api().delete(`/billing-api/payments/${full.payments[1].id}`)).body.data;
    assert.equal(removed.status, 'UNPAID');
    assert.equal(removed.balance, 150000);
    assert.equal(removed.payments.length, 1);
    assert.equal((await api().delete(`/billing-api/payments/${full.payments[1].id}`)).status, 404);
    const owing = (await api().get('/billing-api/balances?owing=1')).body.data;
    assert.equal(owing.find(b => b.id === client.id).balance, 150000);

    const history = (await api().get(`/api/activity?entity=payment`)).body.data;
    assert.ok(history.some(e => e.action === 'deactivate'));
});

test('voiding: only without payments; a voided receipt is kept, not editable and takes no payments', async () => {
    const { client, invoice } = await receipt(100000);
    const payment = (await api().post(`/billing-api/invoices/${invoice.id}/payments`).send({ amount: 10000 })).body.data.payments[0];
    assert.equal((await api().post(`/billing-api/invoices/${invoice.id}/void`)).status, 409);
    await api().delete(`/billing-api/payments/${payment.id}`);

    const voided = (await api().delete(`/billing-api/invoices/${invoice.id}`)).body.data;
    assert.equal(voided.status, 'CANCELLED');
    assert.equal(voided.balance, 0);
    assert.equal(voided.invoiceNumber, invoice.invoiceNumber);
    assert.equal((await api().get(`/billing-api/invoices/${invoice.id}`)).status, 200);
    assert.equal((await api().put(`/billing-api/invoices/${invoice.id}`).send({ clientId: client.id })).status, 409);
    assert.equal((await api().post(`/billing-api/invoices/${invoice.id}/payments`).send({ amount: 1 })).status, 409);
    assert.equal((await api().get('/billing-api/balances')).body.data.find(b => b.id === client.id), undefined);
});

test('a quote becomes a receipt once', async () => {
    const client = (await api().post('/billing-api/clients').send({ name: 'Presupuesto' })).body.data;
    const quote = (await api().post('/billing-api/quotes').send({
        clientId: client.id, discount: 5000, items: [{ description: 'Plan mensual', quantity: 2, unitPrice: 80000 }]
    })).body.data;
    const res = await api().post(`/billing-api/quotes/${quote.id}/convert`);
    assert.equal(res.status, 201);
    assert.match(res.body.data.invoiceNumber, /^REC-/);
    assert.equal(res.body.data.total, 155000);
    assert.match(res.body.data.notes, new RegExp(quote.quoteNumber));
    assert.equal((await api().get(`/billing-api/quotes/${quote.id}`)).body.data.status, 'ACCEPTED');
    assert.equal((await api().post(`/billing-api/quotes/${quote.id}/convert`)).status, 409);
});

test('patient billing includes the balance; payments are isolated per consultorio', async () => {
    const patient = (await api().post('/api/patients').send({ firstName: 'Ana', lastName: 'Saldo' })).body.data;
    const client = (await api().post(`/api/patients/${patient.id}/sync-to-billing`)).body.data;
    const invoice = (await api().post('/billing-api/invoices').send({ clientId: client.id, items: [{ description: 'Consulta', unitPrice: 120000 }] })).body.data;
    await api().post(`/billing-api/invoices/${invoice.id}/payments`).send({ amount: 20000 });
    const billing = (await api().get(`/api/patients/${patient.id}/billing`)).body.data;
    assert.equal(billing.balance, 100000);
    assert.equal(billing.invoices[0].paidAmount, 20000);

    const other = api(sessionFor('admin'));
    assert.equal((await other.post(`/billing-api/invoices/${invoice.id}/payments`).send({ amount: 1 })).status, 404);
    assert.equal((await other.post(`/billing-api/invoices/${invoice.id}/void`)).status, 404);
    assert.equal((await other.get('/billing-api/balances')).body.data.length, 0);
});
