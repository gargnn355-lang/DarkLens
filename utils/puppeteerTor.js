// puppeteerTor.js
// Launch Playwright Firefox browser instance over Tor SOCKS5 proxy

const { firefox } = require('playwright');
require('dotenv').config();

async function launchTorBrowser() {
  const proxy = process.env.TOR_PROXY || 'socks5://127.0.0.1:9050';
  const browser = await firefox.launch({
    headless: true,
    proxy: { server: proxy },
    firefoxUserPrefs: {
      'network.proxy.type': 1,
      'network.proxy.socks': '127.0.0.1',
      'network.proxy.socks_port': 9050,
      'network.proxy.socks_remote_dns': true,
      'network.dns.blockDotOnion': false,
      'network.dns.disableIPv6': true
    }
  });
  return browser;
}

module.exports = { launchTorBrowser }; 