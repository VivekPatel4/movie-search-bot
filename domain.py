import requests
from bs4 import BeautifulSoup
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://www.google.com/"
}

def get_final_url_selenium(url, retries=3, wait_time=10):
    """Use Selenium to handle JavaScript-based redirects and return the final URL."""
    for attempt in range(retries):
        try:
            options = Options()
            options.add_argument("--headless")  # Run in headless mode
            options.add_argument(f"user-agent={headers['User-Agent']}")
            options.add_argument("--disable-gpu")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--ignore-certificate-errors")
            options.add_argument("--disable-popup-blocking")  # Allow new tabs
            options.add_argument("--disable-blink-features=AutomationControlled")  # Avoid bot detection
            
            driver = webdriver.Chrome(options=options)
            driver.get(url)
            time.sleep(3)  # Wait for initial redirects
            
            final_url = driver.current_url
            print(f"📍 Initial URL after loading {url}: {final_url}")
            
            # Handle HDHub4u-specific redirects
            if "hdhub4u.mn" in final_url:
                try:
                    # Wait for the "View Full Site" button to be clickable
                    button = WebDriverWait(driver, wait_time).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, "a.new-tab.btn.btn-lg.btn-radius.btn-primary"))
                    )
                    # Store the original window handle
                    original_window = driver.current_window_handle
                    button.click()
                    time.sleep(7)  # Wait for new tab and redirects
                    
                    # Switch to the new tab (if opened)
                    new_tab_opened = False
                    for window_handle in driver.window_handles:
                        if window_handle != original_window:
                            driver.switch_to.window(window_handle)
                            new_tab_opened = True
                            time.sleep(5)  # Wait for redirects in new tab
                            final_url = driver.current_url
                            print(f"✅ New tab URL after clicking 'View Full Site' for {url}: {final_url}")
                            break
                    
                    # If no new tab or still on hdhub4u.mn, check "Click Here" link
                    if not new_tab_opened or "hdhub4u.mn" in final_url:
                        try:
                            stx_link = WebDriverWait(driver, wait_time).until(
                                EC.presence_of_element_located((By.CSS_SELECTOR, "#stx a"))
                            )
                            href = stx_link.get_attribute("href")
                            if href:
                                print(f"📌 Found 'Click Here' link in #stx: {href}")
                                driver.get(href)
                                time.sleep(7)  # Wait for redirects
                                final_url = driver.current_url
                                print(f"✅ URL after following 'Click Here' for {url}: {final_url}")
                        except Exception as e:
                            print(f"❌ No 'Click Here' link found in #stx or error: {e}")
                except Exception as e:
                    print(f"❌ Failed to click 'View Full Site' for {url}: {e}")
                    # Fallback to "Click Here" link
                    try:
                        stx_link = WebDriverWait(driver, wait_time).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, "#stx a"))
                        )
                        href = stx_link.get_attribute("href")
                        if href:
                            print(f"📌 Found 'Click Here' link in #stx: {href}")
                            driver.get(href)
                            time.sleep(7)  # Wait for redirects
                            final_url = driver.current_url
                            print(f"✅ URL after following 'Click Here' for {url}: {final_url}")
                    except Exception as e:
                        print(f"❌ No 'Click Here' link found in #stx or error: {e}")
            else:
                # For KatWorld or other URLs, wait for JavaScript redirects
                time.sleep(wait_time)
                final_url = driver.current_url
                print(f"✅ Selenium final URL for {url}: {final_url}")
            
            driver.quit()
            
            # Verify final URL with requests to follow redirects
            try:
                response = requests.get(final_url, headers=headers, allow_redirects=True, timeout=10)
                final_url = response.url
                print(f"✅ Verified final URL with requests: {final_url}")
            except Exception as e:
                print(f"⚠️ Failed to verify final URL with requests: {e}")
            
            return final_url
        except Exception as e:
            print(f"❌ Selenium error for {url} (attempt {attempt + 1}/{retries}): {e}")
            if attempt == retries - 1:
                driver.quit()
                return url
            time.sleep(2)  # Wait before retrying

def extract_katworld_links():
    url = "https://katworld.net/"
    try:
        r = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(r.text, "html.parser")

        links = {
            "hollywood": "",
            "anime": "",
            "4k": "",
            "adult": "",
            "drama": ""
        }

        for a in soup.find_all("a", href=True):
            href = a["href"]
            text = a.get_text(strip=True).lower()

            if "katmoviehd" in text:
                print(f"📌 Found KatWorld hollywood link: {href}")
                links["hollywood"] = get_final_url_selenium(href)
            elif "pikahd" in text or "anime" in text:
                print(f"📌 Found KatWorld anime link: {href}")
                links["anime"] = get_final_url_selenium(href)
            elif "katmovie4k" in text or "4k" in text:
                print(f"📌 Found KatWorld 4k link: {href}")
                links["4k"] = get_final_url_selenium(href)
            elif "katmovie18" in text or "adult" in text:
                print(f"📌 Found KatWorld adult link: {href}")
                links["adult"] = get_final_url_selenium(href)
            elif "katdrama" in text or "drama" in text:
                print(f"📌 Found KatWorld drama link: {href}")
                links["drama"] = get_final_url_selenium(href)

        return links
    except Exception as e:
        print("❌ KatWorld error:", e)
        return {}

def extract_hdhub4u_main_link():
    url = "https://hdhublist.com/"
    try:
        r = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(r.text, "html.parser")

        for a in soup.find_all("a", href=True):
            text = a.get_text(strip=True).lower()
            if "hdhub4u" in text and "main site" in text:
                href = a["href"]
                if href.startswith("/"):
                    href = f"https://hdhublist.com{href}"
                print(f"📌 Found HDHub4u link: {href}")
                return get_final_url_selenium(href)
        
        print("⚠️ No 'main site' link found, using fallback URL")
        return get_final_url_selenium("https://hdhub4u.tv/")
    except Exception as e:
        print("❌ HDHub4u error:", e)
        return get_final_url_selenium("https://hdhub4u.tv/")

def update_domains_json():
    katworld_links = extract_katworld_links()
    hdhub4u_main = extract_hdhub4u_main_link()

    domains = {
        "katworld": katworld_links,
        "hdhub4u": {
            "main": hdhub4u_main
        }
    }

    with open("domains.json", "w") as f:
        json.dump(domains, f, indent=4)

    print("✅ domains.json updated:\n")
    print(json.dumps(domains, indent=4))

if __name__ == "__main__":
    update_domains_json()