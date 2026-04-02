export function mapContentRecord(content) {
    return {
        id: String(content?.id || '').trim(),
        title: String(content?.title || '').trim(),
        entryPoint: String(content?.entryPoint || '').trim(),
        activities: Array.isArray(content?.activities)
            ? content.activities.map((activity, index) => ({
                name: String(activity?.name || `Activity ${index + 1}`).trim(),
                launch: String(activity?.launch || '').trim(),
            }))
            : [],
    };
}

export function mapContentCollection(payload) {
    if (Array.isArray(payload)) return payload.map(mapContentRecord);
    if (Array.isArray(payload?.data)) return payload.data.map(mapContentRecord);
    if (Array.isArray(payload?.contents)) return payload.contents.map(mapContentRecord);
    return [];
}

export function toCreateContentFormData(form) {
    const formData = new FormData();
    formData.append('title', String(form?.title || '').trim());
    if (form?.file) formData.append('file', form.file);
    return formData;
}

export function toUpdateContentPayload(id, form) {
    return {
        id: String(id || '').trim(),
        title: String(form?.title || '').trim(),
    };
}
