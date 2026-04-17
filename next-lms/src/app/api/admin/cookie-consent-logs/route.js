import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { listCookieConsentLogs } from '@/lib/server/cookie-consent';

function toCsvValue(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function toCsv(items = []) {
    const header = [
        'Date/Time',
        'Consent ID',
        'User ID',
        'Username',
        'Email',
        'Choice',
        'Analytics',
        'Marketing',
        'Policy Version',
        'Source',
        'IP',
        'User Agent',
    ];

    const rows = items.map((row) => ([
        row.createdAt || '',
        row.consentId || '',
        row.userId ?? '',
        row.username || '',
        row.email || '',
        row.choice || '',
        row.categories?.analytics ? 'yes' : 'no',
        row.categories?.marketing ? 'yes' : 'no',
        row.policyVersion || '',
        row.source || '',
        row.requestedIp || '',
        row.userAgent || '',
    ]));

    return [header, ...rows]
        .map((line) => line.map(toCsvValue).join(','))
        .join('\n');
}

export async function GET(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const format = String(searchParams.get('format') || '').trim().toLowerCase();
        const exportAll = format === 'csv' || searchParams.get('all') === '1';

        const result = await listCookieConsentLogs({
            page: Number(searchParams.get('page') || 1),
            limit: Number(searchParams.get('limit') || (exportAll ? 5000 : 20)),
            choice: searchParams.get('choice') || '',
            source: searchParams.get('source') || '',
            policyVersion: searchParams.get('policyVersion') || '',
            search: searchParams.get('search') || '',
            dateFrom: searchParams.get('dateFrom') || '',
            dateTo: searchParams.get('dateTo') || '',
            exportAll,
        });

        if (format === 'csv') {
            const csv = toCsv(result.items || []);
            const filename = `cookie-consent-logs-${Date.now()}.csv`;
            return new NextResponse(`\uFEFF${csv}`, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Cache-Control': 'no-store',
                },
            });
        }

        return NextResponse.json(result);
    } catch (err) {
        console.error('[admin/cookie-consent-logs/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
