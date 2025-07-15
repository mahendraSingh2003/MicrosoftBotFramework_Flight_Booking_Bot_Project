const { WaterfallDialog, ComponentDialog, DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');
const { TextPrompt, ConfirmPrompt, NumberPrompt } = require('botbuilder-dialogs');
const { verifyPayment } = require('../services/stripeService');
const { ShowBookingDialog } = require('./showBooking');
const { TravelerDetailsDialog } = require('./travelerDetailsDialog');
const { PaymentDialog } = require('./paymentDialog');
const { translateText } = require('../services/translatorService');

const BOOKING_DIALOG = 'BOOKING_DIALOG';
const TRAVELER_DIALOG = 'TRAVELER_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';

let endDialog = false;

class BookingDialog extends ComponentDialog {
    constructor(conversationState, conversationData) {
        super('BookingDialog');
        this.conversationState = conversationState;
        this.conversationData = conversationData;

        this.addDialog(new PaymentDialog(conversationData));
        this.addDialog(new TravelerDetailsDialog(conversationData));
        this.addDialog(new ShowBookingDialog(conversationData));
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));

        this.addDialog(new WaterfallDialog(BOOKING_DIALOG, [
            this.firstStep.bind(this),
            this.collectNextTraveler.bind(this),
            this.askConfirm.bind(this),
            this.takePayment.bind(this),
            this.waitForUserDoneInput.bind(this),
            this.waitForPaymentConfirm.bind(this),
            this.finalBooking.bind(this)
        ]));

        this.initialDialogId = BOOKING_DIALOG;
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

    async getLang(step) {
        const convData = await this.conversationData.get(step.context, {});
        return convData.language || 'en';
    }

    async firstStep(step) {
        endDialog = false;

        const selectedFlight = step.options?.selectedFlight;

        step.values.selectedFlight = selectedFlight;
        step.values.amount = selectedFlight.price.grandTotal;
        step.values.travelerCount = selectedFlight.travelerPricings.length;

        return await step.next();
    }

    async collectNextTraveler(step) {
        const travelerCount = step.values.travelerCount;

        return await step.beginDialog(TRAVELER_DIALOG, {
            travelerCount: travelerCount
        });
    }

    async askConfirm(step) {
        step.values.travelers = step.result; // list from TravelerDetailsDialog
        const lang = await this.getLang(step);

        const msg = `✈️ Booking for ${step.values.travelers.length} traveler(s)\n💵 Total Amount: ₹ ${step.values.amount}\n\nProceed to payment?`;
        await step.context.sendActivity(await translateText(msg, lang));

        return await step.prompt(CONFIRM_PROMPT, await translateText('Do you want to continue?', lang), ['yes', 'no']);
    }

    async takePayment(step) {
        const lang = await this.getLang(step);
        if (step.result !== true) {
            await step.context.sendActivity(await translateText("❌ Booking cancelled.", lang));
            endDialog = true;
            return await step.endDialog();
        }

        const amount = step.values.amount;
        return await step.beginDialog('PAYMENT_DIALOG', { amount });
    }

    async waitForUserDoneInput(step) {
        const lang = await this.getLang(step);
        const { sessionId } = step.result;
        step.values.sessionId = sessionId;

        return await step.prompt(TEXT_PROMPT, await translateText("✅ Once you’ve completed the payment, type **done** to continue.", lang));
    }

    async waitForPaymentConfirm(step) {
        const lang = await this.getLang(step);
        const confirmation = typeof step.result === 'string' ? step.result.trim().toLowerCase() : '';

        if (confirmation !== 'done') {
            await step.context.sendActivity(await translateText("❗ Please type **done** after completing the payment.", lang));
            endDialog = true;
            return await step.endDialog();
        }

        const isPaid = await verifyPayment(step.values.sessionId);
        if (!isPaid) {
            await step.context.sendActivity(await translateText("⚠️ Payment not verified. Please try again later.", lang));
            return await step.endDialog();
        }

        return await step.next();
    }

    async finalBooking(step) {
        const { travelers, selectedFlight } = step.values;
       
        await step.beginDialog('SHOW_BOOKING_DIALOG', { travelers, selectedFlight });
        endDialog = true;
        return await step.endDialog();
    }

    async isDialogComplete() {
        return endDialog;
    }
}

module.exports = { BookingDialog };
