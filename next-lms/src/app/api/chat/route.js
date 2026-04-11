import { GoogleGenerativeAI } from "@google/generative-ai";
import * as YoutubeTranscriptPkg from "youtube-transcript";
import { getRequestIp, requireSession } from "@/lib/server/auth";
import { createStructuredChatLog } from "@/lib/server/chat-logs";
import { buildPromptTuningHints } from "@/lib/server/chat-feedback";
import { buildMyLearningSummary } from "@/lib/server/my-learning-summary";
import { logMyLearningSummaryAccess } from "@/lib/server/my-learning-summary-audit";
import { buildAboutSkillupResponse, isAboutSkillupIntent } from "@/lib/server/skillup-profile";
import { ensureDefaultOrganization } from "@/lib/server/enterprise-context";
import { buildKnowledgePromptBlock, retrieveKnowledgeContext } from "@/lib/server/chat-kb";
import { buildSafetyReply, detectPromptInjection, evaluateRateLimit, evaluateSpam } from "@/lib/server/chat-safety";

const SYSTEM_PROMPT = `คุณคือ "SkillBot" ผู้ช่วย AI ของแพลตฟอร์มการเรียนรู้ SkillUp LMS
หน้าที่ของคุณคือ:
- ช่วยตอบคำถามเกี่ยวกับบทเรียนและเนื้อหาในคอร์ส
- แนะนำวิธีการเรียนรู้ที่มีประสิทธิภาพ
- อธิบายแนวคิดที่ผู้เรียนไม่เข้าใจ
- ให้กำลังใจและสนับสนุนผู้เรียน
- ช่วยแก้ปัญหาที่เกี่ยวข้องกับการใช้งานระบบ LMS

ตอบภาษาเดียวกับที่ผู้ใช้ถาม (ไทยตอบไทย, อังกฤษตอบอังกฤษ)
ตอบกระชับ ชัดเจน และเป็นมิตร
- หากคำถามเกี่ยวข้องกับข้อมูลผู้ใช้ ให้ตอบโดยอิงข้อมูลของผู้ใช้ที่ร้องขอเท่านั้น และห้ามเปิดเผยข้อมูลของผู้ใช้อื่น`;

const MODEL_CANDIDATES = [
    // Keep broadly available and currently supported models first.
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
];
const OPENROUTER_DEFAULT_MODEL = "openai/gpt-4o-mini";
const GROQ_DEFAULT_MODEL = "llama-3.1-8b-instant";
const ASSESSMENT_TITLE_PATTERN = /(quiz|exam|test|assessment|แบบทดสอบ|ข้อสอบ|post[- ]?test|pre[- ]?test|midterm|final)/i;
const VIDEO_TRANSCRIPT_INTENT_PATTERN = /(video_summary|video_explain|youtube_summary|youtube_explain)/i;
const TRANSCRIPT_REQUEST_PATTERN = /(summarize|summary|transcript|video|clip|explain this lesson|สรุป|สรุปบท|ซับ|ถอดความ|คลิป|วิดีโอ|อธิบายบทนี้|ไม่เข้าใจบทนี้)/i;
const DIRECT_ANSWER_REQUEST_PATTERN = /(คำตอบที่ถูก|เฉลย|ตอบข้อไหน|ตัวเลือกที่ถูก|ข้อที่ถูก|answer\s*(is|=)|correct answer|which option|choose (a|b|c|d)|เลือกข้อ|เลือกตัวเลือก|ระหว่าง\s*[กขคงabcd]|(?:[กขคง]\.|[a-d][\.\)])[\s\S]{0,160}(?:[กขคง]\.|[a-d][\.\)]))/i;
const DIRECT_ANSWER_RESPONSE_PATTERN = /(คำตอบที่ถูก|เฉลยคือ|ตอบที่|correct answer|answer is|ตัวเลือกที่ถูก|ดังนั้นคำตอบ|ข้อตอบ)/i;
const LEARNING_PROGRESS_INTENT_PATTERN = /(ความคืบหน้า|สถานะการเรียน|เรียนไปกี่|กี่เปอร์เซ็น|กี่ %|เรียนจบ|จบยัง|คอร์สที่เรียน|วิชาที่เรียน|progress|completion|completed|finished|how much.*learn|my course status|enroll(?:ed|ment)? status)/i;
const COURSE_DETAIL_INTENT_PATTERN = /(คอร์สนี้|บทนี้|หน้านี้|current course|current lesson|course detail|lesson detail|ฉันกำลังเรียนอะไร|what course am i on|what lesson am i on)/i;
const YOUTUBE_HOST_PATTERN = /(?:youtube\.com|youtu\.be)/i;
const TRANSCRIPT_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const MAX_TRANSCRIPT_CHARS = 12000;
const ENROLLMENT_STATUS_RANK = {
    COMPLETED: 5,
    LEARNING: 4,
    APPROVED: 3,
    PENDING: 2,
    FAILED: 1,
    CANCELLED: 0,
};
const MAX_LESSON_OUTLINE_ITEMS = 30;
const MAX_CONTEXT_TEXT_LENGTH = 200;
const INTENT_CONFIDENCE_THRESHOLD = 0.56;
const STREAM_CHUNK_SIZE = 90;

function prefersThai(text = "") {
    return /[\u0E00-\u0E7F]/.test(String(text || ""));
}

function buildClarificationReply(message = "") {
    const thai = prefersThai(message);
    if (thai) {
        return `ผมอยากตอบให้ตรงที่สุดครับ แต่คำถามนี้ยังกว้างอยู่เล็กน้อย

ต้องการให้ช่วยด้านไหน:
1) สรุปสถานะการเรียนของฉัน (my-learning)
2) สรุปบท/คอร์สที่กำลังเปิดอยู่ (course-detail)
3) ช่วยแบบ hint only สำหรับแบบทดสอบ (quiz-hint-only)
4) ข้อมูลเกี่ยวกับ SkillUp และทีม (about-skillup)

พิมพ์หมายเลขหรือพิมพ์ชื่อหัวข้อได้เลยครับ`;
    }
    return `I want to answer accurately, but your request is a bit ambiguous.

Which one do you want?
1) My learning status summary
2) Current course/lesson summary
3) Quiz hint-only help
4) About SkillUp project/team

Reply with a number or topic name.`;
}

function splitTextForStreaming(text = "", chunkSize = STREAM_CHUNK_SIZE) {
    const raw = String(text || "");
    if (!raw) return [];
    const safeSize = Math.max(40, Math.min(220, Number(chunkSize || STREAM_CHUNK_SIZE)));
    const chunks = [];
    let cursor = 0;
    while (cursor < raw.length) {
        const next = raw.slice(cursor, cursor + safeSize);
        chunks.push(next);
        cursor += safeSize;
    }
    return chunks;
}

function buildStreamResponse({ content = "", meta = {} } = {}) {
    const encoder = new TextEncoder();
    const chunks = splitTextForStreaming(content);
    const stream = new ReadableStream({
        async start(controller) {
            try {
                for (const chunk of chunks) {
                    const line = JSON.stringify({ type: "delta", text: chunk });
                    controller.enqueue(encoder.encode(`${line}\n`));
                    // Let browser render progressively.
                    await new Promise((resolve) => setTimeout(resolve, 8));
                }
                const finalLine = JSON.stringify({ type: "final", meta });
                controller.enqueue(encoder.encode(`${finalLine}\n`));
            } catch (error) {
                const line = JSON.stringify({ type: "error", error: String(error?.message || "stream_error") });
                controller.enqueue(encoder.encode(`${line}\n`));
            } finally {
                controller.close();
            }
        },
    });
    return new Response(stream, {
        status: 200,
        headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}

function resolveSummaryCacheTtlMs() {
    const raw = Number(process.env.MY_LEARNING_SUMMARY_CACHE_TTL_MS || "");
    if (!Number.isFinite(raw) || raw <= 0) return 45 * 1000;
    return Math.max(30 * 1000, Math.min(60 * 1000, Math.floor(raw)));
}

function extractErrorStatus(err) {
    const status = Number(err?.status || err?.httpStatusCode || err?.code || 0);
    return Number.isFinite(status) ? status : 0;
}

function buildModelCandidates() {
    const preferred = String(process.env.GEMINI_MODEL || "").trim();
    const merged = preferred ? [preferred, ...MODEL_CANDIDATES] : MODEL_CANDIDATES;
    return Array.from(new Set(merged.filter(Boolean)));
}

function buildOpenRouterConfig() {
    const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
    if (!apiKey) return null;
    const baseUrl = String(process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1")
        .trim()
        .replace(/\/+$/, "");
    const model = String(process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL).trim();
    const appUrl = String(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
    const appName = String(process.env.APP_NAME || "SkillUp LMS").trim();
    return { apiKey, baseUrl, model, appUrl, appName };
}

function buildGroqConfig() {
    const apiKey = String(process.env.GROQ_API_KEY || "").trim();
    if (!apiKey) return null;
    const baseUrl = String(process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1")
        .trim()
        .replace(/\/+$/, "");
    const model = String(process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL).trim();
    return { apiKey, baseUrl, model };
}

function getTranscriptCacheStore() {
    if (!globalThis.__skillupYoutubeTranscriptCache) {
        globalThis.__skillupYoutubeTranscriptCache = new Map();
    }
    return globalThis.__skillupYoutubeTranscriptCache;
}

function extractYouTubeVideoId(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

    try {
        const parsed = new URL(raw);
        const host = String(parsed.hostname || "").toLowerCase();
        if (host.includes("youtu.be")) {
            const id = parsed.pathname.split("/").filter(Boolean)[0] || "";
            return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
        }
        if (host.includes("youtube.com")) {
            const fromQuery = String(parsed.searchParams.get("v") || "").trim();
            if (/^[a-zA-Z0-9_-]{11}$/.test(fromQuery)) return fromQuery;
            const pathParts = parsed.pathname.split("/").filter(Boolean);
            const embedIdx = pathParts.findIndex((part) => part === "embed" || part === "shorts" || part === "live");
            if (embedIdx >= 0 && pathParts[embedIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(pathParts[embedIdx + 1])) {
                return pathParts[embedIdx + 1];
            }
        }
    } catch {
        return "";
    }
    return "";
}

function resolveYouTubeSource(context = {}) {
    const candidates = [
        context?.lessonSrc,
        context?.youtubeUrl,
        context?.videoUrl,
    ];
    for (const candidate of candidates) {
        const value = String(candidate || "").trim();
        if (!value) continue;
        if (YOUTUBE_HOST_PATTERN.test(value) || /^[a-zA-Z0-9_-]{11}$/.test(value)) {
            return value;
        }
    }
    return "";
}

function shouldUseTranscript(context = {}, lastMessageText = "") {
    if (context?.useVideoTranscript === true) return true;
    const intent = String(context?.intent || "").trim().toLowerCase();
    if (VIDEO_TRANSCRIPT_INTENT_PATTERN.test(intent)) return true;
    return TRANSCRIPT_REQUEST_PATTERN.test(String(lastMessageText || ""));
}

async function getYoutubeTranscriptText(youtubeSource) {
    const videoId = extractYouTubeVideoId(youtubeSource);
    if (!videoId) return null;

    const cache = getTranscriptCacheStore();
    const now = Date.now();
    const cached = cache.get(videoId);
    if (cached && now - Number(cached.fetchedAt || 0) <= TRANSCRIPT_CACHE_TTL_MS) {
        return cached.text;
    }

    const fetchTranscriptFn = YoutubeTranscriptPkg.fetchTranscript
        || YoutubeTranscriptPkg.YoutubeTranscript?.fetchTranscript;
    if (typeof fetchTranscriptFn !== "function") return null;
    const rows = await fetchTranscriptFn(videoId);
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const merged = rows
        .map((row) => String(row?.text || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" ");
    const compact = merged.replace(/\s{2,}/g, " ").trim();
    if (!compact) return null;

    const text = compact.slice(0, MAX_TRANSCRIPT_CHARS);
    cache.set(videoId, { text, fetchedAt: now });
    return text;
}

function buildPromptWithTranscript(lastMessageText, transcriptText, lessonTitle = "") {
    if (!transcriptText) return lastMessageText;
    const titleLine = lessonTitle ? `บทเรียน: ${lessonTitle}\n` : "";
    return `ใช้ transcript วิดีโอนี้เป็นแหล่งอ้างอิงหลักในการตอบ และตอบให้อ่านง่ายสำหรับผู้เรียน
${titleLine}Transcript:
${transcriptText}

คำถามผู้ใช้:
${lastMessageText}`;
}

function shouldUseLearningProgressContext(context = {}, lastMessageText = "") {
    if (context?.intent === "my_learning_progress") return true;
    return LEARNING_PROGRESS_INTENT_PATTERN.test(String(lastMessageText || ""));
}

function buildPromptWithLearningSummary(basePrompt, summary) {
    if (!summary) return basePrompt;
    return `${basePrompt}

ข้อมูลสถานะการเรียนของผู้ใช้ปัจจุบันจาก backend (ใช้เฉพาะข้อมูลนี้ ห้ามเดาข้อมูลของผู้อื่น):
${JSON.stringify(summary)}

คำสั่งเพิ่มเติม:
- ตอบสถานะจากข้อมูลจริงใน JSON ด้านบนเท่านั้น
- ถ้าผู้ใช้ถามข้อมูลของคนอื่น ให้ปฏิเสธอย่างสุภาพ`;
}

function sanitizeContextText(value, maxLength = MAX_CONTEXT_TEXT_LENGTH) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeContextLessonOutline(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item, index) => {
            const title = sanitizeContextText(item?.title || item?.name || item, 180);
            if (!title) return null;
            const idx = Number(item?.index);
            const status = sanitizeContextText(item?.status || "", 40).toLowerCase();
            return {
                index: Number.isInteger(idx) && idx > 0 ? idx : index + 1,
                title,
                status,
            };
        })
        .filter(Boolean)
        .slice(0, MAX_LESSON_OUTLINE_ITEMS);
}

function buildLessonContextText(context = {}) {
    const courseTitle = sanitizeContextText(context?.courseTitle, 180);
    const sectionTitle = sanitizeContextText(context?.sectionTitle, 180);
    const lessonTitle = sanitizeContextText(context?.lessonTitle, 180);
    const lessonIndex = Number(context?.activeLessonIndex || 0);
    const totalLessons = Number(context?.totalLessons || 0);
    const outline = normalizeContextLessonOutline(context?.lessonOutline);
    const summary = [];

    if (courseTitle) summary.push(`คอร์สปัจจุบัน: ${courseTitle}`);
    if (sectionTitle) summary.push(`หัวข้อ/หน้าที่เปิด: ${sectionTitle}`);
    if (lessonTitle) summary.push(`บทที่กำลังเปิด: ${lessonTitle}`);
    if (Number.isInteger(lessonIndex) && lessonIndex > 0 && Number.isInteger(totalLessons) && totalLessons > 0) {
        summary.push(`ตำแหน่งบท: ${lessonIndex}/${totalLessons}`);
    }
    if (outline.length > 0) {
        const lessonList = outline
            .map((row) => `${row.index}. ${row.title}${row.status ? ` [${row.status}]` : ""}`)
            .join("\n");
        summary.push(`รายการบทเรียนในหน้านี้:\n${lessonList}`);
    }
    return summary.join("\n");
}

function buildPromptWithLessonContext(basePrompt, context = {}) {
    const lessonContextText = buildLessonContextText(context);
    if (!lessonContextText) return basePrompt;
    return `${basePrompt}

บริบทจากหน้าเรียนปัจจุบัน (เชื่อถือได้):
${lessonContextText}

คำสั่งเพิ่มเติม:
- ถ้าผู้ใช้ถามว่า "กำลังเรียนหลักสูตร/บทไหน" ให้ตอบจากบริบทด้านบนทันที
- ถ้าผู้ใช้ขอ "สรุปบทนี้/หน้านี้/คอร์สนี้" ให้ยึดบริบทด้านบนเป็นหลัก
- หากข้อมูลไม่พอ ให้บอกข้อจำกัดตามจริง แต่ยังตอบโดยอิงบริบทที่มีอยู่`;
}

function formatSummaryTimestamp(iso) {
    const date = new Date(iso || 0);
    if (Number.isNaN(date.getTime())) return "-";
    try {
        return new Intl.DateTimeFormat("th-TH", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Bangkok",
        }).format(date);
    } catch {
        return date.toISOString();
    }
}

function toThaiLearningStatus(status) {
    const key = String(status || "").toUpperCase();
    if (key === "COMPLETED") return "เรียนจบแล้ว";
    if (key === "LEARNING") return "กำลังเรียน";
    if (key === "APPROVED") return "พร้อมเริ่มเรียน";
    if (key === "PENDING") return "รออนุมัติ";
    if (key === "FAILED") return "ไม่ผ่าน";
    if (key === "CANCELLED") return "ยกเลิก";
    return "ไม่ระบุ";
}

function buildLearningProgressTableResponse(summary) {
    const totals = summary?.totals || {};
    const courses = Array.isArray(summary?.courses) ? summary.courses : [];
    const courseQuery = String(summary?.courseQuery || "").trim();
    const timestampText = formatSummaryTimestamp(summary?.lastUpdatedAt || summary?.generatedAt);
    const rows = courses
        .slice()
        .sort((a, b) => {
            const rankA = ENROLLMENT_STATUS_RANK[String(a?.status || "").toUpperCase()] ?? 0;
            const rankB = ENROLLMENT_STATUS_RANK[String(b?.status || "").toUpperCase()] ?? 0;
            if (rankB !== rankA) return rankB - rankA;
            return Number(b?.progressPercent || 0) - Number(a?.progressPercent || 0);
        })
        .slice(0, 20)
        .map((item) => {
            const courseName = String(item?.courseName || "-").replace(/\|/g, "/").trim() || "-";
            const status = toThaiLearningStatus(item?.status);
            const progress = Math.max(0, Math.min(100, Number(item?.progressPercent || 0)));
            return `| ${courseName} | ${status} | ${progress}% |`;
        });

    const header = [
        "สรุปความคืบหน้าการเรียนของคุณ",
        "",
        `ทั้งหมด ${Number(totals?.totalCourses || 0)} คอร์ส | จบแล้ว ${Number(totals?.completedCourses || 0)} | กำลังเรียน ${Number(totals?.learningCourses || 0)} | รออนุมัติ ${Number(totals?.pendingCourses || 0)} | เฉลี่ย ${Number(totals?.averageProgressPercent || 0)}%`,
        `อัปเดตล่าสุดเมื่อ: ${timestampText}`,
        courseQuery ? `ตัวกรองคอร์ส: ${courseQuery}` : "",
        "",
        "| คอร์ส | สถานะ | % |",
        "|---|---|---|",
    ].filter(Boolean);

    if (rows.length === 0) {
        return `${header.join("\n")}\n| - | - | 0% |`;
    }
    return `${header.join("\n")}\n${rows.join("\n")}`;
}

function extractCourseQuery(lastMessageText = "", context = {}) {
    const explicit = String(context?.courseQuery || "").trim();
    if (explicit) return explicit;

    const text = String(lastMessageText || "").trim();
    const patterns = [
        /(?:คอร์ส|วิชา)\s*[\"'“”]?([^\"'“”\n]+?)[\"'“”]?\s*(?:เหลือ|กี่|จบ|สถานะ|ไปถึง|เรียน)/i,
        /(?:course|subject)\s*[\"']?([^\"'\n]+?)[\"']?\s*(?:progress|status|completed|finish|left|how|is)/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        const candidate = String(match?.[1] || "").trim();
        if (candidate && candidate.length <= 120) return candidate;
    }
    return "";
}

function isAssessmentContext(context = {}) {
    const lessonTitle = String(context?.lessonTitle || "").trim();
    return Boolean(context?.isAssessment) || ASSESSMENT_TITLE_PATTERN.test(lessonTitle);
}

function buildNoAnswerPolicyReply() {
    return `ขอโทษครับ ฉันไม่สามารถเฉลยคำตอบหรือบอกตัวเลือกที่ถูกต้องโดยตรงในโหมดแบบทดสอบได้

แต่ฉันช่วยคุณผ่านโจทย์นี้ได้โดย:
1) อธิบายแนวคิดที่เกี่ยวข้อง
2) ตัดช้อยส์ที่ไม่น่าใช่ออกทีละข้อ
3) ให้ hint จนคุณหาคำตอบเองได้

พิมพ์ว่า "ขอ hint ทีละขั้น" ได้เลยครับ`;
}

function hasCourseDetailContext(context = {}) {
    return Boolean(
        String(context?.courseTitle || "").trim()
        || String(context?.lessonTitle || "").trim()
        || String(context?.sectionTitle || "").trim()
    );
}

function resolveIntentWithConfidence(context = {}, lastMessageText = "", assessmentMode = false) {
    const explicitIntent = String(context?.intent || "").trim().toLowerCase();
    if (explicitIntent === "my_learning_progress" || explicitIntent === "my_learning" || explicitIntent === "my_learning_summary") {
        return { intent: "my_learning", confidence: 0.98, ambiguous: false };
    }
    if (explicitIntent === "about_skillup") return { intent: "about_skillup", confidence: 0.98, ambiguous: false };
    if (explicitIntent === "course_detail") return { intent: "course_detail", confidence: 0.96, ambiguous: false };
    if (explicitIntent === "quiz_hint_only") return { intent: "quiz_hint_only", confidence: 0.98, ambiguous: false };
    if (assessmentMode) return { intent: "quiz_hint_only", confidence: 0.9, ambiguous: false };

    const hits = [];
    if (shouldUseLearningProgressContext(context, lastMessageText)) hits.push({ intent: "my_learning", score: 0.86 });
    if (isAboutSkillupIntent(lastMessageText, context)) hits.push({ intent: "about_skillup", score: 0.82 });
    if (hasCourseDetailContext(context) && COURSE_DETAIL_INTENT_PATTERN.test(lastMessageText)) {
        hits.push({ intent: "course_detail", score: 0.84 });
    }
    if (DIRECT_ANSWER_REQUEST_PATTERN.test(lastMessageText)) hits.push({ intent: "quiz_hint_only", score: 0.8 });

    if (hits.length === 0) {
        const shortMessage = String(lastMessageText || "").trim().length <= 30;
        return {
            intent: "general",
            confidence: shortMessage ? 0.4 : 0.62,
            ambiguous: shortMessage,
        };
    }

    hits.sort((a, b) => b.score - a.score);
    const top = hits[0];
    const second = hits[1];
    const ambiguous = Boolean(second && Math.abs(top.score - second.score) <= 0.08);
    return {
        intent: top.intent,
        confidence: top.score,
        ambiguous,
    };
}

function buildPromptWithIntentRouting(basePrompt, context = {}, intent = "general") {
    if (intent === "course_detail") {
        const courseTitle = sanitizeContextText(context?.courseTitle, 180);
        const lessonTitle = sanitizeContextText(context?.lessonTitle, 180);
        const sectionTitle = sanitizeContextText(context?.sectionTitle, 180);
        return `${basePrompt}

Intent ที่ตรวจพบ: course_detail
ข้อมูลที่เชื่อถือได้:
- Course: ${courseTitle || "-"}
- Section/Page: ${sectionTitle || "-"}
- Lesson: ${lessonTitle || "-"}

คำสั่งเพิ่มเติม:
- ตอบให้ชัดเจนว่าผู้ใช้กำลังอยู่คอร์ส/บทใดจากข้อมูลด้านบน
- หากผู้ใช้ขอสรุปบทปัจจุบัน ให้สรุปตามบริบทนี้ก่อนเสมอ`;
    }
    if (intent === "quiz_hint_only") {
        return `${basePrompt}

Intent ที่ตรวจพบ: quiz_hint_only
คำสั่งเพิ่มเติม:
- โหมดนี้ต้องให้ hint เท่านั้น
- ห้ามเฉลยคำตอบหรือบอกตัวเลือกที่ถูกต้องโดยตรง`;
    }
    return basePrompt;
}

function buildSystemInstruction(context = {}, options = {}) {
    const lessonTitle = sanitizeContextText(context?.lessonTitle, 180);
    const courseTitle = sanitizeContextText(context?.courseTitle, 180);
    const isAssessment = Boolean(options?.assessmentMode ?? isAssessmentContext(context));
    const lessonContextLine = lessonTitle ? `\n\nบริบทบทเรียนปัจจุบัน: ${lessonTitle}` : "";
    const courseContextLine = courseTitle ? `\nคอร์สปัจจุบัน: ${courseTitle}` : "";
    const weeklyFeedbackHints = String(options?.weeklyFeedbackHints || "").trim().slice(0, 2400);
    const assessmentRules = isAssessment
        ? `

เมื่ออยู่ในบททดสอบ/แบบฝึกหัด:
- ห้ามให้คำตอบสุดท้ายหรือบอกตัวเลือกที่ถูกต้องโดยตรง
- ให้เฉลยเชิงแนวคิด, วิธีคิดทีละขั้น, และ hint แทน
- ถ้าผู้ใช้ขอเฉลยตรง ๆ ให้ปฏิเสธอย่างสุภาพ แล้วช่วยชี้แนวทางแทน`
        : "";
    const tuningHints = weeklyFeedbackHints ? `\n\n${weeklyFeedbackHints}` : "";
    return `${SYSTEM_PROMPT}${courseContextLine}${lessonContextLine}${assessmentRules}${tuningHints}`;
}

function buildOpenRouterMessages(messages = [], finalMessageForModel = "", systemInstruction = "") {
    const history = messages
        .slice(0, -1)
        .map((msg) => {
            const role = msg?.role === "assistant" ? "assistant" : "user";
            const content = String(msg?.content || "").trim();
            if (!content) return null;
            return { role, content };
        })
        .filter(Boolean);

    const payload = [];
    if (systemInstruction) {
        payload.push({ role: "system", content: systemInstruction });
    }
    payload.push(...history);
    payload.push({ role: "user", content: String(finalMessageForModel || "").trim() });
    return payload;
}

async function generateWithOpenRouter({ config, messages, finalMessageForModel, systemInstruction }) {
    if (!config?.apiKey) {
        const err = new Error("OPENROUTER_API_KEY is not set");
        err.status = 503;
        throw err;
    }
    const endpoint = `${config.baseUrl}/chat/completions`;
    const requestBody = {
        model: config.model,
        messages: buildOpenRouterMessages(messages, finalMessageForModel, systemInstruction),
        temperature: 0.3,
    };

    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
    };
    if (config.appUrl) headers["HTTP-Referer"] = config.appUrl;
    if (config.appName) headers["X-Title"] = config.appName;

    const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errorText = String(
            data?.error?.message
            || data?.error
            || `OpenRouter request failed with status ${response.status}`
        );
        const err = new Error(errorText);
        err.status = response.status;
        throw err;
    }

    const text = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!text) {
        const err = new Error("OpenRouter returned empty response");
        err.status = 502;
        throw err;
    }
    return text;
}

async function generateWithGroq({ config, messages, finalMessageForModel, systemInstruction }) {
    if (!config?.apiKey) {
        const err = new Error("GROQ_API_KEY is not set");
        err.status = 503;
        throw err;
    }
    const endpoint = `${config.baseUrl}/chat/completions`;
    const requestBody = {
        model: config.model,
        messages: buildOpenRouterMessages(messages, finalMessageForModel, systemInstruction),
        temperature: 0.3,
    };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errorText = String(
            data?.error?.message
            || data?.error
            || `Groq request failed with status ${response.status}`
        );
        const err = new Error(errorText);
        err.status = response.status;
        throw err;
    }

    const text = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!text) {
        const err = new Error("Groq returned empty response");
        err.status = 502;
        throw err;
    }
    return text;
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { messages } = body;
        const context = body?.context && typeof body.context === "object" ? body.context : {};
        const streamRequested = body?.stream === true;
        const requestStartedAtMs = Date.now();
        const geminiApiKey = String(
            process.env.GEMINI_API_KEY
            || process.env.GOOGLE_API_KEY
            || process.env.NEXT_PUBLIC_GEMINI_API_KEY
            || ""
        ).trim();
        const openRouterConfig = buildOpenRouterConfig();
        const groqConfig = buildGroqConfig();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return Response.json({ error: "Messages are required" }, { status: 400 });
        }
        if (!geminiApiKey && !openRouterConfig && !groqConfig) {
            console.error("No AI provider configured (Gemini/OpenRouter/Groq)");
            return Response.json(
                { error: "AI ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ" },
                { status: 503 }
            );
        }
        const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

        const rawHistory = messages.slice(0, -1).map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        // Gemini requires the first history entry to have role 'user'
        const firstUserIndex = rawHistory.findIndex((h) => h.role === "user");
        const history = firstUserIndex >= 0 ? rawHistory.slice(firstUserIndex) : [];
        const lastMessage = messages[messages.length - 1];
        const lastMessageText = String(lastMessage?.content || "").trim();

        if (!lastMessageText) {
            return Response.json({ error: "Message content is required" }, { status: 400 });
        }
        const assessmentMode = isAssessmentContext(context);
        const intentResult = resolveIntentWithConfidence(context, lastMessageText, assessmentMode);
        const intent = intentResult.intent;
        const intentConfidence = Number(intentResult?.confidence || 0);
        const quizHintOnlyMode = assessmentMode || intent === "quiz_hint_only";

        let cachedSession = null;
        let hasLoadedSession = false;
        const getOptionalSession = async () => {
            if (hasLoadedSession) return cachedSession;
            hasLoadedSession = true;
            try {
                const { session } = await requireSession(request);
                cachedSession = session || null;
            } catch {
                cachedSession = null;
            }
            return cachedSession;
        };

        const writeChatLog = async ({
            assistantReply = "",
            provider = "rule",
            status = "ok",
            errorMessage = "",
            responseMs = 0,
        } = {}) => {
            try {
                const session = await getOptionalSession();
                if (!session) return;
                await createStructuredChatLog({
                    request,
                    session,
                    messages,
                    context: {
                        ...context,
                        intent,
                        pagePath: String(context?.pagePath || "").trim() || null,
                    },
                    intent,
                    provider,
                    status,
                    assistantReply,
                    errorMessage,
                    responseMs,
                    intentConfidence,
                });
            } catch (err) {
                console.warn("[chat] structured log failed", err?.message || err);
            }
        };

        const respondWithContent = async (content, provider = "rule") => {
            const responseMs = Math.max(0, Date.now() - requestStartedAtMs);
            const meta = {
                intent,
                intentConfidence,
                provider,
                responseMs,
            };
            await writeChatLog({
                assistantReply: content,
                provider,
                status: "ok",
                responseMs,
            });
            if (streamRequested) {
                return buildStreamResponse({ content, meta });
            }
            return Response.json({ content, meta });
        };

        const respondWithError = async (errorMessage, statusCode = 500, provider = "system") => {
            const responseMs = Math.max(0, Date.now() - requestStartedAtMs);
            await writeChatLog({
                assistantReply: "",
                provider,
                status: "error",
                errorMessage,
                responseMs,
            });
            return Response.json({ error: errorMessage }, { status: statusCode });
        };

        const sessionForSafety = await getOptionalSession();
        const actorUserId = Number(sessionForSafety?.uid || 0);
        const requestIp = getRequestIp(request);
        const rateResult = evaluateRateLimit({ userId: actorUserId, ip: requestIp });
        if (!rateResult.allowed) {
            return respondWithError(buildSafetyReply("rate_limit"), 429, "rule:safety_rate_limit");
        }
        const spamResult = evaluateSpam({ userId: actorUserId, ip: requestIp, messageText: lastMessageText });
        if (spamResult.blocked) {
            return respondWithContent(buildSafetyReply("spam"), `rule:safety_spam:${spamResult.reason || "blocked"}`);
        }
        const injectionResult = detectPromptInjection(lastMessageText);
        if (injectionResult.matched) {
            return respondWithContent(buildSafetyReply("prompt_injection"), "rule:safety_prompt_injection");
        }

        if (intentResult.ambiguous || intentConfidence < INTENT_CONFIDENCE_THRESHOLD) {
            return respondWithContent(buildClarificationReply(lastMessageText), "rule:intent_clarify");
        }

        if (intent === "about_skillup") {
            return respondWithContent(buildAboutSkillupResponse(lastMessageText), "rule:about_skillup");
        }

        // Hard guardrail: never provide direct answers in quizzes/exams.
        if (quizHintOnlyMode && DIRECT_ANSWER_REQUEST_PATTERN.test(lastMessageText)) {
            return respondWithContent(buildNoAnswerPolicyReply(), "rule:quiz_guardrail");
        }

        let learningSummary = null;
        if (intent === "my_learning") {
            const { session, response } = await requireSession(request);
            if (response) {
                return respondWithContent(
                    "หากต้องการดูความคืบหน้าการเรียน กรุณาเข้าสู่ระบบก่อนครับ",
                    "rule:my_learning_auth"
                );
            }
            const courseQuery = extractCourseQuery(lastMessageText, context);
            learningSummary = await buildMyLearningSummary({
                session,
                courseQuery,
                cacheTtlMs: resolveSummaryCacheTtlMs(),
            });
            if (Number(learningSummary?.totals?.totalCourses || 0) <= 0) {
                if (courseQuery) {
                    await logMyLearningSummaryAccess({
                        request,
                        session,
                        source: "chat",
                        courseQuery,
                        totalCourses: 0,
                        status: "course_not_found",
                    });
                    return respondWithContent(
                        `ไม่พบคอร์สชื่อ "${courseQuery}" ในรายการเรียนของบัญชีนี้ครับ`,
                        "rule:my_learning"
                    );
                }
                await logMyLearningSummaryAccess({
                    request,
                    session,
                    source: "chat",
                    courseQuery,
                    totalCourses: 0,
                    status: "no_course",
                });
                return respondWithContent(
                    "ตอนนี้ยังไม่พบคอร์สที่ลงทะเบียนไว้ในบัญชีนี้ครับ",
                    "rule:my_learning"
                );
            }
            await logMyLearningSummaryAccess({
                request,
                session,
                source: "chat",
                courseQuery,
                totalCourses: Number(learningSummary?.totals?.totalCourses || 0),
                status: "ok",
            });
            return respondWithContent(
                buildLearningProgressTableResponse(learningSummary),
                "rule:my_learning"
            );
        }

        let transcriptText = null;
        const youtubeSource = resolveYouTubeSource(context);
        const transcriptRequested = youtubeSource && shouldUseTranscript(context, lastMessageText);
        if (transcriptRequested) {
            try {
                transcriptText = await getYoutubeTranscriptText(youtubeSource);
            } catch (err) {
                console.warn("Unable to load YouTube transcript:", err?.message || err);
            }
        }
        if (transcriptRequested && !transcriptText) {
            return respondWithContent(
                "ตอนนี้ดึง subtitle จากวิดีโอนี้ไม่ได้ จึงสรุปจากคลิปตรง ๆ ให้ไม่ได้ในขณะนี้ ลองใช้คลิปที่เปิดคำบรรยาย (CC) หรือส่งประเด็นที่ไม่เข้าใจมา แล้วฉันจะช่วยอธิบายให้ทันทีครับ",
                "rule:transcript_unavailable"
            );
        }

        const transcriptEnrichedPrompt = buildPromptWithTranscript(
            lastMessageText,
            transcriptText,
            String(context?.lessonTitle || "").trim()
        );
        const promptWithLessonContext = buildPromptWithLessonContext(transcriptEnrichedPrompt, context);
        const promptWithIntent = buildPromptWithIntentRouting(promptWithLessonContext, context, intent);
        const knowledgeOrgId = Number(sessionForSafety?.organizationId || 0) || await ensureDefaultOrganization();
        const knowledgeItems = await retrieveKnowledgeContext({
            organizationId: knowledgeOrgId,
            query: lastMessageText,
            intent,
            limit: 3,
        });
        const promptWithKnowledge = `${promptWithIntent}${buildKnowledgePromptBlock(knowledgeItems)}`;
        const finalMessageForModel = buildPromptWithLearningSummary(promptWithKnowledge, learningSummary);

        // Try each model candidate until one succeeds.
        // Some API keys/projects may not have access to specific model versions,
        // so we should continue trying on compatibility errors as well.
        let lastError = null;
        let sawQuotaError = false;
        let sawFallbackProviderError = false;
        const sessionForPromptTuning = sessionForSafety || await getOptionalSession();
        const weeklyFeedbackHints = sessionForPromptTuning
            ? await buildPromptTuningHints({
                organizationId: Number(sessionForPromptTuning?.organizationId || 0),
                weeks: 8,
            })
            : "";
        const systemInstruction = buildSystemInstruction(context, {
            assessmentMode: quizHintOnlyMode,
            weeklyFeedbackHints,
        });
        if (genAI) {
            for (const modelName of buildModelCandidates()) {
                try {
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        systemInstruction,
                    });
                    const chat = model.startChat(history.length > 0 ? { history } : {});
                    const result = await chat.sendMessage(finalMessageForModel);
                    const text = String(result.response.text() || "").trim();
                    if (quizHintOnlyMode && DIRECT_ANSWER_RESPONSE_PATTERN.test(text)) {
                        return respondWithContent(buildNoAnswerPolicyReply(), "rule:quiz_guardrail");
                    }
                    return respondWithContent(text, `gemini:${modelName}`);
                } catch (err) {
                    lastError = err;
                    const status = extractErrorStatus(err);

                    if (status === 429) {
                        sawQuotaError = true;
                        console.warn(`Model ${modelName} quota exceeded, trying next...`);
                        continue;
                    }

                    // Retry on model compatibility/access errors as well.
                    if (status === 400 || status === 403 || status === 404) {
                        console.warn(`Model ${modelName} unavailable for this key/project (status ${status}), trying next...`);
                        continue;
                    }

                    // Unexpected error: keep trying remaining models if any.
                    console.error(`Model ${modelName} failed with status ${status || "unknown"}`, err);
                }
            }
        } else {
            console.warn("Gemini API key is not configured, skipping Gemini provider.");
        }

        // Provider fallback: OpenRouter/OpenAI-compatible endpoint.
        if (openRouterConfig) {
            try {
                const fallbackText = await generateWithOpenRouter({
                    config: openRouterConfig,
                    messages,
                    finalMessageForModel,
                    systemInstruction,
                });
                console.warn("Chat fallback provider used: OpenRouter");
                if (quizHintOnlyMode && DIRECT_ANSWER_RESPONSE_PATTERN.test(fallbackText)) {
                    return respondWithContent(buildNoAnswerPolicyReply(), "rule:quiz_guardrail");
                }
                return respondWithContent(fallbackText, `openrouter:${openRouterConfig.model}`);
            } catch (fallbackErr) {
                lastError = fallbackErr;
                const fallbackStatus = extractErrorStatus(fallbackErr);
                if (fallbackStatus === 429) {
                    sawQuotaError = true;
                } else {
                    sawFallbackProviderError = true;
                }
                console.error(`OpenRouter fallback failed with status ${fallbackStatus || "unknown"}`, fallbackErr);
            }
        }

        // Provider fallback layer 2: Groq (OpenAI-compatible endpoint).
        if (groqConfig) {
            try {
                const groqText = await generateWithGroq({
                    config: groqConfig,
                    messages,
                    finalMessageForModel,
                    systemInstruction,
                });
                console.warn("Chat fallback provider used: Groq");
                if (quizHintOnlyMode && DIRECT_ANSWER_RESPONSE_PATTERN.test(groqText)) {
                    return respondWithContent(buildNoAnswerPolicyReply(), "rule:quiz_guardrail");
                }
                return respondWithContent(groqText, `groq:${groqConfig.model}`);
            } catch (groqErr) {
                lastError = groqErr;
                const groqStatus = extractErrorStatus(groqErr);
                if (groqStatus === 429) {
                    sawQuotaError = true;
                } else {
                    sawFallbackProviderError = true;
                }
                console.error(`Groq fallback failed with status ${groqStatus || "unknown"}`, groqErr);
            }
        }

        if (sawFallbackProviderError) {
            console.error("Fallback AI provider is unavailable/misconfigured:", lastError);
            return respondWithError(
                "ผู้ให้บริการ AI สำรองยังไม่พร้อมใช้งาน กรุณาตรวจสอบการตั้งค่า OpenRouter/Groq และสิทธิ์โมเดล",
                503,
                "system:fallback_error"
            );
        }

        if (sawQuotaError) {
            console.error("All configured AI providers quota exceeded:", lastError);
            return respondWithError(
                "AI หมดโควต้าชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่",
                429,
                "system:quota"
            );
        }

        console.error("All configured AI providers unavailable:", lastError);
        return respondWithError(
            "คีย์ AI ปัจจุบันยังไม่พร้อมใช้งาน กรุณาตรวจสอบการตั้งค่า Gemini/OpenRouter/Groq และสิทธิ์การใช้งาน",
            503,
            "system:provider_unavailable"
        );
    } catch (error) {
        console.error("AI Provider Error:", error);
        return Response.json(
            { error: "ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง" },
            { status: 500 }
        );
    }
}

