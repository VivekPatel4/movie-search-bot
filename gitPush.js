const { execSync } = require('child_process');
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} - ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

async function pushToGitHub() {
  try {
    const username = process.env.GH_USERNAME;
    const email = process.env.GH_EMAIL;
    const token = process.env.GH_TOKEN;
    const repo = process.env.REPO_NAME;

    const remoteUrl = `https://${username}:${token}@github.com/${username}/${repo}.git`;

    execSync('git config user.name "' + username + '"');
    execSync('git config user.email "' + email + '"');

    execSync('git add task.js');
    execSync('git commit -m "Auto-update task.js from Railway" || echo "No changes to commit"');
    execSync(`git push "${remoteUrl}" HEAD:main`);

    logger.info('✅ Changes pushed to GitHub successfully!');
  } catch (error) {
    logger.error(`❌ Git push failed: ${error.message}`);
  }
}

if (require.main === module) {
  pushToGitHub();
}

module.exports = { pushToGitHub };
