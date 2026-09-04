const express = require("express");
const router = express.Router();
const { chatWithGemini } = require("../chatbot/chatbot.js");

// GET - Display chatbot page
router.get("/", (req, res) => {
    res.render("chatbot/chatbot.ejs", { title: "Chatbot" });
});

// POST - Handle chat messages
router.post("/send", async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || message.trim() === "") {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        const response = await chatWithGemini(message);
        res.json({ success: true, reply: response });
    } catch (error) {
        console.error("Error in /send route:", error.message);
        res.status(500).json({ error: "Failed to get response from chatbot" });
    }
});

module.exports = router;
