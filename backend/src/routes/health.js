// Health check
const express = require('express');

const router = express.Router();

// Health check
router.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'normalized_3nf'
    });
});

module.exports = router;
