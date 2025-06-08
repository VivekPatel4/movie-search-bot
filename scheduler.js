const cron = require('node-cron');
const winston = require('winston');
const { spawn } = require('child_process');
const { runUpdate } = require('./cronJob');

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

/**
 * Run the Telegram bot in a separate process
 */
function runBot() {
  logger.info('Starting bot in background process');
  
  const botProcess = spawn('node', ['bot.js'], {
    detached: true,
    stdio: 'inherit'
  });
  
  botProcess.on('error', (error) => {
    logger.error(`Failed to start bot process: ${error.message}`);
    // Restart the bot after a delay
    setTimeout(runBot, 10000);
  });
  
  botProcess.on('exit', (code, signal) => {
    logger.error(`Bot process exited with code ${code} and signal ${signal}`);
    // Restart the bot after a delay
    setTimeout(runBot, 10000);
  });
  
  logger.info('Bot started in background process');
}

/**
 * Schedule updates to run 3 times between 12am-3am
 */
function scheduleUpdates() {
  // Schedule updates at 12:00 AM, 1:30 AM, and 3:00 AM
  cron.schedule('0 0 * * *', () => {
    logger.info('Running scheduled update at 12:00 AM');
    runUpdate();
  });
  
  cron.schedule('30 1 * * *', () => {
    logger.info('Running scheduled update at 1:30 AM');
    runUpdate();
  });
  
  cron.schedule('0 3 * * *', () => {
    logger.info('Running scheduled update at 3:00 AM');
    runUpdate();
  });
  
  logger.info('Updates scheduled for 12:00 AM, 1:30 AM, and 3:00 AM daily');
}

/**
 * Run the scheduler to handle periodic tasks
 */
function runScheduler() {
  scheduleUpdates();
  
  // Run the bot
  runBot();
  
  logger.info('Scheduler is running');
}

// If this file is run directly, start the scheduler
if (require.main === module) {
  logger.info(`Starting scheduler at ${new Date().toISOString()}`);
  
  // Run an initial update when starting
  runUpdate()
    .then(() => {
      // Start the scheduler
      runScheduler();
    })
    .catch(error => {
      logger.error(`Initial update failed: ${error.message}`);
      // Start the scheduler anyway
      runScheduler();
    });
}

module.exports = {
  runScheduler,
  scheduleUpdates,
  runBot
};