const express = require("express");
const router = express.Router();
const Listing = require("../models/listing");

function resolveAIServiceUrl() {
    if (process.env.AI_SERVICE_URL) {
        return process.env.AI_SERVICE_URL.replace(/\/$/, "");
    }

    if (!process.env.AI_SERVICE_HOST) {
        return "http://localhost:8000";
    }

    const host = process.env.AI_SERVICE_HOST.replace(/\/$/, "");
    return /^https?:\/\//i.test(host)
        ? host
        : `${process.env.AI_SERVICE_SCHEME || "http"}://${host}`;
}

const configuredAIServiceUrl = resolveAIServiceUrl();
const AI_SERVICE_URL = configuredAIServiceUrl.replace(/\/$/, "");

console.log(`[AI] configured upstream: ${AI_SERVICE_URL}`);

function responsePreview(text) {
    return text.replace(/\s+/g, " ").trim().slice(0, 300);
}

function logAIServiceError(operation, err) {
    console.error(`[AI] ${operation} failed`, {
        serviceUrl: AI_SERVICE_URL,
        name: err?.name,
        message: err?.message,
        cause: err?.cause?.message || err?.cause?.code || undefined,
    });
}

router.get("/health", async (req, res) => {
    try {
        const response = await fetch(`${AI_SERVICE_URL}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        const text = await response.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (parseErr) {
            const preview = responsePreview(text);
            logAIServiceError("health check returned non-JSON response", {
                name: "UpstreamResponseError",
                message: `HTTP ${response.status}; ${preview || "empty response"}`,
            });
            return res.status(503).json({
                status: "unavailable",
                error: `AI service returned HTTP ${response.status} instead of a JSON health response.`,
                upstream_url: AI_SERVICE_URL,
                upstream_preview: preview || undefined,
            });
        }
        if (!response.ok) {
            return res.status(503).json({
                status: "unavailable",
                error: data.error || `AI service returned HTTP ${response.status}.`,
                upstream_url: AI_SERVICE_URL,
            });
        }
        return res.status(response.status).json(data);
    } catch (err) {
        logAIServiceError("health check", err);
        return res.status(503).json({
            status: "unavailable",
            error: "AI service is unavailable. Check the AI service deployment and AI_SERVICE_URL setting.",
        });
    }
});

router.get("/vehicles/:id", async (req, res) => {
    try {
        const listing = await Listing.findOne({ _id: req.params.id, websiteSource: "car-rental" })
            .populate("owner", "username averageRating isVerified");
        if (!listing) return res.status(404).json({ success: false, error: "Vehicle not found" });
        return res.json({ success: true, vehicle: listing.toObject() });
    } catch (err) {
        return res.status(400).json({ success: false, error: "Invalid vehicle id" });
    }
});

router.post("/chat", async (req, res) => {
    try {
        const requestBody = {
            ...req.body,
            user_id: req.body.user_id || (req.user && req.user._id ? String(req.user._id) : null),
            auth_token: req.body.auth_token || (req.isAuthenticated() ? req.headers.cookie : null),
        };
        const response = await fetch(`${AI_SERVICE_URL}/ai/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(120000),
        });

        const text = await response.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (parseErr) {
            const preview = responsePreview(text);
            console.error("[AI] upstream returned non-JSON response", {
                serviceUrl: AI_SERVICE_URL,
                status: response.status,
                contentType: response.headers.get("content-type"),
                preview,
            });
            return res.status(502).json({
                error: "Invalid AI service response",
                message: `AI service returned HTTP ${response.status} with an invalid response. Check the AI service deployment URL and logs.`,
                upstream_url: AI_SERVICE_URL,
                upstream_preview: preview || undefined,
            });
        }

        return res.status(response.status).json(data);
    } catch (err) {
        logAIServiceError("chat request", err);
        return res.status(503).json({
            error: "AI service is not running",
            message: "Sorry, the AI assistant is temporarily unavailable. Please try again shortly.",
        });
    }
});

module.exports = router;
