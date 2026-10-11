// Nutri Aye backend entry point
const { app } = require('./src/app');
const { db } = require('./src/db/connection');
const { logger } = require('./src/lib/logger');
const { PORT, HOST, DB_PATH } = require('./src/config');

function startServer() {
    return app.listen(PORT, HOST, () => {
        logger.info(`Nutri Aye en http://${HOST}:${PORT} (base de datos: ${DB_PATH})`);
    });
}

function shutdown() {
    db.close();
    process.exit(0);
}

if (require.main === module) {
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    startServer();
}

module.exports = { app, db, startServer };
