import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `คุณคือ "SkillBot" ผู้ช่วย AI ของแพลตฟอร์มการเรียนรู้ SkillUp LMS
หน้าที่ของคุณคือ:
- ช่วยตอบคำถามเกี่ยวกับบทเรียนและเนื้อหาในคอร์ส
- แนะนำวิธีการเรียนรู้ที่มีประสิทธิภาพ
- อธิบายแนวคิดที่ผู้เรียนไม่เข้าใจ
- ให้กำลังใจและสนับสนุนผู้เรียน
- ช่วยแก้ปัญหาที่เกี่ยวข้องกับการใช้งานระบบ LMS

ตอบภาษาเดียวกับที่ผู้ใช้ถาม (ไทยตอบไทย, อังกฤษตอบอังกฤษ)
ตอบกระชับ ชัดเจน และเป็นมิตร`;

const MODEL_CANDIDATES = [
    // Keep broadly available models first for better compatibility across projects.
    "gemini-1.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
];

function extractErrorStatus(err) {
    const status = Number(err?.status || err?.httpStatusCode || err?.code || 0);
    return Number.isFinite(status) ? status : 0;
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { messages } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return Response.json({ error: "Messages are required" }, { status: 400 });
        }

        if (!process.env.GEMINI_API_KEY) {
            console.error("GEMINI_API_KEY is not set");
            return Response.json(
                { error: "AI ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ" },
                { status: 503 }
            );
        }

        const rawHistory = messages.slice(0, -1).map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        // Gemini requires the first history entry to have role 'user'
        const firstUserIndex = rawHistory.findIndex((h) => h.role === "user");
        const history = firstUserIndex >= 0 ? rawHistory.slice(firstUserIndex) : [];
        const lastMessage = messages[messages.length - 1];

        // Try each model candidate until one succeeds.
        // Some API keys/projects may not have access to specific model versions,
        // so we should continue trying on compatibility errors as well.
        let lastError = null;
        let sawQuotaError = false;
        for (const modelName of MODEL_CANDIDATES) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: SYSTEM_PROMPT,
                });
                const chat = model.startChat(history.length > 0 ? { history } : {});
                const result = await chat.sendMessage(lastMessage.content);
                const text = result.response.text();
                return Response.json({ content: text });
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
                console.error(`Model ${modelName} failed with status ${status || 'unknown'}`, err);
            }
        }

        if (sawQuotaError) {
            console.error("All Gemini models quota exceeded:", lastError);
            return Response.json(
                { error: "AI หมดโควต้าชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่" },
                { status: 429 }
            );
        }

        console.error("All Gemini models unavailable for this key/project:", lastError);
        return Response.json(
            { error: "คีย์ AI ปัจจุบันยังไม่พร้อมใช้งานกับโมเดลที่ระบบตั้งไว้ กรุณาตรวจสอบ API key และสิทธิ์การใช้งาน" },
            { status: 503 }
        );
    } catch (error) {
        console.error("Gemini API Error:", error);
        return Response.json(
            { error: "ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง" },
            { status: 500 }
        );
    }
}

