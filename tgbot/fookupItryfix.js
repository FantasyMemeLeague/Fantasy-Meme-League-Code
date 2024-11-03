// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

// Import required modules
import TelegramBot from 'node-telegram-bot-api';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from './firebaseconfig.js'; // Firestore configuration file
import dayjs from 'dayjs';

const token = process.env.TELEGRAM_BOT_TOKEN;   
const bot = new TelegramBot(token, { polling: true });
const adminChatId = process.env.ADMIN_CHAT_ID;
const welcomeMessage = 'Welcome to the Fantasy Meme League! The ultimate memecoin battleground! Choose an option below to get started:';
const dailyResetInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const weeklyResetInterval = 7 * dailyResetInterval; // 7 days
const monthlyResetInterval = 30 * dailyResetInterval; // 30 days

// Fields that should sync to Firestore
const firestoreFields = [
    'subscriptionLevel',
    'subscriptionStartDate',
    'pointsAllTime',
    'tokensAllTime'
];

// Fields that should remain only in the internal cache
const temporaryFields = [
    'lastSubscriptionCheck'
]

const leaderboardParts = ['daily', 'weekly', 'monthly', AllTime]; // Assume each has multiple parts

let syncInterval = 3 * 60 * 60 * 1000; // Default to 3 hours if no modified players
let lastSyncTime = Date.now();
let lastResetTime = { daily: new Date(), weekly: new Date(), monthly: new Date() };
let playerCache = {};
let cachedPlayerCount = 0; 
let modifiedPlayers = new Set(); // Track players with updated data points
let cachedLeaderboardData = {}; // Stores leaderboard for daily, weekly, monthly


// Function to add a player to the cache and increment player count
function addPlayerToCache(userId, playerData) {
    if (!playerCache[userId]) {
        playerCache[userId] = playerData;
        cachedPlayerCount += 1; // Increment count for new player
    }
}

// Function to log errors to Firestore
async function logErrorToFirestore(error) {
    const errorRef = collection(db, 'errorLogs');
    const errorData = {
        timestamp: new Date(),
        message: error.message || 'Unknown error',
        stack: error.stack || 'No stack trace'
    };
    try {
        await addDoc(errorRef, errorData);
    } catch (logError) {
        console.error('Failed to log error to Firestore:', logError);
    }
}

// Critical error reporting to notify admin on Telegram
async function notifyCriticalError(error) {
    const errorMessage = `🚨 Critical Error: The bot encountered an issue:\n\n${error.stack || error}`;
    try {
        await bot.sendMessage(adminChatId, errorMessage);
    } catch (telegramError) {
        console.error('Failed to send error message on Telegram:', telegramError);
    }
}

// Track recent error timestamps to prevent excessive retries
let errorTimestamps = []; // Array to store timestamps of recent errors
const errorThreshold = 10; // Max number of errors allowed within the time window
const errorTimeWindow = 12 * 60 * 60 * 1000; // 30 minutes in milliseconds

// Function to handle critical errors with rate-limited retries
async function handleCriticalBotError(error) {
    console.error('Critical Bot Error:', error);

    // Log the current error timestamp
    const now = Date.now();
    errorTimestamps.push(now);

    // Filter timestamps, keeping only those within the last 30 minutes
    errorTimestamps = errorTimestamps.filter(timestamp => now - timestamp <= errorTimeWindow);

    // Check if the error threshold has been exceeded within the time window
    if (errorTimestamps.length > errorThreshold) {
        await notifyCriticalError(new Error(`Bot is shutting down due to frequent errors (more than ${errorThreshold} in 30 minutes).`));
        console.error("Shutting down bot due to excessive errors.");
        process.exit(1); // Exit the process to stop the bot
    }

    // Log the error to Firestore
    await logErrorToFirestore(error);

    // Notify admin via Telegram
    await notifyCriticalError(error);

    // Check restart attempts and handle accordingly
    handleRestartAttempts();
}

// Function to manage restart attempts
function handleRestartAttempts() {
    restartAttempts += 1;
    if (restartAttempts >= maxRestarts) {
        console.error(`Reached max restart attempts (${maxRestarts}). Bot will not restart.`);
        notifyCriticalError(new Error(`Max restart attempts (${maxRestarts}) reached. Bot will not restart.`));
        return;
    }
    console.log(`Restart attempt ${restartAttempts} of ${maxRestarts}`);
}

// Reset restart attempts periodically (e.g., every 12 hours)
function resetRestartAttempts() {
    restartAttempts = 0;
    errorTimestamps = []; // Clear error timestamps to reset error tracking
    console.log("Bot is stable; reset restart attempts.");
}

// Function to check and update subscription status when launching games
async function checkSubscriptionStatus(userId) {
    // Check internal cache for player data
    let playerData = playerCache[userId];

    if (playerData && dayjs().isBefore(dayjs(playerData.expiryDate))) {
        // If data is cached and subscription is valid, return it
        return playerData;
    }

    // Fetch data from Firestore if not in cache or expired
    const playerRef = doc(db, 'players', userId.toString());
    let playerDoc = await getDoc(playerRef);

    // If no document exists, defer creation until data modification, return default structure
    if (!playerDoc.exists()) {
        console.log(`User ${userId} does not have a Firestore document. Deferred creation until data modification.`);
        return {
            userId,
            subscriptionLevel: 'Free',
            subscriptionStartDate: null,
            tokensDaily: 0,
            tokensWeekly: 0,
            tokensMonthly: 0,
            tokensAllTime: 0,
            pointsDaily: 0,
            pointsWeekly: 0,
            pointsMonthly: 0,
            pointsAllTime: 0,
            expiryDate: dayjs().add(30, 'day').toDate() // Default expiry for Free
        };
    }

    // Extract and return player data from Firestore
    const data = playerDoc.data();
    const subscriptionData = {
        subscriptionLevel: data.subscriptionLevel,
        subscriptionStartDate: data.subscriptionStartDate,
        tokensDaily: data.tokensDaily,
        tokensWeekly: data.tokensWeekly,
        tokensMonthly: data.tokensMonthly,
        tokensAllTime: data.tokensAllTime,
        pointsDaily: data.pointsDaily,
        pointsWeekly: data.pointsWeekly,
        pointsMonthly: data.pointsMonthly,
        pointsAllTime: data.pointsAllTime,
        expiryDate: data.subscriptionStartDate
            ? dayjs(data.subscriptionStartDate.toDate()).add(30, 'day').toDate()
            : null,
        lastSubscriptionCheck: new Date()
    };

    // Calculate subscription expiry and update status if expired
    const subscriptionStartDate = data.subscriptionStartDate;
    if (data.subscriptionLevel !== 'Free' && subscriptionStartDate) {
        const expiryDate = dayjs(subscriptionStartDate.toDate()).add(30, 'day');
        if (dayjs().isAfter(expiryDate)) {
            await updateDoc(playerRef, {
                subscriptionLevel: 'Free',
                subscriptionStartDate: null
            });
            subscriptionData.subscriptionLevel = 'Free';
            subscriptionData.subscriptionStartDate = null;
            subscriptionData.expiryDate = null;
        } else {
            subscriptionData.daysLeft = expiryDate.diff(dayjs(), 'day');
            subscriptionData.expiryDate = expiryDate.toDate();
        }
    } else {
        subscriptionData.expiryDate = null;
    }

    // Cache player data and return it
    playerCache[userId] = subscriptionData;
    return subscriptionData;
}

    await checkSubscriptionStatus(userId); // Populates cache as needed
    sendMainMenu(chatId); // Show main menu after initial check

// Game Launch Logic using Cache Only
async function onGameLaunch(userId) {
    const playerData = playerCache(userId) {
    
    if (playerData && dayjs().isBefore(dayjs(playerData.expiryDate))) {
        console.log(`Launching game for user ${userId} with subscription level: ${playerData.subscriptionLevel}`);
    } else {
        console.log(`User ${userId} does not have an active subscription.`);
    }
}
// Bot Interaction Logic
// Handles main commands, buttons, etc.
bot.onText(/\/start/, async (msg)) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Home menu with buttons for Launch Games, Socials, Leaderboard, and More Options
function sendMainMenu(chatId) {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Launch Games', callback_data: 'launch_games' }],
                [{ text: 'Socials', callback_data: 'socials' }],
                [{ text: 'Leaderboard', callback_data: 'leaderboard' }],
                [{ text: 'More Options', callback_data: 'more_options' }]
            ]
        }
    };
    bot.sendMessage(chatId, welcomeMessage, options);
}

// Start command to initialize bot interaction
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const subscriptionMessage = await checkSubscriptionStatus(userId);
    if (subscriptionMessage.subscriptionLevel !== 'Free') {
        const daysLeft = subscriptionMessage.daysLeft || 0;
        bot.sendMessage(chatId, `Subscription active. You have ${daysLeft} days left.`);
    }

    sendMainMenu(chatId);
});

// Callback query listener to handle button clicks
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;

    try {
        if (callbackQuery.data === 'launch_games') {
            const gameHubUrl = "https://your-firebase-app.web.app/index.html";
            bot.sendMessage(chatId, "Launching Games...", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Open Game Hub', web_app: { url: gameHubUrl } }]
                    ]
                }
            });

        } else if (callbackQuery.data === 'socials') {
            const socialsMessage = "Join the Fantasy Meme League Community!\n\n" +
                                   "• [Telegram](https://t.me/+sDDhicGAyQo5NjNh)\n" +
                                   "• [Twitter](https://x.com/FantasyMeme_Fun)\n" +
                                   "• [Reddit](https://www.reddit.com/r/FantasyMemeLeague/?rdt=57421)\n" +
                                   "• [Website](https://yourwebsite.com)";
            bot.sendMessage(chatId, socialsMessage, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to Main Menu', callback_data: 'back_to_main_menu' }]
                    ]
                }
            });

        } else if (callbackQuery.data === 'leaderboard') {
            await showLeaderboard(chatId, userId);

        } else if (callbackQuery.data === 'more_options') {
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Roadmap', callback_data: 'roadmap' }],
                        [{ text: 'Leaderboard', callback_data: 'leaderboard' }],
                        [{ text: 'Prizes', callback_data: 'prizes' }],
                        [{ text: 'Referral Link', callback_data: 'referral_link' }],
                        [{ text: 'Back to Main Menu', callback_data: 'back_to_main_menu' }]
                    ]
                }
            };
            bot.sendMessage(chatId, "Here are additional options:", options);

        } else if (callbackQuery.data === 'roadmap') {
            bot.sendMessage(chatId, "Here is the roadmap for Fantasy Meme League...");

        } else if (callbackQuery.data === 'prizes') {
            bot.sendMessage(chatId, "Here are the prizes...");

        } else if (callbackQuery.data === 'referral_link') {
            bot.sendMessage(chatId, "Your referral link is coming soon...");

        } else if (callbackQuery.data === 'back_to_main_menu') {
            sendMainMenu(chatId);
        }
    } catch (error) {
        handleCriticalBotError(error);
    }
});

async function calculateSyncInterval() { /*...*/ }
async function syncModifiedPlayers() { /*...*/ } 

    const maxMonthlyWrites = 750000;
    const modifiedPlayerCount = modifiedPlayers.size || 1; // Ensure at least 1 to avoid divide by zero

    // Set a base sync frequency that increases as more players modify data
    const baseInterval = (30 * 24 * 60 * 60 * 1000) / maxMonthlyWrites; // Roughly equivalent to 1 sync per month per allowed write

    // Adjust the interval based on modified players count, limiting it within a reasonable range
    const interval = Math.min(24 * 60 * 60 * 1000, Math.max(30 * 60 * 1000, baseInterval * modifiedPlayerCount));
    return interval;
}

// Call this when a player’s data is updated or a new player is added
function markPlayerAsModified(userId) {
    modifiedPlayers.add(userId);
}

// Sync function that recalculates interval based on modified player count
async function syncModifiedPlayers() {
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTime;

    // Recalculate interval based on the current number of modified players
    syncInterval = await calculateSyncInterval();

    if (timeSinceLastSync >= syncInterval) {
        console.log(Starting sync for ${modifiedPlayers.size} modified players...);

        // Sync only modified players
        for (const userId of modifiedPlayers) {
            await syncToFirestore(userId);
        }

        // Clear modified players and update last sync time
        modifiedPlayers.clear();
        lastSyncTime = now;
    }

    setTimeout(syncModifiedPlayers, 60 * 1000); // Check every minute
}

// Start the sync loop
syncModifiedPlayers();

// When player modifies data, conditionally create Firestore document
async function createOrUpdateFirestoreDoc(userId, modifiedData) {
    const playerRef = doc(db, 'players', userId.toString());
    let playerDoc = await getDoc(playerRef);

    // Create new document only if it doesn't exist
    if (!playerDoc.exists()) {
        console.log(Creating Firestore document for modified user ${userId}.);
        await setDoc(playerRef, modifiedData); // Save initial data in Firestore
    } else {
        // Update document if it already exists
        await updateDoc(playerRef, modifiedData);
    }
}

// Function to assign a player to the appropriate leaderboard document part
async function assignLeaderboardPart(userId) {
    const playerRef = doc(db, 'players', userId.toString());
    let playerData = await getDoc(playerRef);

    // Estimate part size based on current parts
    let assignedPart;
    for (const period of leaderboardParts) {
        for (let part = 1; ; part++) {
            const docRef = doc(db, `leaderboards/${period}-part${part}`);
            const docSnapshot = await getDoc(docRef);

            // If the document doesn’t exist, assign the player to this part and create the document
            if (!docSnapshot.exists()) {
                await setDoc(docRef, { players: [], lastUpdated: new Date() });
                assignedPart = part;
                break;
            }

            // Check if the document is near 900KB and assign accordingly
            const docData = docSnapshot.data();
            const estimatedSize = JSON.stringify(docData).length;

            if (estimatedSize < 900000) { // 900KB threshold
                assignedPart = part;
                break;
            }
        }
        // Store the part assignment within the player's Firestore document
        await updateDoc(playerRef, {
            [`${period}Part`]: assignedPart // Example field: dailyPart, weeklyPart, etc.
        });
    }
}

function playerDataHasModifiedPoints(playerData) {
    return playerData.pointsDaily > 0 || playerData.tokens > 0 || /* add other relevant fields */
}

// Function to sync internal cache to Firestore
async function syncLeaderboardData() {
    const batch = db.batch();
    try {
        for (const period of leaderboardParts) {
            for (let part = 1; part <= getNumberOfParts(period); part++) {
                const key = `${period}-part${part}`;
                const players = cachedLeaderboardData[key] || [];
                if (players.modified) {
                    const docRef = doc(db, `leaderboards/${key}`);
                    batch.set(docRef, { players, lastUpdated: new Date() });
                    players.modified = false; // Mark as synced
                }
            }
        }
        await batch.commit(); // Apply all updates in a single batch
        console.log("Leaderboard data synced to Firestore.");
    } catch (error) {
        console.error("Error syncing leaderboard data:", error);
    }
}

// Function to reset leaderboard data and distribute rewards
async function resetLeaderboard(period) {
    try {
        // Sync to Firestore before resetting
        await syncLeaderboardData();
        
        // Distribute rewards based on cached data
        await distributeRewards(period);

        // Reset internal cache for the specified period
        for (const userId in playerCache) {
            playerCache[userId][`points${capitalize(period)}`] = 0;
            playerCache[userId][`tokens${capitalize(period)}`] = 0;
        }
        
        lastResetTime[period] = new Date(); // Update last reset time
        console.log(`${capitalize(period)} leaderboard reset.`);
    } catch (error) {
        console.error(`Error resetting ${period} leaderboard:`, error);
    }
}

// Helper function to distribute rewards
async function distributeRewards(period) {
    const rewardsDistributed = [];

    // Iterate through leaderboard cache and distribute rewards
    for (const userId in playerCache) {
        const player = playerCache[userId];
        const rank = player.rank[period];

        const rewardPoints = calculateRewardPoints(rank);
        const rewardTokens = calculateRewardTokens(rank);

        // Update cache with rewarded points and tokens
        player[`points${capitalize(period)}`] += rewardPoints;
        player[`tokens${capitalize(period)}`] += rewardTokens;
        
        rewardsDistributed.push({ userId, rewardPoints, rewardTokens });
    }

    console.log(`Rewards distributed for ${period}:`, rewardsDistributed);
}

// Helper functions
function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function calculateRewardPoints(rank) {
    if (rank === 1) return 100;
    if (rank === 2) return 50;
    return 10;
}

function calculateRewardTokens(rank) {
    if (rank === 1) return 10;
    if (rank === 2) return 5;
    return 1;
}

// Placeholder function to estimate number of parts needed for each leaderboard
function getNumberOfParts(period) {
    // Calculate based on player count and adjust as needed
    return Math.ceil(Object.keys(playerCache).length / 100); // Example value, adjust as necessary
}

// Sync loop to run every 3 hours
setInterval(async () => {
    const now = new Date();
    
    if (now - lastSyncTime >= syncInterval) {
        await syncLeaderboardData();
        lastSyncTime = now;
    }

    // Check if any leaderboard reset is due
    for (const period of leaderboardParts) {
        const resetInterval = period === 'daily' ? dailyResetInterval : period === 'weekly' ? 7 * dailyResetInterval : 30 * dailyResetInterval;
        if (now - lastResetTime[period] >= resetInterval) {
            await resetLeaderboard(period);
        }
    }
}, syncInterval);

// Recovery on bot restart
async function loadLeaderboardDataOnRestart() {
    for (const period of leaderboardParts) {
        for (let part = 1; part <= getNumberOfParts(period); part++) {
            const docRef = doc(db, `leaderboards/${period}-part${part}`);
            const docSnapshot = await getDoc(docRef);
            if (docSnapshot.exists()) {
                cachedLeaderboardData[`${period}-part${part}`] = docSnapshot.data().players;
            }
        }
    }
    console.log("Leaderboard data reloaded from Firestore after restart.");
}

// Initialize leaderboard cache on bot start
loadLeaderboardDataOnRestart();


// Function to display leaderboard information
async function showLeaderboard(chatId, userId) {
    const playerData = await checkSubscriptionStatus(userId);

    const leaderboardMessage = `
🏆 *Your Leaderboard Rankings* 🏆
🔸 Daily Points: ${playerData.pointsDaily} | Rank: ${playerData.rankDaily || 'Unranked'}
🔹 Weekly Points: ${playerData.pointsWeekly} | Rank: ${playerData.rankWeekly || 'Unranked'}
🔸 Monthly Points: ${playerData.pointsMonthly} | Rank: ${playerData.rankMonthly || 'Unranked'}
🔹 All-Time Points: ${playerData.pointsAllTime} | Rank: ${playerData.rankAllTime || 'Unranked'}
🔸 NFT Tokens: ${playerData.tokens}
    `;
    bot.sendMessage(chatId, leaderboardMessage, { parse_mode: 'Markdown' });
}

process.on('uncaughtException', (error) => handleCriticalBotError(error));
process.on('unhandledRejection', (reason) => handleCriticalBotError(reason));
