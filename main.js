const express = require('express');
const { performSearchTask, processUserResponse } = require('./task');
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

const app = express();
app.use(express.json());

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
app.post('/update-domains', (req, res) => {
  try {
    const cronJob = spawn('node', ['cronJob.js']);
    
    cronJob.stdout.on('data', (data) => {
      logger.info(`cronJob stdout: ${data}`);
    });
    
    cronJob.stderr.on('data', (data) => {
      logger.error(`cronJob stderr: ${data}`);
    });
    
    cronJob.on('close', (code) => {
      logger.info(`cronJob process exited with code ${code}`);
      return res.json({ status: 'updated' });
    });
  } catch (error) {
    logger.error(`Error updating domains: ${error.message}`);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});