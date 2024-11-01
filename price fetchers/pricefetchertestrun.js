import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import axios from 'axios';
import { format } from 'date-fns';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env


// Firebase configuration
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Define an array of coin IDs (replace with your actual coins)
const coinIDs = [
    'dogwifhat', 'bonk', 'popcat', 'mew', 'book-of-meme', 'dogecoin',
    'goatseus-maximus', 'shiba-inu', 'ponke', 'fwog', 'mumu-the-bull-3',
    'daddy-tate', 'wen-solana', 'slerf', 'retardio', 'myro',
    'michicoin', 'moo-deng', 'maneki', 'smoking-chicken-fish', 
    'mother-iggy', 'koala-ai', 'fartcoin', 'lock-in', 'dolan-duck', 
    'sigma', 'minimini', 'skibidi-toilet-2', 'another-coin', 'yet-another-coin',
    'final-coin'
];

// Your CoinGecko API key
const COINGECKO_API_KEY = CG-Sjprocess.env.COINGECKO_API_KEY;

// Function to fetch and store data for selected coins
async function fetchAndStoreSelectedCoins(coins) {
    try {
        for (const id of coins) {
            const url = `https://api.coingecko.com/api/v3/coins/${id}?&api_key=${COINGECKO_API_KEY}`;
            try {
                const response = await axios.get(url);
                const coin = response.data;

                const currentPrice = coin.market_data.current_price.usd;
                const coinName = coin.name;
                const localTimestamp = format(new Date(), 'HH:mm');

                // Prepare to update Firestore document for the coin
                const coinDocRef = doc(db, 'selected_coins', id);
                const dataToStore = {
                    id: coin.id,
                    name: coinName,
                    current_price: currentPrice,
                    higher_or_lower: [],
                    timestamps: []
                };

                // Fetch the existing document to update it
                const docSnapshot = await getDoc(coinDocRef);
                if (docSnapshot.exists()) {
                    const existingData = docSnapshot.data();
                    const previousPrice = existingData.current_price;
                    dataToStore.higher_or_lower = existingData.higher_or_lower || [];
                    dataToStore.timestamps = existingData.timestamps || [];

                    if (currentPrice > previousPrice) {
                        dataToStore.higher_or_lower.push('Higher');
                    } else if (currentPrice < previousPrice) {
                        dataToStore.higher_or_lower.push('Lower');
                    } else {
                        dataToStore.higher_or_lower.push('Same');
                    }
                }

                // Add the current timestamp and limit the arrays to the last 100 entries
                dataToStore.timestamps.push(localTimestamp);
                dataToStore.higher_or_lower = dataToStore.higher_or_lower.slice(-100);
                dataToStore.timestamps = dataToStore.timestamps.slice(-100);

                await setDoc(coinDocRef, dataToStore);
                console.log(`Data for ${coinName} stored successfully!`);
            } catch (fetchError) {
                console.error(`Error fetching data for ${id}:`, fetchError.message);
            }
        }
    } catch (error) {
        console.error('General error during fetch or storage:', error);
    }
}

// Function to cycle through different coin sets
async function cycleThroughCoins() {
    const delayBetweenFetches = 5 * 60 * 1000; // 5 minutes in milliseconds
    let cycle = 0;

    const cycleCoins = async () => {
        const start = cycle * 3;
        const end = start + 3;
        const coinSubset = coinIDs.slice(start, end);
        await fetchAndStoreSelectedCoins(coinSubset);
        cycle = (cycle + 1) % Math.ceil(coinIDs.length / 3); // Cycle through the coins
    };

    // Set interval to fetch the next set of coins every 5 minutes
    setInterval(cycleCoins, delayBetweenFetches);
}

// Start the cycle
cycleThroughCoins();
