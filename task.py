import requests
import threading
import logging
import traceback
import time

# Set up logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = "8127455390:AAE8PXqnB1S0IARmaOrOf8Pq4U51gL_yVdg"
TELEGRAM_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"

# Site configuration with simplified categories and direct working domains
SITES = {
    "katworld": {
        "base_url": "https://katworld.net/",
        "categories": {
            "hollywood": "Hollywood Movies & Web Series",
            "kdrama": "Korean & Chinese Dramas"
        },
        "working_domains": {
            "hollywood": "https://katmoviehd.blue/",
            "kdrama": "https://katdrama.com/"
        }
    },
    "hdhub4u": {
        "base_url": "https://hdhub4u.tv/",
        "categories": {
            "main": "Hollywood, Bollywood, South & Gujarati"
        },
        "working_domains": {
            "main": "https://hdhub4u.frl/"
        }
    },
    "moviesflix": {
        "base_url": "https://themoviesflix.ag/",
        "categories": {
            "search":"movies/webseries",
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
            "search": "https://themoviesflix.ag/",
            "bollywood": "https://themoviesflix.ag/category/hindi-movies/",
            "hindi_dubbed": "https://themoviesflix.ag/category/hindi-dubbed/",
            "hollywood": "https://themoviesflix.ag/category/english-movies/",
            "dual_audio": "https://themoviesflix.ag/category/dual-audio/",
            "web_series": "https://themoviesflix.ag/category/web-series/",
            "adult": "https://themoviesflix.ag/category/18-adult/",
            "south": "https://themoviesflix.ag/",
            "regional": "https://themoviesflix.ag/",
            "tv_shows": "https://themoviesflix.ag/category/tv-shows/"
        }
    }
}

# Dictionary to store user states
user_states = {}

# Thread lock for safely accessing user_states
user_states_lock = threading.Lock()

def perform_search_task(query, chat_id):
    """Start an interactive search process"""
    logger.info(f"Starting search for '{query}' for chat_id: {chat_id}")
    
    # Initialize or reset user state with thread safety
    with user_states_lock:
        user_states[chat_id] = {
            "state": "site_selection",
            "query": query,
            "site": None,
            "category": None
        }
    
    # Start the interactive search process
    _handle_user_state(chat_id)
    
    return {"status": "started", "message": "Interactive search started"}

def _handle_user_state(chat_id):
    """Handle the current state of the user's search process"""
    # Thread-safe state access
    with user_states_lock:
        state = user_states[chat_id]["state"]
    
    if state == "site_selection":
        # Ask user to select a site
        _display_site_options(chat_id)
    elif state == "category_selection":
        # Ask user to select a category
        _display_category_options(chat_id)
    elif state == "searching":
        # Start the actual search
        with user_states_lock:
            query = user_states[chat_id]["query"]
            site = user_states[chat_id]["site"]
            category = user_states[chat_id]["category"]
        
        # Start the search in a background thread
        thread = threading.Thread(target=_perform_search_with_params, 
                                 args=(query, chat_id, site, category))
        thread.daemon = True
        thread.start()
        logger.info(f"Started background search for '{query}' on {site}/{category} for chat_id: {chat_id}")

def _display_site_options(chat_id):
    """Display available sites for user selection"""
    message = "🌐 *Available Sites:*\n\n"
    
    for i, site_name in enumerate(SITES.keys(), 1):
        message += f"{i}. *{site_name.upper()}*\n"
    
    message += "\nReply with the number of the site you want to search on."
    send(chat_id, message)
    
    # Update user state with thread safety
    with user_states_lock:
        user_states[chat_id]["state"] = "waiting_for_site"

def _display_category_options(chat_id):
    """Display available categories for the selected site"""
    with user_states_lock:
        site_name = user_states[chat_id]["site"]
    
    categories = SITES[site_name]["categories"]
    
    message = f"📂 *Categories for {site_name.upper()}:*\n\n"
    
    for i, (category_key, category_name) in enumerate(categories.items(), 1):
        message += f"{i}. *{category_key}* ({category_name})\n"
    
    message += "\nReply with the number of the category you want to search in."
    send(chat_id, message)
    
    # Update user state with thread safety
    with user_states_lock:
        user_states[chat_id]["state"] = "waiting_for_category"

def _show_options_menu(chat_id):
    """Show options menu after search completion"""
    message = "\n\n📋 *What would you like to do next?*\n\n" + \
              "1️⃣ *New Search* - Start a new search\n" + \
              "2️⃣ *Clear Chat* - Clear chat history\n" + \
              "3️⃣ *Main Menu* - Return to main menu\n\n" + \
              "Reply with the number of your choice."
    
    send(chat_id, message)
    
    # Update user state with thread safety
    with user_states_lock:
        user_states[chat_id] = {
            "state": "waiting_for_menu_choice",
            "query": None,
            "site": None,
            "category": None
        }

def process_user_response(chat_id, text):
    """Process user's response based on their current state"""
    # Thread-safe check for user state
    with user_states_lock:
        if chat_id not in user_states:
            # If we don't have a state for this user, treat it as a new search
            return perform_search_task(text, chat_id)
        
        # Get the current state safely
        state = user_states[chat_id]["state"]
    
    if state == "waiting_for_menu_choice":
        try:
            choice = int(text.strip())
            
            if choice == 1:
                # New Search
                send(chat_id, "🔍 *Starting a new search*")
                return perform_search_task("", chat_id)
            elif choice == 2:
                # Clear Chat - just acknowledge, actual clearing happens in the client
                send(chat_id, "🧹 *Chat cleared*\n\nType anything to start a new search.")
                with user_states_lock:
                    user_states[chat_id] = {
                        "state": "initial",
                        "query": None,
                        "site": None,
                        "category": None
                    }
            elif choice == 3:
                # Main Menu
                send(chat_id, "🏠 *Returning to main menu*")
                return perform_search_task("", chat_id)
            else:
                send(chat_id, "❌ Invalid choice. Please select a number from the list.")
                _show_options_menu(chat_id)
        except ValueError:
            # If not a number, treat as a new search
            return perform_search_task(text, chat_id)
    
    elif state == "waiting_for_site":
        try:
            choice = int(text.strip())
            site_names = list(SITES.keys())
            
            if 1 <= choice <= len(site_names):
                selected_site = site_names[choice-1]
                with user_states_lock:
                    user_states[chat_id]["site"] = selected_site
                    user_states[chat_id]["state"] = "category_selection"
                
                logger.info(f"User {chat_id} selected site: {selected_site}")
                send(chat_id, f"You selected: *{selected_site.upper()}*")
                
                # Move to category selection
                _handle_user_state(chat_id)
            else:
                send(chat_id, "❌ Invalid choice. Please select a number from the list.")
                # Show site options again
                _display_site_options(chat_id)
        except ValueError:
            send(chat_id, "❌ Please enter a valid number.")
            # Show site options again
            _display_site_options(chat_id)
    
    elif state == "waiting_for_category":
        try:
            choice = int(text.strip())
            site_name = user_states[chat_id]["site"]
            category_keys = list(SITES[site_name]["categories"].keys())
            
            if 1 <= choice <= len(category_keys):
                selected_category = category_keys[choice-1]
                with user_states_lock:
                    user_states[chat_id]["category"] = selected_category
                
                category_name = SITES[site_name]["categories"][selected_category]
                logger.info(f"User {chat_id} selected category: {selected_category} ({category_name})")
                send(chat_id, f"You selected: *{selected_category}* ({category_name})")
                
                # Special handling for moviesflix site
                if site_name == "moviesflix" and selected_category != "search":
                    # For non-search categories in moviesflix, send direct URL without asking for query
                    direct_url = SITES[site_name]["working_domains"][selected_category]
                    
                    # Format the site name for display
                    display_name = site_name.upper()
                    
                    # Create result message with the direct URL
                    result_message = f"✅ *{display_name}* ({category_name})\n{direct_url}"
                    
                    # Send the result immediately
                    send(chat_id, result_message)
                    logger.info(f"Sent direct category URL: {direct_url}")
                    
                    # Show options menu after sending URL
                    _show_options_menu(chat_id)
                else:
                    # For search category or other sites, ask for search query
                    send(chat_id, "🔍 Now, please enter the movie or series name you want to search for:")
                    with user_states_lock:
                        user_states[chat_id]["state"] = "waiting_for_query"
            else:
                send(chat_id, "❌ Invalid choice. Please select a number from the list.")
                # Show category options again
                _display_category_options(chat_id)
        except ValueError:
            send(chat_id, "❌ Please enter a valid number.")
            # Show category options again
            _display_category_options(chat_id)
    
    elif state == "waiting_for_query":
        # User has entered a search query
        query = text.strip()
        if query:
            # Thread-safe state update
            with user_states_lock:
                user_states[chat_id]["query"] = query
                user_states[chat_id]["state"] = "searching"
                
                # Get the selected site and category
                site = user_states[chat_id]["site"]
                category = user_states[chat_id]["category"]
            
            # Start the search in a background thread
            thread = threading.Thread(target=_perform_search_with_params, 
                                     args=(query, chat_id, site, category))
            thread.daemon = True
            thread.start()
            logger.info(f"Started background search for '{query}' on {site}/{category} for chat_id: {chat_id}")
        else:
            send(chat_id, "❌ Please enter a valid search term.")
            send(chat_id, "🔍 Please enter the movie or series name you want to search for:")
    
    else:
        # If we're not waiting for a specific response, treat it as a new search
        return perform_search_task(text, chat_id)

def _perform_search_with_params(query, chat_id, site_name, category_key):
    """Perform direct search using known working domains"""
    logger.info(f"Starting direct search for '{query}' on {site_name}/{category_key} for chat_id: {chat_id}")
    try:
        # First, send a message to the user that we're starting the search
        category_text = SITES[site_name]["categories"][category_key]
        send(chat_id, f"🔍 Searching for: *{query}* on *{site_name.upper()}* in *{category_key}* ({category_text})...")
        
        # Get the working domain for this site and category
        working_domain = SITES[site_name]["working_domains"][category_key]
        logger.info(f"Using working domain: {working_domain}")
        
        # Construct a search URL
        search_url = f"{working_domain}?s={query.replace(' ', '+')}"
        logger.info(f"Direct search URL: {search_url}")
        
        # Format the site name for display
        display_name = site_name.upper()
        
        # Create result message with the search URL
        result_message = f"✅ *{display_name}* ({category_text})\n{search_url}"
        
        # Send the result immediately
        send(chat_id, result_message)
        logger.info(f"Sent direct search URL: {search_url}")
        
        # Show options menu after search
        _show_options_menu(chat_id)
    
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in direct search: {str(e)}\n{error_details}")
        # Use fallback search as a last resort
        _fallback_search_single_site(query, chat_id, site_name, category_key)
        # Show options menu even after fallback
        _show_options_menu(chat_id)

def _fallback_search_single_site(query, chat_id, site_name, category_key):
    """Fallback method for a specific site that just generates search URLs without browser automation"""
    logger.info(f"Using fallback search for '{query}' on {site_name}/{category_key}")
    try:
        # Get site configuration
        category_text = SITES[site_name]["categories"][category_key]
        
        # Get the working domain for this site and category
        working_domain = SITES[site_name]["working_domains"][category_key]
        logger.info(f"Using working domain: {working_domain}")
        
        # Construct a search URL
        search_url = f"{working_domain}?s={query.replace(' ', '+')}"
        logger.info(f"Direct search URL: {search_url}")
        
        # Format the site name for display
        display_name = site_name.upper()
        
        # Create result message
        result_message = f"✅ *{display_name}* ({category_text})\n{search_url}"
        
        # Send the result
        send(chat_id, result_message)
        logger.info(f"Sent fallback search URL: {search_url}")
        
        # Show options menu after search
        _show_options_menu(chat_id)
    
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in fallback search: {str(e)}\n{error_details}")
        send(chat_id, f"❌ Error during fallback search: {str(e)}")
        # Show options menu even after error
        _show_options_menu(chat_id)

def fallback_search(query, chat_id):
    """Fallback method that just generates search URLs without browser automation for all sites"""
    logger.info(f"Using fallback search for '{query}'")
    try:
        # Send a message to the user
        send(chat_id, f"🔍 Searching for: *{query}* on all available sites...")
        
        # For each site and category, generate a search URL
        for site_name, site_config in SITES.items():
            for category_key, category_text in site_config["categories"].items():
                try:
                    # Get the working domain
                    working_domain = site_config["working_domains"][category_key]
                    
                    # Construct a search URL
                    search_url = f"{working_domain}?s={query.replace(' ', '+')}"
                    
                    # Format the site name for display
                    display_name = site_name.upper()
                    
                    # Create result message
                    result_message = f"✅ *{display_name}* ({category_text})\n{search_url}"
                    
                    # Send the result
                    send(chat_id, result_message)
                    logger.info(f"Sent fallback search URL for {site_name}/{category_key}: {search_url}")
                except Exception as e:
                    logger.error(f"Error generating fallback URL for {site_name}/{category_key}: {e}")
        
        # Show options menu after all results
        _show_options_menu(chat_id)
    
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in fallback search: {str(e)}\n{error_details}")
        send(chat_id, f"❌ Error during fallback search: {str(e)}")
        # Show options menu even after error
        _show_options_menu(chat_id)

def send(chat_id, text):
    """Send a message to a Telegram chat using a background thread for faster response"""
    def send_message_thread():
        try:
            logger.info(f"Sending message to chat_id {chat_id}: {text[:50]}...")
            response = requests.post(TELEGRAM_URL, json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown"
            })
            logger.info(f"Message sent, response status: {response.status_code}")
            if response.status_code != 200:
                logger.error(f"Failed to send message: {response.text}")
        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error sending message: {str(e)}\n{error_details}")
    
    # Start message sending in a background thread
    thread = threading.Thread(target=send_message_thread)
    thread.daemon = True
    thread.start()