// checkTables.js
const { supabase } = require('./supabaseClient');

const TABLE_NAMES = [
  'sources',
  'onion_sources',
  'links',
  'onion_links',
  'crawled_sites',
  'darkweb_sources',
  'source_links',
  'dark_web_sources',
  'darkweb_links',
  'dark_links'
];

async function checkTables() {
  for (const tableName of TABLE_NAMES) {
    try {
      console.log(`\nChecking table: ${tableName}`);
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1); // Just get one row to check if table exists
      
      if (error) {
        console.log(`❌ Table ${tableName} not found or error:`, error.message);
      } else {
        console.log(`✅ Table ${tableName} found with ${data.length} rows`);
        if (data.length > 0) {
          console.log('Sample row:', JSON.stringify(data[0], null, 2));
        }
        return; // Stop at the first found table
      }
    } catch (err) {
      console.log(`❌ Error checking table ${tableName}:`, err.message);
    }
  }
  console.log('\nNo known tables found. Please check your database for the correct table name.');
}

checkTables();
