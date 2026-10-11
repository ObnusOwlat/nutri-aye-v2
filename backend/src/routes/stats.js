// Health check and database stats
const express = require('express');
const { db } = require('../db/connection');

const router = express.Router();

const health = (req, res) => res.json({ success: true, status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
router.get('/api/health', health);
router.get('/billing-api/health', health);

// Active records of the consultorio; ingredients include the shared catalog
const COUNTS = {
    ingredients: 'SELECT COUNT(*) AS n FROM ingredients WHERE (org_id IS NULL OR org_id = @orgId) AND deactivated_at IS NULL',
    recipes: 'SELECT COUNT(*) AS n FROM recipes WHERE org_id = @orgId AND deactivated_at IS NULL',
    patients: 'SELECT COUNT(*) AS n FROM patients WHERE org_id = @orgId AND deactivated_at IS NULL',
    billingClients: 'SELECT COUNT(*) AS n FROM billing_clients WHERE org_id = @orgId AND deactivated_at IS NULL',
    billingInvoices: 'SELECT COUNT(*) AS n FROM billing_invoices WHERE org_id = @orgId AND deactivated_at IS NULL',
    billingQuotes: 'SELECT COUNT(*) AS n FROM billing_quotes WHERE org_id = @orgId AND deactivated_at IS NULL'
};

router.get('/api/stats', (req, res) => {
    const data = Object.fromEntries(Object.entries(COUNTS).map(([key, sql]) => [key, db.prepare(sql).get({ orgId: req.ctx.orgId }).n]));
    res.json({ success: true, data });
});

module.exports = router;
