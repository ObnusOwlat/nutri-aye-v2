// Windows launcher (runs with the bundled nutri-aye-server.exe, a renamed node.exe).
//   launcher.js               start the server if it is not running, then open the browser
//   launcher.js --background  the same without the browser (Windows startup)
//   launcher.js --serve       the server itself (started hidden by the two above)
// The data lives in %LOCALAPPDATA%\NutriAye (base, daily copies, log), never in
// the program folder: reinstalling or updating does not touch it. The first
// run copies the starting database (seed\database.sqlite).
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PORT = Number(process.env.NUTRI_AYE_PORT) || 3001; // another port only if 3001 is taken
const URL = `http://127.0.0.1:${PORT}`;
const ROOT = __dirname;
const DATA = path.join(process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local'), 'NutriAye');
const DB = path.join(DATA, 'database.sqlite');
const LOG = path.join(DATA, 'servidor.log');

// Is a Nutri Aye already answering on the port?
const running = () => new Promise(resolve => {
    const req = http.get(`${URL}/api/auth/status`, { timeout: 1500 }, res => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
});

const openBrowser = () => spawn('cmd', ['/c', 'start', '', URL], { detached: true, stdio: 'ignore', windowsHide: true }).unref();

function serve() {
    fs.mkdirSync(DATA, { recursive: true });
    if (!fs.existsSync(DB)) fs.copyFileSync(path.join(ROOT, 'seed', 'database.sqlite'), DB);
    Object.assign(process.env, {
        NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(PORT),
        DB_PATH: DB, BACKUP_DIR: path.join(DATA, 'respaldos')
    });
    require('./backend/server').main();
}

async function start({ browser }) {
    if (!(await running())) {
        fs.mkdirSync(DATA, { recursive: true });
        // Every request is logged: past 5 MB the log becomes servidor.log.1 (one old copy)
        if (fs.existsSync(LOG) && fs.statSync(LOG).size > 5 * 1024 * 1024) fs.renameSync(LOG, `${LOG}.1`);
        const log = fs.openSync(LOG, 'a');
        spawn(process.execPath, [__filename, '--serve'], { cwd: ROOT, detached: true, stdio: ['ignore', log, log], windowsHide: true }).unref();
        // Up to 60 s: the first run copies the database and applies the migrations
        let up = false;
        for (let i = 0; i < 120 && !up; i++) {
            await new Promise(r => setTimeout(r, 500));
            up = await running();
        }
        if (!up) {
            spawn('notepad', [LOG], { detached: true, stdio: 'ignore' }).unref(); // shows why it did not start
            process.exit(1);
        }
    }
    if (browser) openBrowser();
}

if (process.argv.includes('--serve')) serve();
else start({ browser: !process.argv.includes('--background') });
