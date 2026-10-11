// Database stats
const express = require('express');
const { db } = require('../db/connection');
const { serverError } = require('../lib/errors');

const router = express.Router();

router.get('/api/stats', (req, res) => {
    try {
        const stats = {
            ingredients: db.prepare('SELECT COUNT(*) as count FROM ingredients').get().count,
            recipes: db.prepare('SELECT COUNT(*) as count FROM recipes').get().count,
            patients: db.prepare('SELECT COUNT(*) as count FROM patients').get().count,
            categories: db.prepare('SELECT COUNT(*) as count FROM categories').get().count,
            // Billing stats
            billingClients: db.prepare('SELECT COUNT(*) as count FROM billing_clients').get().count,
            billingInvoices: db.prepare('SELECT COUNT(*) as count FROM billing_invoices').get().count,
            billingQuotes: db.prepare('SELECT COUNT(*) as count FROM billing_quotes').get().count
        };
        res.json({ success: true, stats });
    } catch (error) {
        serverError(res, error);
    }
});

module.exports = router;
