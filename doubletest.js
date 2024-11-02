// Load environment variables first
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

// Import required modules
import TelegramBot from 'node-telegram-bot-api';
import pm2 from 'pm2';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, } from 'firebase/firestore';
import { db } from './firebaseConfig.js';
import dayjs from 'dayjs';
import { collection, getDocs } from 'firebase/firestore';

async function testFirestore() {
    try {
        const snapshot = await getDocs(collection(db, 'players'));
        console.log('Firestore test successful, documents found:', snapshot.size);
    } catch (error) {
        console.error('Firestore test error:', error);
    }
}

testFirestore();  // Call this function to test Firestore access


testFirestore();  // Call this function to test Firestore access

// Initialize Telegram bot and admin chat ID
const token = process.env.TELEGRAM_BOT_TOKEN;   
const bot = new TelegramBot(token, { polling: true });
const adminChatId = process.env.ADMIN_CHAT_ID;

// Critical error reporting to notify admin on Telegram
function notifyCriticalError(error) {
    const errorMessage = `🚨 Critical Error: The bot encountered an issue:\n\n${error.stack || error}`;
    bot.sendMessage(adminChatId, errorMessage);
}

// Function to handle and log critical errors
function handleCriticalBotError(error) {
    console.error('Critical Bot Error:', error);
    notifyCriticalError(error);  // Send error notification to Telegram
    process.exit(1);  // Exit process for manual restart
}

// Global error handling for unhandled exceptions and rejections
process.on('uncaughtException', (error) => handleCriticalBotError(error));
process.on('unhandledRejection', (reason) => handleCriticalBotError(reason));


// Home menu message
const welcomeMessage = 'Welcome to the Fantasy Meme League! The ultimate memecoin battleground! Choose an option below to get started:';

// Function to check subscription status and initialize new players if needed
async function checkSubscriptionStatus(userId) {
    const playerRef = doc(db, 'players', userId.toString());
    console.log('Player Reference:', playerRef)
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) {
        await setDoc(playerRef, {
            userId: userId,
            subscriptionLevel: 'Free',
            subscriptionStartDate: null,
            tokens: 0,
            pointsDaily: 0,
            pointsWeekly: 0,
            pointsMonthly: 0,
            pointsAllTime: 0,
            rankDaily: null,
            rankWeekly: null,
            rankMonthly: null,
            rankAllTime: null,
            proSubscriptionCount: 0,          // Track Pro subscription purchases
            vipSubscriptionCount: 0,          // Track VIP subscription purchases
            loginHistory: []                  // Store login timestamps
        });
        console.log(`New player added with UserID: ${userId}`);
        return null;   
    } else {
        // Update LoginHistory by appending the current Login timestamp
        await updateDoc(playerRef, {
            loginHistory: arrayUnion(new Date())  // Add current date to login history
        });
    }

    const data = playerDoc.data();
    const subscriptionStartDate = data.subscriptionStartDate;
    const subscriptionLevel = data.subscriptionLevel;

    if (subscriptionLevel === 'Free' || !subscriptionStartDate) {
        return null;
    }

    const daysSinceStart = dayjs().diff(dayjs(subscriptionStartDate.toDate()), 'day');

    if (daysSinceStart >= 30) {
        await updateDoc(playerRef, {
            subscriptionLevel: 'Free',
            subscriptionStartDate: null
        });
        return "Your subscription has expired. Please renew to continue enjoying premium features.";
    } else {
        const daysLeft = 30 - daysSinceStart;
        return `Subscription active. You have ${daysLeft} days remaining on your current subscription.`;
    }
}

// Function to display leaderboard information
async function showLeaderboard(chatId, userId) {
    const playerRef = doc(db, 'players', userId.toString());
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) {
        bot.sendMessage(chatId, "You are not registered in the game yet. Start playing to be ranked!");
        return;
    }

    const data = playerDoc.data();
    const leaderboardMessage = `
🏆 *Your Leaderboard Rankings* 🏆
    
🔸 Daily Points: ${data.pointsDaily} | Rank: ${data.rankDaily || 'Unranked'}
🔹 Weekly Points: ${data.pointsWeekly} | Rank: ${data.rankWeekly || 'Unranked'}
🔸 Monthly Points: ${data.pointsMonthly} | Rank: ${data.rankMonthly || 'Unranked'}
🔹 All-Time Points: ${data.pointsAllTime} | Rank: ${data.rankAllTime || 'Unranked'}
    `;

    bot.sendMessage(chatId, leaderboardMessage, { parse_mode: 'Markdown' });
}

// Home menu with three buttons: Launch Games, Socials, Leaderboard, and More Options
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
    if (subscriptionMessage) {
        await bot.sendMessage(chatId, subscriptionMessage);
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
        handleBotError(error);
    }
});

// Global error handling
process.on('uncaughtException', (error) => handleBotError(error));
process.on('unhandledRejection', (reason) => handleBotError(reason));
