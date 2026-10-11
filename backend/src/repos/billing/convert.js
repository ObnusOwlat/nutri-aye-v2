// A quote becomes a receipt: same client, items, discount and notes. The quote
// is marked ACCEPTED and the receipt remembers where it came from.
const { db } = require('../../db/connection');
const { invoices, quotes } = require('./documents');

// { invoice } | { error: 'notFound' | 'converted' }
const quoteToInvoice = db.transaction((ctx, quoteId) => {
    const quote = quotes.getById(ctx, quoteId);
    if (!quote) return { error: 'notFound' };
    if (quote.status === 'ACCEPTED' || quote.status === 'REJECTED') return { error: 'converted' };
    const origin = `Según presupuesto ${quote.quoteNumber}.`;
    const invoice = invoices.create(ctx, {
        clientId: quote.clientId, date: new Date().toISOString().slice(0, 10), discount: quote.discount || 0,
        notes: quote.notes ? `${origin}\n${quote.notes}` : origin,
        items: quote.items.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, type: i.type }))
    });
    quotes.update(ctx, quoteId, { ...quote, status: 'ACCEPTED', items: undefined });
    return { invoice };
});

module.exports = { quoteToInvoice };
