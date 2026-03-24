import { PrismaClient } from '@/generated/prisma-v2/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = globalThis;

function getMariaDbConfig() {
    const explicitHost = String(process.env.DB_HOST || '').trim();
    const explicitPort = String(process.env.DB_PORT || '').trim();
    const explicitUser = String(process.env.DB_USER || '').trim();
    const explicitPassword = process.env.DB_PASSWORD;
    const explicitDbName = String(process.env.DB_NAME || '').trim();

    // Prefer explicit DB_* envs in containers to avoid URL parsing edge-cases.
    if (explicitHost || explicitUser || explicitPassword !== undefined || explicitDbName) {
        return {
            host: explicitHost || '127.0.0.1',
            port: Number(explicitPort || '3306'),
            user: explicitUser || 'root',
            password: explicitPassword || '',
            database: explicitDbName || 'lms_enterprise',
            // Needed for MySQL 8+ auth (caching_sha2_password) when using mariadb connector.
            allowPublicKeyRetrieval: true,
            connectionLimit: 10,
            connectTimeout: 10000,
            acquireTimeout: 30000,
        };
    }

    const databaseUrl = String(process.env.DATABASE_URL || '').trim();
    if (databaseUrl) {
        try {
            const url = new URL(databaseUrl);
            return {
                host: url.hostname || '127.0.0.1',
                port: Number(url.port || '3306'),
                user: decodeURIComponent(url.username || 'root'),
                password: decodeURIComponent(url.password || ''),
                database: url.pathname.replace(/^\//, '') || 'lms_enterprise',
                // Needed for MySQL 8+ auth (caching_sha2_password) when using mariadb connector.
                allowPublicKeyRetrieval: true,
                connectionLimit: 10,
                connectTimeout: 10000,
                acquireTimeout: 30000,
            };
        } catch (err) {
            console.error('[prisma] Invalid DATABASE_URL, falling back to defaults', err);
        }
    }

    return {
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: '',
        database: 'lms_enterprise',
        allowPublicKeyRetrieval: true,
        connectionLimit: 10,
        connectTimeout: 10000,
        acquireTimeout: 30000,
    };
}

const adapter = globalForPrisma.__adapter ?? new PrismaMariaDb(getMariaDbConfig());

function normalizeBigInts(value) {
    if (typeof value === 'bigint') {
        const asNumber = Number(value);
        return Number.isSafeInteger(asNumber) ? asNumber : String(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => normalizeBigInts(item));
    }
    if (value && typeof value === 'object') {
        if (value instanceof Date) return value;
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) {
            return value;
        }
        const next = {};
        for (const [key, item] of Object.entries(value)) {
            next[key] = normalizeBigInts(item);
        }
        return next;
    }
    return value;
}

const cachedPrisma = globalForPrisma.__prisma;
const shouldRecreateClient =
    !cachedPrisma ||
    typeof cachedPrisma.user === 'undefined' ||
    typeof cachedPrisma.organizations === 'undefined';

const prismaBase = shouldRecreateClient ? new PrismaClient({ adapter }) : cachedPrisma;
const prisma = shouldRecreateClient
    ? prismaBase.$extends({
        query: {
            $allOperations: async ({ args, query }) => {
                const result = await query(args);
                return normalizeBigInts(result);
            },
        },
    })
    : prismaBase;

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__adapter = adapter;
    globalForPrisma.__prisma = prisma;
}

export default prisma;
