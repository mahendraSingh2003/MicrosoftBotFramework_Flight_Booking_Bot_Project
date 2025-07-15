const {
    ComponentDialog,
    WaterfallDialog,
    TextPrompt
} = require('botbuilder-dialogs');
const { translateText } = require('../services/translatorService');

const TRAVELER_DIALOG = 'TRAVELER_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';

class TravelerDetailsDialog extends ComponentDialog {
    constructor(conversationData) {
        super(TRAVELER_DIALOG);
        this.conversationData = conversationData;

        this.addDialog(new TextPrompt(TEXT_PROMPT));

        this.addDialog(new WaterfallDialog(TRAVELER_DIALOG, [
            this.initStep.bind(this),
            this.askFirstName.bind(this),
            this.askLastName.bind(this),
            this.askDOB.bind(this),
            this.askPassport.bind(this),
            this.askEmail.bind(this),
            this.askMobile.bind(this),
            this.askGender.bind(this),
            this.storeTravelerAndLoop.bind(this)
        ]));

        this.initialDialogId = TRAVELER_DIALOG;
    }

    async getLang(step) {
        const convData = await this.conversationData.get(step.context, {});
        return convData.language || 'en';
    }

    async initStep(step) {
        const travelerIndex = step.options?.travelerIndex ?? 0;
        const travelerCount = step.options?.travelerCount ?? 1;
        step.values.travelerIndex = travelerIndex;
        step.values.travelerCount = travelerCount;
        step.values.travelers = step.options.travelers ?? [];

        step.values.traveler = {
            id: `${travelerIndex + 1}`,
            name: {},
            contact: {},
            documents: []
        };

        const lang = await this.getLang(step);
        await step.context.sendActivity(await translateText(`✍️ Entering details for traveler ${travelerIndex + 1} of ${travelerCount}`, lang));
        return await step.next();
    }

    async askFirstName(step) {
        const lang = await this.getLang(step);
        return await step.prompt(TEXT_PROMPT, await translateText("First name:", lang));
    }

    async askLastName(step) {
        step.values.traveler.name.firstName = step.result;
        const lang = await this.getLang(step);
        return await step.prompt(TEXT_PROMPT, await translateText("Last name:", lang));
    }

    async askDOB(step) {
        step.values.traveler.name.lastName = step.result;
        const lang = await this.getLang(step);
        return await step.prompt(TEXT_PROMPT, await translateText("Date of birth (YYYY-MM-DD):", lang));
    }

    async askPassport(step) {
        step.values.traveler.dateOfBirth = step.result;
        const lang = await this.getLang(step);
        return await step.prompt(TEXT_PROMPT, await translateText("Passport number:", lang));
    }

    async askEmail(step) {
        step.values.traveler.passport = step.result;
        const lang = await this.getLang(step);
        return await step.prompt(TEXT_PROMPT, await translateText("Email address:", lang));
    }

    async askMobile(step) {
        step.values.traveler.email = step.result;
        const lang = await this.getLang(step);
        return await step.prompt(TEXT_PROMPT, await translateText("Mobile number:", lang));
    }

    async askGender(step) {
        step.values.traveler.mobile = step.result;
        const lang = await this.getLang(step);
        return await step.prompt(TEXT_PROMPT, await translateText("Gender (MALE/FEMALE/OTHER):", lang));
    }

    async storeTravelerAndLoop(step) {
        const gender = step.result.trim().toUpperCase();
        const traveler = step.values.traveler;

        traveler.gender = ['MALE', 'FEMALE', 'OTHER'].includes(gender) ? gender : 'MALE';
        traveler.contact = {
            emailAddress: traveler.email,
            phones: [{
                deviceType: "MOBILE",
                countryCallingCode: "91",
                number: traveler.mobile
            }]
        };
        traveler.documents = [{
            documentType: "PASSPORT",
            number: traveler.passport,
            expiryDate: "2030-01-01",
            issuanceCountry: "IN",
            nationality: "IN",
            holder: true
        }];

        step.values.travelers.push(traveler);
        step.values.travelerIndex++;

        if (step.values.travelerIndex < step.values.travelerCount) {
            // Restart dialog with next traveler
            return await step.replaceDialog(TRAVELER_DIALOG, {
                travelerCount: step.values.travelerCount,
                travelerIndex: step.values.travelerIndex,
                travelers: step.values.travelers
            });
        }

        // All travelers collected
        return await step.endDialog(step.values.travelers);
    }
}

module.exports = { TravelerDetailsDialog };
