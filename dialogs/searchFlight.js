const { WaterfallDialog, ComponentDialog, DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');
const { ConfirmPrompt, DateTimePrompt, NumberPrompt, TextPrompt } = require('botbuilder-dialogs');
const { getIATACode } = require('../services/getIataCode');
const { ShowFlightsDialog } = require('./showFlightsDialog');
const { IATACodePrompt } = require('./iataPrompt');
const { translateText } = require('../services/translatorService');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const DATETIME_PROMPT = 'DATETIME_PROMPT';
const SEARCH_FLIGHTS_DIALOG = 'SEARCH_FLIGHTS_DIALOG';
const IATA_PROMPT = 'IATA_PROMPT';

let endDialog = '';

class SearchFlight extends ComponentDialog {
  constructor(conversationState, conversationData) {
    super('SearchFlight');
    this.conversationState = conversationState;
    this.conversationData = conversationData;

    this.addDialog(new ShowFlightsDialog(conversationData));
    this.addDialog(new IATACodePrompt(IATA_PROMPT, this.conversationData));
    this.addDialog(new TextPrompt(TEXT_PROMPT));
    this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
    this.addDialog(new NumberPrompt(NUMBER_PROMPT, this.noOfParticipantsValidator));
    this.addDialog(new DateTimePrompt(DATETIME_PROMPT));

    this.addDialog(new WaterfallDialog(SEARCH_FLIGHTS_DIALOG, [
      this.firstStep.bind(this),
      this.getFrom.bind(this),
      this.getTo.bind(this),
      this.getAdult.bind(this),
      this.getDate.bind(this),
      this.confirmStep.bind(this),
      this.summaryStep.bind(this)
    ]));

    this.initialDialogId = SEARCH_FLIGHTS_DIALOG;
  }

  async run(turnContext, accessor, entities) {
    const dialogSet = new DialogSet(accessor);
    dialogSet.add(this);
    const dialogContext = await dialogSet.createContext(turnContext);
    const results = await dialogContext.continueDialog();
    if (results.status === DialogTurnStatus.empty) {
      return await dialogContext.beginDialog(this.id, entities);
    }
  }

  async firstStep(step) {
    endDialog = false;
    const entities = step.options || {};

    const fromCity = this.getEntity(entities, 'fromLocation');
    const toCity = this.getEntity(entities, 'toLocation');
    const val = this.getEntity(entities, 'departureDate');

    step.values.from = fromCity ? await this.getIataCode(fromCity) : null;
    step.values.to = toCity ? await this.getIataCode(toCity) : null;
    step.values.date = this.parseUserDate(val);
    step.values.adults = this.getEntity(entities, 'passengers');

    return await step.next();
  }

  async getFrom(step) {
    const lang = await this.getLang(step);
    if (!step.values.from) {
      const prompt = await translateText('What is your departure city (valid airport city)?', lang);
      return await step.prompt(IATA_PROMPT, prompt);
    }
    return await step.next();
  }

  async getTo(step) {
    const lang = await this.getLang(step);
    if (!step.values.from) step.values.from = step.result;
    if (!step.values.to) {
      const prompt = await translateText('What is your destination city (valid airport city)?', lang);
      return await step.prompt(IATA_PROMPT, prompt);
    }
    return await step.next();
  }

  async getAdult(step) {
    const lang = await this.getLang(step);
    if (!step.values.to) step.values.to = step.result;
    if (!step.values.adults) {
      const prompt = await translateText('How many passengers (1-150)?', lang);
      return await step.prompt(NUMBER_PROMPT, prompt);
    }
    return await step.next();
  }

  async getDate(step) {
    const lang = await this.getLang(step);
    if (!step.values.adults) step.values.adults = step.result;
    if (!step.values.date) {
      const prompt = await translateText('On which date do you want to Search the flight (MM-DD-YYYY,YYYY-MM-DD)?You can also type "today", "tomorrow"', lang);
      return await step.prompt(DATETIME_PROMPT, prompt);
    }
    return await step.next();
  }

  async confirmStep(step) {
    const lang = await this.getLang(step);
    if (!step.values.date && step.result && Array.isArray(step.result) && step.result[0]?.value) {
      step.values.date = step.result[0].value;
    }

    const summary = `You have entered the following:\n\nFrom: ${step.values.from}\nTo: ${step.values.to}\nPassengers: ${step.values.adults}\nDate: ${step.values.date}`;
    const translatedSummary = await translateText(summary, lang);
    await step.context.sendActivity(translatedSummary);

    const confirmPrompt = await translateText('Are you sure you want to search for flights?', lang);
    return await step.prompt(CONFIRM_PROMPT, confirmPrompt, ['yes', 'no']);
  }

  async summaryStep(step) {
    const lang = await this.getLang(step);
    if (step.result === true) {
      const { from, to, date, adults } = step.values;
      await step.beginDialog('SHOW_FLIGHTS_DIALOG', { from, to, date, adults });
      endDialog = true;
      return await step.endDialog();
    } else {
      const msg = await translateText("No problem! You choose not to search for a flight.", lang);
      await step.context.sendActivity(msg);
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
      'DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD', 'D MMM YYYY', 'D MMMM YYYY',
      'MMMM D, YYYY', 'MMM D, YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY',
      'MMMM D', 'MMM D', 'D MMMM', 'D MMM'
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
    return looseParsed.isValid() ? looseParsed.format('YYYY-MM-DD') : null;
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

module.exports.SearchFlight = SearchFlight;
