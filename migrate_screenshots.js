// migrate_screenshots.js
// Migration script to move screenshots from Supabase Storage to Filebase
// Usage: 
//   node migrate_screenshots.js           - Run migration
//   node migrate_screenshots.js --dry-run - Preview what would be migrated (no actual migration)

const { supabase } = require('./supabaseClient');
const { uploadScreenshotToFilebase } = require('./utils/filebaseUpload');
require('dotenv').config();

const SUPABASE_BUCKET = 'screenshots'; // Your Supabase bucket name
const BATCH_SIZE = 10; // Process screenshots in batches to avoid overwhelming the system

/**
 * Download a file from Supabase Storage
 */
async function downloadFromSupabase(fileName) {
  try {
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .download(fileName);
    
    if (error) {
      console.error(`[ERROR] Failed to download ${fileName}:`, error.message);
      return null;
    }
    
    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error(`[ERROR] Exception downloading ${fileName}:`, err.message);
    return null;
  }
}

/**
 * Get all files from Supabase Storage bucket
 */
async function listSupabaseFiles() {
  try {
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .list('', {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'created_at', order: 'asc' }
      });
    
    if (error) {
      console.error('[ERROR] Failed to list files from Supabase:', error.message);
      return [];
    }
    
    // Filter for image files
    return (data || []).filter(file => 
      file.name.endsWith('.png') || 
      file.name.endsWith('.jpg') || 
      file.name.endsWith('.jpeg')
    );
  } catch (err) {
    console.error('[ERROR] Exception listing files:', err.message);
    return [];
  }
}

/**
 * Update database record with new Filebase URL
 */
async function updateDatabaseUrl(oldUrl, newUrl) {
  try {
    // Find all records with the old screenshot URL
    const { data: links, error: selectError } = await supabase
      .from('onion_links')
      .select('id, screenshot_url')
      .eq('screenshot_url', oldUrl);
    
    if (selectError) {
      console.error(`[ERROR] Failed to find records for ${oldUrl}:`, selectError.message);
      return 0;
    }
    
    if (!links || links.length === 0) {
      console.log(`[INFO] No database records found for ${oldUrl}`);
      return 0;
    }
    
    // Update all matching records
    const { error: updateError } = await supabase
      .from('onion_links')
      .update({ screenshot_url: newUrl })
      .in('id', links.map(l => l.id));
    
    if (updateError) {
      console.error(`[ERROR] Failed to update database for ${oldUrl}:`, updateError.message);
      return 0;
    }
    
    return links.length;
  } catch (err) {
    console.error(`[ERROR] Exception updating database:`, err.message);
    return 0;
  }
}

/**
 * Migrate a single screenshot
 */
async function migrateScreenshot(fileName) {
  try {
    console.log(`[MIGRATE] Processing ${fileName}...`);
    
    // Download from Supabase
    const fileBuffer = await downloadFromSupabase(fileName);
    if (!fileBuffer) {
      console.log(`[SKIP] Failed to download ${fileName}, skipping...`);
      return { success: false, fileName };
    }
    
    // Upload to Filebase
    const filebaseUrl = await uploadScreenshotToFilebase(fileBuffer, fileName);
    if (!filebaseUrl) {
      console.log(`[SKIP] Failed to upload ${fileName} to Filebase, skipping...`);
      return { success: false, fileName };
    }
    
    // Get old Supabase URL
    const { data: publicUrlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(fileName);
    const oldUrl = publicUrlData.publicUrl;
    
    // Update database
    const updatedCount = await updateDatabaseUrl(oldUrl, filebaseUrl);
    
    if (updatedCount > 0) {
      console.log(`[SUCCESS] Migrated ${fileName}: ${updatedCount} record(s) updated`);
      return { success: true, fileName, oldUrl, newUrl: filebaseUrl, updatedCount };
    } else {
      console.log(`[WARN] ${fileName} uploaded to Filebase but no database records updated`);
      return { success: true, fileName, oldUrl, newUrl: filebaseUrl, updatedCount: 0 };
    }
  } catch (err) {
    console.error(`[ERROR] Exception migrating ${fileName}:`, err.message);
    return { success: false, fileName, error: err.message };
  }
}

/**
 * Main migration function
 */
async function migrateAllScreenshots(dryRun = false) {
  if (dryRun) {
    console.log('[DRY RUN] Preview mode - no files will be migrated\n');
  }
  console.log('[INFO] Starting screenshot migration from Supabase to Filebase...');
  console.log('[INFO] This may take a while depending on the number of screenshots...\n');
  
  // Check Filebase credentials
  if (!process.env.FILEBASE_ACCESS_KEY || !process.env.FILEBASE_SECRET_KEY) {
    console.error('[ERROR] Filebase credentials not found in .env file!');
    console.error('[ERROR] Please set FILEBASE_ACCESS_KEY and FILEBASE_SECRET_KEY');
    process.exit(1);
  }
  
  // List all files from Supabase
  console.log('[INFO] Fetching list of screenshots from Supabase...');
  const files = await listSupabaseFiles();
  
  if (files.length === 0) {
    console.log('[INFO] No screenshots found in Supabase Storage');
    return;
  }
  
  console.log(`[INFO] Found ${files.length} screenshot(s) to migrate\n`);
  
  // Process in batches
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  const results = [];
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    console.log(`\n[INFO] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(files.length / BATCH_SIZE)} (${batch.length} files)...`);
    
    // Process batch sequentially to avoid overwhelming the system
    for (const file of batch) {
      if (dryRun) {
        // In dry-run mode, just check if file exists and would be migrated
        const { data: publicUrlData } = supabase.storage
          .from(SUPABASE_BUCKET)
          .getPublicUrl(file.name);
        const oldUrl = publicUrlData.publicUrl;
        
        // Check if this URL exists in database
        const { data: links } = await supabase
          .from('onion_links')
          .select('id')
          .eq('screenshot_url', oldUrl)
          .limit(1);
        
        const wouldUpdate = links && links.length > 0;
        console.log(`[DRY RUN] ${file.name} - ${wouldUpdate ? 'Would migrate' : 'No DB records found'}`);
        
        results.push({ 
          success: wouldUpdate, 
          fileName: file.name, 
          wouldUpdate: wouldUpdate 
        });
        
        if (wouldUpdate) successCount++;
        else skippedCount++;
      } else {
        const result = await migrateScreenshot(file.name);
        results.push(result);
        
        if (result.success) {
          if (result.updatedCount > 0) {
            successCount++;
          } else {
            skippedCount++;
          }
        } else {
          failCount++;
        }
        
        // Small delay between files to be gentle on the APIs
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('[MIGRATION SUMMARY]');
  console.log('='.repeat(60));
  console.log(`Total files: ${files.length}`);
  console.log(`Successfully migrated: ${successCount}`);
  console.log(`Uploaded but no DB records: ${skippedCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('='.repeat(60));
  
  // Show failed files if any
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log('\n[FAILED FILES]');
    failed.forEach(f => {
      console.log(`  - ${f.fileName}${f.error ? `: ${f.error}` : ''}`);
    });
  }
  
  console.log('\n[INFO] Migration complete!');
}

// Run migration
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  migrateAllScreenshots(dryRun)
    .then(() => {
      console.log('[INFO] Script finished');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[FATAL ERROR]', err);
      process.exit(1);
    });
}

module.exports = { migrateAllScreenshots, migrateScreenshot };

