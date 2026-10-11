// Writes and reads the audit log. Every change is recorded inside the same
// transaction as the change itself: if one fails, neither stays.
const { db } = require('../db/connection');
const { snapshot, patientIdOf } = require('./entities');
const { nowIso } = require('../lib/http');

const insert = db.prepare(`
    INSERT INTO audit_log (org_id, user_id, action, entity, entity_id, patient_id, changes, ip, created_at)
    VALUES (@orgId, @userId, @action, @entity, @entityId, @patientId, @changes, @ip, @now)
`);

function record(ctx, { action, entity, entityId = null, patientId = null, changes = null }) {
    insert.run({
        orgId: ctx?.orgId ?? null, userId: ctx?.userId ?? null, ip: ctx?.ip ?? null,
        action, entity, entityId, patientId,
        changes: changes ? JSON.stringify(changes) : null, now: nowIso()
    });
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// { field: [before, after] } for the fields that changed
function diff(before, after) {
    const changes = {};
    for (const key of new Set([...Object.keys(before || {}), ...Object.keys(after || {})])) {
        if (!same(before?.[key], after?.[key])) changes[key] = [before?.[key] ?? null, after?.[key] ?? null];
    }
    return changes;
}

function actionFor(before, after) {
    if (!before) return 'create';
    if (!before.deactivated_at && after.deactivated_at) return 'deactivate';
    if (before.deactivated_at && !after.deactivated_at) return 'reactivate';
    return 'update';
}

/**
 * Runs fn (a repo write) and records what it changed. id = existing entity, or
 * null for a creation (the id is taken from fn's result). A result of null or
 * false (not found) records nothing; nothing is recorded if nothing changed.
 */
function tracked(ctx, entity, id, fn) {
    return db.transaction(() => {
        const before = id ? snapshot(entity, id, ctx) : null;
        const result = fn();
        const entityId = id || result?.id;
        if (result == null || result === false || !entityId) return result;
        const after = snapshot(entity, entityId, ctx);
        const changes = diff(before, after);
        if (Object.keys(changes).length) {
            record(ctx, {
                action: actionFor(before, after), entity, entityId,
                patientId: patientIdOf(entity, after || before, entityId), changes
            });
        }
        return result;
    })();
}

const LIST_SELECT = `
    SELECT a.id, a.action, a.entity, a.entity_id, a.patient_id, a.changes, a.ip, a.created_at,
           a.user_id, u.name AS user_name, p.first_name || ' ' || p.last_name AS patient_name
    FROM audit_log a
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN patients p ON p.id = a.patient_id
`;

const toEntry = (row) => ({
    id: row.id, action: row.action, entity: row.entity, entityId: row.entity_id,
    patientId: row.patient_id, patientName: row.patient_name, userId: row.user_id, userName: row.user_name,
    changes: row.changes ? JSON.parse(row.changes) : null, ip: row.ip, createdAt: row.created_at
});

// Filters: userId, entity, action, patientId, from/to (YYYY-MM-DD, inclusive)
function list(ctx, { userId, entity, action, patientId, from, to, limit, offset }) {
    const where = ['a.org_id = @orgId'];
    const params = { orgId: ctx.orgId };
    const add = (sql, key, value) => { if (value) { where.push(sql); params[key] = value; } };
    add('a.user_id = @userId', 'userId', userId);
    add('a.entity = @entity', 'entity', entity);
    add('a.action = @action', 'action', action);
    add('a.patient_id = @patientId', 'patientId', patientId);
    add('a.created_at >= @from', 'from', from);
    add("a.created_at < date(@to, '+1 day')", 'to', to);
    const whereSql = where.join(' AND ');
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM audit_log a WHERE ${whereSql}`).get(params);
    const rows = db.prepare(`${LIST_SELECT} WHERE ${whereSql} ORDER BY a.id DESC LIMIT @limit OFFSET @offset`)
        .all({ ...params, limit, offset });
    return { rows: rows.map(toEntry), total };
}

module.exports = { record, tracked, list, diff };
