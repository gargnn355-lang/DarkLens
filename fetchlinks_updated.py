from supabase import create_client, Client
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.by import By
from bs4 import BeautifulSoup
from datetime import datetime, timezone
import re
import os
from dotenv import load_dotenv

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

def extract_onion_links_from_html(html):
    return list(set(match[0] for match in ONION_REGEX.findall(html)))

class OnionCrawler:
    def __init__(self):
        pass

    def get_active_sources_prioritized(self):
        """Get active sources ordered by recency (newest first)"""
        try:
            result = supabase.table("onion_sources")\
                .select("id, url, created_at, last_checked_at")\
                .eq("is_active", True)\
                .order("created_at", desc=True)\
                .execute()
            return result.data or []
        except Exception as e:
            print(f"[!] Error fetching sources: {e}")
            return []

    def get_recently_added_links(self, limit=50):
        """Get recently added links that haven't been crawled yet"""
        try:
            result = supabase.table("fetched_onion_links")\
                .select("id, url, source_id, created_at")\
                .eq("is_active", True)\
                .order("created_at", desc=True)\
                .limit(limit)\
                .execute()
            return result.data or []
        except Exception as e:
            print(f"[!] Error fetching recent links: {e}")
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

    def crawl_sources_phase(self):
        """Phase 1: Crawl recently added sources first"""
        sources = self.get_active_sources_prioritized()
        print(f"[PHASE 1] Found {len(sources)} active sources, crawling in priority order (newest first)")

        options = Options()
        options.headless = True
        options.set_preference('network.proxy.type', 1)
        options.set_preference('network.proxy.socks', '127.0.0.1')
        options.set_preference('network.proxy.socks_port', 9050)
        options.set_preference('network.proxy.socks_remote_dns', True)
        driver = webdriver.Firefox(options=options)

        total_inserted = 0
        for i, source in enumerate(sources):
            source_id = source["id"]
            source_url = source["url"]
            created_at = source.get("created_at", "Unknown")
            last_checked = source.get("last_checked_at", "Never")

            print(f"\n[PHASE 1 - {i+1}/{len(sources)}] Processing source: {source_url}")
            print(f"  Created: {created_at}")
            print(f"  Last checked: {last_checked}")

            try:
                driver.get(source_url)
                html = driver.page_source
                dom_links = [a.get_attribute("href") for a in driver.find_elements(By.TAG_NAME, "a") if a.get_attribute("href")]
                text_links = extract_onion_links_from_html(html)
                all_links = set(dom_links + text_links)

                print(f"[FETCH] Found {len(all_links)} raw onion links from {source_url}")

                seen = set()
                inserted_count = 0
                skipped_count = 0

                for link in all_links:
                    normalized_link = normalize_onion_url(link)
                    # Skip if not a valid web link
                    if not is_valid_web_link(normalized_link):
                        print(f"[SKIP] Invalid web link: {normalized_link}")
                        skipped_count += 1
                        continue
                    # Skip if link contains irc, ircs, or xmpp (anywhere in the URL)
                    if any(proto in normalized_link for proto in ["irc", "ircs", "xmpp"]):
                        print(f"[SKIP] Link contains forbidden protocol: {normalized_link}")
                        skipped_count += 1
                        continue
                    # Skip if link contains '#' (fragment)
                    if '#' in normalized_link:
                        print(f"[SKIP] Link contains #: {normalized_link}")
                        skipped_count += 1
                        continue
                    # Skip if already seen
                    if not normalized_link or normalized_link in seen:
                        skipped_count += 1
                        continue
                    seen.add(normalized_link)
                    # Add the link without checking if it's active or base domain
                    self.add_link(normalized_link, source_id)
                    inserted_count += 1
                    print(f"[INSERTED] {normalized_link}")

                total_inserted += inserted_count
                print(f"[SUMMARY] Inserted {inserted_count} new links, skipped {skipped_count} links from {source_url}")
                self.update_source_last_checked(source_id)

            except Exception as e:
                print(f"[!] Error processing source {source_url}: {e}")

        driver.quit()
        print(f"\n[PHASE 1 COMPLETE] Total new links inserted: {total_inserted}")
        return total_inserted

    def crawl_recent_links_phase(self):
        """Phase 2: Process recently added links for content crawling"""
        recent_links = self.get_recently_added_links(limit=100)
        print(f"\n[PHASE 2] Found {len(recent_links)} recently added links to process")

        if not recent_links:
            print("[PHASE 2] No recent links to process")
            return

        # Group links by source for better organization
        links_by_source = {}
        for link in recent_links:
            source_id = link["source_id"]
            if source_id not in links_by_source:
                links_by_source[source_id] = []
            links_by_source[source_id].append(link)

        print(f"[PHASE 2] Grouped links into {len(links_by_source)} sources")

        for source_id, links in links_by_source.items():
            print(f"\n[PHASE 2] Processing {len(links)} links from source {source_id}")
            for i, link in enumerate(links):
                print(f"  [{i+1}/{len(links)}] {link['url']} (added: {link.get('created_at', 'Unknown')})")
                # Here you could add logic to trigger content crawling for these links
                # For now, we're just logging them

    def crawl_and_update(self):
        """Main crawling method with priority-based approach"""
        print("=" * 60)
        print("🚀 STARTING PRIORITY-BASED CRAWLING")
        print("=" * 60)

        # Phase 1: Crawl recently added sources first
        print("\n📡 PHASE 1: Crawling recently added sources")
        print("-" * 40)
        new_links_count = self.crawl_sources_phase()

        # Phase 2: Process recently added links
        print("\n🔍 PHASE 2: Processing recently added links")
        print("-" * 40)
        self.crawl_recent_links_phase()

        print("\n" + "=" * 60)
        print("✅ PRIORITY-BASED CRAWLING COMPLETE")
        print(f"📊 New links discovered: {new_links_count}")
        print("=" * 60)

if __name__ == "__main__":
    crawler = OnionCrawler()
    crawler.crawl_and_update()
