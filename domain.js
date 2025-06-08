const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const puppeteer = require('puppeteer');

// User agent for requests
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Referer': 'https://www.google.com/'
};

/**
 * Use Puppeteer to handle JavaScript-based redirects and return the final URL
 * @param {string} url - The initial URL to navigate to
 * @param {number} retries - Number of retry attempts
 * @param {number} waitTime - Time to wait for redirects in seconds
 * @returns {Promise<string>} The final URL after all redirects
 */
async function getFinalUrlSelenium(url, retries = 3, waitTime = 10) {
  let browser = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Launch browser
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--ignore-certificate-errors',
          '--disable-popup-blocking',
          '--disable-blink-features=AutomationControlled'
        ]
      });
      
      const page = await browser.newPage();
      
      // Set user agent
      await page.setUserAgent(headers['User-Agent']);
      
      // Navigate to URL
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      // Use setTimeout instead of waitForTimeout
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for initial redirects
      
      let finalUrl = page.url();
      console.log(`📍 Initial URL after loading ${url}: ${finalUrl}`);
      
      // Handle HDHub4u-specific redirects
      if (finalUrl.includes('hdhub4u.do')) {
        try {
          // Wait for the "View Full Site" button to be clickable
          const button = await page.waitForSelector('a.new-tab.btn.btn-lg.btn-radius.btn-primary', { timeout: waitTime * 1000 });
          
          // Store the original page
          const originalPage = page;
          
          // Create a promise to wait for a new page to open
          const newPagePromise = new Promise(resolve => {
            browser.once('targetcreated', async target => {
              const newPage = await target.page();
              resolve(newPage);
            });
          });
          
          // Click the button
          await button.click();
          
          // Wait for the new page to open
          const newPage = await newPagePromise;
          // Use setTimeout instead of waitForTimeout
          await new Promise(resolve => setTimeout(resolve, 7000)); // Wait for redirects in new tab
          
          finalUrl = newPage.url();
          console.log(`✅ New tab URL after clicking 'View Full Site' for ${url}: ${finalUrl}`);
          
          // If still on hdhub4u.mn, check "Click Here" link
          if (finalUrl.includes('hdhub4u.mn')) {
            try {
              const stxLink = await newPage.waitForSelector('#stx a', { timeout: waitTime * 1000 });
              const href = await stxLink.evaluate(el => el.getAttribute('href'));
              
              if (href) {
                console.log(`📌 Found 'Click Here' link in #stx: ${href}`);
                await newPage.goto(href, { waitUntil: 'networkidle2', timeout: 30000 });
                // Use setTimeout instead of waitForTimeout
                await new Promise(resolve => setTimeout(resolve, 7000)); // Wait for redirects
                finalUrl = newPage.url();
                console.log(`✅ URL after following 'Click Here' for ${url}: ${finalUrl}`);
              }
            } catch (e) {
              console.log(`❌ No 'Click Here' link found in #stx or error: ${e.message}`);
            }
          }
        } catch (e) {
          console.log(`❌ Failed to click 'View Full Site' for ${url}: ${e.message}`);
          
          // Fallback to "Click Here" link
          try {
            const stxLink = await page.waitForSelector('#stx a', { timeout: waitTime * 1000 });
            const href = await stxLink.evaluate(el => el.getAttribute('href'));
            
            if (href) {
              console.log(`📌 Found 'Click Here' link in #stx: ${href}`);
              await page.goto(href, { waitUntil: 'networkidle2', timeout: 30000 });
              // Use setTimeout instead of waitForTimeout
              await new Promise(resolve => setTimeout(resolve, 7000)); // Wait for redirects
              finalUrl = page.url();
              console.log(`✅ URL after following 'Click Here' for ${url}: ${finalUrl}`);
            }
          } catch (e) {
            console.log(`❌ No 'Click Here' link found in #stx or error: ${e.message}`);
          }
        }
      } else {
        // For KatWorld or other URLs, wait for JavaScript redirects
        // Use setTimeout instead of waitForTimeout
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        finalUrl = page.url();
        console.log(`✅ Puppeteer final URL for ${url}: ${finalUrl}`);
      }
      
      await browser.close();
      browser = null;
      
      // Verify final URL with axios to follow redirects
      try {
        const response = await axios.get(finalUrl, { 
          headers, 
          maxRedirects: 5,
          timeout: 10000
        });
        finalUrl = response.request.res.responseUrl || finalUrl;
        console.log(`✅ Verified final URL with axios: ${finalUrl}`);
      } catch (e) {
        console.log(`⚠️ Failed to verify final URL with axios: ${e.message}`);
      }
      
      return finalUrl;
    } catch (e) {
      console.log(`❌ Puppeteer error for ${url} (attempt ${attempt + 1}/${retries}): ${e.message}`);
      
      if (browser) {
        await browser.close();
        browser = null;
      }
      
      if (attempt === retries - 1) {
        return url;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return url;
}

/**
 * Extract KatWorld links from their main page
 * @returns {Promise<Object>} Object containing KatWorld links
 */
async function extractKatworldLinks() {
  const url = 'https://katworld.net/';
  
  try {
    const response = await axios.get(url, { headers, timeout: 10000 });
    const $ = cheerio.load(response.data);
    
    const links = {
      'hollywood': '',
      'anime': '',
      '4k': '',
      'adult': '',
      'drama': ''
    };
    
    // Find all links and collect them first
    const foundLinks = [];
    
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().toLowerCase();
      
      if (href) {
        if (text.includes('katmoviehd')) {
          console.log(`📌 Found KatWorld hollywood link: ${href}`);
          foundLinks.push({ type: 'hollywood', href });
        } else if (text.includes('pikahd') || text.includes('anime')) {
          console.log(`📌 Found KatWorld anime link: ${href}`);
          foundLinks.push({ type: 'anime', href });
        } else if (text.includes('katmovie4k') || text.includes('4k')) {
          console.log(`📌 Found KatWorld 4k link: ${href}`);
          foundLinks.push({ type: '4k', href });
        } else if (text.includes('katmovie18') || text.includes('adult')) {
          console.log(`📌 Found KatWorld adult link: ${href}`);
          foundLinks.push({ type: 'adult', href });
        } else if (text.includes('katdrama') || text.includes('drama')) {
          console.log(`📌 Found KatWorld drama link: ${href}`);
          foundLinks.push({ type: 'drama', href });
        }
      }
    });
    
    // Process links sequentially
    for (const link of foundLinks) {
      try {
        links[link.type] = await getFinalUrlSelenium(link.href);
      } catch (error) {
        console.log(`❌ Error processing ${link.type} link: ${error.message}`);
      }
    }
    
    return links;
  } catch (error) {
    console.log(`❌ KatWorld error: ${error.message}`);
    return {};
  }
}

/**
 * Extract HDHub4u main link
 * @returns {Promise<string>} The HDHub4u main link
 */
async function extractHdhub4uMainLink() {
  const url = 'https://hdhublist.com/';
  
  try {
    const response = await axios.get(url, { headers, timeout: 10000 });
    const $ = cheerio.load(response.data);
    
    let mainLink = null;
    
    // Find the HDHub4u link
    $('a').each((_, element) => {
      const text = $(element).text().toLowerCase();
      if (text.includes('hdhub4u') && text.includes('main site')) {
        let href = $(element).attr('href');
        if (href && href.startsWith('/')) {
          href = `https://hdhublist.com${href}`;
        }
        console.log(`📌 Found HDHub4u link: ${href}`);
        mainLink = href;
      }
    });
    
    // Process the link
    try {
      if (mainLink) {
        return await getFinalUrlSelenium(mainLink);
      } else {
        console.log('⚠️ No "main site" link found, using fallback URL');
        return await getFinalUrlSelenium('https://hdhub4u.tv/');
      }
    } catch (error) {
      console.log(`❌ Error processing HDHub4u link: ${error.message}`);
      return 'https://hdhub4u.tv/';
    }
  } catch (error) {
    console.log(`❌ HDHub4u error: ${error.message}`);
    return await getFinalUrlSelenium('https://hdhub4u.tv/');
  }
}

/**
 * Update domains.json with the latest working domains
 * @returns {Promise<void>}
 */
async function updateDomainsJson() {
  try {
    // Read existing domains.json first as a fallback
    let existingDomains = {};
    try {
      const existingData = await fs.readFile('domains.json', 'utf8');
      existingDomains = JSON.parse(existingData);
    } catch (err) {
      console.log('No existing domains.json found or error reading it');
    }
    
    // Try to get new links
    let katworldLinks = {};
    let hdhub4uMain = '';
    
    try {
      katworldLinks = await extractKatworldLinks();
    } catch (err) {
      console.error(`Error extracting KatWorld links: ${err.message}`);
      // Use existing values as fallback
      if (existingDomains.katworld) {
        katworldLinks = existingDomains.katworld;
      }
    }
    
    try {
      hdhub4uMain = await extractHdhub4uMainLink();
    } catch (err) {
      console.error(`Error extracting HDHub4u link: ${err.message}`);
      // Use existing value as fallback
      if (existingDomains.hdhub4u && existingDomains.hdhub4u.main) {
        hdhub4uMain = existingDomains.hdhub4u.main;
      }
    }
    
    // Create new domains object
    const domains = {
      'katworld': katworldLinks,
      'hdhub4u': {
        'main': hdhub4uMain
      }
    };
    
    // Write to file
    await fs.writeFile('domains.json', JSON.stringify(domains, null, 4));
    
    console.log('✅ domains.json updated:\n');
    console.log(JSON.stringify(domains, null, 4));
    
    return domains;
  } catch (error) {
    console.error(`Error updating domains.json: ${error.message}`);
    throw error;
  }
}

// If this file is run directly, update domains.json
if (require.main === module) {
  updateDomainsJson();
}

module.exports = {
  getFinalUrlSelenium,
  extractKatworldLinks,
  extractHdhub4uMainLink,
  updateDomainsJson
};