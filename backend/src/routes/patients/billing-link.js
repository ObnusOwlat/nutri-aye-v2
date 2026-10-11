// Link a patient to a billing client
const express = require('express');
const clients = require('../../repos/billing/clients');
const { tracked, record, diff } = require('../../audit/log');
const { snapshot } = require('../../audit/entities');
const { notFound } = require('../../lib/http');

const router = express.Router();

router.post('/api/patients/:id/sync-to-billing', (req, res) => {
    // The patient's billing_client_id change and the new client are both recorded
    const result = tracked(req.ctx, 'patient', req.params.id, () => {
        const linked = clients.linkPatient(req.ctx, req.params.id);
        if (linked && !linked.alreadyLinked) {
            const changes = diff(null, snapshot('billing_client', linked.client.id, req.ctx));
            record(req.ctx, { action: 'create', entity: 'billing_client', entityId: linked.client.id, changes });
        }
        return linked;
    });
    if (!result) throw notFound('Paciente');
    res.json({ success: true, data: result.client, alreadyLinked: result.alreadyLinked });
});

router.get('/api/patients/:id/billing', (req, res) => {
    const billing = clients.patientBilling(req.ctx, req.params.id);
    if (!billing) throw notFound('Paciente');
    res.json({ success: true, data: billing });
});

module.exports = router;
