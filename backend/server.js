/**
 * Meal Prep Planner - Backend Server
 * 
 * Optional backend for data sync and backup.
 * Uses localStorage-compatible data format.
 */

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'db', 'database.sqlite');
const dbDir = path.dirname(dbPath);

// Ensure db directory exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new Database(dbPath);

// Initialize database schema
function initializeDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS sync_data (
            id TEXT PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS backup_history (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sync_data_key ON sync_data(key);
        CREATE INDEX IF NOT EXISTS idx_backup_history_created ON backup_history(created_at);
    `);

    console.log('[DB] Database initialized');
}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ==========================================
// SYNC ENDPOINTS
// ==========================================

/**
 * Push local data to server
 * POST /api/sync/push
 */
app.post('/api/sync/push', (req, res) => {
    try {
        const { ingredients, recipes, weekPlan, dietProfile } = req.body;

        const now = new Date().toISOString();

        // Save each data type
        const saveData = (key, data) => {
            const stmt = db.prepare(`
                INSERT INTO sync_data (id, key, data, updated_at, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    data = excluded.data,
                    updated_at = excluded.updated_at
            `);

            const id = uuidv4();
            stmt.run(id, key, JSON.stringify(data), now, now);
        };

        if (ingredients) saveData('ingredients', ingredients);
        if (recipes) saveData('recipes', recipes);
        if (weekPlan) saveData('weekPlan', weekPlan);
        if (dietProfile) saveData('dietProfile', dietProfile);

        res.json({
            success: true,
            timestamp: now,
            message: 'Data synced successfully'
        });
    } catch (error) {
        console.error('[Sync] Push error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Pull data from server
 * GET /api/sync/pull
 */
app.get('/api/sync/pull', (req, res) => {
    try {
        const data = {};

        const rows = db.prepare('SELECT key, data, updated_at FROM sync_data').all();
        
        rows.forEach(row => {
            try {
                data[row.key] = JSON.parse(row.data);
                data[row.key]._syncMeta = {
                    updatedAt: row.updated_at
                };
            } catch (e) {
                console.error(`[Sync] Error parsing ${row.key}:`, e);
            }
        });

        res.json({
            success: true,
            data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Sync] Pull error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==========================================
// BACKUP ENDPOINTS
// ==========================================

/**
 * Export full backup
 * POST /api/backup/export
 */
app.get('/api/backup/export', (req, res) => {
    try {
        const data = {};
        const rows = db.prepare('SELECT key, data FROM sync_data').all();
        
        rows.forEach(row => {
            try {
                data[row.key] = JSON.parse(row.data);
            } catch (e) {
                // Skip invalid data
            }
        });

        const backup = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            ...data
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=meal-prep-backup.json');
        res.json(backup);
    } catch (error) {
        console.error('[Backup] Export error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Import backup
 * POST /api/backup/import
 */
app.post('/api/backup/import', (req, res) => {
    try {
        const { ingredients, recipes, weekPlan, dietProfile } = req.body;

        // Save to database (same logic as sync push)
        const now = new Date().toISOString();

        const saveData = (key, data) => {
            const stmt = db.prepare(`
                INSERT INTO sync_data (id, key, data, updated_at, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    data = excluded.data,
                    updated_at = excluded.updated_at
            `);

            const id = uuidv4();
            stmt.run(id, key, JSON.stringify(data), now, now);
        };

        if (ingredients) saveData('ingredients', ingredients);
        if (recipes) saveData('recipes', recipes);
        if (weekPlan) saveData('weekPlan', weekPlan);
        if (dietProfile) saveData('dietProfile', dietProfile);

        // Also save to backup history
        const backupStmt = db.prepare(`
            INSERT INTO backup_history (id, data, created_at)
            VALUES (?, ?, ?)
        `);
        backupStmt.run(uuidv4(), JSON.stringify(req.body), now);

        res.json({
            success: true,
            message: 'Backup imported successfully',
            timestamp: now
        });
    } catch (error) {
        console.error('[Backup] Import error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get backup history
 * GET /api/backup/history
 */
app.get('/api/backup/history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const rows = db.prepare(`
            SELECT id, created_at 
            FROM backup_history 
            ORDER BY created_at DESC 
            LIMIT ?
        `).all(limit);

        res.json({
            success: true,
            history: rows
        });
    } catch (error) {
        console.error('[Backup] History error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==========================================
// STATS ENDPOINT
// ==========================================

/**
 * Get sync statistics
 * GET /api/stats
 */
app.get('/api/stats', (req, res) => {
    try {
        const ingredientsCount = db.prepare("SELECT COUNT(*) as count FROM sync_data WHERE key = 'ingredients'").get();
        const recipesCount = db.prepare("SELECT COUNT(*) as count FROM sync_data WHERE key = 'recipes'").get();
        const backupsCount = db.prepare("SELECT COUNT(*) as count FROM backup_history").get();
        const lastSync = db.prepare("SELECT MAX(updated_at) as last FROM sync_data").get();

        res.json({
            success: true,
            stats: {
                ingredients: ingredientsCount?.count || 0,
                recipes: recipesCount?.count || 0,
                backups: backupsCount?.count || 0,
                lastSync: lastSync?.last || null
            }
        });
    } catch (error) {
        console.error('[Stats] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[Server] Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// ==========================================
// START SERVER
// ==========================================

function startServer() {
    initializeDatabase();
    
    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════╗
║     Meal Prep Planner - Backend Server       ║
╠════════════════════════════════════════════╣
║  Status:  Running                            ║
║  Port:    ${PORT}                              ║
║  DB:      SQLite                             ║
║  URL:     http://localhost:${PORT}              ║
╚════════════════════════════════════════════╝

API Endpoints:
  GET    /api/health          - Health check
  POST   /api/sync/push       - Push data to server
  GET    /api/sync/pull       - Pull data from server
  GET    /api/backup/export   - Export full backup
  POST   /api/backup/import   - Import backup
  GET    /api/backup/history  - Get backup history
  GET    /api/stats           - Get sync statistics
        `);
    });
}

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[Server] Shutting down...');
    db.close();
    process.exit(0);
});

// Start if run directly
if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
