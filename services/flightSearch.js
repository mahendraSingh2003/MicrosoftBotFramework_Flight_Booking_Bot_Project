const Amadeus = require('amadeus');

// 🔐 Use environment variables for credentials
const amadeus = new Amadeus({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET
});




async function searchFlights(from, to, date,adults,max) {

  try {

    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: from,
      destinationLocationCode: to,
      departureDate: date,
      adults: adults,
      max: max,
      currencyCode:'INR'
    });


    return response.data;

  } catch (err) {
    console.error('❌ Amadeus API error:', err.response?.data || err.message);
    return ;
  }
}

module.exports = { searchFlights };
