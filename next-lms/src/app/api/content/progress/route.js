import { NextResponse } from 'next/server';
import {
    listLearningProgress,
    upsertLearningProgress,
} from '@/lib/server/learning-db';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';

/**
 * GET - Get progress for a specific content/user
 */
export async function GET(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const contentId = searchParams.get('contentId');
        const sectionIdRaw = searchParams.get('sectionId');
        const numericSectionId = Number(sectionIdRaw);
        const sectionId = Number.isInteger(numericSectionId) && numericSectionId > 0
            ? numericSectionId
            : null;
        const userId = session.user.username || session.user.email || String(session.uid);
        const progressData = await listLearningProgress({ contentId, userKey: userId, sectionId });

        return NextResponse.json(progressData);
    } catch (err) {
        console.error('[content/progress][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST - Update or create progress entry
 */
export async function POST(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const { contentId, sectionId: sectionIdRaw, status, progress, currentTime, duration, scoreRaw, scoreScaled, success, completion } = body;
        const numericSectionId = Number(sectionIdRaw);
        const sectionId = Number.isInteger(numericSectionId) && numericSectionId > 0
            ? numericSectionId
            : null;

        if (!contentId) {
            return NextResponse.json({ error: 'contentId is required' }, { status: 400 });
        }

        const { row, reason } = await upsertLearningProgress({
            contentId,
            userKey: session.user.username || session.user.email || String(session.uid),
            sectionId,
            status,
            progress,
            currentTime,
            duration,
            scoreRaw,
            scoreScaled,
            success,
            completion,
        });

        if (!row) {
            const reasonConfig = {
                ENROLLMENT_REQUIRED: { status: 403, error: 'Enrollment required' },
                USER_NOT_FOUND: { status: 404, error: 'User not found' },
                COURSE_NOT_FOUND: { status: 404, error: 'Course not found' },
                SECTION_NOT_FOUND: { status: 404, error: 'Section not found' },
                COURSE_INACTIVE: { status: 403, error: 'Course is inactive' },
                SECTION_INACTIVE: { status: 403, error: 'Section is inactive' },
                LEARN_WINDOW_EXPIRED: { status: 403, error: 'Learning period expired' },
                LEARNING_ACCESS_DENIED: { status: 403, error: 'Learning access denied' },
            };
            const mapped = reasonConfig[reason] || { status: 400, error: 'Unable to update progress' };
            return NextResponse.json(
                { success: false, reason, error: mapped.error },
                { status: mapped.status }
            );
        }

        return NextResponse.json({ success: Boolean(row), reason, entry: row });
    } catch (err) {
        console.error('[content/progress][POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
