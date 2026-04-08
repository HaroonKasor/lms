import { buildAttemptSectionsFromStatements } from './attempt-report-time';

function makeStatement({
    timestamp,
    verbId,
    objectId = 'https://example.com/activity/default',
    title = 'Lesson A',
    activityId = '',
    activityName = '',
}) {
    const contextExtensions = {};
    if (activityId) contextExtensions['https://lms.local/extensions/activity-id'] = activityId;
    if (activityName) contextExtensions['https://lms.local/extensions/activity-name'] = activityName;

    return {
        statement_json: {
            timestamp,
            verb: { id: verbId },
            object: {
                id: objectId,
                definition: {
                    name: {
                        'en-US': title,
                    },
                },
            },
            context: {
                extensions: contextExtensions,
            },
        },
        receivedAt: timestamp,
    };
}

describe('attempt report time builder', () => {
    it('computes study duration from timestamp gaps for a single attempt', () => {
        const rows = [
            makeStatement({
                timestamp: '2026-04-08T10:00:00.000Z',
                verbId: 'http://adlnet.gov/expapi/verbs/experienced',
            }),
            makeStatement({
                timestamp: '2026-04-08T10:00:05.000Z',
                verbId: 'https://w3id.org/xapi/video/verbs/played',
            }),
            makeStatement({
                timestamp: '2026-04-08T10:00:15.000Z',
                verbId: 'https://w3id.org/xapi/video/verbs/paused',
            }),
            makeStatement({
                timestamp: '2026-04-08T10:00:25.000Z',
                verbId: 'http://adlnet.gov/expapi/verbs/completed',
            }),
        ];

        const sections = buildAttemptSectionsFromStatements(rows);
        expect(sections).toHaveLength(1);
        expect(sections[0].title).toBe('Lesson A');
        expect(sections[0].records).toHaveLength(1);
        expect(sections[0].records[0].duration).toBe('0.42');
    });

    it('splits attempts when experienced appears again for the same activity', () => {
        const rows = [
            makeStatement({
                timestamp: '2026-04-08T10:00:00.000Z',
                verbId: 'http://adlnet.gov/expapi/verbs/experienced',
            }),
            makeStatement({
                timestamp: '2026-04-08T10:00:10.000Z',
                verbId: 'https://w3id.org/xapi/video/verbs/played',
            }),
            makeStatement({
                timestamp: '2026-04-08T10:00:40.000Z',
                verbId: 'http://adlnet.gov/expapi/verbs/experienced',
            }),
            makeStatement({
                timestamp: '2026-04-08T10:01:10.000Z',
                verbId: 'http://adlnet.gov/expapi/verbs/completed',
            }),
        ];

        const sections = buildAttemptSectionsFromStatements(rows);
        expect(sections).toHaveLength(1);
        expect(sections[0].records).toHaveLength(2);
        expect(sections[0].records[0].duration).toBe('0.67');
        expect(sections[0].records[1].duration).toBe('0.50');
    });

    it('ignores end-only statements without a start event', () => {
        const rows = [
            makeStatement({
                timestamp: '2026-04-08T10:00:00.000Z',
                verbId: 'http://adlnet.gov/expapi/verbs/completed',
            }),
        ];

        const sections = buildAttemptSectionsFromStatements(rows);
        expect(sections).toHaveLength(1);
        expect(sections[0].records).toHaveLength(0);
    });

    it('caps a single time gap to one hour like Java reference logic', () => {
        const rows = [
            makeStatement({
                timestamp: '2026-04-08T10:00:00.000Z',
                verbId: 'http://adlnet.gov/expapi/verbs/experienced',
            }),
            makeStatement({
                timestamp: '2026-04-08T12:00:00.000Z',
                verbId: 'https://w3id.org/xapi/video/verbs/paused',
            }),
            makeStatement({
                timestamp: '2026-04-08T12:01:00.000Z',
                verbId: 'http://adlnet.gov/expapi/verbs/completed',
            }),
        ];

        const sections = buildAttemptSectionsFromStatements(rows);
        expect(sections).toHaveLength(1);
        expect(sections[0].records).toHaveLength(1);
        expect(sections[0].records[0].duration).toBe('61.00');
    });

    it('separates sections by context activity-id even with same lesson title', () => {
        const rows = [
            makeStatement({
                timestamp: '2026-04-08T10:00:00.000Z',
                verbId: 'http://adlnet.gov/expapi/verbs/experienced',
                title: 'Same Name',
                activityId: 'lesson-1',
                activityName: 'Lesson 1',
            }),
            makeStatement({
                timestamp: '2026-04-08T10:00:10.000Z',
                verbId: 'http://adlnet.gov/expapi/verbs/completed',
                title: 'Same Name',
                activityId: 'lesson-1',
                activityName: 'Lesson 1',
            }),
            makeStatement({
                timestamp: '2026-04-08T10:01:00.000Z',
                verbId: 'http://adlnet.gov/expapi/verbs/experienced',
                title: 'Same Name',
                activityId: 'lesson-2',
                activityName: 'Lesson 2',
            }),
            makeStatement({
                timestamp: '2026-04-08T10:01:20.000Z',
                verbId: 'http://adlnet.gov/expapi/verbs/completed',
                title: 'Same Name',
                activityId: 'lesson-2',
                activityName: 'Lesson 2',
            }),
        ];

        const sections = buildAttemptSectionsFromStatements(rows);
        expect(sections).toHaveLength(2);
        expect(sections[0].title).toBe('Lesson 1');
        expect(sections[1].title).toBe('Lesson 2');
        expect(sections[0].records[0].duration).toBe('0.17');
        expect(sections[1].records[0].duration).toBe('0.33');
    });
});
