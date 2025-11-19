// listSources.js
const { supabase } = require('./supabaseClient');

async function listSources() {
  try {
    console.log('Fetching all sources...');
    
    const { data: sources, error } = await supabase
      .from('onion_sources')
      .select('*');
    
    if (error) {
      console.error('Error fetching sources:', error);
      return;
    }

    if (!sources || sources.length === 0) {
      console.log('No sources found in the database.');
      return;
    }

    console.log(`\nFound ${sources.length} sources:\n`);
    console.log(JSON.stringify(sources, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

listSources();