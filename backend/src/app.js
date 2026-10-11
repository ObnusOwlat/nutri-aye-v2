// Express app: security middleware, static frontend, API routes, error handling
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PUBLIC_DIR } = require('./config');
const { serverError } = require('./lib/errors');

const app = express();
app.disable('x-powered-by');

// Same-origin app: no CORS headers, so other websites cannot read the API
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: null
        }
    }
}));

const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api', apiLimiter);
app.use('/billing-api', apiLimiter);

// Bulk ingredient import needs a bigger body; everything else 1 MB
app.use('/api/ingredients/bulk', express.json({ limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));

// Only frontend/public is served; no-cache makes the browser revalidate after updates
app.use(express.static(PUBLIC_DIR, {
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache')
}));

const ROUTES = [
    'health', 'ingredients', 'nutrients', 'recipes',
    'patients/index', 'patients/records', 'patients/billing-link',
    'sync', 'backup', 'planner', 'stats',
    'billing/company', 'billing/clients', 'billing/invoices', 'billing/quotes', 'billing/payment-methods'
];
for (const route of ROUTES) {
    app.use(require(`./routes/${route}`));
}

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'No encontrado', code: 'NOT_FOUND' });
});

app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, error: 'El cuerpo de la solicitud no es JSON válido', code: 'INVALID_JSON' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, error: 'La solicitud es demasiado grande', code: 'PAYLOAD_TOO_LARGE' });
    }
    return serverError(res, err);
});

module.exports = { app };
