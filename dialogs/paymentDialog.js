const { ComponentDialog, WaterfallDialog } = require('botbuilder-dialogs');
const { createCheckoutSession } = require('../services/stripeService');
const { CardFactory } = require('botbuilder');
const { translateText } = require('../services/translatorService');

const PAYMENT_DIALOG = 'PAYMENT_DIALOG';

class PaymentDialog extends ComponentDialog {
    constructor(conversationData, id = PAYMENT_DIALOG) {
        super(id);
        this.conversationData = conversationData;

        this.addDialog(new WaterfallDialog(PAYMENT_DIALOG, [
            this.collectPayment.bind(this)
        ]));

        this.initialDialogId = PAYMENT_DIALOG;
    }

    async getLang(step) {
        const convData = await this.conversationData.get(step.context, {});
        return convData.language || 'en';
    }

    async collectPayment(step) {
        const lang = await this.getLang(step);
        const { amount } = step.options;

        const { url, sessionId } = await createCheckoutSession(amount);
        step.values.sessionId = sessionId;

        const msg = await translateText(`Click the button below to complete your payment.`, lang);
        const cardTitle = await translateText('Secure Payment', lang);
        const cardSubtitle = await translateText('Pay via Stripe', lang);
        const payNowText = await translateText('Pay Now', lang);

        await step.context.sendActivity({
            text: msg,
            attachments: [CardFactory.heroCard(
                cardTitle,
                cardSubtitle,
                null,
                [{ type: 'openUrl', title: payNowText, value: url }]
            )]
        });

        return await step.endDialog({ sessionId });
    }
}

module.exports = { PaymentDialog };
