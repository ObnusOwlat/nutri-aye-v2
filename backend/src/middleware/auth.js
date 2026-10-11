// Session cookie, login requirement, roles and same-origin check for writes
const { resolveSession } = require('../repos/auth');
const { isAllowed } = require('../lib/permissions');
const { HttpError } = require('../lib/http');
const { COOKIE_SECURE, SESSION_MAX_DAYS } = require('../config');

const COOKIE = 'nutri_sid';

// Reachable without a session
const PUBLIC = new Set(['/api/health', '/billing-api/health', '/api/auth/status', '/api/auth/login', '/api/auth/setup']);
// Reachable while the user must change the temporary password
const PASSWORD_CHANGE = new Set(['/api/auth/me', '/api/auth/password', '/api/auth/logout']);

function readCookie(req, name) {
    for (const part of (req.headers.cookie || '').split(';')) {
        const [key, ...rest] = part.trim().split('=');
        if (key === name) return decodeURIComponent(rest.join('='));
    }
    return null;
}

function setSessionCookie(res, token) {
    const attrs = [`${COOKIE}=${token}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${SESSION_MAX_DAYS * 86400}`];
    if (COOKIE_SECURE) attrs.push('Secure');
    res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${COOKIE_SECURE ? '; Secure' : ''}`);
}

// Writes from another website are rejected (CSRF): the browser always sends Origin on them
function sameOrigin(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const source = req.headers.origin || req.headers.referer;
    if (!source) return next(); // not a browser: it cannot carry the user's cookie
    let host;
    try { host = new URL(source).host; } catch { host = null; }
    if (host !== req.headers.host) return next(new HttpError(403, 'Solicitud de otro sitio rechazada', 'FORBIDDEN_ORIGIN'));
    next();
}

// Loads req.auth and req.ctx ({ orgId, userId, role }) and enforces login + role for the API
function authenticate(req, res, next) {
    const isApi = req.path.startsWith('/api/') || req.path.startsWith('/billing-api/');
    if (!isApi) return next();

    req.auth = resolveSession(readCookie(req, COOKIE));
    if (req.auth) req.ctx = { orgId: req.auth.orgId, userId: req.auth.userId, role: req.auth.role, ip: req.ip };

    if (PUBLIC.has(req.path)) return next();
    if (!req.auth) return next(new HttpError(401, 'Iniciá sesión para continuar', 'UNAUTHENTICATED'));
    if (req.auth.mustChangePassword && !PASSWORD_CHANGE.has(req.path)) {
        return next(new HttpError(403, 'Tenés que cambiar la contraseña temporal', 'PASSWORD_CHANGE_REQUIRED'));
    }
    if (!isAllowed(req.auth.role, req.method, req.path)) {
        return next(new HttpError(403, 'Tu rol no permite esta acción', 'FORBIDDEN'));
    }
    next();
}

module.exports = { authenticate, sameOrigin, setSessionCookie, clearSessionCookie, readCookie, COOKIE };
