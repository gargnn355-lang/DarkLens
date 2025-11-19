// crawler.js
// Main background crawler for .onion sites using Selenium Firefox over Tor
// Crawls links from the database and saves results to Supabase

const { supabase } = require('./supabaseClient');
const { Builder, By } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const { classifyRisk } = require('./utils/classifyRisk');
const { uploadScreenshotToFilebase } = require('./utils/filebaseUpload');

const MAX_DEPTH = 2; // Limit recursion depth for safety
const CRAWL_INTERVAL = 10000; // ms between crawls

const KEYWORDS = [
  "drugs", "bitcoin", "crypto", "market", "carding", "hacking", "fraud", "phishing",
  "counterfeit", "passport", "weed", "cocaine", "heroin", "ecstasy", "steroids",
  "gun", "firearm", "explosives", "malware", "ransomware", "porn", "escort", "forged",
  "credit card", "bank", "atm", "skimmer", "vpn", "anonymity", "tor", "privacy"
];

function extractTagsFromContent(content) {
  if (!content) return [];
  const lower = content.toLowerCase();
  return KEYWORDS.filter(kw => lower.includes(kw));
}

// Extract base domain from URL (e.g., "example.onion" from "http://example.onion/path")
function getBaseDomain(url) {
  try {
    // Remove protocol if present
    let domain = url.replace(/^http?:\/\//, '');
    // Remove path, query, and fragment
    domain = domain.split('/')[0];
    domain = domain.split('?')[0];
    domain = domain.split('#')[0];
    // Extract just the .onion domain part
    const onionMatch = domain.match(/([a-z2-7]{16,56}\.onion)/i);
    if (onionMatch) {
      return onionMatch[1].toLowerCase();
    }
    return domain.toLowerCase();
  } catch (e) {
    // Fallback: try to extract anything before first /
    return url.split('/')[0].replace(/^http?:\/\//, '').toLowerCase();
  }
}

async function launchTorSelenium() {
  const TOR_PORT = process.env.TOR_PORT || 9052; // Allow port to be configured via env
  console.log(`[INFO] Configuring Firefox to use Tor on port ${TOR_PORT}`);
  
  let options = new firefox.Options();
  options.setPreference('network.proxy.type', 1);
  options.setPreference('network.proxy.socks', '127.0.0.1');
  options.setPreference('network.proxy.socks_port', parseInt(TOR_PORT));
  options.setPreference('network.proxy.socks_remote_dns', true);
  options.setPreference('network.dns.blockDotOnion', false);
  options.setPreference('network.dns.disableIPv6', true);
  options.addArguments('-headless');
  
  // Additional Firefox preferences for better Tor compatibility
  options.setPreference('network.proxy.socks_version', 5);
  options.setPreference('media.navigator.enabled', false);
  options.setPreference('dom.webdriver.enabled', false);
  options.setPreference('dom.disable_beforeunload', true); // Disable beforeunload dialogs

  try {
    let driver = await new Builder()
      .forBrowser('firefox')
      .setFirefoxOptions(options)
      .build();
    
    console.log(`[INFO] Firefox driver initialized successfully`);
    return driver;
  } catch (error) {
    console.error(`[ERROR] Failed to launch Firefox driver:`, error.message);
    console.error(`[ERROR] Make sure Firefox and geckodriver are installed`);
    console.error(`[ERROR] Check if Tor is running on port ${TOR_PORT}`);
    throw error;
  }
}

async function readLinksFromDB() {
  try {
    const { data, error } = await supabase
      .from('fetched_onion_links')
      .select('url')
      .eq('is_active', true)
      .order('created_at', { ascending: false }); // Newest links first

    if (error) {
      console.error('[ERROR] Failed to read links from database:', error.message);
      console.error('[ERROR] Details:', error);
      // Fallback: try ordering by id if created_at doesn't exist
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('fetched_onion_links')
        .select('url')
        .eq('is_active', true)
        .order('id', { ascending: false });
      
      if (fallbackError) {
        console.error('[ERROR] Fallback query also failed:', fallbackError.message);
        return [];
      }
      console.log(`[INFO] Using fallback query (ordered by id), found ${fallbackData.length} links`);
      return fallbackData.map(row => row.url);
    }
    
    if (!data || data.length === 0) {
      console.log('[WARN] No active links found in database');
      return [];
    }
    
    console.log(`[INFO] Successfully fetched ${data.length} active links from database`);
    return data.map(row => row.url);
  } catch (err) {
    console.error('[ERROR] Exception in readLinksFromDB:', err.message);
    return [];
  }
}

// Screenshot storage is now handled by Filebase (configured via environment variables)

async function handleAlertDialogs(driver) {
  try {
    const alert = await driver.switchTo().alert();
    const alertText = await alert.getText();
    console.log(`[INFO] Dismissing alert dialog: ${alertText.substring(0, 50)}...`);
    await alert.dismiss();
    // Wait a bit after dismissing alert
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (e) {
    // No alert present, that's fine
  }
}

async function crawlLink(driver, url, sourceUrl, depth = 0, visited = new Set(), failedDomains = new Set()) {
  if (!url.endsWith('.onion') && !url.includes('.onion/')) return;
  
  // Extract base domain and check if it's already marked as failed
  const baseDomain = getBaseDomain(url);
  if (failedDomains.has(baseDomain)) {
    console.log(`[SKIP] Domain ${baseDomain} already marked as failed, skipping ${url}`);
    return;
  }
  
  // Skip APK files
  if (url.endsWith('.apk')) {
    console.log(`[SKIP] Skipping APK file: ${url}`);
    return;
  }
  if (visited.has(url) || (depth > 0 && depth > MAX_DEPTH)) return;
  
  // Check if this URL was crawled in the last 2 hours
  try {
    const { data: existingLink, error: checkError } = await supabase
      .from('onion_links')
      .select('last_crawled_at')
      .eq('url', url)
      .maybeSingle();
    
    if (!checkError && existingLink && existingLink.last_crawled_at) {
      const lastCrawled = new Date(existingLink.last_crawled_at);
      const now = new Date();
      const hoursSinceCrawl = (now - lastCrawled) / (1000 * 60 * 60); // Convert to hours
      
      if (hoursSinceCrawl < 2) {
        const minutesSinceCrawl = Math.floor((now - lastCrawled) / (1000 * 60));
        console.log(`[SKIP] ${url} was crawled ${minutesSinceCrawl} minutes ago (less than 2 hours), skipping`);
        return;
      }
    }
  } catch (checkErr) {
    // If check fails, continue with crawl (don't block on DB errors)
    console.log(`[WARN] Could not check last_crawled_at for ${url}, proceeding anyway: ${checkErr.message}`);
  }
  
  visited.add(url);
  try {
    // Set a shorter timeout for navigation (60 seconds)
    await driver.manage().setTimeouts({ pageLoad: 60000, script: 30000 });
    
    // Navigate to the page
    try {
      await driver.get(url);
    } catch (navError) {
      // Handle navigation errors (timeouts, connection issues)
      if (navError.message.includes('timeout') || navError.message.includes('Reached error page')) {
        console.log(`[SKIP] Connection timeout or error page for ${url}`);
        // Mark this domain as failed
        failedDomains.add(baseDomain);
        console.log(`[INFO] Marked domain ${baseDomain} as failed - will skip all future links from this domain`);
        return;
      }
      throw navError; // Re-throw if it's a different error
    }
    
    // Handle any alert dialogs that might appear
    await handleAlertDialogs(driver);
    
    // Wait a moment for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if we're on an error page
    const currentUrl = await driver.getCurrentUrl();
    if (currentUrl.includes('about:neterror') || currentUrl.includes('about:blank')) {
      console.log(`[SKIP] Error page detected for ${url}`);
      // Mark this domain as failed
      failedDomains.add(baseDomain);
      console.log(`[INFO] Marked domain ${baseDomain} as failed - will skip all future links from this domain`);
      return;
    }
    
    const title = await driver.getTitle();
    const pageSource = await driver.getPageSource();
    
    // Check for error pages in the source
    if (pageSource.includes('about:neterror') || 
        pageSource.includes('dnsNotFound') || 
        pageSource.includes("can't connect to the server")) {
      console.log(`[SKIP] DNS/Connection error detected for ${url}`);
      // Mark this domain as failed
      failedDomains.add(baseDomain);
      console.log(`[INFO] Marked domain ${baseDomain} as failed - will skip all future links from this domain`);
      return;
    }
    // Take screenshot and upload to Filebase
    let screenshot_url = null;
    try {
      const screenshotBuffer = await driver.takeScreenshot();
      const fileName = `screenshot_${Date.now()}_${Math.floor(Math.random()*10000)}.png`;
      
      // Upload to Filebase
      screenshot_url = await uploadScreenshotToFilebase(screenshotBuffer, fileName);
      
      if (!screenshot_url) {
        console.error(`[WARN] Failed to upload screenshot for ${url} to Filebase`);
      }
    } catch (e) {
      console.error(`[WARN] Could not take/upload screenshot for ${url}:`, e.message);
    }
    // Extract only the visible text content from the page
    let textContent = '';
    try {
      const body = await driver.findElement(By.tagName('body'));
      textContent = await body.getText();
    } catch (e) {
      console.error(`[WARN] Could not extract text content for ${url}:`, e.message);
    }

    // Check for empty or error content
    if (!textContent || textContent.trim() === '' || 
        pageSource.includes('about:neterror') ||
        pageSource.includes('dnsNotFound') ||
        textContent.toLowerCase().includes("can't connect") ||
        textContent.toLowerCase().includes('dns error')) {
      console.log(`[SKIP] No valid content at ${url} (empty or error page)`);
      // Mark this domain as failed if it's a connection error
      if (pageSource.includes('about:neterror') || 
          pageSource.includes('dnsNotFound') ||
          textContent.toLowerCase().includes("can't connect") ||
          textContent.toLowerCase().includes('dns error')) {
        failedDomains.add(baseDomain);
        console.log(`[INFO] Marked domain ${baseDomain} as failed - will skip all future links from this domain`);
      }
      return;
    }

    // Compute risk score
    const risk_score = classifyRisk({ title, content: textContent });
    // Extract tags from content
    const tags = extractTagsFromContent(textContent);
    // Only here: process/save the link and its content
    // Check if the link already exists in the onion_links table
    const { data: existing, error: selectError } = await supabase
      .from('onion_links')
      .select('id, source_urls, source_count')
      .eq('url', url)
      .maybeSingle();
    if (selectError) {
      console.error(`[DB ERROR] Failed to check existence for ${url}:`, selectError.message);
    }
    const now = new Date().toISOString();
    let newSourceUrls = [sourceUrl];
    let newSourceCount = 1;
    if (existing && existing.source_urls) {
      // Merge sources, avoid duplicates
      const prevSources = Array.isArray(existing.source_urls) ? existing.source_urls : [existing.source_urls];
      if (!prevSources.includes(sourceUrl)) {
        newSourceUrls = [...prevSources, sourceUrl];
        newSourceCount = newSourceUrls.length;
      } else {
        newSourceUrls = prevSources;
        newSourceCount = prevSources.length;
      }
    }
    // Trending score: recency + number of sources (simple formula)
    // You can adjust this formula as needed
    const recencyScore = 1000000000 - Date.now(); // Lower is newer
    const trending_score = (1000000000 - recencyScore) + (newSourceCount * 1000);
    if (!existing) {
      // Insert the new crawled link with trending columns
      const { error: insertError } = await supabase
        .from('onion_links')
        .insert([{ url, title, content: textContent, risk_score, last_crawled_at: now, source_urls: newSourceUrls, source_count: newSourceCount, trending_score, tags, screenshot_url }]);
      if (insertError) {
        console.error(`[DB ERROR] Failed to insert ${url}:`, insertError.message);
      } else {
        console.log(`[INSERTED] ${url} (risk: ${risk_score})`);
      }
    } else {
      // Update trending columns if already exists
      const { error: updateError } = await supabase
        .from('onion_links')
        .update({ last_crawled_at: now, source_urls: newSourceUrls, source_count: newSourceCount, trending_score, tags, screenshot_url })
        .eq('id', existing.id);
      if (updateError) {
        console.error(`[DB ERROR] Failed to update ${url}:`, updateError.message);
      } else {
        console.log(`[UPDATED] ${url} trending info`);
      }
    }
    console.log(`[CRAWL] (depth ${depth}) ${url} | Title: ${title} | Risk: ${risk_score}`);
    // Extract links from the page
    let links = await driver.findElements(By.css('a'));
    let onionLinks = [];
    for (let link of links) {
      let href = await link.getAttribute('href');
      if (href && href.includes('.onion')) {
        onionLinks.push(href);
      }
    }
    // Recursively crawl found onion links if any
    if (depth < MAX_DEPTH) {
      for (const link of onionLinks) {
        await crawlLink(driver, link, sourceUrl, depth + 1, visited, failedDomains);
      }
    }
  } catch (err) {
    // Categorize errors for better logging
    const errorMsg = err.message || err.toString();
    
    // Check if this is a connection/domain error that should mark the domain as failed
    const isConnectionError = errorMsg.includes('timeout') || 
                             errorMsg.includes('TimeoutError') ||
                             errorMsg.includes('dnsNotFound') || 
                             errorMsg.includes('neterror') ||
                             errorMsg.includes('Reached error page');
    
    if (errorMsg.includes('alert dialog')) {
      // Alert dialog was already handled, but might have caused issues
      console.log(`[SKIP] Alert dialog issue for ${url} - continuing...`);
    } else if (isConnectionError) {
      // Mark domain as failed for connection errors
      failedDomains.add(baseDomain);
      if (errorMsg.includes('timeout') || errorMsg.includes('TimeoutError')) {
        console.log(`[SKIP] Timeout for ${url} - site may be slow or unreachable`);
      } else if (errorMsg.includes('dnsNotFound') || errorMsg.includes('neterror')) {
        console.log(`[SKIP] DNS/Network error for ${url} - site may be down`);
      } else if (errorMsg.includes('Reached error page')) {
        console.log(`[SKIP] Error page reached for ${url}`);
      }
      console.log(`[INFO] Marked domain ${baseDomain} as failed - will skip all future links from this domain`);
    } else {
      // Log unexpected errors but don't crash
      console.error(`[ERROR] Failed to fetch ${url}: ${errorMsg}`);
      // Only log stack trace for unexpected errors
      if (!errorMsg.includes('alert') && !errorMsg.includes('timeout') && !errorMsg.includes('dns')) {
        console.error(`[ERROR] Stack:`, err.stack);
      }
    }
    // Continue crawling other links even if this one fails
  }
}

async function main() {
  console.log('[INFO] Starting DarkLens crawler...');
  console.log('[INFO] Make sure Tor is running on the configured port');
  
  // Test Supabase connection
  try {
    const { data, error } = await supabase.from('fetched_onion_links').select('url').limit(1);
    if (error) {
      console.error('[ERROR] Cannot connect to Supabase:', error.message);
      console.error('[ERROR] Check your SUPABASE_URL and SUPABASE_KEY environment variables');
      process.exit(1);
    }
    console.log('[INFO] Supabase connection successful');
  } catch (err) {
    console.error('[ERROR] Failed to test Supabase connection:', err.message);
    process.exit(1);
  }

  while (true) {
    try {
      const links = await readLinksFromDB();
      console.log(`[INFO] Found ${links.length} active links to crawl (newest first)`);
      
      if (links.length === 0) {
        console.log('[INFO] No links to crawl, waiting for next cycle...');
        await new Promise(res => setTimeout(res, CRAWL_INTERVAL));
        continue;
      }
      
      if (links.length > 0) {
        console.log(`[INFO] Priority: Crawling newest link first: ${links[0]}`);
      }
      
      let driver;
      try {
        driver = await launchTorSelenium();
      } catch (driverError) {
        console.error('[ERROR] Failed to initialize browser driver:', driverError.message);
        console.error('[ERROR] Skipping this crawl cycle, will retry after sleep...');
        await new Promise(res => setTimeout(res, CRAWL_INTERVAL));
        continue;
      }
      
      // Track failed domains across all links in this crawl cycle
      const failedDomains = new Set();
      
      for (const url of links) {
        try {
          await crawlLink(driver, url, url, 0, new Set(), failedDomains); // Pass failedDomains set
        } catch (e) {
          console.error(`[ERROR] Top-level crawl for ${url}:`, e.message);
          console.error(`[ERROR] Stack:`, e.stack);
          // Mark domain as failed on unexpected errors too
          const baseDomain = getBaseDomain(url);
          failedDomains.add(baseDomain);
        }
      }
      
      if (failedDomains.size > 0) {
        console.log(`[INFO] Summary: ${failedDomains.size} domain(s) marked as failed in this cycle: ${Array.from(failedDomains).join(', ')}`);
      }
      
      try { 
        await driver.quit(); 
        console.log('[INFO] Browser driver closed successfully');
      } catch (quitError) {
        console.error('[WARN] Error closing driver:', quitError.message);
      }
      
      console.log(`[INFO] Crawl cycle complete. Sleeping for ${CRAWL_INTERVAL / 1000}s before next round...`);
      await new Promise(res => setTimeout(res, CRAWL_INTERVAL));
    } catch (mainError) {
      console.error('[ERROR] Fatal error in main loop:', mainError.message);
      console.error('[ERROR] Stack:', mainError.stack);
      console.log('[INFO] Waiting before retry...');
      await new Promise(res => setTimeout(res, CRAWL_INTERVAL));
    }
  }
}

if (require.main === module) {
  main();
}