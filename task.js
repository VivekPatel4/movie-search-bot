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

const TELEGRAM_TOKEN = process.env.BOT_TOKEN || '8127455390:AAE8PXqnB1S0IARmaOrOf8Pq4U51gL_yVdg';
const TELEGRAM_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

// Site configuration with simplified categories and direct working domains
const SITES = {
  "katworld": {
    "base_url": "https://katworld.net/",
    "categories": {
      "hollywood": "https://katmoviehd.blue/",
      "kdrama": "https://katdrama.com/"
    },
    "working_domains": {
      "hollywood": "https://katmoviehd.blue/",
      "kdrama": ""
    }
  },
  "hdhub4u": {
    "base_url": "https://hdhub4u.tv/",
    "categories": {
      "main": "https://hdhub4u.gl/"
    },
    "working_domains": {
      "main": "https://hdhub4u.gl/"
    }
  },
  "moviesflix": {
    "base_url": "https://themoviesflix.bi/",
    "categories": {
      "search": "movies/webseries",
      "bollywood": "Bollywood/Hindi Movies",
      "hindi_dubbed": "Hindi Dubbed Movies",
      "hollywood": "Hollywood/English Movies",
      "dual_audio": "Dual Audio Movies",
      "web_series": "Web Series",
      "adult": "18+ Adult Content",
      "south": "South Indian Movies (Tamil/Telugu)",
      "regional": "Regional Movies (Bengali/Gujarati/Marathi/Punjabi)",
      "tv_shows": "TV Shows"
    },
    "working_domains": {
      "search": "https://themoviesflix.bi/",
      "bollywood": "https://themoviesflix.bi/category/hindi-movies/",
      "hindi_dubbed": "https://themoviesflix.bi/category/hindi-dubbed/",
      "hollywood": "https://themoviesflix.bi/category/english-movies/",
      "dual_audio": "https://themoviesflix.bi/category/dual-audio/",
      "web_series": "https://themoviesflix.bi/category/web-series/",
      "adult": "https://themoviesflix.bi/category/18-adult/",
      "south": "https://themoviesflix.bi/",
      "regional": "https://themoviesflix.bi/",
      "tv_shows": "https://themoviesflix.bi/category/tv-shows/"
    }
  }
};

// Dictionary to store user states
const userStates = {};

// Cleanup old user states (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  Object.keys(userStates).forEach(chatId => {
    const userState = userStates[chatId];
    if (userState && userState.lastActivity && userState.lastActivity < oneHourAgo) {
      delete userStates[chatId];
      logger.info(`Cleaned up old user state for chat_id: ${chatId}`);
    }
  });
}, 30 * 60 * 1000); // Run cleanup every 30 minutes

/**
 * Start an interactive search process
 * @param {string} query - The search query
 * @param {number} chatId - The Telegram chat ID
 * @returns {Object} Status object
 */
function performSearchTask(query, chatId) {
  logger.info(`Starting search for '${query}' for chat_id: ${chatId}`);
  
  // Initialize or reset user state
  userStates[chatId] = {
    state: 'site_selection',
    query: query,
    site: null,
    category: null,
    lastActivity: Date.now()
  };
  
  // Start the interactive search process
  _handleUserState(chatId);
  
  return { status: 'started', message: 'Interactive search started' };
}

/**
 * Handle the current state of the user's search process
 * @param {number} chatId - The Telegram chat ID
 */
function _handleUserState(chatId) {
  const state = userStates[chatId].state;
  
  if (state === 'site_selection') {
    // Ask user to select a site
    _displaySiteOptions(chatId);
  } else if (state === 'category_selection') {
    // Ask user to select a category
    _displayCategoryOptions(chatId);
  } else if (state === 'searching') {
    // Start the actual search
    const { query, site, category } = userStates[chatId];
    
    // Start the search asynchronously
    _performSearchWithParams(query, chatId, site, category);
    logger.info(`Started background search for '${query}' on ${site}/${category} for chat_id: ${chatId}`);
  }
}

/**
 * Display available sites for user selection
 * @param {number} chatId - The Telegram chat ID
 */
function _displaySiteOptions(chatId) {
  let message = '🌐 *Available Sites:*\n\n';
  
  const siteNames = Object.keys(SITES);
  siteNames.forEach((siteName, index) => {
    message += `${index + 1}. *${siteName.toUpperCase()}*\n`;
  });
  
  message += '\nReply with the number of the site you want to search on.';
  send(chatId, message);
  
  // Update user state
  userStates[chatId].state = 'waiting_for_site';
}

/**
 * Display available categories for the selected site
 * @param {number} chatId - The Telegram chat ID
 */
function _displayCategoryOptions(chatId) {
  const siteName = userStates[chatId].site;
  const categories = SITES[siteName].categories;
  
  let message = `📂 *Categories for ${siteName.toUpperCase()}:*\n\n`;
  
  Object.entries(categories).forEach(([categoryKey, categoryName], index) => {
    message += `${index + 1}. *${categoryKey}* (${categoryName})\n`;
  });
  
  message += '\nReply with the number of the category you want to search in.';
  send(chatId, message);
  
  // Update user state
  userStates[chatId].state = 'waiting_for_category';
}

/**
 * Show options menu after search completion
 * @param {number} chatId - The Telegram chat ID
 */
function _showOptionsMenu(chatId) {
  const message = '\n\n📋 *What would you like to do next?*\n\n' +
                '1️⃣ *New Search* - Start a new search\n' +
                '2️⃣ *Clear Chat* - Clear chat history\n' +
                '3️⃣ *Main Menu* - Return to main menu\n\n' +
                'Reply with the number of your choice.';
  
  send(chatId, message);
  
  // Update user state
  userStates[chatId] = {
    state: 'waiting_for_menu_choice',
    query: null,
    site: null,
    category: null,
    lastActivity: Date.now()
  };
}

/**
 * Process user's response based on their current state
 * @param {number} chatId - The Telegram chat ID
 * @param {string} text - The user's message text
 * @returns {Object} Status object with session information
 */
function processUserResponse(chatId, text) {
  // If we don't have a state for this user, treat it as a new search
  if (!userStates[chatId]) {
    performSearchTask(text, chatId);
    return { status: 'new_search_started', sessionEnded: false };
  }
  
  // Update last activity timestamp
  userStates[chatId].lastActivity = Date.now();
  
  // Get the current state
  const state = userStates[chatId].state;
  
  if (state === 'waiting_for_menu_choice') {
    try {
      const choice = parseInt(text.trim());
      
      if (choice === 1) {
        // New Search
        send(chatId, '🔍 *Starting a new search*');
        performSearchTask('', chatId);
        return { status: 'new_search_started', sessionEnded: false };
      } else if (choice === 2) {
        // Clear Chat - just acknowledge, actual clearing happens in the client
        send(chatId, '🧹 *Chat cleared*\n\nType anything to start a new search.');
        delete userStates[chatId]; // Clean up user state
        return { status: 'chat_cleared', sessionEnded: true };
      } else if (choice === 3) {
        // Main Menu
        send(chatId, '🏠 *Returning to main menu*');
        performSearchTask('', chatId);
        return { status: 'main_menu', sessionEnded: false };
      } else {
        send(chatId, '❌ Invalid choice. Please select a number from the list.');
        _showOptionsMenu(chatId);
        return { status: 'invalid_choice', sessionEnded: false };
      }
    } catch (error) {
      // If not a number, treat as a new search
      performSearchTask(text, chatId);
      return { status: 'new_search_from_invalid_input', sessionEnded: false };
    }
  } else if (state === 'waiting_for_site') {
    try {
      const choice = parseInt(text.trim());
      const siteNames = Object.keys(SITES);
      
      if (choice >= 1 && choice <= siteNames.length) {
        const selectedSite = siteNames[choice - 1];
        userStates[chatId].site = selectedSite;
        userStates[chatId].state = 'category_selection';
        
        logger.info(`User ${chatId} selected site: ${selectedSite}`);
        send(chatId, `You selected: *${selectedSite.toUpperCase()}*`);
        
        // Move to category selection
        _handleUserState(chatId);
        return { status: 'site_selected', sessionEnded: false };
      } else {
        send(chatId, '❌ Invalid choice. Please select a number from the list.');
        // Show site options again
        _displaySiteOptions(chatId);
        return { status: 'invalid_site_choice', sessionEnded: false };
      }
    } catch (error) {
      send(chatId, '❌ Please enter a valid number.');
      // Show site options again
      _displaySiteOptions(chatId);
      return { status: 'invalid_site_input', sessionEnded: false };
    }
  } else if (state === 'waiting_for_category') {
    try {
      const choice = parseInt(text.trim());
      const siteName = userStates[chatId].site;
      const categoryKeys = Object.keys(SITES[siteName].categories);
      
      if (choice >= 1 && choice <= categoryKeys.length) {
        const selectedCategory = categoryKeys[choice - 1];
        userStates[chatId].category = selectedCategory;
        
        const categoryName = SITES[siteName].categories[selectedCategory];
        logger.info(`User ${chatId} selected category: ${selectedCategory} (${categoryName})`);
        send(chatId, `You selected: *${selectedCategory}* (${categoryName})`);
        
        // Special handling for moviesflix site
        if (siteName === 'moviesflix' && selectedCategory !== 'search') {
          // For non-search categories in moviesflix, send direct URL without asking for query
          const directUrl = SITES[siteName].working_domains[selectedCategory];
          
          // Format the site name for display
          const displayName = siteName.toUpperCase();
          
          // Create result message with the direct URL
          const resultMessage = `✅ *${displayName}* (${categoryName})\n${directUrl}`;
          
          // Send the result immediately
          send(chatId, resultMessage);
          logger.info(`Sent direct category URL: ${directUrl}`);
          
          // Show options menu after sending URL
          _showOptionsMenu(chatId);
          return { status: 'direct_category_url_sent', sessionEnded: false };
        } else {
          // For search category or other sites, ask for search query
          send(chatId, '🔍 Now, please enter the movie or series name you want to search for:');
          userStates[chatId].state = 'waiting_for_query';
          return { status: 'waiting_for_search_query', sessionEnded: false };
        }
      } else {
        send(chatId, '❌ Invalid choice. Please select a number from the list.');
        // Show category options again
        _displayCategoryOptions(chatId);
        return { status: 'invalid_category_choice', sessionEnded: false };
      }
    } catch (error) {
      send(chatId, '❌ Please enter a valid number.');
      // Show category options again
      _displayCategoryOptions(chatId);
      return { status: 'invalid_category_input', sessionEnded: false };
    }
  } else if (state === 'waiting_for_query') {
    // User has entered a search query
    const query = text.trim();
    if (query) {
      // Update state
      userStates[chatId].query = query;
      userStates[chatId].state = 'searching';
      
      // Get the selected site and category
      const { site, category } = userStates[chatId];
      
      // Start the search asynchronously
      _performSearchWithParams(query, chatId, site, category);
      logger.info(`Started background search for '${query}' on ${site}/${category} for chat_id: ${chatId}`);
      return { status: 'search_started', sessionEnded: false };
    } else {
      send(chatId, '❌ Please enter a valid search term.');
      send(chatId, '🔍 Please enter the movie or series name you want to search for:');
      return { status: 'invalid_search_query', sessionEnded: false };
    }
  } else {
    // If we're not waiting for a specific response, treat it as a new search
    performSearchTask(text, chatId);
    return { status: 'fallback_new_search', sessionEnded: false };
  }
}

/**
 * Perform direct search using known working domains
 * @param {string} query - The search query
 * @param {number} chatId - The Telegram chat ID
 * @param {string} siteName - The selected site name
 * @param {string} categoryKey - The selected category key
 */
async function _performSearchWithParams(query, chatId, siteName, categoryKey) {
  logger.info(`Starting direct search for '${query}' on ${siteName}/${categoryKey} for chat_id: ${chatId}`);
  try {
    // First, send a message to the user that we're starting the search
    const categoryText = SITES[siteName].categories[categoryKey];
    send(chatId, `🔍 Searching for: *${query}* on *${siteName.toUpperCase()}* in *${categoryKey}* (${categoryText})...`);
    
    // Get the working domain for this site and category
    let workingDomain = SITES[siteName].working_domains[categoryKey];
    
    // If working domain is empty, use the category URL as fallback
    if (!workingDomain || workingDomain.trim() === '') {
      workingDomain = SITES[siteName].categories[categoryKey];
    }
    
    logger.info(`Using working domain: ${workingDomain}`);
    
    // Construct a search URL
    const searchUrl = `${workingDomain}?s=${encodeURIComponent(query)}`;
    logger.info(`Direct search URL: ${searchUrl}`);
    
    // Format the site name for display
    const displayName = siteName.toUpperCase();
    
    // Create result message with the search URL
    const resultMessage = `✅ *${displayName}* (${categoryText})\n${searchUrl}`;
    
    // Send the result immediately
    send(chatId, resultMessage);
    logger.info(`Sent direct search URL: ${searchUrl}`);
    
    // Show options menu after search
    _showOptionsMenu(chatId);
  } catch (error) {
    logger.error(`Error in direct search: ${error.message}\n${error.stack}`);
    // Use fallback search as a last resort
    _fallbackSearchSingleSite(query, chatId, siteName, categoryKey);
    // Show options menu even after fallback
    _showOptionsMenu(chatId);
  }
}

/**
 * Fallback method for a specific site that just generates search URLs without browser automation
 * @param {string} query - The search query
 * @param {number} chatId - The Telegram chat ID
 * @param {string} siteName - The selected site name
 * @param {string} categoryKey - The selected category key
 */
function _fallbackSearchSingleSite(query, chatId, siteName, categoryKey) {
  logger.info(`Using fallback search for '${query}' on ${siteName}/${categoryKey}`);
  try {
    // Get site configuration
    const categoryText = SITES[siteName].categories[categoryKey];
    
    // Get the working domain for this site and category
    let workingDomain = SITES[siteName].working_domains[categoryKey];
    
    // If working domain is empty, use the category URL as fallback
    if (!workingDomain || workingDomain.trim() === '') {
      workingDomain = SITES[siteName].categories[categoryKey];
    }
    
    logger.info(`Using working domain: ${workingDomain}`);
    
    // Construct a search URL
    const searchUrl = `${workingDomain}?s=${encodeURIComponent(query)}`;
    logger.info(`Direct search URL: ${searchUrl}`);
    
    // Format the site name for display
    const displayName = siteName.toUpperCase();
    
    // Create result message
    const resultMessage = `✅ *${displayName}* (${categoryText})\n${searchUrl}`;
    
    // Send the result
    send(chatId, resultMessage);
    logger.info(`Sent fallback search URL: ${searchUrl}`);
    
    // Show options menu after search
    _showOptionsMenu(chatId);
  } catch (error) {
    logger.error(`Error in fallback search: ${error.message}\n${error.stack}`);
    send(chatId, `❌ Error during fallback search: ${error.message}`);
    // Show options menu even after error
    _showOptionsMenu(chatId);
  }
}

/**
 * Fallback method that just generates search URLs without browser automation for all sites
 * @param {string} query - The search query
 * @param {number} chatId - The Telegram chat ID
 */
function fallbackSearch(query, chatId) {
  logger.info(`Using fallback search for '${query}'`);
  try {
    // Send a message to the user
    send(chatId, `🔍 Searching for: *${query}* on all available sites...`);
    
    // For each site and category, generate a search URL
    Object.entries(SITES).forEach(([siteName, siteConfig]) => {
      Object.entries(siteConfig.categories).forEach(([categoryKey, categoryText]) => {
        try {
          // Get the working domain
          let workingDomain = siteConfig.working_domains[categoryKey];
          
          // If working domain is empty, use the category URL as fallback
          if (!workingDomain || workingDomain.trim() === '') {
            workingDomain = categoryText;
          }
          
          // Construct a search URL
          const searchUrl = `${workingDomain}?s=${encodeURIComponent(query)}`;
          
          // Format the site name for display
          const displayName = siteName.toUpperCase();
          
          // Create result message
          const resultMessage = `✅ *${displayName}* (${categoryText})\n${searchUrl}`;
          
          // Send the result
          send(chatId, resultMessage);
          logger.info(`Sent fallback search URL for ${siteName}/${categoryKey}: ${searchUrl}`);
        } catch (error) {
          logger.error(`Error generating fallback URL for ${siteName}/${categoryKey}: ${error.message}`);
        }
      });
    });
    
    // Show options menu after all results
    _showOptionsMenu(chatId);
  } catch (error) {
    logger.error(`Error in fallback search: ${error.message}\n${error.stack}`);
    send(chatId, `❌ Error during fallback search: ${error.message}`);
    // Show options menu even after error
    _showOptionsMenu(chatId);
  }
}

/**
 * Send a message to a Telegram chat
 * @param {number} chatId - The Telegram chat ID
 * @param {string} text - The message text
 */
function send(chatId, text) {
  logger.info(`Sending message to chat_id ${chatId}: ${text.substring(0, 50)}...`);
  
  // If we're running in combined mode and the bot is available globally
  if (global.bot) {
    try {
      const result = global.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      
      // Check if result is a promise
      if (result && typeof result.then === 'function') {
        result
          .then(() => {
            logger.info(`Message sent via bot instance`);
          })
          .catch(error => {
            logger.error(`Error sending message via bot: ${error.message}`);
            // Fallback to HTTP API if bot instance fails
            sendViaHttp(chatId, text);
          });
      } else {
        logger.info(`Message sent via bot instance (sync)`);
      }
    } catch (error) {
      logger.error(`Error sending message via bot: ${error.message}`);
      // Fallback to HTTP API if bot instance fails
      sendViaHttp(chatId, text);
    }
  } else {
    // Fallback to HTTP API
    sendViaHttp(chatId, text);
  }
}

/**
 * Send a message via HTTP API (fallback method)
 * @param {number} chatId - The Telegram chat ID
 * @param {string} text - The message text
 */
function sendViaHttp(chatId, text) {
  axios.post(TELEGRAM_URL, {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  })
  .then(response => {
    logger.info(`Message sent via HTTP, response status: ${response.status}`);
    if (response.status !== 200) {
      logger.error(`Failed to send message: ${JSON.stringify(response.data)}`);
    }
  })
  .catch(error => {
    logger.error(`Error sending message via HTTP: ${error.message}\n${error.stack}`);
  });
}

module.exports = {
  performSearchTask,
  processUserResponse,
  fallbackSearch,
  send
};