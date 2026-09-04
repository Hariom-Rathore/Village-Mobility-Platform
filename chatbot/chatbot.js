const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Get working model name
function getWorkingModelName() {
    const envModel = process.env.GEMINI_MODEL;
    if (envModel && envModel.length) {
        // Ensure model name has "models/" prefix if not present
        return envModel.startsWith("models/") ? envModel : `models/${envModel}`;
    }
    // Default fallback to gemini-2.5-flash
    return "models/gemini-2.5-flash";
}

// Function to chat with Gemini (or a fallback model)
async function chatWithGemini(userMessage) {
    try {
        const modelName = getWorkingModelName();
        const model = genAI.getGenerativeModel({ model: modelName });
        const chat = model.startChat({ history: [] });
        const result = await chat.sendMessage(userMessage);

        return result.response.text();
    } catch (error) {
        console.error("Error in chatWithGemini:", error.message);
        throw error;
    }
}

module.exports = { chatWithGemini };

module.exports = { chatWithGemini };
