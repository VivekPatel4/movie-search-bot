import subprocess
import logging

logging.basicConfig(
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def run_update():
    try:
        logger.info("Running domain.py")
        subprocess.run(["python", "domain.py"], check=True)
        logger.info("Running update_task.py")
        subprocess.run(["python", "update_task.py"], check=True)
        logger.info("Cron job completed successfully")
    except Exception as e:
        logger.error(f"Cron job failed: {e}")

if __name__ == "__main__":
    run_update()