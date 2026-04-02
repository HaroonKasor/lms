import { mapCategoryCollection, toCategoryPayload } from '@/mappers/admin/categoryMapper';
import { extractServiceError, readJson } from '@/services/admin/http';

export async function listCategories() {
    const response = await fetch('/api/categories', { cache: 'no-store' });
    if (!response.ok) throw await extractServiceError(response, 'Failed to load categories');
    return mapCategoryCollection(await readJson(response));
}

export async function createCategory(form) {
    const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toCategoryPayload(form)),
    });
    if (!response.ok) throw await extractServiceError(response, 'Save category failed');
    return readJson(response);
}

export async function updateCategory(id, form) {
    const response = await fetch(`/api/categories?id=${encodeURIComponent(String(id))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toCategoryPayload(form)),
    });
    if (!response.ok) throw await extractServiceError(response, 'Save category failed');
    return readJson(response);
}

export async function deleteCategory(id) {
    const response = await fetch(`/api/categories?id=${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw await extractServiceError(response, 'Delete category failed');
    return readJson(response);
}
