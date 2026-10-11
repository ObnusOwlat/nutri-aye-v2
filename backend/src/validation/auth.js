// Login, first admin, passwords and consultorio users
const { z, requiredText } = require('./index');
const { ROLES } = require('../lib/permissions');

const email = z.string().trim().toLowerCase().email().max(200);
const password = z.string().min(8, 'Mínimo 8 caracteres').max(200);

const login = z.object({ email, password: z.string().min(1).max(200) });

const setup = z.object({
    orgName: requiredText(200).optional(),
    name: requiredText(100),
    email,
    password
});

const changePassword = z.object({ currentPassword: z.string().min(1).max(200), newPassword: password });

const switchOrg = z.object({ orgId: requiredText(64) });

const userCreate = z.object({
    name: requiredText(100),
    email,
    role: z.enum(ROLES)
});

const userUpdate = z.object({
    name: requiredText(100).optional(),
    role: z.enum(ROLES).optional()
});

module.exports = { login, setup, changePassword, switchOrg, userCreate, userUpdate };
