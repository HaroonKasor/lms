import { NextResponse } from 'next/server';

function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}

export async function readJsonBody(request, options = {}) {
    const { requireObject = true, enforceJsonContentType = true } = options;

    const contentType = String(request?.headers?.get('content-type') || '').toLowerCase();
    if (enforceJsonContentType && !contentType.includes('application/json')) {
        return {
            data: null,
            response: jsonError('Content-Type must be application/json', 415),
        };
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return {
            data: null,
            response: jsonError('Invalid JSON body', 400),
        };
    }

    if (requireObject && (!body || Array.isArray(body) || typeof body !== 'object')) {
        return {
            data: null,
            response: jsonError('JSON body must be an object', 400),
        };
    }

    return { data: body, response: null };
}
