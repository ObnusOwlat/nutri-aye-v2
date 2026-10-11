// Link a patient to a billing client
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../db/connection');
const { serverError } = require('../../lib/errors');

const router = express.Router();

// POST /api/patients/:id/sync-to-billing - Sync patient to billing client (unified)
router.post('/api/patients/:id/sync-to-billing', (req, res) => {
    try {
        const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
        if (!patient) {
            return res.status(404).json({ success: false, error: 'Patient not found' });
        }

        // Check if already linked
        if (patient.billing_client_id) {
            const existingClient = db.prepare('SELECT * FROM billing_clients WHERE id = ?').get(patient.billing_client_id);
            if (existingClient) {
                return res.json({ success: true, data: existingClient, alreadyLinked: true });
            }
        }

        // Create new client in billing (unified database)
        const clientId = uuidv4();
        const now = new Date().toISOString();
        const company = db.prepare('SELECT id FROM billing_company LIMIT 1').get();

        db.prepare(`
            INSERT INTO billing_clients (id, company_id, name, email, phone, address, city, country, type, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INDIVIDUAL', ?, ?, ?)
        `).run(
            clientId, company?.id,
            `${patient.first_name} ${patient.last_name}`,
            patient.email, patient.phone,
            patient.street, patient.city, 'USA',
            `Patient Notes: ${patient.notes || 'None'}`,
            now, now
        );

        const newClient = db.prepare('SELECT * FROM billing_clients WHERE id = ?').get(clientId);

        // Update patient with billing_client_id
        db.prepare('UPDATE patients SET billing_client_id = ?, updated_at = ? WHERE id = ?')
            .run(clientId, now, req.params.id);

        res.json({ success: true, data: newClient, alreadyLinked: false });
    } catch (error) {
        serverError(res, error);
    }
});

// GET /api/patients/:id/billing - Get patient's billing info (unified)
router.get('/api/patients/:id/billing', (req, res) => {
    try {
        const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
        if (!patient) {
            return res.status(404).json({ success: false, error: 'Patient not found' });
        }

        if (!patient.billing_client_id) {
            return res.json({ success: true, data: { linked: false, invoices: [], quotes: [] } });
        }

        // Get client info from unified database
        const client = db.prepare('SELECT * FROM billing_clients WHERE id = ?').get(patient.billing_client_id);
        const invoices = db.prepare('SELECT * FROM billing_invoices WHERE client_id = ? ORDER BY created_at DESC').all(patient.billing_client_id);
        const quotes = db.prepare('SELECT * FROM billing_quotes WHERE client_id = ? ORDER BY created_at DESC').all(patient.billing_client_id);

        res.json({ 
            success: true, 
            data: { 
                linked: !!client, 
                client,
                invoices,
                quotes 
            } 
        });
    } catch (error) {
        serverError(res, error);
    }
});

module.exports = router;
