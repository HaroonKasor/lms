export async function readJson(response) {
    return response.json().catch(() => ({}));
}

export async function extractServiceError(response, fallbackMessage) {
    const data = await readJson(response);
    const message = data?.error || data?.message || data?.detail || fallbackMessage;
    return new Error(message);
}
