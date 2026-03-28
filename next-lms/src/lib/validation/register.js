const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,30}$/;
const PHONE_REGEX = /^[0-9+\-()\s]{8,20}$/;

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

function normalizeString(value) {
    return String(value ?? '').trim();
}

export function sanitizeRegisterInput(raw = {}) {
    return {
        username: normalizeString(raw?.username),
        email: normalizeString(raw?.email).toLowerCase(),
        password: String(raw?.password ?? ''),
        fullName: normalizeString(raw?.fullName),
        phone: normalizeString(raw?.phone),
    };
}

export function validateRegisterInput(input = {}) {
    const data = sanitizeRegisterInput(input);

    if (!data.username) {
        return { valid: false, error: 'Username is required' };
    }
    if (!USERNAME_REGEX.test(data.username)) {
        return {
            valid: false,
            error: 'Username must be 3-30 characters and can contain only letters, numbers, dot (.), underscore (_), or hyphen (-)',
        };
    }

    if (!data.email) {
        return { valid: false, error: 'Email is required' };
    }
    if (!EMAIL_REGEX.test(data.email)) {
        return { valid: false, error: 'Invalid email format' };
    }

    if (!data.password) {
        return { valid: false, error: 'Password is required' };
    }
    if (data.password.length < PASSWORD_MIN_LENGTH || data.password.length > PASSWORD_MAX_LENGTH) {
        return { valid: false, error: `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters` };
    }
    if (/\s/.test(data.password)) {
        return { valid: false, error: 'Password must not contain spaces' };
    }
    if (!/[A-Za-z]/.test(data.password) || !/\d/.test(data.password)) {
        return { valid: false, error: 'Password must contain both letters and numbers' };
    }

    if (data.fullName && (data.fullName.length < 2 || data.fullName.length > 100)) {
        return { valid: false, error: 'Full name must be between 2 and 100 characters' };
    }

    if (data.phone && !PHONE_REGEX.test(data.phone)) {
        return { valid: false, error: 'Invalid phone number format' };
    }

    return { valid: true, error: '' };
}

