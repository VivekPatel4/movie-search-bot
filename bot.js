const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const winston = require('winston');

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

const BOT_TOKEN = '8127455390:AAE8PXqnB1S0IARmaOrOf8Pq4U51gL_yVdg';
const SEARCH_API_URL = 'http://localhost:8000/search';
const RESPONSE_API_URL = 'http://localhost:8000/response';

// Track users who are in the middle of an interactive search
const usersInSearch = new Set();

// Create a bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

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
    // If user is in the middle of an interactive search, send to response endpoint
    if (usersInSearch.has(chatId)) {
      logger.info(`User ${chatId} is in interactive search, sending to response endpoint`);
      const payload = {
        text: text,
        chat_id: chatId
      };
      
      const response = await axios.post(RESPONSE_API_URL, payload);
      logger.info(`Response API response status: ${response.status}`);
      logger.info(`Response API response: ${JSON.stringify(response.data)}`);
      
      // No need to send a confirmation message here as the API will send responses
    } 
    // Otherwise, start a new search
    else {
      logger.info(`Starting new search for user ${chatId}`);
      const payload = {
        query: text,
        chat_id: chatId
      };
      
      const response = await axios.post(SEARCH_API_URL, payload);
      logger.info(`Search API response status: ${response.status}`);
      logger.info(`Search API response: ${JSON.stringify(response.data)}`);
      
      // Add user to the interactive search set
      usersInSearch.add(chatId);
      logger.info(`Added user ${chatId} to interactive search set`);
      
      // No confirmation message needed as the API will send the site selection options
    }
  } catch (error) {
    logger.error(`Error processing request: ${error.message}`);
    logger.error(`Full error details: ${error.stack}`);
    await bot.sendMessage(chatId, '❌ Sorry, there was an error processing your request.');
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