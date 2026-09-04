require('dotenv').config();
const { chatWithGemini } = require('./chatbot.js');

(async () => {
  try {
    const res = await chatWithGemini('Hello from test script');
    console.log('REPLY:', res);
  } catch (e) {
    console.error('TEST ERROR:', e);
  }
})();