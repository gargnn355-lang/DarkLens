// directCrawl.js
// Usage: node directCrawl.js <onion_url>

const { Builder, By } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const { supabase } = require('./supabaseClient');
const { classifyRisk } = require('./utils/classifyRisk');

const KEYWORDS = [
  "drugs", "bitcoin", "crypto", "market", "carding", "hacking", "fraud", "phishing",
  "counterfeit", "passport", "weed", "cocaine", "heroin", "ecstasy", "steroids",
  "gun", "firearm", "explosives", "malware", "ransomware", "porn", "escort", "forged",
  "credit card", "bank", "atm", "skimmer", "vpn", "anonymity", "tor", "privacy"
];

const MAX_DEPTH = 2; // Same as crawler.js
const SCREENSHOT_BUCKET = 'screenshots';

function extractTagsFromContent(content) {
  if (!content) return [];
  const lower = content.toLowerCase();
  return KEYWORDS.filter(kw => lower.includes(kw));
}

async function launchTorSelenium() {
  let options = new firefox.Options();
  options.setPreference('network.proxy.type', 1);
  options.setPreference('network.proxy.socks', '127.0.0.1');
  options.setPreference('network.proxy.socks_port', 9050);
  options.setPreference('network.proxy.socks_remote_dns', true);
  options.setPreference('network.dns.blockDotOnion', false);
  options.setPreference('network.dns.disableIPv6', true);
  options.addArguments('-headless');
  let driver = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(options)
    .build();
  return driver;
}

async function crawlLink(driver, url, sourceUrl, depth = 0, visited = new Set()) {
  if (!url.endsWith('.onion') && !url.includes('.onion/')) return;
  // Skip APK files
  if (url.endsWith('.apk')) {
    console.log(`[SKIP] Skipping APK file: ${url}`);
    return;
  }
  if (visited.has(url) || (depth > 0 && depth > MAX_DEPTH)) return;
  visited.add(url);
  try {
    await driver.manage().setTimeouts({ pageLoad: 60000 });
    await driver.get(url);
    const title = await driver.getTitle();
    const pageSource = await driver.getPageSource();
    // Take screenshot
    let screenshot_url = null;
    try {
      const screenshotBuffer = await driver.takeScreenshot();
      const fileName = `screenshot_${Date.now()}_${Math.floor(Math.random()*10000)}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(SCREENSHOT_BUCKET)
        .upload(fileName, Buffer.from(screenshotBuffer, 'base64'), {
          contentType: 'image/png',
        });
      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage.from(SCREENSHOT_BUCKET).getPublicUrl(fileName);
        screenshot_url = publicUrlData.publicUrl;
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
    if (!textContent || textContent.trim() === '' || pageSource.includes('about:neterror')) {
      console.log(`[SKIP] No content at ${url}`);
      return;
    }
    const risk_score = classifyRisk({ title, content: textContent });
    const tags = extractTagsFromContent(textContent);
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
      const prevSources = Array.isArray(existing.source_urls) ? existing.source_urls : [existing.source_urls];
      if (!prevSources.includes(sourceUrl)) {
        newSourceUrls = [...prevSources, sourceUrl];
        newSourceCount = newSourceUrls.length;
      } else {
        newSourceUrls = prevSources;
        newSourceCount = prevSources.length;
      }
    }
    const recencyScore = 1000000000 - Date.now();
    const trending_score = (1000000000 - recencyScore) + (newSourceCount * 1000);
    if (!existing) {
      const { error: insertError } = await supabase
        .from('onion_links')
        .insert([{ url, title, content: textContent, risk_score, last_crawled_at: now, source_urls: newSourceUrls, source_count: newSourceCount, trending_score, tags, screenshot_url }]);
      if (insertError) {
        console.error(`[DB ERROR] Failed to insert ${url}:`, insertError.message);
      } else {
        console.log(`[INSERTED] ${url} (risk: ${risk_score})`);
      }
    } else {
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
        await crawlLink(driver, link, sourceUrl, depth + 1, visited);
      }
    }
  } catch (err) {
    console.error(`[ERROR] Failed to fetch ${url}: ${err.message}`);
  }
}

async function directCrawl(url) {
  const driver = await launchTorSelenium();
  try {
    await crawlLink(driver, url, url, 0, new Set());
  } finally {
    try { await driver.quit(); } catch {}
  }
}

if (require.main === module) {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node directCrawl.js <onion_url>');
    process.exit(1);
  }
  directCrawl(url).then(() => process.exit(0));
} 