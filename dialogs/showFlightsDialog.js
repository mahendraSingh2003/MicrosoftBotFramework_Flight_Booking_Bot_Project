const { ComponentDialog, WaterfallDialog } = require('botbuilder-dialogs');
const { searchFlights } = require('../services/flightSearch');
const { CardFactory } = require('botbuilder');
const { translateText } = require('../services/translatorService');

const SHOW_FLIGHTS_DIALOG = 'SHOW_FLIGHTS_DIALOG';

class ShowFlightsDialog extends ComponentDialog {
    constructor(conversationData, id = SHOW_FLIGHTS_DIALOG) {
        super(id);

        this.conversationData = conversationData;

        this.addDialog(new WaterfallDialog(SHOW_FLIGHTS_DIALOG, [
            this.showResults.bind(this)
        ]));

        this.initialDialogId = SHOW_FLIGHTS_DIALOG;
    }

    async showResults(step) {
        const { from, to, date, adults } = step.options;

        const convData = await this.conversationData.get(step.context, {});
        const userLang = convData.language || 'en';

        try {
            const flights = await searchFlights(from, to, date, adults,5);

            if (!flights || flights.length === 0) {
                const noFlightsMsg = await translateText(`❌ Sorry, no flights found from **${from}** to **${to}** on **${date}**.`, userLang);
                await step.context.sendActivity(noFlightsMsg);
                return await step.endDialog();
            }

            const foundMsg = await translateText(`✅ Found ${flights.length} flights ✈️ from **${from}** to **${to}** on **${date}**:`, userLang);
            await step.context.sendActivity(foundMsg);

            for (const offer of flights) {
                // console.log(offer)
                const itinerary = offer.itineraries[0];
                const segments = itinerary.segments;
                const traveler = offer.travelerPricings?.[0];
                const fareSegment = traveler?.fareDetailsBySegment?.[0];

                const flightSummaryBlocks = await Promise.all(segments.map(async (seg) => {
                    const depDate = new Date(seg.departure.at);
                    const arrDate = new Date(seg.arrival.at);

                    const formatDateTime = (date) => {
                        return date.toLocaleString('en-US', {
                            hour: 'numeric',
                            minute: 'numeric',
                            hour12: true,
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        });
                    };

                    const flightText = `✈️ ${seg.carrierCode}${seg.number} | ${seg.departure.iataCode} (T${seg.departure.terminal}) → ${seg.arrival.iataCode} (T${seg.arrival.terminal})  
🕓 Dep: ${formatDateTime(depDate)} | Arr: ${formatDateTime(arrDate)}  
🕒 Duration: ${seg.duration.replace('PT', '').toLowerCase()}`;

                    return {
                        type: 'TextBlock',
                        text: await translateText(flightText, userLang),
                        wrap: true
                    };
                }));

                const baggage = fareSegment?.includedCheckedBags?.weight
                    ? `${fareSegment.includedCheckedBags.weight}${fareSegment.includedCheckedBags.weightUnit}`
                    : 'N/A';

                const priceText = `${offer.price.currency} ${offer.price.total}`;
                const fareClass = fareSegment?.class || 'N/A';
                const seatsAvailable = offer.numberOfBookableSeats;
                const totalDuration = itinerary.duration;

                const card = {
                    type: 'AdaptiveCard',
                    version: '1.4',
                    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                    body: [
                        ...flightSummaryBlocks,
                        {
                            type: 'TextBlock',
                            text: await translateText(`🕒 Total Duration: ${totalDuration}`, userLang),
                            wrap: true
                        },
                        {
                            type: 'TextBlock',
                            text: await translateText(`💺 Fare Class: ${fareClass}, Seats: ${seatsAvailable}`, userLang),
                            wrap: true
                        },
                        {
                            type: 'TextBlock',
                            text: await translateText(`💰 Price: ${priceText}`, userLang),
                            wrap: true
                        },
                        {
                            type: 'TextBlock',
                            text: await translateText(`🧳 Baggage: ${baggage}`, userLang),
                            wrap: true
                        }
                    ],
                    actions: [
                        {
                            type: 'Action.Submit',
                            title: await translateText('Book Now ✈️', userLang),
                            data: {
                                action: 'book_flight',
                                flightData: offer
                            }
                        }
                    ]
                };

                await step.context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
            }

            return await step.endDialog();

        } catch (err) {
            console.error("❌ Error in showResults:", err.message || err);
            const errorMsg = await translateText("⚠️ An error occurred while fetching flights. Please try again later.", userLang);
            await step.context.sendActivity(errorMsg);
            return await step.endDialog();
        }
    }
}

module.exports = { ShowFlightsDialog };
