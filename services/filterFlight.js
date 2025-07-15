const Amadeus = require('amadeus');

const amadeus = new Amadeus({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
});

// ⏱️ Converts ISO 8601 duration like "PT5H30M" → 330 minutes
function parseISODurationToMinutes(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  const hours = parseInt(match?.[1] || 0);
  const minutes = parseInt(match?.[2] || 0);
  return hours * 60 + minutes;
}



async function getFilteredFlights(from, to, date, adults, airline, maxPrice, layovers, userDurationInput, travelClass) {
  try {
    const params = {
      originLocationCode: from,
      destinationLocationCode: to,
      departureDate: date,
      adults: adults,
      nonStop: layovers,
      currencyCode: 'INR',
      max:50
    }
    if (travelClass!=='ALL') {
           params.travelClass = travelClass;
    }
    if(airline){
      params.includedAirlineCodes=airline;
    }
    if(maxPrice){
      params.maxPrice=maxPrice;
    }
    const response = await amadeus.shopping.flightOffersSearch.get(params);
    

    return response.data;

  } catch (error) {
    console.error('❌ Error fetching flights,Please enter valid values', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { getFilteredFlights };
