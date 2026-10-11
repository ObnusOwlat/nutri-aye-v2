// Spanish labels of every stored value, for the interface
const express = require('express');
const { LABELS } = require('../labels');

const router = express.Router();

router.get('/api/labels', (req, res) => {
    res.set('Cache-Control', 'private, max-age=3600');
    res.json({ success: true, data: LABELS });
});

module.exports = router;
