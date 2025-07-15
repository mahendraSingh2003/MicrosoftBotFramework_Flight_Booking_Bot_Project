const Amadeus = require("amadeus");

const amadeus = new Amadeus({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
});

async function bookingService(traveler, selectedFlight) {

    try {
        const pricingResponse = await amadeus.shopping.flightOffers.pricing.post({
            data: {
                type: "flight-offers-pricing",
                flightOffers: [selectedFlight],
            },
        });
        const response = await amadeus.booking.flightOrders.post({
            data: {
                type: "flight-order",
                flightOffers: [pricingResponse.data.flightOffers[0]],
                travelers: traveler
            },
        });
        return response;
        // console.log(response);
    } catch (error) {
        console.error(error);
    }
}

module.exports = { bookingService };