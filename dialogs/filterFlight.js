const {
  WaterfallDialog, ComponentDialog, DialogSet, DialogTurnStatus,
  ConfirmPrompt, DateTimePrompt, NumberPrompt, TextPrompt, ChoicePrompt
} = require('botbuilder-dialogs');
const { getIATACode } = require('../services/getIataCode');
const { ShowFilteredFlights } = require('./showFiltered');
const { IATACodePrompt } = require('./iataPrompt');
const { translateText } = require('../services/translatorService');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

let endDialog = '';

const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const DATETIME_PROMPT = 'DATETIME_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const IATA_PROMPT = 'IATA_PROMPT';
const CHOICE_PROMPT = 'CHOICE_PROMPT';

class FilterFlight extends ComponentDialog {
  constructor(conversationState, conversationData) {
    super('FilterFlight');
    this.conversationState = conversationState;
    this.conversationData = conversationData;

    this.addDialog(new ShowFilteredFlights(conversationData));
    this.addDialog(new IATACodePrompt(IATA_PROMPT, this.conversationData));
    this.addDialog(new TextPrompt(TEXT_PROMPT));
    this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
    this.addDialog(new NumberPrompt(NUMBER_PROMPT, this.noOfParticipantsValidator));
    this.addDialog(new DateTimePrompt(DATETIME_PROMPT));
    this.addDialog(new ChoicePrompt(CHOICE_PROMPT));

    this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
      this.firstStep.bind(this),
      this.getFrom.bind(this),
      this.getTo.bind(this),
      this.getNumberOfParticipants.bind(this),
      this.getDate.bind(this),
      this.askAirlineFilter.bind(this),
      this.askMaxPrice.bind(this),
      this.askMaxStops.bind(this),
      this.askMaxDuration.bind(this),
      this.askTravelClass.bind(this),
      this.confirmStep.bind(this),
      this.summaryStep.bind(this)
    ]));

    this.initialDialogId = WATERFALL_DIALOG;
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
    step.values.airline = this.getEntity(entities, 'airline');
    const max = this.getEntity(entities, 'maxPrice');
    step.values.maxPrice = max ? max.replace(/[^\d.]/g, '') : null;
    step.values.layovers = this.getEntity(entities, 'layovers');

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
      return await step.prompt(NUMBER_PROMPT, await translateText('How many passengers (1-150)?', lang));
    }
    return await step.continueDialog();
  }

  async getDate(step) {
    const lang = await this.getLang(step);
    if (!step.values.noOfParticipants) step.values.noOfParticipants = step.result;
    if (!step.values.date) {
      return await step.prompt(DATETIME_PROMPT, await translateText('On which date do you want to filter the flight (MM-DD-YYYY,YYYY-MM-DD)? You can also type (today, tomorrow)', lang));
    }
    return await step.continueDialog();
  }

  async askAirlineFilter(step) {
    const lang = await this.getLang(step);
    if (!step.values.date && step.result?.[0]?.value) {
      step.values.date = step.result[0].value;
    }
    return await step.prompt(TEXT_PROMPT, await translateText('Optional: Filter by airline IATA codes (comma-separated, e.g., AI, EK) or type "no" to skip.', lang));
  }

  async askMaxPrice(step) {
    const lang = await this.getLang(step);
    step.values.airline = step.result.toLowerCase() !== 'no' ? step.result.toUpperCase() : null;
    if (!step.values.maxPrice) {
      return await step.prompt(TEXT_PROMPT, await translateText('Optional: Enter your maximum budget in INR (e.g., 10000), or type "no" to skip.', lang));
    }
    return await step.continueDialog();
  }

  async askMaxStops(step) {
    const lang = await this.getLang(step);
    if (!step.values.maxPrice)
      step.values.maxPrice = step.result.toLowerCase() !== 'no' ? parseInt(step.result) : null;
    return await step.prompt(CONFIRM_PROMPT, await translateText('Would you like to see only direct flights (no layovers)?', lang), ['yes', 'no']);
  }

  async askMaxDuration(step) {
    const lang = await this.getLang(step);
    step.values.layovers = step.result;
    return await step.prompt(TEXT_PROMPT, await translateText('Optional: Enter max travel duration (e.g., 5h, 6h 30m), or type "no" to skip.', lang));
  }

  async askTravelClass(step) {
    const lang = await this.getLang(step);
    const input = step.result.trim().toLowerCase();
    step.values.maxDurationInMinutes = input === 'no' ? null : this.parseUserDuration(input);
    return await step.prompt(CHOICE_PROMPT, {
      prompt: await translateText('Please select a travel class:', lang),
      choices: [
        { value: 'ALL' },
        { value: 'ECONOMY' },
        { value: 'PREMIUM_ECONOMY' },
        { value: 'BUSINESS' },
        { value: 'FIRST' }
      ],
      style: 4
    });
  }

  async confirmStep(step) {
    const lang = await this.getLang(step);
    step.values.travelClass = step.result.value;

    const msg = `You have entered the following:\n\nFrom: ${step.values.from}\nTo: ${step.values.to}\nPassengers: ${step.values.noOfParticipants}\nDate: ${step.values.date}\nAirline: ${step.values.airline}\nMax Price: ₹${step.values.maxPrice}\nNonStop: ${step.values.layovers}\nMax Duration: ${step.values.maxDurationInMinutes ? step.values.maxDurationInMinutes + ' mins' : 'Not specified'}\nTravel Class: ${step.values.travelClass}`;
    await step.context.sendActivity(await translateText(msg, lang));

    return await step.prompt(CONFIRM_PROMPT, await translateText('Are you sure you want to filter flights?', lang), ['yes', 'no']);
  }

  async summaryStep(step) {
    if (step.result === true) {
      await step.beginDialog('SHOW_FILTER_DIALOG', {
        from: step.values.from,
        to: step.values.to,
        date: step.values.date,
        adults: step.values.noOfParticipants,
        airline: step.values.airline,
        maxPrice: step.values.maxPrice,
        layovers: step.values.layovers,
        userDurationInput: step.values.maxDurationInMinutes,
        travelClass: step.values.travelClass
      });
      endDialog = true;
      return await step.endDialog();
    } else {
      await step.context.sendActivity(await translateText('No problem! You chose not to filter the flights.', lang));
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
    const match = entities.find(e => e?.category?.toLowerCase() === category.toLowerCase());
    return match?.text || null;
  }

  parseUserDate(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    const today = dayjs();
    const formats = [
      'DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD',
      'D MMM YYYY', 'D MMMM YYYY', 'MMMM D, YYYY', 'MMM D, YYYY',
      'DD/MM/YYYY', 'MM/DD/YYYY', 'MMMM D', 'MMM D', 'D MMMM', 'D MMM'
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

  parseUserDuration(input) {
    if (!input) return null;
    const match = input.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i);
    const hours = parseInt(match?.[1] || 0);
    const minutes = parseInt(match?.[2] || 0);
    return hours * 60 + minutes;
  }

  async isDialogComplete() {
    return endDialog;
  }
}

module.exports = { FilterFlight };
