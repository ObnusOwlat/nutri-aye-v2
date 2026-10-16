// Who can do what. Everyone in a consultorio can read its data; writing
// depends on the role. One table, checked before every route.
const ROLES = ['admin', 'nutricionista', 'recepcion'];

const GROUPS = {
    admin: ['admin'],
    clinical: ['admin', 'nutricionista'],
    front: ['admin', 'nutricionista', 'recepcion']
};

// [path pattern, group, applies to reads too?] - first match wins
const RULES = [
    [/^\/api\/users(\/|$)/, 'admin', true],
    [/^\/api\/activity(\/|$)/, 'admin', true],
    [/^\/api\/backup(\/|$)/, 'admin', true],
    [/^\/billing-api\/(company|pdf-config)(\/|$)/, 'admin', false],
    [/^\/api\/patients\/[^/]+\/(metrics|conditions|plans|progress|targets)(\/|$)/, 'clinical', false],
    [/^\/api\/(diet-templates|activity-templates|day-templates|migration)(\/|$)/, 'clinical', false],
    [/^\/api\/(recipes|ingredients|planner)(\/|$)/, 'clinical', false],
    [/^\/api\/patients(\/|$)/, 'front', false],
    [/^\/billing-api(\/|$)/, 'front', false]
];

const isRead = (method) => method === 'GET' || method === 'HEAD';

function isAllowed(role, method, path) {
    const rule = RULES.find(([pattern]) => pattern.test(path));
    if (!rule) return true;
    const [, group, appliesToReads] = rule;
    if (isRead(method) && !appliesToReads) return true;
    return GROUPS[group].includes(role);
}

module.exports = { ROLES, isAllowed };
