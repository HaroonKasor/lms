export function mapCategoryRecord(category) {
    return {
        id: Number(category?.id) || 0,
        name: String(category?.name || category?.categoryName || '').trim(),
        codeName: String(category?.codeName || '').trim(),
        detail: String(category?.detail || category?.categoryDetail || '').trim(),
        isPublic: category?.isPublic !== false,
        parentId: category?.parentId ? Number(category.parentId) : null,
    };
}

export function mapCategoryCollection(payload) {
    if (Array.isArray(payload)) return payload.map(mapCategoryRecord);
    if (Array.isArray(payload?.data)) return payload.data.map(mapCategoryRecord);
    if (Array.isArray(payload?.categories)) return payload.categories.map(mapCategoryRecord);
    return [];
}

export function toCategoryPayload(form) {
    return {
        categoryName: String(form?.categoryName || '').trim(),
        codeName: String(form?.codeName || '').trim(),
        categoryDetail: String(form?.categoryDetail || '').trim(),
        isPublic: Boolean(form?.isPublic),
        mainCategory: form?.mainCategory ? String(form.mainCategory) : '',
    };
}
