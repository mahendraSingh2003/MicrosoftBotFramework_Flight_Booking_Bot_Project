const { ComponentDialog, WaterfallDialog } = require('botbuilder-dialogs');
const { bookingService } = require('../services/bookingService');
const { translateText } = require('../services/translatorService');
const conn = require('../db/db');

const SHOW_BOOKING_DIALOG = 'SHOW_BOOKING_DIALOG';
let endDialog = '';

class ShowBookingDialog extends ComponentDialog {
    constructor(conversationData, id = SHOW_BOOKING_DIALOG) {
        super(id);
        this.conversationData = conversationData;

        this.addDialog(new WaterfallDialog(SHOW_BOOKING_DIALOG, [
            this.showResults.bind(this)
        ]));

        this.initialDialogId = SHOW_BOOKING_DIALOG;
    }

    async getLang(step) {
        const convData = await this.conversationData.get(step.context, {});
        return convData.language || 'en';
    }

    async showResults(step) {
        const { travelers, selectedFlight } = step.options;
        const lang = await this.getLang(step);

        try {
            const response = await bookingService(travelers, selectedFlight);
            const booking = response.result.data;

            const travelerPricings = booking.flightOffers[0].travelerPricings;
            const itinerary = selectedFlight.itineraries[0];
            const segments = itinerary.segments;
            const pnr = booking.associatedRecords[0].reference;
            const userId = step.context.activity.from.id;

            const formatDateTime = (date) => {
                const options = {
                    hour: 'numeric',
                    minute: 'numeric',
                    hour12: true,
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                };
                return new Date(date).toLocaleString('en-US', options);
            };

            const segmentData = segments.map((seg, idx) => ({
                segmentNumber: idx + 1,
                flightNumber: seg.carrierCode + seg.number,
                origin: seg.departure.iataCode,
                originTerminal: seg.departure.terminal || 'N/A',
                destination: seg.arrival.iataCode,
                destinationTerminal: seg.arrival.terminal || 'N/A',
                departureTime: formatDateTime(seg.departure.at),
                arrivalTime: formatDateTime(seg.arrival.at),
                duration: seg.duration.replace('PT', '').toLowerCase()
            }));

            const travelerData = travelers.map(traveler => ({
                id: traveler.id,
                name: traveler.name,
                dateOfBirth: traveler.dateOfBirth,
                gender: traveler.gender,
                passport: traveler.passport,
                email: traveler.email,
                mobile: traveler.mobile,
                contact: traveler.contact,
                documents: traveler.documents
            }));

            const segmentTextArray = await Promise.all(segmentData.map(async (seg) => {
                const msg =
                    `✈️ Segment ${seg.segmentNumber}: ${seg.flightNumber}\n` +
                    `📍 ${seg.origin} (T${seg.originTerminal}) → ${seg.destination} (T${seg.destinationTerminal})\n` +
                    `🛫 Departure: ${seg.departureTime}\n` +
                    `🛬 Arrival: ${seg.arrivalTime}\n` +
                    `🕒 Duration: ${seg.duration}`;
                return await translateText(msg, lang);
            }));

            const totalPrice = travelerPricings[0].price.total;
            const refundableAmount = travelerPricings[0].price.refundableTaxes;
            const travelClass = travelerPricings[0].fareDetailsBySegment[0].cabin;

            const travelerList = travelerData.map((t, i) =>
                `👤 Traveler ${i + 1}:\n- Name: ${t.name.firstName} ${t.name.lastName}\n- DOB: ${t.dateOfBirth}\n- Email(saved for future use): ${t.email}\n- Mobile: ${t.mobile}\n- Gender: ${t.gender}\n- Passport: ${t.passport}`
            ).join('\n\n');

            const confirmMsg = await translateText(
                `✅ Booking Confirmed!\n\n📄 *Booking ID (PNR)*: ${pnr}\n\n${travelerList}\n\n💰 *Total Price*: ₹${totalPrice}\n💸 *Refundable Amount*: ₹${refundableAmount}\n\n${segmentTextArray.join('\n\n')}`,
                lang
            );

            await step.context.sendActivity(confirmMsg);

            // Save each traveler-segment pair
            for (const traveler of travelerData) {
                for (const seg of segmentData) {
                    conn.query(
                        `INSERT INTO itineraries 
                        (user_id, pnr, traveler_name, email, phone, price, refundable_amount, travel_class,
                        flight_number, origin, origin_terminal, destination, destination_terminal,
                        departure_time, arrival_time, duration, segment_number)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            userId,
                            pnr,
                            traveler.name.firstName + ' ' + traveler.name.lastName,
                            traveler.email,
                            traveler.mobile,
                            totalPrice,
                            refundableAmount,
                            travelClass,
                            seg.flightNumber,
                            seg.origin,
                            seg.originTerminal,
                            seg.destination,
                            seg.destinationTerminal,
                            seg.departureTime,
                            seg.arrivalTime,
                            seg.duration,
                            seg.segmentNumber
                        ],
                        (err) => {
                            if (err) {
                                console.error("❌ Error inserting itinerary:", err);
                            } else {
                                console.log(`✅ Inserted segment ${seg.segmentNumber} for ${traveler.email}`);
                            }
                        }
                    );
                }
            }

        } catch (err) {
            console.error("❌ Booking Error:", err);
            const errorMsg = await translateText("❌ Booking failed due to an internal error. Please try again.", lang);
            await step.context.sendActivity(errorMsg);
        }

        endDialog = true;
        return await step.endDialog();
    }

    async isDialogComplete() {
        return endDialog;
    }
}

module.exports = { ShowBookingDialog };
