const {
    ComponentDialog,
    DialogSet,
    WaterfallDialog,
    TextPrompt,
    ChoicePrompt,
    ConfirmPrompt,
    DialogTurnStatus
} = require('botbuilder-dialogs');
const { MessageFactory } = require('botbuilder');
const itineraryModel = require('../models/itineraryModel');
const { translateText } = require('../services/translatorService');

const MANAGE_ITINERARY_DIALOG = 'MANAGE_ITINERARY_DIALOG';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const CHOICE_PROMPT = 'CHOICE_PROMPT';

let endDialog = '';

class ManageItinerary extends ComponentDialog {
    constructor(conversationState, conversationData) {
        super('ManageItinerary');

        this.conversationState = conversationState;
        this.conversationData = conversationData;

        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));

        this.addDialog(new WaterfallDialog(MANAGE_ITINERARY_DIALOG, [
            this.promptEmailStep.bind(this),
            this.showItineraryStep.bind(this),
            this.selectItineraryStep.bind(this),
            this.cancelStep.bind(this)
        ]));

        this.initialDialogId = MANAGE_ITINERARY_DIALOG;
    }

    async getLang(step) {
        const convData = await this.conversationData.get(step.context, {});
        return convData.language || 'en';
    }

    async run(turnContext, accessor, entities) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);
        const dialogContext = await dialogSet.createContext(turnContext);

        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            return await dialogContext.beginDialog(this.id, entities);
        }
        return results;
    }

    async promptEmailStep(step) {
        endDialog = false;
        const lang = await this.getLang(step);
        const prompt = await translateText("📧 Please enter your email address to retrieve your itinerary:", lang);
        return await step.prompt(TEXT_PROMPT, prompt);
    }

    async showItineraryStep(step) {
        const lang = await this.getLang(step);
        const email = step.result;
        step.values.email = email;

        const matchingEmailItins = await itineraryModel.getItinerariesByEmail(email);
        const matchingPNRs = [...new Set(matchingEmailItins.map(i => i.pnr))];

        if (matchingPNRs.length === 0) {
            const noItin = await translateText("😔 No itineraries found for this email.", lang);
            await step.context.sendActivity(noItin);
            return await step.endDialog();
        }

        const allItins = await itineraryModel.getItinerariesByPNRs(matchingPNRs);

        const grouped = {};
        for (const item of allItins) {
            if (!grouped[item.pnr]) {
                grouped[item.pnr] = {
                    segments: [],
                    segmentKeys: new Set(), // Track unique segments
                    travelers: new Map()
                };
            }

            // ✅ Prevent duplicate segments
            const segmentKey = `${item.segment_number}_${item.flight_number}_${item.origin}_${item.destination}_${item.departure_time}_${item.arrival_time}`;
            if (!grouped[item.pnr].segmentKeys.has(segmentKey)) {
                grouped[item.pnr].segments.push(item);
                grouped[item.pnr].segmentKeys.add(segmentKey);
            }

            const travelerKey = `${item.traveler_name}_${item.email}_${item.phone}`;
            grouped[item.pnr].travelers.set(travelerKey, {
                id: item.id || '1',
                name: {
                    firstName: item.traveler_name.split(' ')[0],
                    lastName: item.traveler_name.split(' ')[1] || ''
                },
                dateOfBirth: '2000-01-01',
                gender: 'MALE',
                passport: 'XXXXXX123',
                email: item.email,
                mobile: item.phone,
                contact: { emailAddress: item.email, phones: [item.phone] },
                documents: [{ type: 'PASSPORT', number: 'XXXXXX123' }]
            });
        }

        step.values.groupedItineraries = grouped;

        let index = 0;
        for (const pnr in grouped) {
            const { segments, travelers } = grouped[pnr];
            const shared = segments[0];

            const segmentText = await Promise.all(segments.map(async (seg, i) => {
                return await translateText(
                    `✈️ Segment ${i + 1}: ${seg.flight_number}\n📍 ${seg.origin} (T${seg.origin_terminal || 'N/A'}) → ${seg.destination} (T${seg.destination_terminal || 'N/A'})\n🛫 Departure: ${seg.departure_time}\n🛬 Arrival: ${seg.arrival_time}\n🕒 Duration: ${seg.duration}`,
                    lang
                );
            }));

            const travelerList = [...travelers.values()].map((t, i) =>
                `👤 Traveler ${i + 1}:\n- Name: ${t.name.firstName} ${t.name.lastName}\n- DOB: ${t.dateOfBirth}\n- Email: ${t.email}\n- Mobile: ${t.mobile}\n- Gender: ${t.gender}\n- Passport: ${t.passport}`
            ).join('\n\n');

            const confirmMsg = await translateText(
                `✅ ✉️ **Itinerary #${index}**\n\n📄 *Booking ID (PNR)*: ${pnr}\n\n${travelerList}\n\n💰 *Total Price*: ₹${shared.price}\n💸 *Refundable Amount*: ₹${shared.refundable_amount}\n\n${segmentText.join('\n\n')}`,
                lang
            );

            await step.context.sendActivity(confirmMsg);
            index++;
        }

        const confirmPrompt = await translateText("❓ Do you want to cancel a flight from these itineraries?", lang);
        return await step.prompt(CONFIRM_PROMPT, confirmPrompt, ['yes', 'no']);
    }

    async selectItineraryStep(step) {
        const lang = await this.getLang(step);
        if (step.result === false) {
            const cancelMsg = await translateText("✅ Glad we could help you view your itinerary.\nFeel free to reach out if you need further assistance.", lang);
            await step.context.sendActivity(cancelMsg);
            endDialog = true;
            return await step.endDialog();
        }

        const prompt = await translateText("✏️ Please enter the itinerary number (e.g., 0, 1, 2) you want to cancel:", lang);
        return await step.prompt(TEXT_PROMPT, prompt);
    }

    async cancelStep(step) {
        const lang = await this.getLang(step);
        const selectedIndex = parseInt(step.result);
        const grouped = Object.entries(step.values.groupedItineraries);

        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= grouped.length) {
            const invalidMsg = await translateText("❌ Invalid selection. Please start again.", lang);
            await step.context.sendActivity(invalidMsg);
            endDialog = true;
            return await step.endDialog();
        }

        const [pnr, group] = grouped[selectedIndex];

        await itineraryModel.deleteItineraryByPNR(pnr);

        const confirmMsg = await translateText(
            `✅ Your flight with *PNR ${pnr}* has been successfully cancelled.\n💸 *Refund of ₹${group.segments[0].refundable_amount}* has been initiated.\n\nThank you for using our service! ✨`,
            lang
        );
        await step.context.sendActivity(confirmMsg);

        endDialog = true;
        return await step.endDialog();
    }

    async isDialogComplete() {
        return endDialog;
    }
}

module.exports.ManageItinerary = ManageItinerary;
