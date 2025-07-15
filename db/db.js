// db/db.js
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config(); // Load environment variables

const mysql = require('mysql2');

// Load SSL certificate
const serverCa = fs.readFileSync(__dirname + process.env.DB_SSL_CERT);

// Create MySQL connection
const conn = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 3306,
    ssl: {
        rejectUnauthorized: false,
        ca: serverCa
    }
});

// Connect and handle connection errors once
conn.connect(function (err) {
    if (err) {
        console.error('❌ DB Connection Failed:', err.message);
    } else {
        console.log('✅ Connected to Azure MySQL');
    }
});

// Export the connection for use in dialogs
module.exports = conn;
