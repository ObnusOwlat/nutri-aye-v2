// One-time import of a browser's old data (before Fase 4). Adds only new records.
const express = require('express');
const { convert } = require('../migration/browser');
const { importBackup } = require('../backup/serializer');
const { record } = require('../audit/log');
const { badRequest } = require('../lib/http');

const router = express.Router();

router.post('/api/migration/browser-data', (req, res) => {
    if (!req.body || typeof req.body !== 'object') throw badRequest('Datos del navegador inválidos');
    let imported;
    try {
        imported = importBackup(req.ctx, convert(req.ctx, req.body), { onlyNew: true });
    } catch (error) {
        if (String(error.code).startsWith('SQLITE_CONSTRAINT')) throw badRequest('Los datos del navegador tienen referencias inconsistentes; no se importó nada');
        throw error;
    }
    const counts = Object.fromEntries(Object.entries(imported).filter(([, n]) => n).map(([name, n]) => [name, [null, n]]));
    record(req.ctx, { action: 'import', entity: 'browser_data', changes: counts });
    res.json({ success: true, data: { imported } });
});

module.exports = router;
