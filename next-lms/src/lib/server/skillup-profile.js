const ABOUT_SKILLUP_INTENT_PATTERN = /(about\s*skillup|about us|about skill up|skillup คือ|skillup คืออะไร|เกี่ยวกับ skillup|ประวัติ (โครงการ|skillup)|โปรเจคจบ|รามคำแหง|ramkhamhaeng|ทีมผู้พัฒนา)/i;

function prefersThai(text = '') {
    return /[\u0E00-\u0E7F]/.test(String(text || ''));
}

export function isAboutSkillupIntent(message = '', context = {}) {
    const explicitIntent = String(context?.intent || '').trim().toLowerCase();
    if (explicitIntent === 'about_skillup') return true;
    return ABOUT_SKILLUP_INTENT_PATTERN.test(String(message || ''));
}

export function buildAboutSkillupResponse(message = '') {
    if (prefersThai(message)) {
        return `เกี่ยวกับ SkillUp

SkillUp เป็นระบบ Learning Management System (LMS) บนเว็บ ที่พัฒนาเป็นโครงงานจบของนักศึกษามหาวิทยาลัยรามคำแหง คณะวิศวกรรมศาสตร์ สาขาวิชาคอมพิวเตอร์และอิเล็กทรอนิกส์

เป้าหมายของโครงการคือสร้างแพลตฟอร์มการเรียนรู้ออนไลน์ที่ใช้งานง่าย ยืดหยุ่น และช่วยให้ผู้เรียนติดตามความก้าวหน้าได้ชัดเจน โดยรองรับการเรียนรู้ด้วยตนเองอย่างมีประสิทธิภาพ

ทีมผู้จัดทำ:
1) Miss Suppansa Nakprasert
2) Mr. Ekthaphong Lonhin
3) Mr. Haroon Kasor`;
    }

    return `About SkillUp

SkillUp is a web-based Learning Management System (LMS) developed as a senior project by students from Ramkhamhaeng University, Faculty of Engineering, Department of Computer and Electronics Engineering.

The project focuses on creating an accessible, user-friendly, and effective learning platform where learners can study at their own pace, track progress clearly, and receive AI-assisted learning support.

Project Team:
1) Miss Suppansa Nakprasert
2) Mr. Ekthaphong Lonhin
3) Mr. Haroon Kasor`;
}

