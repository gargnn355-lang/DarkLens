// prune.js
// This script connects to the database and removes links that are likely dead.

const { supabase } = require('./supabaseClient');

// Define the threshold for pruning.
// A link is considered dead if its status is not 200 (e.g., 0 for timeout, 404)
// AND it hasn't been successfully updated in this many days.
const PRUNE_THRESHOLD_DAYS = 7;

async function pruneDeadLinks() {
  console.log(`[PRUNE] Starting dead link pruning process...`);

  // Calculate the date threshold
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - PRUNE_THRESHOLD_DAYS);
  const thresholdISO = thresholdDate.toISOString();

  console.log(`[PRUNE] Deleting links with non-200 status last updated before ${thresholdISO}`);

  // Perform the deletion
  const { data, error } = await supabase
    .from('onion_links')
    .delete()
    .neq('status', 200) // not equal to 200
    .lt('updated_at', thresholdISO); // less than the threshold date

  if (error) {
    console.error(`[PRUNE] Error during pruning:`, error);
    return;
  }

  if (data) {
    console.log(`[PRUNE] Successfully pruned ${data.length} dead link(s).`);
  } else {
    console.log(`[PRUNE] No dead links to prune.`);
  }

}

// Run the function if the script is executed directly
if (require.main === module) {
  pruneDeadLinks();
} 
module.exports = { pruneDeadLinks };