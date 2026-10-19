// Nutri Aye backend entry point
const { app } = require('./src/app');
const { db } = require('./src/db/connection');
const { logger } = require('./src/lib/logger');
const { PORT, HOST, DB_PATH } = require('./src/config');
const { startDailyBackups } = require('./src/backup/daily');

function startServer() {
    return app.listen(PORT, HOST, () => {
        logger.info(`Nutri Aye en http://${HOST}:${PORT} (base de datos: ${DB_PATH})`);
    });
}

function shutdown() {
    db.close();
    process.exit(0);
}

// Server + daily copies; `npm start` and the Windows launcher (installer/launcher.js)
function main() {
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    startDailyBackups();
    return startServer();
}

if (require.main === module) main();

module.exports = { app, db, startServer, main };
