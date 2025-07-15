const { WaterfallDialog, ComponentDialog, DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');
const { getIATACode } = require('../services/getIataCode');
const { ConfirmPrompt, ChoicePrompt, DateTimePrompt, NumberPrompt, TextPrompt } = require('botbuilder-dialogs');
const { ShowComparisonDialog } = require('./showComparison');
const { IATACodePrompt } = require('./iataPrompt');
const { translateText } = require('../services/translatorService');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

var endDialog = '';

const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const DATETIME_PROMPT = 'DATETIME_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const IATA_PROMPT = 'IATA_PROMPT';

class PriceCompare extends ComponentDialog {
  constructor(conversationState, conversationData) {
    super('flightDialog');
    this.conversationState = conversationState;
    this.conversationData = conversationData;

    this.addDialog(new ShowComparisonDialog(conversationData));
    this.addDialog(new IATACodePrompt(IATA_PROMPT, this.conversationData));
    this.addDialog(new TextPrompt(TEXT_PROMPT));
    this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
    this.addDialog(new NumberPrompt(NUMBER_PROMPT, this.noOfParticipantsValidator));
    this.addDialog(new DateTimePrompt(DATETIME_PROMPT));

    this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
      this.firstStep.bind(this),
      this.getFrom.bind(this),
      this.getTo.bind(this),
      this.getNumberOfParticipants.bind(this),
      this.getDate.bind(this),
      this.confirmStep.bind(this),
      this.summaryStep.bind(this)
    ]));

    this.initialDialogId = WATERFALL_DIALOG;
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



  async firstStep(step) {
    endDialog = false;
    const entities = step.options || {};

    const fromCity = this.getEntity(entities, 'fromLocation');
    const toCity = this.getEntity(entities, 'toLocation');

    if (fromCity) {
      const fromIATA = await this.getIataCode(fromCity);
      step.values.from = fromIATA || fromCity;
    }

    if (toCity) {
      const toIATA = await this.getIataCode(toCity);
      step.values.to = toIATA || toCity;
    }

    const val = this.getEntity(entities, 'departureDate');
    step.values.date = this.parseUserDate(val);

    step.values.noOfParticipants = this.getEntity(entities, 'passengers');

    return await step.continueDialog();
  }

  async getFrom(step) {
    const lang = await this.getLang(step);
    if (!step.values.from) {
      return await step.prompt(IATA_PROMPT, await translateText('What is your departure city (valid airport city)?', lang));
    }
    return await step.continueDialog();
  }

  async getTo(step) {
    const lang = await this.getLang(step);
    if (!step.values.from) step.values.from = step.result;
    if (!step.values.to) {
      return await step.prompt(IATA_PROMPT, await translateText('What is your destination city (valid airport city)?', lang));
    }
    return await step.continueDialog();
  }

  async getNumberOfParticipants(step) {
    const lang = await this.getLang(step);
    if (!step.values.to) step.values.to = step.result;
    if (!step.values.noOfParticipants) {
      return await step.prompt(NUMBER_PROMPT, await translateText('How many participants (1-150)?', lang));
    }
    return await step.continueDialog();
  }

  async getDate(step) {
    const lang = await this.getLang(step);
    if (!step.values.noOfParticipants) step.values.noOfParticipants = step.result;
    if (!step.values.date) {
      return await step.prompt(DATETIME_PROMPT, await translateText('On which date would you like to see the best value flights? (Format: MM-DD-YYYY or YYYY-MM-DD) You can also type "today" or "tomorrow".', lang));
    }
    return await step.continueDialog();
  }

  async confirmStep(step) {
    const lang = await this.getLang(step);
    if (!step.values.date && step.result && Array.isArray(step.result) && step.result[0]?.value) {
      step.values.date = step.result[0].value;
    }

    const summaryMsg = await translateText(`You have entered the following:
From: ${step.values.from}
To: ${step.values.to}
Passengers: ${step.values.noOfParticipants}
Date: ${JSON.stringify(step.values.date)}`, lang);

    await step.context.sendActivity(summaryMsg);

    const prompt = await translateText('Are you sure you want to search for best value flights?', lang);
    return await step.prompt(CONFIRM_PROMPT, prompt, ['yes', 'no']);
  }

  async summaryStep(step) {
    const lang = await this.getLang(step);
    if (step.result === true) {
      await step.beginDialog('SHOW_COMPARISON_DIALOG', {
        from: step.values.from,
        to: step.values.to,
        date: step.values.date,
        adults: step.values.noOfParticipants
      });
      endDialog = true;
      return await step.endDialog();
    } else {
      await step.context.sendActivity(await translateText("No problem! You chose not to search for a flight.", lang));
      endDialog = true;
      return await step.endDialog();
    }
  }

  async noOfParticipantsValidator(promptContext) {
    return promptContext.recognized.succeeded &&
      promptContext.recognized.value > 0 &&
      promptContext.recognized.value <= 150;
  }

  async getIataCode(city) {
    return await getIATACode(city);
  }

  getEntity(entities, category) {
    if (!Array.isArray(entities)) return null;
    const match = entities.find(e =>
      e?.category?.trim().toLowerCase() === category.trim().toLowerCase()
    );
    return match?.text || null;
  }

  parseUserDate(input) {
    if (!input || typeof input !== 'string') return null;

    const trimmed = input.trim();
    const today = dayjs();

    const formats = [
      'DD-MM-YYYY',
      'MM-DD-YYYY',
      'YYYY-MM-DD',
      'D MMM YYYY',
      'D MMMM YYYY',
      'MMMM D, YYYY',
      'MMM D, YYYY',
      'DD/MM/YYYY',
      'MM/DD/YYYY',
      'MMMM D',
      'MMM D',
      'D MMMM',
      'D MMM'
    ];

    for (const fmt of formats) {
      const parsed = dayjs(trimmed, fmt, true);
      if (parsed.isValid()) {
        let finalDate = parsed;
        if (parsed.year() < 2005) {
          finalDate = parsed.year(today.year());
          if (finalDate.isBefore(today, 'day')) {
            finalDate = finalDate.add(1, 'year');
          }
        }
        return finalDate.format('YYYY-MM-DD');
      }
    }

    const looseParsed = dayjs(trimmed);
    if (looseParsed.isValid()) {
      return looseParsed.format('YYYY-MM-DD');
    }

    return null;
  }

  async getLang(step) {
    const context = step.context;
    const convData = await this.conversationData.get(context, {});
    return convData.language || 'en';
  }

  async isDialogComplete() {
    return endDialog;
  }
}

module.exports.PriceCompare = PriceCompare;
