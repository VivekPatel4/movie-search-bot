from telegram import Update
from telegram.ext import Application, MessageHandler, filters, ContextTypes, ApplicationBuilder, CommandHandler
import aiohttp
import logging
import sys
from telegram.error import Conflict

# Set up logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

BOT_TOKEN = "8127455390:AAE8PXqnB1S0IARmaOrOf8Pq4U51gL_yVdg"
SEARCH_API_URL = "http://localhost:8000/search"
RESPONSE_API_URL = "http://localhost:8000/response"

# Track users who are in the middle of an interactive search
users_in_search = set()

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle the /start command"""
    chat_id = update.message.chat_id
    await update.message.reply_text("👋 Welcome to Movie/Web-Series Search Bot!\n\nSimply type any message to start a new search.")
    
    # Remove user from interactive search if they were in one
    if chat_id in users_in_search:
        users_in_search.remove(chat_id)
        logger.info(f"Removed user {chat_id} from interactive search due to /start command")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    chat_id = update.message.chat_id
    
    logger.info(f"Received message: '{text}' from chat_id: {chat_id}")

    try:
        # If user is in the middle of an interactive search, send to response endpoint
        if chat_id in users_in_search:
            logger.info(f"User {chat_id} is in interactive search, sending to response endpoint")
            payload = {
                "text": text,
                "chat_id": chat_id
            }
            
            async with aiohttp.ClientSession() as session:
                response = await session.post(RESPONSE_API_URL, json=payload)
                logger.info(f"Response API response status: {response.status}")
                response_json = await response.json()
                logger.info(f"Response API response: {response_json}")
                
            # No need to send a confirmation message here as the API will send responses
        
        # Otherwise, start a new search
        else:
            logger.info(f"Starting new search for user {chat_id}")
            payload = {
                "query": text,
                "chat_id": chat_id
            }
            
            async with aiohttp.ClientSession() as session:
                response = await session.post(SEARCH_API_URL, json=payload)
                logger.info(f"Search API response status: {response.status}")
                response_json = await response.json()
                logger.info(f"Search API response: {response_json}")
            
            # Add user to the interactive search set
            users_in_search.add(chat_id)
            logger.info(f"Added user {chat_id} to interactive search set")
            
            # No confirmation message needed as the API will send the site selection options
    
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        logger.exception("Full exception details:")
        await update.message.reply_text("❌ Sorry, there was an error processing your request.")

async def error_handler(update, context):
    logger.error(f"Update {update} caused error {context.error}")

if __name__ == "__main__":
    try:
        # Build the application with a higher timeout
        app = ApplicationBuilder().token(BOT_TOKEN).connect_timeout(30.0).read_timeout(30.0).build()
        
        # Add handlers
        app.add_handler(CommandHandler("start", start_command))
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
        app.add_error_handler(error_handler)
        
        # Start the bot
        logger.info("Starting bot...")
        app.run_polling(drop_pending_updates=True)
    except Conflict as e:
        logger.error(f"Conflict error: {e}. Another instance of the bot might be running.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error starting bot: {e}")
        sys.exit(1)
