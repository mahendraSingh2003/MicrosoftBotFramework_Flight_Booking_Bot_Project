const Amadeus = require('amadeus');

// 🔐 Use environment variables for credentials
const amadeus = new Amadeus({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET
});



async function getIATACode(city) {
  try {
    const response = await amadeus.referenceData.locations.get({
      keyword: city,
      subType: 'AIRPORT,CITY'
    }); 
    // console.log(response)
      return response.data[0].iataCode;
  
  } catch (err) {
    console.error('Error fetching IATA code:', err.message);
    return null;
  }
}

module.exports = { getIATACode };