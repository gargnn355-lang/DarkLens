// listAllTables.js
const { supabase } = require('./supabaseClient');

async function listAllTables() {
  try {
    console.log('Fetching database tables...');
    
    // This is a simple query that should work with PostgREST
    const { data: tables, error } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');

    if (error) {
      console.error('Error fetching tables:', error);
      return;
    }

    if (!tables || tables.length === 0) {
      console.log('No tables found in the public schema.');
      return;
    }

    console.log(`\nFound ${tables.length} tables:\n`);
    tables.forEach((table, index) => {
      console.log(`[${index + 1}] ${table.tablename}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

listAllTables();
