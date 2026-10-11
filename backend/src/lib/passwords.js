// Password hashing with scrypt (built into Node, no native dependency)
const crypto = require('crypto');

const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, KEY_LENGTH, PARAMS);
    return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
    const [scheme, N, r, p, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(hash, 'base64');
    const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(actual, expected);
}

// Readable temporary password for resets (shown once to the admin)
function temporaryPassword() {
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(crypto.randomBytes(12), b => alphabet[b % alphabet.length]).join('');
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

module.exports = { hashPassword, verifyPassword, temporaryPassword, sha256 };
