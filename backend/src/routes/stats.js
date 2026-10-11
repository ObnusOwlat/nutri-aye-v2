// Health check and database stats
const express = require('express');
const { db } = require('../db/connection');

const router = express.Router();

const health = (req, res) => res.json({ success: true, status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
router.get('/api/health', health);
router.get('/billing-api/health', health);

const TABLES = {
    ingredients: 'ingredients', recipes: 'recipes', patients: 'patients', categories: 'categories',
    billingClients: 'billing_clients', billingInvoices: 'billing_invoices', billingQuotes: 'billing_quotes'
};

router.get('/api/stats', (req, res) => {
    const data = Object.fromEntries(Object.entries(TABLES).map(([key, table]) => [key, db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n]));
    res.json({ success: true, data });
});

module.exports = router;
