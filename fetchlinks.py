import re
import time
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
from supabase import create_client, Client
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException, WebDriverException
from bs4 import BeautifulSoup
import bs4

# Load environment variables from .env file
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in .env file")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

ONION_REGEX = re.compile(r"((https?://)?[a-z2-7]{16,56}\.onion\b[^\s'\"<>]*)", re.IGNORECASE)

def normalize_onion_url(url):
    url = url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "http://" + url
    try:
        from urllib.parse import urlparse
        u = urlparse(url)
        return f"{u.scheme}://{u.hostname}{u.path}"
    except Exception:
        return url.split('#')[0].split('?')[0]

def is_valid_web_link(url):
    try:
        if not (url.startswith("http://") or url.startswith("https://")):
            return False
        from urllib.parse import urlparse
        u = urlparse(url)
        if u.scheme not in ("http", "https"):
            return False
        if u.port and u.port not in (80, 443):
            return False
        if any(proto in url for proto in ["irc://", "ircs://", "xmpp://", "gopher://"]):
            return False
        if any(port in url for port in [":6667", ":6697", ":9999", ":5222"]):
            return False
        return True
    except Exception:
        return False

def is_base_onion_domain(url):
    return False

def contains_source_base_domain(link_url, source_url):
    return False

class OnionCrawler:
    def __init__(self):
        pass

    def get_active_sources(self):
        try:
            result = supabase.table("onion_sources")\
                .select("id, url")\
                .eq("is_active", True)\
                .execute()
            return result.data or []
        except Exception as e:
            print(f"[!] Error fetching sources: {e}")
            return []

    def update_source_last_checked(self, source_id: str):
        try:
            supabase.table("onion_sources")\
                .update({"last_checked_at": datetime.now(timezone.utc).isoformat()})\
                .eq("id", source_id)\
                .execute()
        except Exception as e:
            print(f"[!] Error updating source last_checked_at: {e}")

    def add_link(self, url: str, source_id: str):
        try:
            supabase.table("fetched_onion_links").upsert({
                "url": url,
                "source_id": source_id,
                "is_active": True
            }, on_conflict="url").execute()
        except Exception as e:
            print(f"[!] Failed to insert link: {e}")

    def check_link(self, driver, url, max_retries: int = 2) -> bool:
        for attempt in range(max_retries):
            try:
                driver.set_page_load_timeout(30)
                driver.get(url)
                # If page loads without exception, consider it active
                return True
            except (TimeoutException, WebDriverException) as e:
                print(f"[RETRY] Attempt {attempt + 1}/{max_retries} failed for {url}: {e}")
                time.sleep(2 * (attempt + 1))
        return False

    def crawl_and_update(self):
        sources = self.get_active_sources()
        print(f"[INFO] Found {len(sources)} active sources in database")

        options = Options()
        options.add_argument('--headless')
        options.set_preference('network.proxy.type', 1)
        options.set_preference('network.proxy.socks', '127.0.0.1')
        options.set_preference('network.proxy.socks_port', 9050)
        options.set_preference('network.proxy.socks_remote_dns', True)
        driver = webdriver.Firefox(options=options)

        for source in sources:
            source_id = source["id"]
            source_url = source["url"]
            print(f"\n[FETCH] Processing source: {source_url}")
            try:
                driver.set_page_load_timeout(90)
                driver.get(source_url)
                html = driver.page_source
                soup = BeautifulSoup(html, 'html.parser')
                # Extract links from DOM
                dom_links = [a['href'] for a in soup.find_all('a', href=True) if isinstance(a, bs4.element.Tag) and a.has_attr('href')]
                # Extract onion links from text
                text_links = list(set([match[0] for match in ONION_REGEX.findall(soup.get_text())]))
                all_links = set(dom_links + text_links)

                print(f"[FETCH] Found {len(all_links)} raw onion links from {source_url}")

                normalized_source = normalize_onion_url(source_url)
                seen = set()
                inserted_count = 0
                skipped_count = 0

                for link in all_links:
                    normalized_link = normalize_onion_url(link)
                    if not is_valid_web_link(normalized_link):
                        print(f"[SKIP] Invalid web link: {normalized_link}")
                        skipped_count += 1
                        continue

                    if (
                        not normalized_link or
                        normalized_link == normalized_source or
                        normalized_link in seen or
                        is_base_onion_domain(normalized_link) or
                        contains_source_base_domain(normalized_link, source_url)
                    ):
                        if contains_source_base_domain(normalized_link, source_url):
                            print(f"[SKIP] Link contains source base domain: {normalized_link}")
                        skipped_count += 1
                        continue

                    seen.add(normalized_link)

                    print(f"[CHECK] Checking if active: {normalized_link}")
                    if self.check_link(driver, normalized_link):
                        self.add_link(normalized_link, source_id)
                        inserted_count += 1
                        print(f"[INSERTED] {normalized_link}")
                    else:
                        print(f"[INACTIVE] {normalized_link} is not active")
                        skipped_count += 1

                print(f"[SUMMARY] Inserted {inserted_count} new links, skipped {skipped_count} links from {source_url}")
                self.update_source_last_checked(source_id)

            except Exception as e:
                print(f"[!] Error processing source {source_url}: {e}")

        driver.quit()

if __name__ == "__main__":
    crawler = OnionCrawler()
    crawler.crawl_and_update()