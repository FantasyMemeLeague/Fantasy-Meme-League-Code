const axios = require('axios');

import dotenv from 'dotenv';
dotenv.config();

// URL for supported currencies
const url = 'https://api.coingecko.com/api/v3/simple/supported_vs_currencies';

// Your API key
const apiKey = process.env.COINGECKO_API_KEY; // Load the CoinGecko API key from .env

// Function to fetch supported currencies
async function fetchSupportedCurrencies() {
    try {
        const response = await axios.get(url, {
            headers: {
                'accept': 'application/json',
                'x-cg-pro-api-key': apiKey
            }
        });

        console.log('Supported Currencies:', response.data);
    } catch (error) {
        console.error('Error fetching supported currencies:', error.response ? error.response.data : error.message);
    }
}

// Call the function to fetch supported currencies
fetchSupportedCurrencies();
