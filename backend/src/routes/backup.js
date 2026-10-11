// Backup of the logged-in consultorio (admin only, see lib/permissions.js)
const express = require('express');
const { exportBackup, checkBackup, importBackup } = require('../backup/serializer');
const { badRequest } = require('../lib/http');

const router = express.Router();

router.get('/api/backup/export', (req, res) => {
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename=nutri-aye-respaldo-${date}.json`);
    res.json(exportBackup(req.ctx));
});

router.post('/api/backup/import', (req, res) => {
    const problems = checkBackup(req.body);
    if (problems.length) throw badRequest(`El respaldo no es válido: ${problems.join('; ')}`, problems);
    try {
        res.json({ success: true, data: { imported: importBackup(req.ctx, req.body) } });
    } catch (error) {
        if (String(error.code).startsWith('SQLITE_CONSTRAINT')) {
            throw badRequest('El respaldo tiene datos inconsistentes (referencias o valores obligatorios); no se importó nada');
        }
        throw error;
    }
});

module.exports = router;
