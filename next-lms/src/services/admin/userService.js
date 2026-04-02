import {
    mapUserCollection,
    toCreateUserPayload,
    toUpdateUserPayload,
} from '@/mappers/admin/userMapper';
import { extractServiceError, readJson } from '@/services/admin/http';

export async function listUsers(options = {}) {
    const params = new URLSearchParams();
    const groupCode = String(options?.groupCode || '').trim().toUpperCase();
    if (groupCode) params.set('groupCode', groupCode);
    const query = params.toString();
    const response = await fetch(`/api/users${query ? `?${query}` : ''}`, { cache: 'no-store' });
    if (!response.ok) throw await extractServiceError(response, 'Failed to load users');
    return mapUserCollection(await readJson(response));
}

export async function createUser(form) {
    const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toCreateUserPayload(form)),
    });
    if (!response.ok) throw await extractServiceError(response, 'Create user failed');
    return readJson(response);
}

export async function updateUser(id, form) {
    const response = await fetch(`/api/users?id=${encodeURIComponent(String(id))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toUpdateUserPayload(form)),
    });
    if (!response.ok) throw await extractServiceError(response, 'Update user failed');
    return readJson(response);
}

export async function changeUserPassword(id, password) {
    const response = await fetch(`/api/users?id=${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: String(password || '') }),
    });
    if (!response.ok) throw await extractServiceError(response, 'Change password failed');
    return readJson(response);
}

export async function deleteUser(id) {
    const response = await fetch(`/api/users?id=${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw await extractServiceError(response, 'Delete user failed');
    return readJson(response);
}
