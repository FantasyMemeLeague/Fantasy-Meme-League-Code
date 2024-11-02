// Import required modules
import TelegramBot from 'node-telegram-bot-api';
import pm2 from 'pm2';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const adminChatId = process.env.ADMIN_CHAT_ID;
let restartAttempts = 0;

console.log("Bot Token:", process.env.TELEGRAM_BOT_TOKEN); // Debugging line

// Error reporting and bot restart functionality
function sendErrorToTelegram(error) {
    const errorMessage = `🚨 The bot encountered an error:\n\n${error.stack || error}\n\nAttempted restarts: ${restartAttempts}/3`;
    bot.sendMessage(adminChatId, errorMessage);
}

function restartBot() {
    pm2.connect((err) => {
        if (err) {
            console.error('PM2 connect error:', err);
            bot.sendMessage(adminChatId, "Error connecting to PM2 for restart.");
            return;
        }
        pm2.restart('FantasyMemeBot', (err) => {
            pm2.disconnect();
            if (err) {
                console.error('PM2 restart error:', err);
                bot.sendMessage(adminChatId, "Error restarting the bot via PM2.");
            } else {
                bot.sendMessage(adminChatId, "Bot is restarting...");
                restartAttempts += 1;
            }
        });
    });
}

function handleBotError(error) {
    console.error('Bot Error:', error);
    sendErrorToTelegram(error);

    if (restartAttempts < 3) {
        restartBot();
    } else {
        bot.sendMessage(adminChatId, "Bot has exceeded maximum restart attempts. Manual intervention required.");
        process.exit(1);
    }
}

// Home menu message
const welcomeMessage = 'Welcome to the Fantasy Meme League! The ultimate memecoin battleground! Choose an option below to get started:';

// Home menu with three buttons: Launch Games, Socials, and More Options
function sendMainMenu(chatId) {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Launch Games', callback_data: 'launch_games' }],
                [{ text: 'Socials', callback_data: 'socials' }],
                [{ text: 'More Options', callback_data: 'more_options' }]
            ]
        }
    };
    bot.sendMessage(chatId, welcomeMessage, options);
}

// Start command to initialize bot interaction
bot.onText(/\/start/, (msg) => {
    sendMainMenu(msg.chat.id);
});

// Callback query listener to handle button clicks
bot.on('callback_query', (callbackQuery) => {
    try {
        const message = callbackQuery.message;

        // Button for launching games (Game Hub)
        if (callbackQuery.data === 'launch_games') {
            const gameHubUrl = "https://your-firebase-app.web.app/index.html";  // Replace with actual game hub URL
            bot.sendMessage(message.chat.id, "Launching Games...", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Open Game Hub', web_app: { url: gameHubUrl } }]
                    ]
                }
            });

        // Button for socials
        } else if (callbackQuery.data === 'socials') {
            const socialsMessage = "Join the Fantasy Meme League Community!\n\n" +
                                   "• [Telegram](https://t.me/+sDDhicGAyQo5NjNh)\n" +
                                   "• [Twitter](https://x.com/FantasyMeme_Fun)";
                                   "• [Reddit](https://www.reddit.com/r/FantasyMemeLeague/?rdt=57421)\n" +
                                   "• [Website](https://yourwebsite.com)";
            bot.sendMessage(message.chat.id, socialsMessage, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to Main Menu', callback_data: 'back_to_main_menu' }]
                    ]
                }
            });

        // Button for more options - navigates to additional features
        } else if (callbackQuery.data === 'more_options') {
            const moreOptionsMessage = "Here are additional options for the Fantasy Meme League:";
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
            bot.sendMessage(message.chat.id, moreOptionsMessage, options);

        // Additional options: Roadmap, Leaderboard, Prizes, Referral Link
        } else if (callbackQuery.data === 'roadmap') {
            bot.sendMessage(message.chat.id, "Here is the roadmap for Fantasy Meme League...");

        } else if (callbackQuery.data === 'leaderboard') {
            bot.sendMessage(message.chat.id, "Here is the leaderboard...");

        } else if (callbackQuery.data === 'prizes') {
            bot.sendMessage(message.chat.id, "Here are the prizes...");

        } else if (callbackQuery.data === 'referral_link') {
            bot.sendMessage(message.chat.id, "Your referral link is coming soon: ...");

        // Navigation back to the main menu
        } else if (callbackQuery.data === 'back_to_main_menu') {
            sendMainMenu(message.chat.id);

        }
    } catch (error) {
        handleBotError(error);
    }
});

// Global error handling
process.on('uncaughtException', (error) => handleBotError(error));
process.on('unhandledRejection', (reason) => handleBotError(reason));
