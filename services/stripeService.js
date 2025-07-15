// services/stripeService.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function createCheckoutSession(amountInRs, currency = 'INR') {
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency,
                    product_data: {
                        name: 'Flight Booking',
                    },
                    unit_amount: amountInRs * 100, // Stripe uses smallest currency unit
                },
                quantity: 1,
            },
        ],
        mode: 'payment',
        success_url: 'https://yourdomain.com/success',
        cancel_url: 'https://yourdomain.com/cancel',
    });
   return { url: session.url, sessionId: session.id };
}
async function verifyPayment(sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.payment_status === 'paid';
}

module.exports = { createCheckoutSession, verifyPayment };

