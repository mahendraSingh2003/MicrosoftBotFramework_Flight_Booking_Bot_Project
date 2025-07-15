const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const key = process.env.TRANSLATOR_KEY;
const endpoint = process.env.TRANSLATOR_ENDPOINT;
const location = process.env.TRANSLATOR_REGION;

async function translateText(text, toLang = 'en', fromLang = 'en') {
    try {
        // Sanitize and validate toLang
        toLang = typeof toLang === 'string' ? toLang.trim().toLowerCase() : '';
        if (!toLang) {
            throw new Error("❌ 'toLang' is required and must be a valid language code.");
        }

        // console.log("Translating to:", toLang);
        // console.log("Text:", text);

        const response = await axios({
            url: `${endpoint}/translate`, // 👈 Use full URL here
            method: 'post',
            headers: {
                'Ocp-Apim-Subscription-Key': key,
                'Ocp-Apim-Subscription-Region': location,
                'Content-type': 'application/json',
                'X-ClientTraceId': uuidv4().toString()
            },
            params: {
                'api-version': '3.0',
                ...(fromLang && { 'from': fromLang }),
                'to': toLang // 👈 Use as string
            },
            data: [{
                'text': text
            }],
            responseType: 'json'
        });

        return response.data[0].translations[0].text;
    } catch (error) {
        console.error("Transl5ation Error:", error.response?.data || error.message);
        return text; // Fallback
    }
}

module.exports = { translateText };
