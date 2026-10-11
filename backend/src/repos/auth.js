// Users, memberships (user x consultorio x role) and sessions
const crypto = require('crypto');
const { db } = require('../db/connection');
const { hashPassword, verifyPassword, sha256 } = require('../lib/passwords');
const { newId, nowIso } = require('../lib/http');
const { SESSION_IDLE_HOURS, SESSION_MAX_DAYS } = require('../config');

const stmts = {
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ? AND deactivated_at IS NULL'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userCount: db.prepare('SELECT COUNT(*) AS n FROM users'),
    insertUser: db.prepare(`
        INSERT INTO users (id, email, name, password_hash, must_change_password, created_at)
        VALUES (@id, @email, @name, @passwordHash, @mustChange, @now)
    `),
    setPassword: db.prepare('UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?'),
    touchLogin: db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?'),
    insertOrg: db.prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)'),
    orgById: db.prepare('SELECT * FROM organizations WHERE id = ?'),
    anyOrg: db.prepare('SELECT * FROM organizations WHERE deactivated_at IS NULL ORDER BY created_at LIMIT 1'),
    memberships: db.prepare(`
        SELECT m.org_id, m.role, o.name AS org_name FROM memberships m
        JOIN organizations o ON o.id = m.org_id
        WHERE m.user_id = ? AND m.deactivated_at IS NULL AND o.deactivated_at IS NULL
        ORDER BY m.created_at
    `),
    insertMembership: db.prepare(`
        INSERT INTO memberships (id, user_id, org_id, role, created_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (user_id, org_id) DO UPDATE SET role = excluded.role, deactivated_at = NULL, deactivated_by = NULL
    `),
    insertSession: db.prepare(`
        INSERT INTO sessions (id, token_hash, user_id, org_id, ip, user_agent, created_at, last_seen_at, expires_at)
        VALUES (@id, @tokenHash, @userId, @orgId, @ip, @userAgent, @now, @now, @expiresAt)
    `),
    sessionByToken: db.prepare(`
        SELECT s.id AS session_id, s.last_seen_at, s.expires_at, s.org_id, u.id AS user_id, u.email, u.name,
               u.must_change_password, m.role, o.name AS org_name
        FROM sessions s
        JOIN users u ON u.id = s.user_id AND u.deactivated_at IS NULL
        JOIN memberships m ON m.user_id = s.user_id AND m.org_id = s.org_id AND m.deactivated_at IS NULL
        JOIN organizations o ON o.id = s.org_id AND o.deactivated_at IS NULL
        WHERE s.token_hash = ? AND s.revoked_at IS NULL
    `),
    touchSession: db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?'),
    revokeSession: db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL'),
    revokeUserSessions: db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL'),
    revokeUserOrgSessions: db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND org_id = ? AND revoked_at IS NULL'),
    switchOrg: db.prepare('UPDATE sessions SET org_id = ? WHERE id = ?')
};

const hasUsers = () => stmts.userCount.get().n > 0;
const findUserByEmail = (email) => stmts.userByEmail.get(email);
const getUser = (id) => stmts.userById.get(id);
const membershipsOf = (userId) => stmts.memberships.all(userId).map(m => ({ orgId: m.org_id, orgName: m.org_name, role: m.role }));

// null when the email/password pair is wrong or the user is deactivated
function checkCredentials(email, password) {
    const user = findUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) return null;
    return user;
}

function createUser({ email, name, password, mustChangePassword = false }) {
    const id = newId();
    stmts.insertUser.run({ id, email, name, passwordHash: hashPassword(password), mustChange: mustChangePassword ? 1 : 0, now: nowIso() });
    return getUser(id);
}

const addMembership = (userId, orgId, role) => stmts.insertMembership.run(newId(), userId, orgId, role, nowIso());

function createOrganization(name) {
    const id = newId();
    stmts.insertOrg.run(id, name, nowIso());
    return stmts.orgById.get(id);
}

const getOrganization = (id) => stmts.orgById.get(id);
const firstOrganization = () => stmts.anyOrg.get();

function setPassword(userId, password, { mustChange = false } = {}) {
    stmts.setPassword.run(hashPassword(password), mustChange ? 1 : 0, userId);
}

const hours = (h) => h * 60 * 60 * 1000;

// Returns the cookie token; only its hash is stored
function createSession({ userId, orgId, ip, userAgent }) {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = new Date();
    stmts.insertSession.run({
        id: newId(), tokenHash: sha256(token), userId, orgId, ip: ip ?? null, userAgent: userAgent?.slice(0, 300) ?? null,
        now: now.toISOString(), expiresAt: new Date(now.getTime() + hours(24 * SESSION_MAX_DAYS)).toISOString()
    });
    stmts.touchLogin.run(now.toISOString(), userId);
    return token;
}

// Session + user + role for a cookie token; null if missing, expired, idle or revoked
function resolveSession(token) {
    if (!token) return null;
    const row = stmts.sessionByToken.get(sha256(token));
    if (!row) return null;
    const now = Date.now();
    if (now > Date.parse(row.expires_at) || now - Date.parse(row.last_seen_at) > hours(SESSION_IDLE_HOURS)) {
        stmts.revokeSession.run(new Date(now).toISOString(), row.session_id);
        return null;
    }
    // Write at most once a minute
    if (now - Date.parse(row.last_seen_at) > 60 * 1000) stmts.touchSession.run(new Date(now).toISOString(), row.session_id);
    return {
        sessionId: row.session_id, userId: row.user_id, email: row.email, name: row.name,
        orgId: row.org_id, orgName: row.org_name, role: row.role, mustChangePassword: !!row.must_change_password
    };
}

const revokeSession = (sessionId) => stmts.revokeSession.run(nowIso(), sessionId);
const revokeUserSessions = (userId) => stmts.revokeUserSessions.run(nowIso(), userId);
const revokeUserOrgSessions = (userId, orgId) => stmts.revokeUserOrgSessions.run(nowIso(), userId, orgId);
const switchSessionOrg = (sessionId, orgId) => stmts.switchOrg.run(orgId, sessionId);

module.exports = {
    hasUsers, findUserByEmail, getUser, membershipsOf, checkCredentials, createUser, addMembership,
    createOrganization, getOrganization, firstOrganization, setPassword,
    createSession, resolveSession, revokeSession, revokeUserSessions, revokeUserOrgSessions, switchSessionOrg
};
