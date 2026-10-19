// Login, logout, current user, first admin, password, consultorio switch
const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../repos/auth');
const { record } = require('../audit/log');
const { validate } = require('../validation');
const schemas = require('../validation/auth');
const { setSessionCookie, clearSessionCookie } = require('../middleware/auth');
const { HttpError, badRequest } = require('../lib/http');

const router = express.Router();

// Slows down password guessing: 20 failed attempts per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, skipSuccessfulRequests: true, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ success: false, error: 'Demasiados intentos. Esperá unos minutos.', code: 'TOO_MANY_ATTEMPTS' })
});

const me = (req) => ({
    user: { id: req.auth.userId, name: req.auth.name, email: req.auth.email, mustChangePassword: req.auth.mustChangePassword },
    organization: { id: req.auth.orgId, name: req.auth.orgName },
    role: req.auth.role,
    memberships: auth.membershipsOf(req.auth.userId)
});

function startSession(req, res, user, orgId) {
    const token = auth.createSession({ userId: user.id, orgId, ip: req.ip, userAgent: req.headers['user-agent'] });
    setSessionCookie(res, token);
}

const ctxOf = (req, userId, orgId) => ({ userId, orgId, ip: req.ip });

// Whether the first admin still has to be created, and whether this browser is logged in
// Failed attempts on an existing account are shown to each of its consultorios
// (the email typed is not stored when it matches no account)
function recordFailedLogin(req, email) {
    const user = auth.findUserByEmail(email);
    const memberships = user ? auth.membershipsOf(user.id) : [];
    if (!memberships.length) return record({ ip: req.ip }, { action: 'login_failed', entity: 'session' });
    for (const m of memberships) record(ctxOf(req, null, m.orgId), { action: 'login_failed', entity: 'session', entityId: user.id });
}

router.get('/api/auth/status', (req, res) => {
    res.json({ success: true, data: { setupRequired: !auth.hasUsers(), authenticated: !!req.auth } });
});

// Only while there are no users at all
router.post('/api/auth/setup', loginLimiter, validate(schemas.setup), (req, res) => {
    if (auth.hasUsers()) throw new HttpError(409, 'El sistema ya tiene usuarios', 'CONFLICT');
    // A new installation already has its consultorio (with the recipes and templates): it takes the given name
    const existing = auth.firstOrganization();
    const org = existing
        ? (req.body.orgName ? auth.renameOrganization(existing.id, req.body.orgName) : existing)
        : auth.createOrganization(req.body.orgName || 'Consultorio principal');
    const user = auth.createUser({ email: req.body.email, name: req.body.name, password: req.body.password });
    auth.addMembership(user.id, org.id, 'admin');
    record(ctxOf(req, user.id, org.id), { action: 'create', entity: 'user', entityId: user.id, changes: { role: [null, 'admin'] } });
    startSession(req, res, user, org.id);
    res.status(201).json({ success: true });
});

router.post('/api/auth/login', loginLimiter, validate(schemas.login), (req, res) => {
    const user = auth.checkCredentials(req.body.email, req.body.password);
    const memberships = user ? auth.membershipsOf(user.id) : [];
    // Same message for every failure: does not reveal which emails exist
    if (!user || !memberships.length) {
        recordFailedLogin(req, req.body.email);
        throw new HttpError(401, 'Email o contraseña incorrectos', 'INVALID_CREDENTIALS');
    }
    startSession(req, res, user, memberships[0].orgId);
    record(ctxOf(req, user.id, memberships[0].orgId), { action: 'login', entity: 'session', entityId: user.id });
    res.json({ success: true });
});

router.post('/api/auth/logout', (req, res) => {
    auth.revokeSession(req.auth.sessionId);
    record(req.ctx, { action: 'logout', entity: 'session', entityId: req.ctx.userId });
    clearSessionCookie(res);
    res.json({ success: true });
});

router.get('/api/auth/me', (req, res) => {
    res.json({ success: true, data: me(req) });
});

// Changing the password closes every other session of the user
router.post('/api/auth/password', validate(schemas.changePassword), (req, res) => {
    const user = auth.getUser(req.auth.userId);
    if (!auth.checkCredentials(user.email, req.body.currentPassword)) throw badRequest('La contraseña actual no es correcta');
    auth.setPassword(user.id, req.body.newPassword);
    auth.revokeUserSessions(user.id);
    record(req.ctx, { action: 'password_change', entity: 'user', entityId: user.id });
    startSession(req, res, user, req.auth.orgId);
    res.json({ success: true });
});

router.post('/api/auth/switch-org', validate(schemas.switchOrg), (req, res) => {
    const membership = auth.membershipsOf(req.auth.userId).find(m => m.orgId === req.body.orgId);
    if (!membership) throw new HttpError(403, 'No tenés acceso a ese consultorio', 'FORBIDDEN');
    auth.switchSessionOrg(req.auth.sessionId, membership.orgId);
    record(ctxOf(req, req.ctx.userId, membership.orgId), { action: 'switch_org', entity: 'session', entityId: req.ctx.userId });
    res.json({ success: true });
});

module.exports = router;
