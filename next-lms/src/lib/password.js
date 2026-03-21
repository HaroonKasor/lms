import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;

export function isHashedPassword(value = '') {
    return BCRYPT_PREFIX.test(String(value));
}

export async function hashPassword(plainText) {
    return bcrypt.hash(String(plainText), SALT_ROUNDS);
}

export async function verifyPassword(plainText, storedPassword) {
    if (!storedPassword) return false;
    if (!isHashedPassword(storedPassword)) return false;
    return bcrypt.compare(String(plainText), String(storedPassword));
}
