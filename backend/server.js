// Nutri Aye backend entry point: creates/migrates the schema and starts listening.
// The app itself lives in src/ (app.js, routes/, db/, transforms, queries).
const { app } = require('./src/app');
const { db } = require('./src/db/connection');
const { initializeDatabase } = require('./src/db/schema');
const { PORT, HOST, DB_PATH } = require('./src/config');

// Schema is created/migrated as soon as the module loads, so tests can import `app`
initializeDatabase();

function startServer() {
    return app.listen(PORT, HOST, () => {
        console.log(`[Nutri Aye] http://${HOST}:${PORT}  (base de datos: ${DB_PATH})`);
    });
}

function shutdown() {
    console.log('\n[Nutri Aye] Cerrando...');
    db.close();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (require.main === module) {
    startServer();
}

module.exports = { app, db, startServer };
