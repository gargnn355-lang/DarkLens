// extractData.js
// Extracts title, content, metadata, and .onion links from a Puppeteer page

async function extractPageData(page, url) {
  let status = 0;
  let rawHtml = '';
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    status = response ? response.status() : 0;
  } catch (e) {
    status = 0;
  }
  let data = { url, title: '', content: '', metadata: {}, links: [], status };
  try {
    // Wait for body or main content
    await page.waitForSelector('body', { timeout: 20000 });
    rawHtml = await page.content();
    data = await page.evaluate(() => {
      let title = document.querySelector('title')?.innerText || document.querySelector('h1')?.innerText || '';
      document.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      let content = document.body.innerText;
      let meta = {};
      document.querySelectorAll('meta').forEach(m => {
        if (m.name || m.property) meta[m.name || m.property] = m.content;
      });
      let links = Array.from(document.querySelectorAll('a[href*=".onion"]')).map(a => a.href);
      return { title, content, metadata: meta, links };
    });
    // If content is empty, log raw HTML for debugging
    if (!data.content || data.content.trim().length < 10) {
      console.log('[DEBUG] Raw HTML:', rawHtml.slice(0, 500));
    }
  } catch (e) {
    // Extraction failed, log raw HTML for debugging
    try { rawHtml = await page.content(); } catch {}
    console.log('[DEBUG] Extraction failed. Raw HTML:', rawHtml.slice(0, 500));
  }
  data.url = url;
  data.status = status;
  return data;
}

module.exports = { extractPageData }; 