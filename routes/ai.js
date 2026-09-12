const express = require("express");
const router = express.Router();
const Listing = require("../models/listing");

const configuredAIServiceUrl = process.env.AI_SERVICE_URL || (
    process.env.AI_SERVICE_HOST ? `https://${process.env.AI_SERVICE_HOST}` : "http://localhost:8000"
);
const AI_SERVICE_URL = configuredAIServiceUrl.replace(/\/$/, "");

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
            return res.status(503).json({
                status: "unavailable",
                error: `AI service returned HTTP ${response.status} instead of a JSON health response.`,
            });
        }
        if (!response.ok) {
            return res.status(503).json({
                status: "unavailable",
                error: data.error || `AI service returned HTTP ${response.status}.`,
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
            console.error(`[AI] upstream returned non-JSON HTTP ${response.status}`);
            return res.status(502).json({
                error: "Invalid AI service response",
                message: `AI service returned HTTP ${response.status} with an invalid response. Check the AI service deployment URL and logs.`,
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
