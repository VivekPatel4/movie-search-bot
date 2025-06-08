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
    
    // Update KatWorld URLs in working_domains only
    if (domains.katworld) {
      // Update Hollywood URL in working_domains
      if (domains.katworld.hollywood) {
        const hollywoodUrl = domains.katworld.hollywood;
        // Match the exact pattern in working_domains section
        const workingDomainsPattern = /"working_domains":\s*{\s*"hollywood":\s*"[^"]*"/;
        const workingDomainsReplacement = `"working_domains": {\n      "hollywood": "${hollywoodUrl}"`;
        
        if (taskContent.match(workingDomainsPattern)) {
          taskContent = taskContent.replace(workingDomainsPattern, workingDomainsReplacement);
          logger.info(`Updated KatWorld hollywood URL in working_domains to: ${hollywoodUrl}`);
        } else {
          logger.error('Could not find hollywood URL pattern in working_domains');
        }
      }
      
      // Update KDrama URL in working_domains
      if (domains.katworld.drama) {
        const kdramaUrl = domains.katworld.drama;
        // Match the exact pattern in working_domains section
        const workingDomainsPattern = /"working_domains":\s*{\s*"kdrama":\s*"[^"]*"/;
        const workingDomainsReplacement = `"working_domains": {\n      "kdrama": "${kdramaUrl}"`;
        
        if (taskContent.match(workingDomainsPattern)) {
          taskContent = taskContent.replace(workingDomainsPattern, workingDomainsReplacement);
          logger.info(`Updated KatWorld kdrama URL in working_domains to: ${kdramaUrl}`);
        } else {
          logger.error('Could not find kdrama URL pattern in working_domains');
        }
      }
    }
    
    // Update HDHub4u URL in working_domains only
    if (domains.hdhub4u && domains.hdhub4u.main) {
      const hdhub4uUrl = domains.hdhub4u.main;
      // Match the exact pattern in working_domains section
      const workingDomainsPattern = /"working_domains":\s*{\s*"main":\s*"[^"]*"/;
      const workingDomainsReplacement = `"working_domains": {\n      "main": "${hdhub4uUrl}"`;
      
      if (taskContent.match(workingDomainsPattern)) {
        taskContent = taskContent.replace(workingDomainsPattern, workingDomainsReplacement);
        logger.info(`Updated HDHub4u main URL in working_domains to: ${hdhub4uUrl}`);
      } else {
        logger.error('Could not find main URL pattern in working_domains');
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