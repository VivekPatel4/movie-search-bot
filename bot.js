const TelegramBot = require('node-telegram-bot-api');
const winston = require('winston');
const { performSearchTask, processUserResponse } = require('./task');

// Set up logging
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} - ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

const BOT_TOKEN = process.env.BOT_TOKEN || '8127455390:AAE8PXqnB1S0IARmaOrOf8Pq4U51gL_yVdg';

// Track users who are in the middle of an interactive search
const usersInSearch = new Set();

// Create a bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Make bot available globally for task.js
global.bot = bot;

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, '👋 Welcome to Movie/Web-Series Search Bot!\n\nSimply type any message to start a new search.');
  
  // Remove user from interactive search if they were in one
  if (usersInSearch.has(chatId)) {
    usersInSearch.delete(chatId);
    logger.info(`Removed user ${chatId} from interactive search due to /start command`);
  }
});

// Handle all text messages
bot.on('message', async (msg) => {
  // Skip if it's a command
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  if (!msg.text) {
    return;
  }
  
  const text = msg.text.trim();
  const chatId = msg.chat.id;
  
  logger.info(`Received message: '${text}' from chat_id: ${chatId}`);
  
  try {
    // If user is in the middle of an interactive search, process the response
    if (usersInSearch.has(chatId)) {
      logger.info(`User ${chatId} is in interactive search, processing response`);
      const result = processUserResponse(chatId, text);
      
      // Check if the user's search session has ended
      if (result && result.sessionEnded) {
        usersInSearch.delete(chatId);
        logger.info(`Removed user ${chatId} from interactive search set - session ended`);
      }
    } 
    // Otherwise, start a new search
    else {
      logger.info(`Starting new search for user ${chatId}`);
      performSearchTask(text, chatId);
      
      // Add user to the interactive search set
      usersInSearch.add(chatId);
      logger.info(`Added user ${chatId} to interactive search set`);
    }
  } catch (error) {
    logger.error(`Error processing request: ${error.message}`);
    logger.error(`Full error details: ${error.stack}`);
    
    // Remove user from search set on error
    if (usersInSearch.has(chatId)) {
      usersInSearch.delete(chatId);
      logger.info(`Removed user ${chatId} from interactive search set due to error`);
    }
    
    try {
      await bot.sendMessage(chatId, '❌ Sorry, there was an error processing your request.');
    } catch (sendError) {
      logger.error(`Failed to send error message: ${sendError.message}`);
    }
  }
});

// Error handler
bot.on('polling_error', (error) => {
  logger.error(`Polling error: ${error.message}`);
});

// Start the bot
logger.info('Starting bot...');

// Export the bot for use in other modules
module.exports = bot;

// If this file is run directly, start the bot
if (require.main === module) {
  logger.info('Bot is running...');
}