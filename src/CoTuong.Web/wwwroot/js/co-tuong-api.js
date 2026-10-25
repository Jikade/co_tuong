window.coTuongApi = {
    async post(url, payload, idempotencyKey) {
        return this.request("POST", url, payload, idempotencyKey);
    },
    async get(url) {
        return this.request("GET", url);
    },
    async put(url, payload) {
        return this.request("PUT", url, payload);
    },
    async delete(url) {
        return this.request("DELETE", url);
    },
    async request(method, url, payload, idempotencyKey) {
        const headers = payload === undefined ? {} : { "Content-Type": "application/json" };
        if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
        const response = await fetch(url, {
            method,
            credentials: "same-origin",
            headers,
            body: payload === undefined ? undefined : JSON.stringify(payload)
        });
        const text = await response.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
        return { ok: response.ok, status: response.status, data };
    }
};
