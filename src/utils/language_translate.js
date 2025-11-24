const express = require('express');
const translate = require('translate-google');

const app = express();
const PORT = 3000;


app.use(express.json());

(async () => {
    const text = "Hello, how are you?";
    const targetLanguage = "zh-cn";
    // const targetLanguage = "zh-tw";

    try {
        const translatedText = await translate(text, { to: targetLanguage });
        const data = {
            originalText: text,
            translatedText: translatedText,
            targetLanguage: targetLanguage,
        };
        console.log(data);
    } catch (error) {
        console.error('Translation error:', error.message || error);
    }
})();

// Start the Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
