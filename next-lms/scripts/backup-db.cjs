#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function parseArgs(argv = []) {
    const args = { out: '', gzip: false };
    for (let i = 0; i < argv.length; i += 1) {
        const token = String(argv[i] || '').trim();
        if (!token) continue;
        if (token === '--gzip') {
            args.gzip = true;
            continue;
        }
        if ((token === '--out' || token === '-o') && argv[i + 1]) {
            args.out = String(argv[i + 1]);
            i += 1;
        }
    }
    return args;
}

function nowStamp() {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function getDbConfig() {
    return {
        host: process.env.DB_HOST || '127.0.0.1',
        port: String(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'lms_enterprise',
    };
}

function run() {
    const args = parseArgs(process.argv.slice(2));
    const cfg = getDbConfig();
    if (!cfg.database) {
        throw new Error('Missing DB_NAME');
    }

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const defaultName = `${cfg.database}-${nowStamp()}.sql`;
    const outFile = path.resolve(args.out || path.join(backupDir, defaultName));
    const outStream = fs.createWriteStream(outFile, { flags: 'w' });

    const dumpArgs = [
        `--host=${cfg.host}`,
        `--port=${cfg.port}`,
        `--user=${cfg.user}`,
        '--single-transaction',
        '--quick',
        '--routines',
        '--events',
        '--triggers',
        cfg.database,
    ];

    console.log(`[backup] creating dump for "${cfg.database}" -> ${outFile}`);
    const child = spawn('mysqldump', dumpArgs, {
        env: {
            ...process.env,
            MYSQL_PWD: cfg.password,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.pipe(outStream);
    child.stderr.on('data', (chunk) => {
        process.stderr.write(chunk);
    });

    child.on('close', (code) => {
        outStream.end();
        if (code !== 0) {
            console.error(`[backup] failed with exit code ${code}`);
            process.exit(code || 1);
            return;
        }
        console.log('[backup] completed');
        if (args.gzip) {
            console.log('[backup] tip: run your preferred gzip tool on the output file if needed');
        }
    });

    child.on('error', (err) => {
        outStream.end();
        console.error('[backup] unable to run mysqldump. Ensure MySQL client tools are installed.');
        console.error(err?.message || err);
        process.exit(1);
    });
}

try {
    run();
} catch (err) {
    console.error('[backup] error:', err?.message || err);
    process.exit(1);
}

