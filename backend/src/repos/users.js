// Users of a consultorio (admin screen). Users are never deleted:
// removing someone deactivates their membership in this consultorio.
const { db } = require('../db/connection');
const { nowIso } = require('../lib/http');

const MEMBER_SELECT = `
    SELECT u.id, u.name, u.email, u.last_login_at, u.must_change_password, m.role, m.created_at,
           m.deactivated_at, m.deactivated_by
    FROM memberships m JOIN users u ON u.id = m.user_id
`;

const toMember = (row) => row && ({
    id: row.id, name: row.name, email: row.email, role: row.role, lastLoginAt: row.last_login_at,
    mustChangePassword: !!row.must_change_password, createdAt: row.created_at,
    active: !row.deactivated_at, deactivatedAt: row.deactivated_at
});

const stmts = {
    list: db.prepare(`${MEMBER_SELECT} WHERE m.org_id = ? ORDER BY m.deactivated_at IS NOT NULL, u.name`),
    get: db.prepare(`${MEMBER_SELECT} WHERE m.org_id = ? AND m.user_id = ?`),
    setRole: db.prepare('UPDATE memberships SET role = ? WHERE org_id = ? AND user_id = ?'),
    setName: db.prepare('UPDATE users SET name = ? WHERE id = ?'),
    deactivate: db.prepare('UPDATE memberships SET deactivated_at = ?, deactivated_by = ? WHERE org_id = ? AND user_id = ? AND deactivated_at IS NULL'),
    reactivate: db.prepare('UPDATE memberships SET deactivated_at = NULL, deactivated_by = NULL WHERE org_id = ? AND user_id = ?'),
    activeAdmins: db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE org_id = ? AND role = 'admin' AND deactivated_at IS NULL")
};

const list = (orgId) => stmts.list.all(orgId).map(toMember);
const get = (orgId, userId) => toMember(stmts.get.get(orgId, userId));
const activeAdmins = (orgId) => stmts.activeAdmins.get(orgId).n;

const update = db.transaction((orgId, userId, { name, role }) => {
    if (role) stmts.setRole.run(role, orgId, userId);
    if (name) stmts.setName.run(name, userId);
    return get(orgId, userId);
});

const deactivate = (orgId, userId, byUserId) => stmts.deactivate.run(nowIso(), byUserId, orgId, userId).changes > 0;
const reactivate = (orgId, userId) => stmts.reactivate.run(orgId, userId).changes > 0;

module.exports = { list, get, update, deactivate, reactivate, activeAdmins };
