// Settings from the environment (see backend/.env.example)
const path = require('path');

module.exports = {
    PORT: Number(process.env.PORT) || 3001,
    HOST: process.env.HOST || '127.0.0.1',   // only this machine unless configured
    DB_PATH: process.env.DB_PATH || path.join(__dirname, '..', 'db', 'database.sqlite'),
    PUBLIC_DIR: path.join(__dirname, '..', '..', 'frontend', 'public')
};
