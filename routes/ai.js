const express = require("express");
const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

router.get("/health", async (req, res) => {
    try {
        const response = await fetch(`${AI_SERVICE_URL}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (err) {
        return res.status(503).json({
            status: "unavailable",
            error: "AI service is not running. Start it with: npm run ai:start",
        });
    }
});

router.post("/chat", async (req, res) => {
    try {
        const response = await fetch(`${AI_SERVICE_URL}/ai/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
            signal: AbortSignal.timeout(120000),
        });

        const text = await response.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (parseErr) {
            return res.status(502).json({
                error: "Invalid AI service response",
                message: "Sorry, the AI assistant returned an unexpected response. Please try again.",
            });
        }

        return res.status(response.status).json(data);
    } catch (err) {
        return res.status(503).json({
            error: "AI service is not running",
            message: "Sorry, the AI assistant is temporarily unavailable. Please start the AI service with: npm run ai:start",
        });
    }
});

module.exports = router;
