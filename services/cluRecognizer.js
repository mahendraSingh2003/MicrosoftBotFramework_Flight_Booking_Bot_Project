const axios = require('axios');
require('dotenv').config();

async function recognizeIntent(text) {
    const endpoint = `${process.env.CLU_ENDPOINT}/language/:analyze-conversations?api-version=2023-04-01`;
    
    const body = {
        kind: 'Conversation',
        analysisInput: {
            conversationItem: {
                participantId: 'user1',
                id: '1',
                modality: 'text',
                language: 'en',
                text: text
            }
        },
        parameters: {
            projectName: process.env.CLU_PROJECT_NAME,
            deploymentName: process.env.CLU_DEPLOYMENT_NAME,
            stringIndexType: 'Utf16CodeUnit'
        }
    };

    try {
        const response = await axios.post(endpoint, body, {
            headers: {
                'Ocp-Apim-Subscription-Key': process.env.CLU_KEY,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (err) {
        console.error('CLU error:', err.response?.data || err.message);
        throw err;
    }
}

module.exports = { recognizeIntent };
