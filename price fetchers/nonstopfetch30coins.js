import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import axios from 'axios';
import { format, utcToZonedTime } from 'date-fns-tz';

dotenv.config({ path: '../.env' });

// Access the API key from the environment variables
const apiKey = process.env.COINGECKO_API_KEY;


// Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id",
    measurementId: "your-measurement-id"
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Define an array of 30 coin IDs
const coinIDs = [
    'bitcoin', 'ethereum', 'litecoin', 'ripple', 'cardano', 'dogecoin',
    'polkadot', 'solana', 'shiba-inu', 'avalanche', 'chainlink', 'uniswap',
    'terra-luna', 'vechain', 'cosmos', 'theta-token', 'algorand', 'stellar',
    'tron', 'monero', 'tezos', 'filecoin', 'aave', 'dash', 'neo',
    'zilliqa', 'elrond', 'harmony', 'fantom', 'gala'
];

// Function to fetch and store data for selected coins
async function fetchAndStoreSelectedCoins(coins) {
    try {
        for (const id of coins) {
            const url = `https://api.coingecko.com/api/v3/coins/${id}`;
            try {
                const response = await axios.get(url);
                const coin = response.data;

                const currentPrice = coin.market_data.current_price.usd;
                const coinName = coin.name;

                // Get the current UTC timestamp and convert to local time
                //If 'utcTimestamp' is not needed, remove it
                const timeZone = 'America/New_York'; // Your time zone
                const localDate = utcToZonedTime(new Date(), timeZone);
                const localTimestamp = format(localDate, 'HH:mm');

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

// Function to cycle through different coin sets every hour
let cycle = 0; // To keep track of which set of 10 coins to fetch

function cycleThroughCoins() {
    const start = cycle * 10;
    const end = start + 10;
    const coinSubset = coinIDs.slice(start, end);

    fetchAndStoreSelectedCoins(coinSubset);
    
    // Move to the next cycle (0 -> 1 -> 2 and repeat)
    cycle = (cycle + 1) % 3; // 3 cycles of 10 coins each
}

// Run the cycle every hour
const hourInMilliseconds = 3600000; // 1 hour in milliseconds

// Use setInterval to run it every hour indefinitely
// If you intend to use 'intervalid' later, ensure it's referenced
const intervalId = setInterval(cycleThroughCoins, hourInMilliseconds); //eslint-disable-line no-unused-vars

// To stop the script manually, you can call `clearInterval(intervalId)`.
// This will stop the cycle.
