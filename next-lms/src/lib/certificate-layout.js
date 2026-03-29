export const CERTIFICATE_TEMPLATE_IMAGE = '/images/certificate-template-achievement.png';
export const CERTIFICATE_SIGNATURE_IMAGE = '/images/certificate-signature-skillup.png';

const DESIGN_WIDTH = 1365;
const DESIGN_HEIGHT = 1024;

const toPercent = (value, total) => `${(value / total) * 100}%`;

export const CERTIFICATE_ASPECT_RATIO = '1536 / 1024';
export const CERTIFICATE_HOLDER_RATIO = 1.5;

export const CERTIFICATE_LAYOUT = {
    recipient: {
        left: '50%',
        top: toPercent(515, DESIGN_HEIGHT),
        width: '58.5938%',
        fontSizePrint: '4.1cqw',
        fontSizePreview: 'clamp(20px, 3.2vw, 52px)',
    },
    course: {
        left: '50%',
        top: toPercent(695, DESIGN_HEIGHT),
        width: '64.4531%',
        fontSizePrint: '2.75cqw',
        fontSizePreview: 'clamp(14px, 2.3vw, 30px)',
    },
    date: {
        left: toPercent(360, DESIGN_WIDTH),
        top: toPercent(900, DESIGN_HEIGHT),
        width: '30.2734%',
        fontSizePrint: '2.2cqw',
        fontSizePreview: 'clamp(14px, 1.9vw, 28px)',
    },
    signature: {
        left: toPercent(1005, DESIGN_WIDTH),
        top: toPercent(854, DESIGN_HEIGHT),
        width: '18%',
        maxHeight: '12%',
    },
    certificateNo: {
        left: '5.8594%',
        bottom: '5.3867%',
        fontSizePrint: '0.9cqw',
        fontSizePreview: 'clamp(8px, 0.9vw, 14px)',
    },
};

export function formatCertificateDate(value) {
    const safeDate = value ? new Date(value) : new Date();
    const fallbackDate = Number.isNaN(safeDate.getTime()) ? new Date() : safeDate;
    return fallbackDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
