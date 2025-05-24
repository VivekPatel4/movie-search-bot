const fs = require('fs').promises;
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
 * Update the SITES dictionary in task.js with URLs from domains.json
 * @returns {Promise<boolean>} Success status
 */
async function updateTaskJs() {
  try {
    logger.info('Starting task.js update process');
    
    // Read domains.json
    const domainsData = await fs.readFile('domains.json', 'utf8');
    const domains = JSON.parse(domainsData);
    logger.info(`Domains data loaded: ${JSON.stringify(domains, null, 2)}`);
    
    // Read task.js
    let taskContent = await fs.readFile('task.js', 'utf8');
    logger.info(`Task.js file loaded, size: ${taskContent.length} bytes`);
    
    // Update KatWorld URLs in working_domains
    if (domains.katworld) {
      // Update Hollywood URL
      if (domains.katworld.hollywood) {
        const hollywoodUrl = domains.katworld.hollywood;
        // Simpler pattern that's more likely to match
        const hollywoodPattern = /"hollywood":\s*"[^"]*"/;
        const hollywoodReplacement = `"hollywood": "${hollywoodUrl}"`;
        
        if (taskContent.match(hollywoodPattern)) {
          taskContent = taskContent.replace(hollywoodPattern, hollywoodReplacement);
          logger.info(`Updated KatWorld hollywood URL to: ${hollywoodUrl}`);
        } else {
          logger.error('Could not find hollywood URL pattern in task.js');
        }
      }
      
      // Update KDrama URL (which is "drama" in domains.json)
      if (domains.katworld.drama) {
        const kdramaUrl = domains.katworld.drama;
        // Simpler pattern that's more likely to match
        const kdramaPattern = /"kdrama":\s*"[^"]*"/;
        const kdramaReplacement = `"kdrama": "${kdramaUrl}"`;
        
        if (taskContent.match(kdramaPattern)) {
          taskContent = taskContent.replace(kdramaPattern, kdramaReplacement);
          logger.info(`Updated KatWorld kdrama URL to: ${kdramaUrl}`);
        } else {
          logger.error('Could not find kdrama URL pattern in task.js');
        }
      }
    }
    
    // Update HDHub4u URL in working_domains
    if (domains.hdhub4u && domains.hdhub4u.main) {
      const hdhub4uUrl = domains.hdhub4u.main;
      // Simpler pattern that's more likely to match
      const mainPattern = /"main":\s*"[^"]*"/;
      const mainReplacement = `"main": "${hdhub4uUrl}"`;
      
      if (taskContent.match(mainPattern)) {
        taskContent = taskContent.replace(mainPattern, mainReplacement);
        logger.info(`Updated HDHub4u main URL to: ${hdhub4uUrl}`);
      } else {
        logger.error('Could not find main URL pattern in task.js');
      }
    }
    
    // Write updated content back to task.js
    await fs.writeFile('task.js', taskContent, 'utf8');
    
    logger.info('Successfully updated task.js with latest URLs from domains.json');
    return true;
  } catch (error) {
    logger.error(`Error updating task.js: ${error.message}`);
    return false;
  }
}

// If this file is run directly, update task.js
if (require.main === module) {
  console.log(`Starting update at ${new Date().toISOString()}`);
  updateTaskJs()
    .then(success => {
      if (success) {
        console.log('Task.js updated successfully with latest URLs from domains.json');
      } else {
        console.log('Failed to update task.js');
      }
    })
    .catch(error => {
      console.error(`Error: ${error.message}`);
    });
}

module.exports = {
  updateTaskJs
};