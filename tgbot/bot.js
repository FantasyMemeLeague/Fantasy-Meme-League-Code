// Import required modules
import TelegramBot from 'node-telegram-bot-api';
import pm2 from 'pm2';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const adminChatId = process.env.ADMIN_CHAT_ID;  // Replace with your own Telegram chat ID
let restartAttempts = 0;  // Track restart attempts

console.log("Bot Token:", process.env.TELEGRAM_BOT_TOKEN); // Debugging line


bot.onText(/\/restart/, (msg) => {
    if (msg.chat.id === adminChatId) {
        bot.sendMessage(adminChatId, "Manual restart initiated...");
        restartAttempts = 0;  // Reset restart attempts on manual restart
        restartBot();
    } else {
        bot.sendMessage(msg.chat.id, "You are not authorized to restart the bot.");
    }
});

// Function to send error notification to Telegram with detailed information
function sendErrorToTelegram(error) {
    const errorMessage = `🚨 The bot encountered an error:\n\n${error.stack || error}\n\nAttempted restarts: ${restartAttempts}/3`;
    bot.sendMessage(adminChatId, errorMessage);
}

// Function to restart the bot programmatically
function restartBot() {
    pm2.connect((err) => {
        if (err) {
            console.error('PM2 connect error:', err);
            bot.sendMessage(adminChatId, "Error connecting to PM2 for restart.");
            return;
        }
        pm2.restart('FantasyMemeBot', (err) => {  // Ensure the PM2 process name matches
            pm2.disconnect();
            if (err) {
                console.error('PM2 restart error:', err);
                bot.sendMessage(adminChatId, "Error restarting the bot via PM2.");
            } else {
                bot.sendMessage(adminChatId, "Bot is restarting...");
                restartAttempts += 1;  // Increment restart count
            }
        });
    });
}

// Function to handle automatic restart logic
function handleBotError(error) {
    console.error('Bot Error:', error);
    sendErrorToTelegram(error); // Notify admin via Telegram

    // Check if restart attempts exceeded the limit
    if (restartAttempts < 3) {
        restartBot();
    } else {
        bot.sendMessage(adminChatId, "Bot has exceeded maximum restart attempts. Manual intervention required.");
        process.exit(1); // Stop bot after 3 attempts
    }
}

// Welcome message without special characters
const welcomeMessage = 'Welcome To The Fantasy Meme League Test Server! \n\n' +
                       'Press Beta Proving Grounds and enter the Beta Proving Grounds to compete with the top meme coin traders in daily and weekly tournaments. \n\n' +
                       'Ready to test your skills? Let’s get started!';

// Function to send the main menu
function sendMainMenu(chatId) {
    const mainMenuMessage = "Welcome to the main menu!";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Beta Proving Grounds', callback_data: 'start_proving_grounds' }
                ],
                [
                    { text: 'Back', callback_data: 'back_to_main_menu' }
                ]
            ]
        }
    };
    bot.sendMessage(chatId, mainMenuMessage, options);
}

// Start command to initialize bot interaction
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Beta Proving Grounds', callback_data: 'start_proving_grounds' }
                ]
            ]
        }
    };
    bot.sendMessage(chatId, welcomeMessage, options);
});

// Callback query listener to handle button clicks
bot.on('callback_query', (callbackQuery) => {
    try {
        const message = callbackQuery.message;

        if (callbackQuery.data === 'start_proving_grounds') {
            const nextMessage = "Welcome To The Beta Proving Grounds! The Preseason Warm-up Is Gearing Up! " +
                                "Explore the available options to compete and test your skills!";
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Roadmap', callback_data: 'roadmap' }
                        ],
                        [
                            { text: 'Game', url: 'https://www.youtube.com/' },
                            { text: 'Features', callback_data: 'features' }
                        ],
                        [
                            { text: 'Leaderboard', callback_data: 'leaderboard' },
                            { text: 'Prizes', callback_data: 'prizes' }
                        ],
                        [
                            { text: 'Referral Link', callback_data: 'referral_link' },
                            { text: 'Socials', callback_data: 'socials' }
                        ],
                        [
                            { text: 'Back', callback_data: 'back_to_home' }
                        ]
                    ]
                }
            };
            bot.sendMessage(message.chat.id, nextMessage, options);

        } else if (callbackQuery.data === 'socials') {
            const socialsMessage = "Think you've got what it takes to meme harder than a 90's dial-up connection? Prove it! \n\n" +
                                   "Join the Fantasy Meme League Community on Telegram \n\n" +
                                   "Follow us on X to stay updated";
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Telegram', url: 'https://t.me/+sDDhicGAyQo5NjNh' },
                            { text: 'X/Twitter', url: 'https://x.com/FantasyMeme_Fun' }
                        ],
                        [
                            { text: 'Back', callback_data: 'back_to_proving_grounds' }
                        ]
                    ]
                }
            };
            bot.sendMessage(message.chat.id, socialsMessage, options);

        } else if (callbackQuery.data === 'roadmap') {
            bot.sendMessage(message.chat.id, "Here is the roadmap for Fantasy Meme League...");

        } else if (callbackQuery.data === 'features') {
            bot.sendMessage(message.chat.id, "Here are the features of Fantasy Meme League...");

        } else if (callbackQuery.data === 'leaderboard') {
            bot.sendMessage(message.chat.id, "Here is the leaderboard...");

        } else if (callbackQuery.data === 'prizes') {
            bot.sendMessage(message.chat.id, "Here are the prizes...");

        } else if (callbackQuery.data === 'referral_link') {
            bot.sendMessage(message.chat.id, "Your referral link is: ...");

        } else if (callbackQuery.data === 'back_to_main_menu') {
            sendMainMenu(message.chat.id);

        } else if (callbackQuery.data === 'back_to_proving_grounds') {
            const backMessage = "Welcome To The Beta Proving Grounds! The Preseason Warm-up Is Gearing Up! " +
                                "Explore the options to compete and test your skills!";
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Game', url: 'https://www.youtube.com/' },
                            { text: 'Socials', callback_data: 'socials' }
                        ],
                        [
                            { text: 'Back', callback_data: 'back_to_main_menu' }
                        ]
                    ]
                }
            };
            bot.sendMessage(message.chat.id, backMessage, options);
        }

    } catch (error) {
        handleBotError(error);
    }
});

// Global error handling to catch unhandled errors
process.on('uncaughtException', (error) => {
    handleBotError(error);
});

process.on('unhandledRejection', (reason) => {
    handleBotError(reason);
});
