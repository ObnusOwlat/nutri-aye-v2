// Payment methods and billing health check
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../db/connection');
const { serverError } = require('../../lib/errors');

const router = express.Router();

router.get('/billing-api/payment-methods', (req, res) => {
    try {
        const methods = db.prepare('SELECT * FROM billing_payment_methods ORDER BY is_default DESC, name').all();
        res.json({ success: true, data: methods });
    } catch (error) {
        serverError(res, error);
    }
});

router.post('/billing-api/payment-methods', (req, res) => {
    try {
        const d = req.body;
        const id = uuidv4();
        const company = db.prepare('SELECT id FROM billing_company LIMIT 1').get();
        
        db.prepare(`
            INSERT INTO billing_payment_methods (id, company_id, name, type, instructions, is_default)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, company?.id, d.name, d.type || 'BANK_TRANSFER', d.instructions || '', d.isDefault ? 1 : 0);
        
        const method = db.prepare('SELECT * FROM billing_payment_methods WHERE id = ?').get(id);
        res.json({ success: true, data: method });
    } catch (error) {
        serverError(res, error);
    }
});

router.put('/billing-api/payment-methods/:id', (req, res) => {
    try {
        const d = req.body;
        
        db.prepare(`
            UPDATE billing_payment_methods SET name = ?, type = ?, instructions = ?, is_default = ?
            WHERE id = ?
        `).run(d.name, d.type, d.instructions, d.isDefault ? 1 : 0, req.params.id);
        
        const method = db.prepare('SELECT * FROM billing_payment_methods WHERE id = ?').get(req.params.id);
        res.json({ success: true, data: method });
    } catch (error) {
        serverError(res, error);
    }
});

router.delete('/billing-api/payment-methods/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM billing_payment_methods WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        serverError(res, error);
    }
});

// BILLING HEALTH CHECK

router.get('/billing-api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'unified' });
});

module.exports = router;
