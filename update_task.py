import json
import re
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def update_task_py():
    """Update the SITES dictionary in task.py with URLs from domains.json"""
    try:
        logger.info("Starting task.py update process")
        
        # Read domains.json
        with open('domains.json', 'r') as f:
            domains = json.load(f)
        
        # Read task.py with explicit UTF-8 encoding and error handling
        try:
            with open('task.py', 'r', encoding='utf-8') as f:
                task_content = f.read()
        except UnicodeDecodeError:
            # Fallback to reading with 'latin-1' which can read any byte
            with open('task.py', 'r', encoding='latin-1') as f:
                task_content = f.read()
        
        # Update KatWorld URLs in working_domains
        if 'katworld' in domains:
            # Update Hollywood URL
            if 'hollywood' in domains['katworld']:
                hollywood_url = domains['katworld']['hollywood']
                pattern = r'("katworld"[^}]*"working_domains"[^{]*{[^}]*"hollywood":\s*)"[^"]*"'
                replacement = f'\\1"{hollywood_url}"'
                task_content = re.sub(pattern, replacement, task_content, flags=re.DOTALL)
                logger.info(f"Updated KatWorld hollywood URL to: {hollywood_url}")
            
            # Update KDrama URL (which is "drama" in domains.json)
            if 'drama' in domains['katworld']:
                kdrama_url = domains['katworld']['drama']
                pattern = r'("katworld"[^}]*"working_domains"[^{]*{[^}]*"kdrama":\s*)"[^"]*"'
                replacement = f'\\1"{kdrama_url}"'
                task_content = re.sub(pattern, replacement, task_content, flags=re.DOTALL)
                logger.info(f"Updated KatWorld kdrama URL to: {kdrama_url}")
        
        # Update HDHub4u URL in working_domains
        if 'hdhub4u' in domains and 'main' in domains['hdhub4u']:
            hdhub4u_url = domains['hdhub4u']['main']
            pattern = r'("hdhub4u"[^}]*"working_domains"[^{]*{[^}]*"main":\s*)"[^"]*"'
            replacement = f'\\1"{hdhub4u_url}"'
            task_content = re.sub(pattern, replacement, task_content, flags=re.DOTALL)
            logger.info(f"Updated HDHub4u main URL to: {hdhub4u_url}")
        
        # Write updated content back to task.py with the same encoding
        try:
            with open('task.py', 'w', encoding='utf-8') as f:
                f.write(task_content)
        except UnicodeEncodeError:
            with open('task.py', 'w', encoding='latin-1') as f:
                f.write(task_content)
        
        logger.info("Successfully updated task.py with latest URLs from domains.json")
        return True
    except Exception as e:
        logger.error(f"Error updating task.py: {e}")
        return False

if __name__ == "__main__":
    print(f"Starting update at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if update_task_py():
        print("Task.py updated successfully with latest URLs from domains.json")
    else:
        print("Failed to update task.py")