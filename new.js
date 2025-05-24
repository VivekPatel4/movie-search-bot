const axios = require('axios');
const { chromium } = require('playwright');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Referer': 'https://www.google.com/'
};

async function getFinalUrlPlaywright(url, retries = 3, waitTime = 10) {
  let browser = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      browser = await chromium.launch({
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

      const context = await browser.newContext({
        userAgent: headers['User-Agent'],
        locale: 'en-US',
        extraHTTPHeaders: {
          'Accept': headers.Accept,
          'Accept-Language': headers['Accept-Language'],
          'Referer': headers.Referer
        }
      });

      const page = await context.newPage();

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000); // Wait for initial redirects

      let finalUrl = page.url();
      console.log(`📍 Initial URL after loading ${url}: ${finalUrl}`);

      if (finalUrl.includes('hdhub4u.mn')) {
        try {
          const button = await page.waitForSelector('a.new-tab.btn.btn-lg.btn-radius.btn-primary', { timeout: waitTime * 1000 });
          const [newPage] = await Promise.all([
            context.waitForEvent('page'),
            button.click()
          ]);

          await newPage.waitForLoadState('networkidle');
          await newPage.waitForTimeout(7000);

          finalUrl = newPage.url();
          console.log(`✅ New tab URL after clicking 'View Full Site' for ${url}: ${finalUrl}`);

          if (finalUrl.includes('hdhub4u.mn')) {
            try {
              const stxLink = await newPage.waitForSelector('#stx a', { timeout: waitTime * 1000 });
              const href = await stxLink.getAttribute('href');

              if (href) {
                console.log(`📌 Found 'Click Here' link in #stx: ${href}`);
                await newPage.goto(href, { waitUntil: 'networkidle', timeout: 30000 });
                await newPage.waitForTimeout(7000);
                finalUrl = newPage.url();
                console.log(`✅ URL after following 'Click Here' for ${url}: ${finalUrl}`);
              }
            } catch (e) {
              console.log(`❌ No 'Click Here' link found in #stx or error: ${e.message}`);
            }
          }
        } catch (e) {
          console.log(`❌ Failed to click 'View Full Site' for ${url}: ${e.message}`);

          try {
            const stxLink = await page.waitForSelector('#stx a', { timeout: waitTime * 1000 });
            const href = await stxLink.getAttribute('href');

            if (href) {
              console.log(`📌 Found 'Click Here' link in #stx: ${href}`);
              await page.goto(href, { waitUntil: 'networkidle', timeout: 30000 });
              await page.waitForTimeout(7000);
              finalUrl = page.url();
              console.log(`✅ URL after following 'Click Here' for ${url}: ${finalUrl}`);
            }
          } catch (e) {
            console.log(`❌ No 'Click Here' link found in #stx or error: ${e.message}`);
          }
        }
      } else {
        await page.waitForTimeout(waitTime * 1000);
        finalUrl = page.url();
        console.log(`✅ Playwright final URL for ${url}: ${finalUrl}`);
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
      console.log(`❌ Playwright error for ${url} (attempt ${attempt + 1}/${retries}): ${e.message}`);

      if (browser) {
        await browser.close();
        browser = null;
      }

      if (attempt === retries - 1) {
        return url;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return url;
}

(async () => {
  const testUrl = 'https://hdhub.com/';  // Change this URL to test other sites
  console.log(`Starting test for URL: ${testUrl}`);

  const finalUrl = await getFinalUrlPlaywright(testUrl);
  console.log(`\n🎯 Final resolved URL is:\n${finalUrl}`);
})();
