ALTER TABLE onion_links ADD COLUMN last_crawled_at timestamptz, ADD COLUMN source_urls text[], ADD COLUMN source_count integer DEFAULT 1, ADD COLUMN trending_score numeric DEFAULT 0;
