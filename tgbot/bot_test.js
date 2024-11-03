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
const firestoreFields = [   // Fields that should sync to Firestore
    'subscriptionLevel',
    'subscriptionStartDate',
    'tokens',
    'pointsDaily',
    'pointsWeekly',
    'pointsMonthly',
    'pointsAllTime'
];

// Fields that should remain only in the internal cache
const temporaryFields = [
    'lastSubscriptionCheck'
]
// Internal cache for player data
let playerCache = {};
let cachedPlayerCount = 0; // Internal count of active players in cache

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

// Function to handle and log critical errors with restart attempts
async function handleCriticalBotError(error) {
    console.error('Critical Bot Error:', error);

    // Log the error to Firestore
    await logErrorToFirestore(error);

    // Notify admin via Telegram
    await notifyCriticalError(error);

    // Increment restart attempts and check if limit reached
    restartAttempts += 1;
    if (restartAttempts >= maxRestarts) {
        console.error(`Reached max restart attempts (${maxRestarts}). Bot will not restart.`);
        // Notify admin that max restart attempts were reached
        await notifyCriticalError(new Error(`Max restart attempts (${maxRestarts}) reached. Bot will not restart.`));
        return;
    }

    console.log(`Restart attempt ${restartAttempts} of ${maxRestarts}`);
}

// Reset restart attempts periodically (e.g., every 12 hours)
function resetRestartAttempts() {
    restartAttempts = 0;
    console.log("Bot is stable; reset restart attempts.");
}

// Set interval to reset restart attempts every 12 hours
setInterval(resetRestartAttempts, 12 * 60 * 60 * 1000); // 12 hours

// Global error handling for unhandled exceptions and rejections
process.on('uncaughtException', (error) => handleCriticalBotError(error));
process.on('unhandledRejection', (reason) => handleCriticalBotError(reason));

// Function to add a player to the cache and increment player count
function addPlayerToCache(userId, playerData) {
    if (!playerCache[userId]) {
        playerCache[userId] = playerData;
        cachedPlayerCount += 1; // Increment count for new player
    } else {
        // add in to Track in Firebase Analytics
        // analytics.logEvent("new_player", { userId: userId });
    }
}

// Sync function with adjustable interval based on player count
let syncInterval = 3 * 60 * 60 * 1000; // Default to 3 hours

async function startSyncLoop() {
    setInterval(async () => {
        const playerCount = cachedPlayerCount;

        // Adjust sync frequency based on player count
        if (playerCount > 50) {
            syncInterval = 2 * 60 * 60 * 1000; // 2 hours if more than 50 players
        } else if (playerCount > 100) {
            syncInterval = 1 * 60 * 60 * 1000; // 1 hour if more than 100 players
        } else {
            syncInterval = 3 * 60 * 60 * 1000; // 3 hours for lower player count
        }

        // Sync each player in cache to Firestore
        for (const userId of Object.keys(playerCache)) {
            await syncToFirestore(userId);
        }

    }, syncInterval); // Start with an initial sync interval
}

// Call startSyncLoop when bot starts
startSyncLoop();

// Function to check subscription status and initialize new players if needed
async function checkSubscriptionStatus(userId) {
    // Check internal cache for player data
    let playerData = playerCache[userId];

    // If data exists in cache and the subscription is valid, return it
    if (playerData && dayjs().isBefore(dayjs(playerData.expiryDate))) {
        return playerData;
    }

    // If data is not in cache or has expired, fetch from Firestore
    const playerRef = doc(db, 'players', userId.toString());
    let playerDoc = await getDoc(playerRef);

    // Initialize new player in Firestore if document does not exist
    if (!playerDoc.exists()) {
        const initialData = {
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
            expiryDate: dayjs().add(30, 'day').toDate() // Set expiry date to 30 days from now
        };
        await setDoc(playerRef, initialData);
        playerDoc = await getDoc(playerRef); // Retrieve the newly created document
    }

    // Extract data fro m Firestore
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
    // Check for mismatch in subscription start date between cache and Firestore
    if (
        playerData &&
        firestoreData.subscriptionStartDate &&
        dayjs(firestoreData.subscriptionStartDate.toDate()).isAfter(dayjs(playerData.subscriptionStartDate))
    ) {
        console.log(`Cache mismatch for user ${userId}. Updating cache with latest data from Firestore.`);
    }

    // Update the cache with Firestore data
    playerData = {
        ...firestoreData,
        expiryDate: firestoreData.subscriptionStartDate
            ? dayjs(firestoreData.subscriptionStartDate.toDate()).add(30, 'day').toDate()
            : null,
        lastSubscriptionCheck: new Date()
    };
    playerCache[userId] = playerData; // Update the cache

    return playerData;
}

    // Calculate subscription expiry and status if not Free
    const subscriptionStartDate = data.subscriptionStartDate;
    if (data.subscriptionLevel !== 'Free' && subscriptionStartDate) {
        const expiryDate = dayjs(subscriptionStartDate.toDate()).add(30, 'day');
        // Check if the subscription has expired
        if (dayjs().isAfter(expiryDate)) {
            // Update Firebase only if necessary
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

    // Cache and add player to internal player count if not cached
    addPlayerToCache(userId, subscriptionData);

    return subscriptionData

// Function to display leaderboard information
async function showLeaderboard(chatId, userId) {
    const playerData = await checkSubscriptionStatus(userId);

    const leaderboardMessage = `
🏆 *Your Leaderboard Rankings* 🏆
🔸 Daily Points: ${playerData.pointsDaily} | Rank: ${playerData.rankDaily || 'Unranked'}
🔹 Weekly Points: ${playerData.pointsWeekly} | Rank: ${playerData.rankWeekly || 'Unranked'}
🔸 Monthly Points: ${playerData.pointsMonthly} | Rank: ${playerData.rankMonthly || 'Unranked'}
🔹 All-Time Points: ${playerData.pointsAllTime} | Rank: ${playerData.rankAllTime || 'Unranked'}
🔸 NFT Tokens: ${playerData.tokensAllTime}
    `;
    bot.sendMessage(chatId, leaderboardMessage, { parse_mode: 'Markdown' });
}

// Home menu with buttons for Launch Games, Socials, Leaderboard, and More Options
function sendMainMenu(bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
   
    const subscriptionMessage = await checkSubscriptionStatus(userId);
    if (subscriptionMessage.subscriptionLevel !== 'Free') {
        const daysLeft = subscriptionMessage.daysLeft || 0;
        bot.sendMessage(chatId, `Subscription active. You have ${daysLeft} days left.`);
    }

    // 1. Initial Subscription Check
async function checkSubscriptionStatus(userId) {
    // Logic to check subscription status and populate cache if needed
}

// 2. Bot Interaction Logic
// Handles main commands, buttons, etc.
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    await checkSubscriptionStatus(userId); // Populates cache as needed
    sendMainMenu(chatId); // Show main menu after initial check
});

// 1. Initial Subscription Check
async function checkSubscriptionStatus(userId) {
    // Logic to check subscription status and populate cache if needed
}

// 2. Bot Interaction Logic
// Handles main commands, buttons, etc.
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    await checkSubscriptionStatus(userId); // Populates cache as needed
    sendMainMenu(chatId); // Show main menu after initial check
});

// 3. Game Launch Logic using Cache Only
async function onGameLaunch(userId) {
    let playerData = playerCache[userId];

    if (playerData && dayjs().isBefore(dayjs(playerData.expiryDate))) {
        console.log(`Launching game for user ${userId} with subscription level: ${playerData.subscriptionLevel}`);
    } else {
        console.log(`User ${userId} does not have an active subscription.`);
    }
}

// 2. Bot Interaction Logic
// Handles main commands, buttons, etc.
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    await checkSubscriptionStatus(userId); // Populates cache as needed
    sendMainMenu(chatId); // Show main menu after initial check
});

    sendMainMenu(chatId);
});chatId) {
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

process.on('uncaughtException', (error) => handleCriticalBotError(error));
process.on('unhandledRejection', (reason) => handleCriticalBotError(reason));
