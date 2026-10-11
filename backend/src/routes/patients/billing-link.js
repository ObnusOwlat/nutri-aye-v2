// Link a patient to a billing client
const express = require('express');
const clients = require('../../repos/billing/clients');
const { notFound } = require('../../lib/http');

const router = express.Router();

router.post('/api/patients/:id/sync-to-billing', (req, res) => {
    const result = clients.linkPatient(req.params.id);
    if (!result) throw notFound('Paciente');
    res.json({ success: true, data: result.client, alreadyLinked: result.alreadyLinked });
});

router.get('/api/patients/:id/billing', (req, res) => {
    const billing = clients.patientBilling(req.params.id);
    if (!billing) throw notFound('Paciente');
    res.json({ success: true, data: billing });
});

module.exports = router;
