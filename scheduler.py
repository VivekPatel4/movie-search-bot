import time
import logging
import threading
import subprocess
import schedule
from datetime import datetime
import importlib
import sys

# Import your bot module
sys.path.append('.')
import task  # Your main bot file

# Set up logging
logging.basicConfig(
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def run_update():
    """Run the domain update process"""
    try:
        logger.info("Starting scheduled URL update")
        
        # Run domain.py to fetch latest domains
        logger.info("Running domain.py to fetch latest domains")
        subprocess.run(["python", "domain.py"], check=True)
        
        # Run update_task.py to update the task.py file
        logger.info("Running update_task.py to update URLs in task.py")
        subprocess.run(["python", "update_task.py"], check=True)
        
        # Reload the task module to apply changes
        logger.info("Reloading task module to apply changes")
        importlib.reload(task)
        
        logger.info("URL update completed successfully")
        return True
    except Exception as e:
        logger.error(f"Error during scheduled update: {e}")
        return False

def run_bot():
    """Run the Telegram bot in a separate thread"""
    bot_thread = threading.Thread(target=run_bot_with_restart)
    bot_thread.daemon = True
    bot_thread.start()
    logger.info("Bot started in background thread")

def run_bot_with_restart():
    """Run the bot with automatic restart on failure"""
    while True:
        try:
            logger.info("Starting Telegram bot")
            # Import the main function from your task.py
            # Replace 'main' with your actual entry point function
            if hasattr(task, 'main'):
                task.main()
            else:
                # If there's no main function, we'll assume the bot starts on import
                logger.info("No main function found, bot should be running on import")
                # Keep the thread alive
                while True:
                    time.sleep(60)
        except Exception as e:
            logger.error(f"Bot crashed: {e}")
            logger.info("Restarting bot in 10 seconds...")
            time.sleep(10)

def schedule_updates():
    """Schedule updates to run 3 times between 12am-3am"""
    # Schedule updates at 12:00 AM, 1:30 AM, and 3:00 AM
    schedule.every().day.at("00:00").do(run_update)
    schedule.every().day.at("01:30").do(run_update)
    schedule.every().day.at("03:00").do(run_update)
    
    logger.info("Updates scheduled for 12:00 AM, 1:30 AM, and 3:00 AM daily")

def run_scheduler():
    """Run the scheduler to handle periodic tasks"""
    schedule_updates()
    
    # Run the bot
    run_bot()
    
    # Keep the scheduler running
    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    logger.info(f"Starting scheduler at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run an initial update when starting
    run_update()
    
    # Start the scheduler
    run_scheduler()