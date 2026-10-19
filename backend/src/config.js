// Settings from the environment (see backend/.env.example)
const path = require('path');

module.exports = {
    PORT: Number(process.env.PORT) || 3001,
    HOST: process.env.HOST || '127.0.0.1',   // only this machine unless configured
    DB_PATH: process.env.DB_PATH || path.join(__dirname, '..', 'db', 'database.sqlite'),
    // Automatic daily copy of the database (src/backup/daily.js): folder and how many to keep
    BACKUP_DIR: process.env.BACKUP_DIR || path.join(__dirname, '..', 'db', 'respaldos'),
    BACKUP_KEEP: Number(process.env.BACKUP_KEEP) || 30,
    PUBLIC_DIR: path.join(__dirname, '..', '..', 'frontend', 'public'),
    // Sessions: closed after SESSION_IDLE_HOURS without use, always after SESSION_MAX_DAYS
    SESSION_IDLE_HOURS: Number(process.env.SESSION_IDLE_HOURS) || 12,
    SESSION_MAX_DAYS: Number(process.env.SESSION_MAX_DAYS) || 7,
    // true behind HTTPS (Fase 9): the browser then sends the cookie only over HTTPS
    COOKIE_SECURE: process.env.COOKIE_SECURE === 'true'
};
