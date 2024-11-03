import express from 'express';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;
const AEON_SECRET = process.env.AEON_SECRET;

// Middleware to parse JSON payloads
app.use(express.json());

// Webhook endpoint
app.post('/webhooks/subscription', (req, res) => {
    // Validate HMAC signature (if Aeon provides it)
    const signature = req.headers['x-aeon-signature'];
    const hmac = crypto.createHmac('sha256', AEON_SECRET);
    hmac.update(JSON.stringify(req.body));
    const hash = hmac.digest('hex');

    if (signature !== hash) {
        console.log('Invalid signature');
        return res.status(401).send('Unauthorized');
    }

    // Process the subscription data
    const { userId, subscriptionLevel, subscriptionStatus } = req.body;
    
    // (Perform actions, like updating your bot’s database with the new subscription info)
    
    console.log(`Received subscription update for user ${userId}`);
    res.status(200).send('Success');  // Send 200 response to acknowledge receipt
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
