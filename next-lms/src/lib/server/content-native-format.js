import fs from 'fs';
import path from 'path';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mov', '.m4v']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf']);

const YOUTUBE_PATTERN = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
const QUIZ_HINT_PATTERN = /(quiz|question|assessment|exam|test|pre[-_\s]?test|post[-_\s]?test|แบบทดสอบ|ข้อสอบ)/i;
const VIDEO_TAG_PATTERN = /<video[\s>]/i;
const AUDIO_TAG_PATTERN = /<audio[\s>]/i;

function inferTypeFromHtml(html = '') {
    const snippet = String(html || '').slice(0, 256000);

    if (YOUTUBE_PATTERN.test(snippet)) {
        return { activityType: 'youtube', activityProvider: 'youtube' };
    }

    if (VIDEO_TAG_PATTERN.test(snippet)) {
        return { activityType: 'video', activityProvider: 'html5' };
    }

    if (AUDIO_TAG_PATTERN.test(snippet)) {
        return { activityType: 'audio', activityProvider: 'html5' };
    }

    const hasFormControls = /<(input|button|select|textarea)[\s>]/i.test(snippet);
    if (hasFormControls && QUIZ_HINT_PATTERN.test(snippet)) {
        return { activityType: 'quiz', activityProvider: 'html' };
    }

    return { activityType: 'legacy' };
}

export function detectNativeActivityFormat(absoluteLaunchPath = '') {
    const filePath = String(absoluteLaunchPath || '').trim();
    if (!filePath) return { activityType: 'legacy' };

    const ext = path.extname(filePath).toLowerCase();

    if (VIDEO_EXTENSIONS.has(ext)) {
        return { activityType: 'video', activityProvider: 'file' };
    }

    if (AUDIO_EXTENSIONS.has(ext)) {
        return { activityType: 'audio', activityProvider: 'file' };
    }

    if (DOCUMENT_EXTENSIONS.has(ext)) {
        return { activityType: 'document', activityProvider: 'file' };
    }

    if (ext === '.html' || ext === '.htm') {
        try {
            const html = fs.readFileSync(filePath, 'utf8');
            return inferTypeFromHtml(html);
        } catch {
            return { activityType: 'legacy' };
        }
    }

    return { activityType: 'legacy' };
}

export default detectNativeActivityFormat;
