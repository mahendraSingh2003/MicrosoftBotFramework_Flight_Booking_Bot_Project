
# ✈️ Flight Booking Bot

An intelligent chatbot built with the Microsoft Bot Framework that allows users to search, compare, filter, and book flights using natural language. The bot integrates real-time airline data, secure payments, and multilingual interaction for a seamless booking experience.

---

## 🌟 Key Features
## 🚀 Features

- 🗣️ Conversational flight search
- 🌍 City-to-IATA resolution
- 🔍 Real-time flight offers (Amadeus API)
- 💲 Price comparison and filtering
- 🛫 Airline, class, layover, and duration filters
- 📅 Flexible date input (e.g., "next Friday")
- 🔐 Stripe payment integration
- 🌐 Multilingual support via Azure Translator
- 🧠 Smart entity recognition via CLU
- ☁️ Azure-ready deployment templates

### 💬 Conversational Search
Interact with the bot using natural language to specify:
- Departure and destination cities
- Travel dates (e.g., “tomorrow”, “next Friday”)
- Number of travelers
- Preferred travel class

### 🔍 Real-Time Flight Search
Access live flight data from multiple airlines to get the most accurate prices and seat availability using integrated third-party APIs like **Amadeus**.

### 💸 Price Comparison
Automatically compare fares across different airlines, cabins (economy, business, etc.), and layover durations to show the best value options.

### 🎛 Flight Filtering
Narrow down results using filters like:
- Price range
- Preferred airline
- Travel duration
- Layovers (non-stop, 1-stop, etc.)
- Cabin class

### 🔐 Secure Booking
Complete your flight booking securely within the chat using an integrated payment gateway such as **Stripe**, ensuring safe and reliable transactions.

### 📧 Confirmation & Itinerary Management
Receive instant booking confirmation and access your travel itinerary directly in the chat. Your itinerary is stored and can be retrieved later.

### 🌍 Multilingual Support
Chat with the bot in different languages thanks to real-time translation support, improving accessibility for international users.

---

## 🛠 Tech Stack

- **Node.js** + **Express**
- **Microsoft Bot Framework SDK**
- **Amadeus API** – Flight search & pricing
- **Stripe API** – Secure payments
- **azure Mysql database** – Store itinerary data(retrieve using Email)
- **Azure CLU(conversational understading)** –  Interact with the bot in a natural language way to specify your travel needs (origin, destination, dates, number of travelers, etc.).
- **Azure Translator** –  Multilingual Support: Interact with the bot in multiple languages for wider accessibility
- **dotenv** – Secure configuration

---

## ⚙️ Project Setup

### ✅ Prerequisites

- Node.js (v18+)
- azure Mysql database
- Stripe and Amadeus developer accounts
- Azure Translator subscription (optional for multilingual support)

---

### 📦 Installation

```bash
git clone https://github.com/mahendraSingh2003/MicrosoftBotFramework_Flight_Booking_Bot_Project.git
cd MicrosoftBotFramework_Flight_Booking_Bot_Project
npm install
```

---

### 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# === Azure CLU Configuration ===
CLU_ENDPOINT=https://fbbot.cognitiveservices.azure.com/
CLU_KEY=your_clu_subscription_key
CLU_PROJECT_NAME=your_clu_project_name
CLU_DEPLOYMENT_NAME=your_clu_deployment_name
CLU_REGION=your_clu_region

# === Amadeus API (or similar) ===
CLIENT_ID=your_amadeus_client_id
CLIENT_SECRET=your_amadeus_client_secret

# === Stripe Payment ===
STRIPE_SECRET_KEY=your_stripe_secret_key

# === MySQL Database (Azure) ===
DB_HOST=flightbotserver.mysql.database.azure.com
DB_PORT=3306
DB_USER=your_db_username@flightbotserver
DB_PASSWORD=your_db_password
DB_NAME=flightbotdb
DB_SSL_CERT=./certs/DigiCertGlobalRootCA.crt.pem  # Path to SSL certificate file

# === Azure Translator ===
TRANSLATOR_KEY=your_translator_subscription_key
TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com/
TRANSLATOR_REGION=your_translator_region
```

---

### ▶️ Run the Bot

```bash
npm start
```

Then open the **Bot Framework Emulator** and connect to:

```
http://localhost:3978/api/messages
```

---

## 💬 Sample Prompts

- “Find me a flight from Delhi to Mumbai tomorrow.”
- “Show flights under ₹8000 with Air India.”
- “I want to book a business class ticket next week.”
- “Compare the cheapest and fastest options.”
- “Book this flight.”

---

## 🗂 Folder Structure

```
📦 Flight Booking Bot
├── dialogs/
│   ├── flightDialog.js
│   ├── showFlightsDialog.js
│   ├── filterDialog.js
│   ├── priceComparisonDialog.js
│   ├── travelerDetailsDialog.js
│   ├── paymentDialog.js
|   | ---bookingDialog.js                         
│   └── showBooking.js
├── services/
│   ├── flightSearch.js
│   ├── iataService.js
│   ├── stripeService.js
│   └── translatorService.js
├── models/
│   └── itineraryModel.js
├── bot.js
├── index.js
├── .env
├── package.json
└── README.md
```

---

## 🔌 Integrated APIs

- **Amadeus API** – Fetches real-time flight data and pricing
- **Stripe API** – Handles payment and billing
- **Azure Translator API** – Supports multiple languages
- **Azure CLU**-conversational understainding
- **MySQL Database (Azure)**-storing user booked itinerary


---

## ☁️ Optional Azure Deployment

To deploy the bot to Microsoft Azure:

```bash
az deployment group create   --resource-group YourResourceGroup   --template-file deploymentTemplates/template-with-preexisting-rg.json   --parameters appId=yourAppId appPassword=yourPassword botId=yourBotId ...
```

You can also deploy using GitHub Actions or ZIP deployment methods.

---

## 📝 License

This project is licensed under the MIT License.

---

## 👤 Author

**Mahendra Singh Gurjar**  
GitHub: [@mahendraSingh2003](https://github.com/mahendraSingh2003)

---
## Testing the bot using Bot Framework Emulator

[Bot Framework Emulator](https://github.com/microsoft/botframework-emulator) is a desktop application that allows bot developers to test and debug their bots on localhost or running remotely through a tunnel.

- Install the Bot Framework Emulator version 4.9.0 or greater from [here](https://github.com/Microsoft/BotFramework-Emulator/releases)

### Connect to the bot using Bot Framework Emulator

- Launch Bot Framework Emulator
- File -> Open Bot
- Enter a Bot URL of `http://localhost:3978/api/messages`

## Deploy the bot to Azure

To learn more about deploying a bot to Azure, see [Deploy your bot to Azure](https://aka.ms/azuredeployment) for a complete list of deployment instructions.


## Further reading

- [Bot Framework Documentation](https://docs.botframework.com)
- [Bot Basics](https://docs.microsoft.com/azure/bot-service/bot-builder-basics?view=azure-bot-service-4.0)
- [Dialogs](https://docs.microsoft.com/en-us/azure/bot-service/bot-builder-concept-dialog?view=azure-bot-service-4.0)
- [Gathering Input Using Prompts](https://docs.microsoft.com/en-us/azure/bot-service/bot-builder-prompts?view=azure-bot-service-4.0)
- [Activity processing](https://docs.microsoft.com/en-us/azure/bot-service/bot-builder-concept-activity-processing?view=azure-bot-service-4.0)
- [Azure Bot Service Introduction](https://docs.microsoft.com/azure/bot-service/bot-service-overview-introduction?view=azure-bot-service-4.0)
- [Azure Bot Service Documentation](https://docs.microsoft.com/azure/bot-service/?view=azure-bot-service-4.0)
- [Azure CLI](https://docs.microsoft.com/cli/azure/?view=azure-cli-latest)
- [Azure Portal](https://portal.azure.com)
- [Language Understanding using LUIS](https://docs.microsoft.com/en-us/azure/cognitive-services/luis/)
- [Channels and Bot Connector Service](https://docs.microsoft.com/en-us/azure/bot-service/bot-concepts?view=azure-bot-service-4.0)
- [Restify](https://www.npmjs.com/package/restify)
- [dotenv](https://www.npmjs.com/package/dotenv)
