#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function parseArgs(argv = []) {
    const args = { file: '', force: false };
    for (let i = 0; i < argv.length; i += 1) {
        const token = String(argv[i] || '').trim();
        if (!token) continue;
        if (token === '--force') {
            args.force = true;
            continue;
        }
        if ((token === '--file' || token === '-f') && argv[i + 1]) {
            args.file = String(argv[i + 1]);
            i += 1;
            continue;
        }
        if (!args.file && !token.startsWith('-')) {
            args.file = token;
        }
    }
    return args;
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

function promptConfirm(message) {
    return new Promise((resolve) => {
        process.stdout.write(`${message} Type "YES" to continue: `);
        process.stdin.setEncoding('utf8');
        process.stdin.once('data', (input) => {
            resolve(String(input || '').trim() === 'YES');
        });
    });
}

async function run() {
    const args = parseArgs(process.argv.slice(2));
    const cfg = getDbConfig();
    const filePath = path.resolve(args.file || '');
    if (!args.file) {
        throw new Error('Usage: npm run restore:db -- --file ./backups/your-dump.sql');
    }
    if (!fs.existsSync(filePath)) {
        throw new Error(`Backup file not found: ${filePath}`);
    }

    if (!args.force) {
        const ok = await promptConfirm(`[restore] this will overwrite data in "${cfg.database}".`);
        if (!ok) {
            console.log('[restore] cancelled');
            process.exit(0);
        }
    }

    const mysqlArgs = [
        `--host=${cfg.host}`,
        `--port=${cfg.port}`,
        `--user=${cfg.user}`,
        cfg.database,
    ];

    console.log(`[restore] restoring "${filePath}" into "${cfg.database}"`);
    const mysql = spawn('mysql', mysqlArgs, {
        env: {
            ...process.env,
            MYSQL_PWD: cfg.password,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    const inStream = fs.createReadStream(filePath);
    inStream.pipe(mysql.stdin);

    mysql.stdout.on('data', (chunk) => {
        process.stdout.write(chunk);
    });
    mysql.stderr.on('data', (chunk) => {
        process.stderr.write(chunk);
    });

    mysql.on('close', (code) => {
        if (code !== 0) {
            console.error(`[restore] failed with exit code ${code}`);
            process.exit(code || 1);
            return;
        }
        console.log('[restore] completed');
    });

    mysql.on('error', (err) => {
        console.error('[restore] unable to run mysql client. Ensure MySQL client tools are installed.');
        console.error(err?.message || err);
        process.exit(1);
    });
}

run().catch((err) => {
    console.error('[restore] error:', err?.message || err);
    process.exit(1);
});

