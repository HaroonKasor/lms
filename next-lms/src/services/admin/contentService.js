import {
    mapContentCollection,
    toCreateContentFormData,
    toUpdateContentPayload,
} from '@/mappers/admin/contentMapper';
import { extractServiceError, readJson } from '@/services/admin/http';

export async function listContents() {
    const response = await fetch('/api/content/upload', { cache: 'no-store' });
    if (!response.ok) throw await extractServiceError(response, 'Failed to load content');
    return mapContentCollection(await readJson(response));
}

export async function createContent(form) {
    const response = await fetch('/api/content/upload', {
        method: 'POST',
        body: toCreateContentFormData(form),
    });
    if (!response.ok) throw await extractServiceError(response, 'Unable to save content');
    return readJson(response);
}

export async function updateContent(id, form) {
    const response = await fetch('/api/content/upload', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toUpdateContentPayload(id, form)),
    });
    if (!response.ok) throw await extractServiceError(response, 'Unable to save content');
    return readJson(response);
}

export async function deleteContent(id) {
    const response = await fetch(`/api/content/upload?id=${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw await extractServiceError(response, 'Delete failed');
    return readJson(response);
}
