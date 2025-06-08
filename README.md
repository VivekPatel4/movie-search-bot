# Movie Search Bot

A Telegram bot for searching movies and web series across multiple websites.

## Features

- Search for movies and web series across multiple websites
- Automatically updates domain URLs every 6 hours
- Single process deployment (Express server + Telegram bot + scheduled updates)
- Keep-alive mechanism to prevent sleeping on free hosting platforms

## Setup Instructions

### Prerequisites
- Node.js (v12 or higher)
- npm (Node Package Manager)

### Installation

1. Install dependencies:
```
npm install
```

This will install all required dependencies:
- express
- node-telegram-bot-api
- axios
- cheerio
- puppeteer
- node-cron
- winston

### Running the Application

1. Run the combined application (recommended):
```
npm start
```
or
```
node combined.js
```
This runs both the Express server and Telegram bot in a single process.

2. Start only the Express server:
```
npm run server
```
or
```
node main.js
```

3. Run only the Telegram bot:
```
npm run bot
```
or
```
node bot.js
```

4. Run the scheduler (which starts both the bot and scheduled updates):
```
npm run scheduler
```
or
```
node scheduler.js
```

5. Run a manual update of domain URLs:
```
npm run update
```
or
```
node cronJob.js
```

## Project Structure

- `combined.js` - All-in-one file that runs Express server, Telegram bot, and scheduled domain updates (recommended for deployment)
- `main.js` - Express server with API endpoints
- `bot.js` - Telegram bot implementation
- `task.js` - Core functionality for searching and handling user interactions
- `domain.js` - Web scraping to find current working domains
- `updateTask.js` - Updates the task.js file with new domain URLs
- `cronJob.js` - Runs domain updates (not needed when using combined.js)
- `scheduler.js` - Schedules periodic updates and runs the bot (not needed when using combined.js)
- `domains.json` - Stores current working domain URLs

## Deployment

### Deploying to Render (Free Tier)

1. Sign up for Render at [render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Configure your service:
   - Name: `movie-search-bot` (or any name you prefer)
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start` (this will run combined.js)
   - Select the free plan
5. Set environment variables:
   - `APP_URL`: Your app's URL (e.g., https://movie-search-bot.onrender.com)
6. Click "Create Web Service"

### Deploying to Railway (Free Credit)

1. Sign up for Railway at [railway.app](https://railway.app)
2. Create a new project from GitHub
3. Connect your GitHub repository
4. Railway will automatically detect that it's a Node.js application
5. Set environment variables:
   - `APP_URL`: Your app's URL (e.g., https://movie-search-bot.up.railway.app)
6. Deploy

### Deploying to Fly.io (Free Tier)

1. Sign up for Fly.io at [fly.io](https://fly.io)
2. Install the flyctl CLI
3. Run `fly launch` in your project directory
4. Run `fly deploy`
5. Set environment variables:
   - `fly secrets set APP_URL=https://your-app-name.fly.dev`