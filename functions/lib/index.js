"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boxRevokeProxy = exports.boxOAuthProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const boxClientId = (0, params_1.defineSecret)("BOX_CLIENT_ID");
const boxClientSecret = (0, params_1.defineSecret)("BOX_CLIENT_SECRET");
const ALLOWED_ORIGINS = [
    "https://easyedit-cloud.web.app",
    "https://easyeditor.co.uk",
    "http://localhost:5000",
    "http://localhost:3024",
];
function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.set("Access-Control-Allow-Origin", origin);
    }
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true;
    }
    return false;
}
function buildBody(req, clientId, clientSecret) {
    const params = new URLSearchParams();
    // req.body is parsed as an object when Content-Type is application/x-www-form-urlencoded
    const source = typeof req.body === "object" ? req.body : Object.fromEntries(new URLSearchParams(req.body));
    for (const [key, value] of Object.entries(source)) {
        if (key !== "client_id" && key !== "client_secret") {
            params.set(key, value);
        }
    }
    // Always inject from server-side secrets
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    return params.toString();
}
exports.boxOAuthProxy = (0, https_1.onRequest)({ secrets: [boxClientId, boxClientSecret], region: "europe-west1", invoker: "public" }, async (req, res) => {
    if (setCorsHeaders(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    try {
        const body = buildBody(req, boxClientId.value(), boxClientSecret.value());
        const response = await fetch("https://api.box.com/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        });
        const data = await response.text();
        res.status(response.status).set("Content-Type", "application/json").send(data);
    }
    catch (err) {
        console.error("Box token proxy error:", err);
        res.status(500).json({ error: "Proxy request failed" });
    }
});
exports.boxRevokeProxy = (0, https_1.onRequest)({ secrets: [boxClientId, boxClientSecret], region: "europe-west1", invoker: "public" }, async (req, res) => {
    if (setCorsHeaders(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    try {
        const body = buildBody(req, boxClientId.value(), boxClientSecret.value());
        const response = await fetch("https://api.box.com/oauth2/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        });
        res.status(response.status).send("");
    }
    catch (err) {
        console.error("Box revoke proxy error:", err);
        res.status(500).json({ error: "Proxy request failed" });
    }
});
//# sourceMappingURL=index.js.map