const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs').promises;
const winston = require('winston');
const cron = require('node-cron');
const { performSearchTask, processUserResponse } = require('./task');
const { updateDomainsJson } = require('./domain');
const { updateTaskJs } = require('./updateTask');

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

// Telegram Bot Configuration
const BOT_TOKEN = '8127455390:AAE8PXqnB1S0IARmaOrOf8Pq4U51gL_yVdg';

// Track users who are in the middle of an interactive search
const usersInSearch = new Set();

// Create a bot instance and make it globally available
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
global.bot = bot; // Make bot available globally for task.js

// Express Server Configuration
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8000;

// ===== TELEGRAM BOT HANDLERS =====

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
      processUserResponse(chatId, text);
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
    await bot.sendMessage(chatId, '❌ Sorry, there was an error processing your request.');
  }
});

// Error handler
bot.on('polling_error', (error) => {
  logger.error(`Polling error: ${error.message}`);
});

// ===== EXPRESS SERVER ENDPOINTS =====

// Search endpoint
app.post('/search', async (req, res) => {
  const { query, chat_id } = req.body;
  
  try {
    performSearchTask(query, chat_id);
    return res.json({ status: 'queued', message: `Searching '${query}' in background` });
  } catch (error) {
    logger.error(`Error in search endpoint: ${error.message}`);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// Response endpoint
app.post('/response', async (req, res) => {
  const { text, chat_id } = req.body;
  
  try {
    processUserResponse(chat_id, text);
    return res.json({ status: 'processed', message: 'User response processed' });
  } catch (error) {
    logger.error(`Error in response endpoint: ${error.message}`);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  return res.json({ status: 'ok' });
});

// Update domains endpoint
app.post('/update-domains', async (req, res) => {
  try {
    logger.info('Manual domain update requested');
    const success = await runDomainUpdate();
    
    if (success) {
      return res.json({ status: 'updated', message: 'Domains updated successfully' });
    } else {
      return res.status(500).json({ status: 'error', message: 'Failed to update domains' });
    }
  } catch (error) {
    logger.error(`Error updating domains: ${error.message}`);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// Force update task.js endpoint (for debugging)
app.post('/force-update-task', async (req, res) => {
  try {
    logger.info('Force update task.js requested');
    
    // Use synchronous file operations for simplicity and reliability
    const fs = require('fs');
    
    // Read domains.json
    const domainsData = fs.readFileSync('domains.json', 'utf8');
    const domains = JSON.parse(domainsData);
    logger.info(`Domains data loaded: ${JSON.stringify(domains, null, 2)}`);
    
    // Read task.js
    let taskContent = fs.readFileSync('task.js', 'utf8');
    logger.info(`Task.js file loaded, size: ${taskContent.length} bytes`);
    
    // Update KatWorld Hollywood URL
    if (domains.katworld && domains.katworld.hollywood) {
      const hollywoodUrl = domains.katworld.hollywood;
      taskContent = taskContent.replace(
        /"hollywood": ".*?"/,
        `"hollywood": "${hollywoodUrl}"`
      );
      logger.info(`Updated KatWorld hollywood URL to: ${hollywoodUrl}`);
    }
    
    // Update KatWorld KDrama URL
    if (domains.katworld && domains.katworld.drama) {
      const kdramaUrl = domains.katworld.drama;
      taskContent = taskContent.replace(
        /"kdrama": ".*?"/,
        `"kdrama": "${kdramaUrl}"`
      );
      logger.info(`Updated KatWorld kdrama URL to: ${kdramaUrl}`);
    }
    
    // Update HDHub4u URL
    if (domains.hdhub4u && domains.hdhub4u.main) {
      const hdhub4uUrl = domains.hdhub4u.main;
      taskContent = taskContent.replace(
        /"main": ".*?"/,
        `"main": "${hdhub4uUrl}"`
      );
      logger.info(`Updated HDHub4u main URL to: ${hdhub4uUrl}`);
    }
    
    // Write updated content back to task.js
    fs.writeFileSync('task.js', taskContent, 'utf8');
    logger.info('Successfully wrote updated task.js file');
    
    // Reload the task module
    delete require.cache[require.resolve('./task')];
    const updatedTask = require('./task');
    global.performSearchTask = updatedTask.performSearchTask;
    global.processUserResponse = updatedTask.processUserResponse;
    logger.info('Task module reloaded with updated URLs');
    
    return res.json({ 
      status: 'updated', 
      message: 'Task.js forcefully updated with latest URLs from domains.json' 
    });
  } catch (error) {
    logger.error(`Error force updating task.js: ${error.message}`);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ===== DOMAIN UPDATE FUNCTIONALITY =====

/**
 * Run the domain update process
 * @returns {Promise<boolean>} Success status
 */
async function runDomainUpdate() {
  try {
    logger.info('Starting domain update process');
    
    // Step 1: Update domains.json with latest URLs
    logger.info('Updating domains.json');
    const domains = await updateDomainsJson();
    logger.info(`Domains updated: ${JSON.stringify(domains, null, 2)}`);
    
    // Step 2: Update task.js with URLs from domains.json using our simple approach
    logger.info('Updating task.js directly with simple approach');
    
    try {
      // Use synchronous file operations for simplicity and reliability
      const fs = require('fs');
      
      // Read task.js
      let taskContent = fs.readFileSync('task.js', 'utf8');
      logger.info(`Task.js file loaded, size: ${taskContent.length} bytes`);
      
      let updated = false;
      
      // Update KatWorld Hollywood URL
      if (domains.katworld && domains.katworld.hollywood) {
        const hollywoodUrl = domains.katworld.hollywood;
        const originalContent = taskContent;
        
        // Use exact pattern matching for reliability
        taskContent = taskContent.replace(
          /"hollywood": ".*?"/,
          `"hollywood": "${hollywoodUrl}"`
        );
        
        if (taskContent !== originalContent) {
          updated = true;
          logger.info(`Updated KatWorld hollywood URL to: ${hollywoodUrl}`);
        } else {
          logger.warn(`Failed to update KatWorld hollywood URL`);
        }
      }
      
      // Update KatWorld KDrama URL
      if (domains.katworld && domains.katworld.drama) {
        const kdramaUrl = domains.katworld.drama;
        const originalContent = taskContent;
        
        // Use exact pattern matching for reliability
        taskContent = taskContent.replace(
          /"kdrama": ".*?"/,
          `"kdrama": "${kdramaUrl}"`
        );
        
        if (taskContent !== originalContent) {
          updated = true;
          logger.info(`Updated KatWorld kdrama URL to: ${kdramaUrl}`);
        } else {
          logger.warn(`Failed to update KatWorld kdrama URL`);
        }
      }
      
      // Update HDHub4u URL
      if (domains.hdhub4u && domains.hdhub4u.main) {
        const hdhub4uUrl = domains.hdhub4u.main;
        const originalContent = taskContent;
        
        // Use exact pattern matching for reliability
        taskContent = taskContent.replace(
          /"main": ".*?"/,
          `"main": "${hdhub4uUrl}"`
        );
        
        if (taskContent !== originalContent) {
          updated = true;
          logger.info(`Updated HDHub4u main URL to: ${hdhub4uUrl}`);
        } else {
          logger.warn(`Failed to update HDHub4u main URL`);
        }
      }
      
      if (updated) {
        // Write updated content back to task.js
        fs.writeFileSync('task.js', taskContent, 'utf8');
        logger.info('Successfully wrote updated task.js file');
        
        // Reload the task module to use the updated URLs
        try {
          delete require.cache[require.resolve('./task')];
          const updatedTask = require('./task');
          // Update the global references
          global.performSearchTask = updatedTask.performSearchTask;
          global.processUserResponse = updatedTask.processUserResponse;
          logger.info('Task module reloaded with updated URLs');
          return true;
        } catch (error) {
          logger.error(`Error reloading task module: ${error.message}`);
          return false;
        }
      } else {
        logger.error('No updates were made to task.js');
        return false;
      }
    } catch (error) {
      logger.error(`Error directly updating task.js: ${error.message}`);
      return false;
    }
  } catch (error) {
    logger.error(`Domain update error: ${error.message}`);
    return false;
  }
}

// Schedule domain updates to run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  logger.info('Running scheduled domain update');
  await runDomainUpdate();
});

// ===== START ALL SERVICES =====

// Start the Express server
app.listen(PORT, () => {
  logger.info(`Express server running on port ${PORT}`);
});

// Log that the bot is running
logger.info('Telegram bot is running...');

// Make task functions globally available for reloading
global.performSearchTask = performSearchTask;
global.processUserResponse = processUserResponse;

// Run an initial domain update on startup
setTimeout(async () => {
  logger.info('Running initial domain update');
  await runDomainUpdate();
}, 10000); // Wait 10 seconds after startup

// Keep-alive mechanism to prevent the app from sleeping on free hosting platforms
const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes
setInterval(() => {
  const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  logger.info(`Sending keep-alive ping to ${appUrl}/health`);
  
  axios.get(`${appUrl}/health`)
    .then(response => {
      logger.info(`Keep-alive ping successful: ${response.status}`);
    })
    .catch(error => {
      logger.error(`Keep-alive ping failed: ${error.message}`);
    });
}, KEEP_ALIVE_INTERVAL);

// Export the bot and app for use in other modules if needed
module.exports = { bot, app, runDomainUpdate };

// Log startup message
logger.info('Combined application (Express + Telegram Bot + Domain Updates) is running!');
