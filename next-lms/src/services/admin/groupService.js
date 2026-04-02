import {
    normalizeGroupModel,
    toGroupFormValues,
} from '@/mappers/admin/groupMapper';
import { extractServiceError, readJson } from '@/services/admin/http';

function mapGroupCollection(payload) {
    if (Array.isArray(payload)) return payload.map((group, index) => normalizeGroupModel(group, index));
    if (Array.isArray(payload?.groups)) return payload.groups.map((group, index) => normalizeGroupModel(group, index));
    if (payload?.group) return [normalizeGroupModel(payload.group, 0)];
    return [];
}

export async function listGroups() {
    const response = await fetch('/api/groups', { cache: 'no-store' });
    if (!response.ok) throw await extractServiceError(response, 'Failed to load groups');
    const payload = await readJson(response);
    return mapGroupCollection(payload);
}

export async function listGroupRoleOptions() {
    const response = await fetch('/api/groups/roles', { cache: 'no-store' });
    if (!response.ok) throw await extractServiceError(response, 'Failed to load role options');
    const payload = await readJson(response);
    return {
        categories: Array.isArray(payload?.categories) ? payload.categories : [],
        roles: Array.isArray(payload?.roles) ? payload.roles : [],
    };
}

export async function getGroupById(id) {
    const response = await fetch(`/api/groups?id=${encodeURIComponent(String(id))}`, { cache: 'no-store' });
    if (response.status === 404) return null;
    if (!response.ok) throw await extractServiceError(response, 'Failed to load group');
    const payload = await readJson(response);
    const group = payload?.group || mapGroupCollection(payload)[0] || null;
    return group ? normalizeGroupModel(group, 0) : null;
}

export async function createGroup(form) {
    const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: String(form?.code || form?.name || '').trim().toUpperCase(),
            name: String(form?.name || '').trim(),
            description: String(form?.description || '').trim(),
            roleCode: String(form?.roleCode || 'LEARNER').trim().toUpperCase(),
            isActive: Boolean(form?.isActive),
            roles: Array.isArray(form?.roles) ? form.roles : [],
        }),
    });
    if (!response.ok) throw await extractServiceError(response, 'Create group failed');
    const payload = await readJson(response);
    return payload?.group ? normalizeGroupModel(payload.group, 0) : payload;
}

export async function updateGroup(id, form) {
    const response = await fetch(`/api/groups?id=${encodeURIComponent(String(id))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: String(form?.code || form?.name || '').trim().toUpperCase(),
            name: String(form?.name || '').trim(),
            description: String(form?.description || '').trim(),
            roleCode: String(form?.roleCode || 'LEARNER').trim().toUpperCase(),
            isActive: Boolean(form?.isActive),
            roles: Array.isArray(form?.roles) ? form.roles : [],
        }),
    });
    if (!response.ok) throw await extractServiceError(response, 'Update group failed');
    const payload = await readJson(response);
    return toGroupFormValues(payload?.group || {});
}

export async function deleteGroup(id) {
    const response = await fetch(`/api/groups?id=${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw await extractServiceError(response, 'Delete group failed');
    return readJson(response);
}
