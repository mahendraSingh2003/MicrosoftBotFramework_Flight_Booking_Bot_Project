const conn = require('../db/db');

// Get all itineraries by email
async function getItinerariesByEmail(email) {
    return new Promise((resolve, reject) => {
        conn.query(
            `SELECT * FROM itineraries WHERE email = ? ORDER BY pnr, segment_number ASC`,
            [email],
            (err, results) => {
                if (err) {
                    console.error("❌ Error fetching itineraries:", err);
                    reject(err);
                } else {
                    resolve(results);
                }
            }
        );
    });
}

// Get all itineraries for a list of PNRs
async function getItinerariesByPNRs(pnrs) {
    return new Promise((resolve, reject) => {
        if (pnrs.length === 0) return resolve([]);

        const placeholders = pnrs.map(() => '?').join(',');
        conn.query(
            `SELECT * FROM itineraries WHERE pnr IN (${placeholders}) ORDER BY pnr, segment_number ASC`,
            pnrs,
            (err, results) => {
                if (err) {
                    console.error("❌ Error fetching itineraries by PNRs:", err);
                    reject(err);
                } else {
                    resolve(results);
                }
            }
        );
    });
}

// Delete all itineraries for a given PNR
async function deleteItineraryByPNR(pnr) {
    return new Promise((resolve, reject) => {
        conn.query(
            'DELETE FROM itineraries WHERE pnr = ?',
            [pnr],
            (err, results) => {
                if (err) {
                    console.error("❌ Error deleting itinerary:", err);
                    reject(err);
                } else {
                    console.log(`✅ Deleted itinerary for PNR: ${pnr}`);
                    resolve(results);
                }
            }
        );
    });
}

module.exports = {
    getItinerariesByEmail,
    getItinerariesByPNRs,
    deleteItineraryByPNR
};
