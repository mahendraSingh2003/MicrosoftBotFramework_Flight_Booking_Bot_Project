const { ActivityHandler, MessageFactory } = require('botbuilder');
const { DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');
const { SearchFlight } = require('./dialogs/searchFlight');
const { PriceCompare } = require('./dialogs/priceComparison');
const { FilterFlight } = require('./dialogs/filterFlight');
const { BookingDialog } = require('./dialogs/bookingDialog');
const { ManageItinerary } = require('./dialogs/manageItinerary');
const { recognizeIntent } = require('./services/cluRecognizer');
const { translateText } = require('./services/translatorService');

class FBBOT extends ActivityHandler {
    constructor(conversationState, userState) {
        super();

        this.conversationState = conversationState;
        this.userState = userState;

        this.dialogState = this.conversationState.createProperty("dialogState");
        this.previousIntent = this.conversationState.createProperty("previousIntent");
        this.conversationData = this.conversationState.createProperty("conversationData");

        this.searchFlight = new SearchFlight(this.conversationState, this.conversationData);
        this.priceCompare = new PriceCompare(this.conversationState, this.conversationData);
        this.filterFlight = new FilterFlight(this.conversationState, this.conversationData);
        this.bookingDialog = new BookingDialog(this.conversationState, this.conversationData);
        this.manageItinerary = new ManageItinerary(this.conversationState, this.conversationData);

        this.dialogs = new DialogSet(this.dialogState);
        this.dialogs.add(this.searchFlight);
        this.dialogs.add(this.priceCompare);
        this.dialogs.add(this.filterFlight);
        this.dialogs.add(this.bookingDialog);
        this.dialogs.add(this.manageItinerary);

        this.onMessage(async (context, next) => {
            const userMessage = context.activity.text?.trim();
            const convData = await this.conversationData.get(context, {});

            if (convData.expectingLanguage) {
                convData.language = userMessage.toLowerCase();
                convData.expectingLanguage = false;
                await this.conversationData.set(context, convData);

                await this.sendTranslatedText(context, "✅ Language changed successfully!", convData.language);
                await this.sendSuggestedActions(context);
                return await next();
            }

            const value = context.activity.value;
            const dialogContext = await this.dialogs.createContext(context);
            const dialogResult = await dialogContext.continueDialog();

            if (dialogResult.status === DialogTurnStatus.waiting) return await next();

            if (dialogResult.status === DialogTurnStatus.complete) {
                convData.endDialog = true;
                await this.conversationData.set(context, convData);
                await this.previousIntent.set(context, {});
                await this.sendSuggestedActions(context);
                return await next();
            }

            if (value?.action === 'book_flight' && value.flightData) {
                await this.handleDialog(this.bookingDialog, context, { selectedFlight: value.flightData });
                return await next();
            }

            if (!userMessage) return await next();

            const userLang = convData.language || 'en';
            let translatedInput = userMessage;

            if (userLang !== 'en') {
                translatedInput = await translateText(userMessage, 'en', userLang);
            }

            try {
                const cluResult = await recognizeIntent(translatedInput);
                const intent = cluResult.result.prediction.topIntent;
                const entities = cluResult.result.prediction.entities;

                await this.dispatchToIntentAsync(context, intent, entities);
            } catch (err) {
                console.error('CLU error:', err.message || err);
                await this.sendTranslatedText(context, "⚠️ Sorry, I couldn't understand that. Please try again.", userLang);
            }

            await next();
        });

        this.onDialog(async (context, next) => {
            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            await this.sendWelcomeMessage(context);
            await next();
        });
    }

    async sendTranslatedText(context, text, language) {
        try {
            const finalText = language && language !== 'en'
                ? await translateText(text, language, 'en')
                : text;
            await context.sendActivity(finalText);
        } catch (error) {
            console.error("Translation send failed:", error.message);
            await context.sendActivity(text); // fallback
        }
    }

    async sendWelcomeMessage(turnContext) {
        const { activity } = turnContext;
        for (const member of activity.membersAdded) {
            if (member.id !== activity.recipient.id) {
                const conversationData = await this.conversationData.get(turnContext, {});
                const name = member.name || 'User';
                await this.sendTranslatedText(turnContext, `Welcome to Flight Reservation Bot ${name}.`, conversationData.language || 'en');
                await this.sendSuggestedActions(turnContext);
            }
        }
    }

    async sendSuggestedActions(turnContext) {
        const conversationData = await this.conversationData.get(turnContext, {});
        const lang = conversationData.language || 'en';

        const suggestions = [
            'Search and book Flights ✈️',
            'Comparison(best value flights) 💸',
            'Filter Flights 🔍',
            'Manage Itinerary 📄',
            'Change Language 🌐'
        ];

        const translatedSuggestions = await Promise.all(suggestions.map(s => translateText(s, lang, 'en')));
        const prompt = await translateText(
            'Hi! What would you like to do today?\nFor example: "I want to book a flight from Jaipur to Bengaluru for 3 people today."',
            lang,
            'en'
        );

        const reply = MessageFactory.suggestedActions(translatedSuggestions, prompt);
        await turnContext.sendActivity(reply);
    }

    async dispatchToIntentAsync(context, intent, entities) {
        const previousIntent = await this.previousIntent.get(context, {});
        const conversationData = await this.conversationData.get(context, {});
        let currentIntent = '';

        if (previousIntent.intentName && conversationData.endDialog === false) {
            currentIntent = previousIntent.intentName;
        } else {
            currentIntent = intent;
            await this.previousIntent.set(context, { intentName: intent });
        }

        switch (currentIntent) {
            case 'SearchFlight':
                await this.handleDialog(this.searchFlight, context, entities);
                break;
            case 'PriceCompare':
                await this.handleDialog(this.priceCompare, context, entities);
                break;
            case 'FilterFlight':
                await this.handleDialog(this.filterFlight, context, entities);
                break;
            case 'ManageItinerary':
                await this.handleDialog(this.manageItinerary, context, entities);
                break;
            case 'ChangeLanguage':
                await this.sendTranslatedText(context, "Please type your language code (e.g., `en`, `hi`, `fr`, `es`):", conversationData.language || 'en');
                conversationData.expectingLanguage = true;
                await this.conversationData.set(context, conversationData);
                break;
            default:
                console.log("❓ Unknown intent received");

                // Cancel any ongoing dialog
                const dialogContext = await this.dialogs.createContext(context);
                if (dialogContext.activeDialog) {
                    await dialogContext.cancelAllDialogs();
                }

                // Reset intent tracking
                await this.previousIntent.set(context, {});
                conversationData.endDialog = true;
                await this.conversationData.set(context, conversationData);

                // Send friendly message and suggestions
                await this.sendTranslatedText(
                    context,
                    "🤖 I'm not sure how to help with that. Please choose one of the options below or rephrase your request.",
                    conversationData.language || 'en'
                );
                await this.sendSuggestedActions(context);
                break;
        }
    }

    async handleDialog(dialog, context, entities) {
        const conversationData = await this.conversationData.get(context, {});
        conversationData.endDialog = false;
        await this.conversationData.set(context, conversationData);
        await dialog.run(context, this.dialogState, entities);
        conversationData.endDialog = await dialog.isDialogComplete();
        await this.conversationData.set(context, conversationData);
        if (conversationData.endDialog) {
            await this.previousIntent.set(context, {});
            await this.sendSuggestedActions(context);
        }
    }
}

module.exports.FBBOT = FBBOT;
