// Creates an admin from the terminal (installation on the server computer).
// Usage: node scripts/create-admin.js email@ejemplo.com "Nombre" "contraseña" ["Consultorio"]
// Without a consultorio name it uses the first one (where existing data lives).
const { migrate } = require('../src/db/migrations');
migrate();
const auth = require('../src/repos/auth');

const [email, name, password, orgName] = process.argv.slice(2);
if (!email || !name || !password || password.length < 8) {
    console.error('Uso: node scripts/create-admin.js email "Nombre" "contraseña (mín. 8)" ["Consultorio"]');
    process.exit(1);
}

const org = (!orgName && auth.firstOrganization()) || auth.createOrganization(orgName || 'Consultorio principal');
const user = auth.findUserByEmail(email) || auth.createUser({ email: email.toLowerCase(), name, password });
auth.addMembership(user.id, org.id, 'admin');
console.log(`Listo: ${email} es admin de "${org.name}"`);
