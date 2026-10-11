// Consultorio users (admin only, see lib/permissions.js)
const express = require('express');
const auth = require('../repos/auth');
const users = require('../repos/users');
const { validate } = require('../validation');
const schemas = require('../validation/auth');
const { temporaryPassword } = require('../lib/passwords');
const { notFound, conflict, badRequest } = require('../lib/http');

const router = express.Router();

function member(req) {
    const found = users.get(req.ctx.orgId, req.params.id);
    if (!found) throw notFound('Usuario');
    return found;
}

// The consultorio must always keep an active admin
function keepsAnAdmin(req, target, newRole) {
    const losesAdmin = target.role === 'admin' && target.active && newRole !== 'admin';
    if (losesAdmin && users.activeAdmins(req.ctx.orgId) <= 1) throw conflict('El consultorio tiene que tener al menos un administrador activo');
}

router.get('/api/users', (req, res) => {
    res.json({ success: true, data: users.list(req.ctx.orgId) });
});

// New email: creates the user with a temporary password (shown once).
// Existing email: adds that person to this consultorio with their current password.
router.post('/api/users', validate(schemas.userCreate), (req, res) => {
    const { name, email, role } = req.body;
    let user = auth.findUserByEmail(email);
    let password = null;
    if (user) {
        const current = users.get(req.ctx.orgId, user.id);
        if (current?.active) throw conflict('Esa persona ya es usuaria de este consultorio');
    } else {
        password = temporaryPassword();
        user = auth.createUser({ email, name, password, mustChangePassword: true });
    }
    auth.addMembership(user.id, req.ctx.orgId, role);
    res.status(201).json({ success: true, data: { ...users.get(req.ctx.orgId, user.id), temporaryPassword: password } });
});

router.put('/api/users/:id', validate(schemas.userUpdate), (req, res) => {
    const target = member(req);
    if (req.body.role) keepsAnAdmin(req, target, req.body.role);
    res.json({ success: true, data: users.update(req.ctx.orgId, target.id, req.body) });
});

// "Delete" = deactivate in this consultorio and close their sessions here
router.post('/api/users/:id/deactivate', (req, res) => {
    const target = member(req);
    if (target.id === req.ctx.userId) throw badRequest('No podés desactivarte a vos mismo');
    keepsAnAdmin(req, target, null);
    users.deactivate(req.ctx.orgId, target.id, req.ctx.userId);
    auth.revokeUserOrgSessions(target.id, req.ctx.orgId);
    res.json({ success: true, data: users.get(req.ctx.orgId, target.id) });
});

router.post('/api/users/:id/reactivate', (req, res) => {
    const target = member(req);
    users.reactivate(req.ctx.orgId, target.id);
    res.json({ success: true, data: users.get(req.ctx.orgId, target.id) });
});

// New temporary password; the user must change it at the next login
router.post('/api/users/:id/reset-password', (req, res) => {
    const target = member(req);
    const password = temporaryPassword();
    auth.setPassword(target.id, password, { mustChange: true });
    auth.revokeUserSessions(target.id);
    res.json({ success: true, data: { temporaryPassword: password } });
});

module.exports = router;
