 // init_sources.js
const { supabase } = require('./supabaseClient');

const INITIAL_SOURCES = [
  {
    url: 'http://zqktlwiuavvvqqt4ybvgvi7tyo4hjl5xgfuvpdf6otjiycgwqbym2qad.onion/wiki/index.php/Main_Page',
    description: 'The Hidden Wiki (v3 mirror)'
  },
  {
    url: 'http://torlinksge6enmcyyuxjpjkoouw4oorgdgeo7ftnq3zodj7g2zxi3kyd.onion/',
    description: 'TorLinks (Hidden Wiki alternative)'
  },
  {
    url: 'http://jaz45aabn5vkemy4jkg4mi4syheisqn2wn2n4fsuitpccdackjwxplad.onion/',
    description: 'OnionLinks (Hidden Wiki mirror)'
  }
];

async function initializeSources() {
  for (const src of INITIAL_SOURCES) {
    const { data: existing } = await supabase
      .from('onion_sources')
      .select('id')
      .eq('url', src.url)
      .maybeSingle();

    if (!existing) {
      await supabase
        .from('onion_sources')
        .insert([src]);
      console.log(`Inserted: ${src.url}`);
    } else {
      console.log(`Already exists: ${src.url}`);
    }
  }
  console.log('Initialization complete.');
}

initializeSources();