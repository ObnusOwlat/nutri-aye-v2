// Express app: security middleware, static frontend, API routes, error handling
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const { PUBLIC_DIR } = require('./config');
const { logger } = require('./lib/logger');
const { newId } = require('./lib/http');
const { errorHandler } = require('./lib/errors');
const { migrate } = require('./db/migrations');

// The schema must exist before the repos prepare their statements
migrate();
const { authenticate, sameOrigin } = require('./middleware/auth');

const app = express();
app.disable('x-powered-by');

// Request log: method, path, status, time and a request id. No bodies (patient data).
app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
        const id = newId();
        res.setHeader('X-Request-Id', id);
        return id;
    },
    autoLogging: { ignore: (req) => !req.url.startsWith('/api') && !req.url.startsWith('/billing-api') },
    serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url.split('?')[0] }),
        res: (res) => ({ statusCode: res.statusCode })
    }
}));

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

// Imports need a bigger body; everything else 1 MB
app.use(['/api/ingredients/bulk', '/api/backup/import'], express.json({ limit: '20mb' }));
app.use(express.json({ limit: '1mb' }));

// Only frontend/public is served; no-cache makes the browser revalidate after updates
app.use(express.static(PUBLIC_DIR, {
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache')
}));

// Writes from other websites are rejected; every API route needs a session
// and a role allowed by lib/permissions.js (except login/health)
app.use(sameOrigin);
app.use(authenticate);

const ROUTES = [
    'auth', 'users', 'activity', 'stats', 'ingredients', 'nutrients', 'recipes',
    'patients/index', 'patients/records', 'patients/billing-link',
    'sync', 'backup', 'planner',
    'billing/company', 'billing/clients', 'billing/documents', 'billing/payment-methods'
];
for (const route of ROUTES) {
    app.use(require(`./routes/${route}`));
}

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'No encontrado', code: 'NOT_FOUND' });
});

app.use(errorHandler);

module.exports = { app };
