const { spawn } = require('child_process');
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

/**
 * Run the domain update process
 * @returns {Promise<void>}
 */
async function runUpdate() {
  try {
    logger.info('Running domain.js');
    await runProcess('node', ['domain.js']);
    
    logger.info('Running updateTask.js');
    await runProcess('node', ['updateTask.js']);
    
    logger.info('Cron job completed successfully');
  } catch (error) {
    logger.error(`Cron job failed: ${error.message}`);
  }
}

/**
 * Helper function to run a process and return a promise
 * @param {string} command - The command to run
 * @param {Array<string>} args - The arguments for the command
 * @returns {Promise<void>}
 */
function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args);
    
    process.stdout.on('data', (data) => {
      logger.info(`${command} stdout: ${data}`);
    });
    
    process.stderr.on('data', (data) => {
      logger.error(`${command} stderr: ${data}`);
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        logger.info(`${command} process completed successfully`);
        resolve();
      } else {
        const error = new Error(`${command} process exited with code ${code}`);
        logger.error(error.message);
        reject(error);
      }
    });
    
    process.on('error', (error) => {
      logger.error(`Failed to start ${command} process: ${error.message}`);
      reject(error);
    });
  });
}

// If this file is run directly, run the update
if (require.main === module) {
  runUpdate()
    .catch(error => {
      logger.error(`Error in main: ${error.message}`);
      process.exit(1);
    });
}

module.exports = {
  runUpdate
};
