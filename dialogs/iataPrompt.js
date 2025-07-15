const { TextPrompt } = require('botbuilder-dialogs');
const { getIATACode } = require('../services/getIataCode');
const { translateText } = require('../services/translatorService');

class IATACodePrompt extends TextPrompt {
    constructor(dialogId, conversationData) {
        super(dialogId, async (promptContext) => {
            const cityInput = promptContext.recognized.value?.trim();

            if (!cityInput) return false;

            const context = promptContext.context;
            const convData = await conversationData.get(context, {});
            const userLang = convData.language || 'en';

            // Translate to English if needed
            let translatedInput = cityInput;
            if (userLang !== 'en') {
                try {
                    translatedInput = await translateText(cityInput, 'en', userLang);
                } catch (err) {
                    console.error('Translation error:', err);
                }
            }

            try {
                const iataCode = await getIATACode(translatedInput);

                if (iataCode && typeof iataCode === 'string' && iataCode.length === 3) {
                    promptContext.recognized.value = iataCode.toUpperCase();
                    return true;
                }

                const retryMsg = await translateText("❌ Invalid city. Please enter a valid airport city.", userLang);
                await context.sendActivity(retryMsg);
                return false;

            } catch (err) {
                console.error('Error in IATACodePrompt:', err);
                const errorMsg = await translateText("⚠️ Something went wrong while checking the city. Please try again.", userLang);
                await context.sendActivity(errorMsg);
                return false;
            }
        });

        this.conversationData = conversationData; // <== crucial to fix the error
    }
}


module.exports = { IATACodePrompt };
