import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { promisify } from 'util';

// Create writeFile async/await compatible
const writeFile = promisify(fs.writeFile);

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

// Initialize the S3 client with the same configuration as in test-filebase.js
const s3Client = new S3Client({
  endpoint: process.env.VITE_FILEBASE_ENDPOINT || 'https://s3.filebase.com',
  region: process.env.VITE_FILEBASE_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.VITE_FILEBASE_ACCESS_KEY,
    secretAccessKey: process.env.VITE_FILEBASE_SECRET_KEY,
  },
  forcePathStyle: true,
});

async function downloadFile(bucket, key, outputPath) {
  const params = {
    Bucket: bucket,
    Key: key,
  };

  try {
    const { Body } = await s3Client.send(new GetObjectCommand(params));
    const writeStream = fs.createWriteStream(outputPath);
    
    return new Promise((resolve, reject) => {
      Body.pipe(writeStream)
        .on('error', reject)
        .on('close', () => resolve(outputPath));
    });
  } catch (error) {
    console.error(`Error downloading ${key}:`, error);
    throw error;
  }
}

async function testScreenshotAccess() {
  console.log('📸 Starting Screenshot Access Test\n');
  
  const bucket = process.env.VITE_FILEBASE_BUCKET;
  const testScreenshot = 'screenshot_1763375671318_2063.png';
  const testDir = './test-downloads';
  
  // Log configuration for debugging
  console.log('Configuration:');
  console.log('  - Bucket:', bucket);
  console.log('  - Endpoint:', process.env.VITE_FILEBASE_ENDPOINT || 'https://s3.filebase.com');
  console.log('  - Region:', process.env.VITE_FILEBASE_REGION || 'us-east-1');
  console.log('  - Access Key:', process.env.VITE_FILEBASE_ACCESS_KEY ? '*** (present)' : '❌ Missing');
  console.log('  - Secret Key:', process.env.VITE_FILEBASE_SECRET_KEY ? '*** (present)' : '❌ Missing');
  
  // Create test directory if it doesn't exist
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  try {
    // 1. First try to get the specific screenshot directly
    console.log(`\n🔍 Attempting to access: ${testScreenshot}`);
    try {
      const headParams = {
        Bucket: bucket,
        Key: testScreenshot
      };
      
      // Try to get the object's metadata first
      const headCommand = new HeadObjectCommand(headParams);
      const headResult = await s3Client.send(headCommand);
      
      console.log('✅ Found screenshot with metadata:', {
        'Content-Type': headResult.ContentType,
        'Content-Length': headResult.ContentLength,
        'Last-Modified': headResult.LastModified
      });
      
      // If we get here, the file exists - download it
      const outputPath = `${testDir}/${testScreenshot}`;
      await downloadFile(bucket, testScreenshot, outputPath);
      console.log(`✅ Successfully downloaded to: ${outputPath}`);
      
      // Get file stats
      const stats = fs.statSync(outputPath);
      console.log(`   File size: ${stats.size} bytes`);
      console.log(`   Created at: ${stats.birthtime}`);
      console.log(`   Last modified: ${stats.mtime}`);
      
      // Try to open the file in the default image viewer
      try {
        const { exec } = require('child_process');
        const openCommand = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
        exec(`${openCommand} "${outputPath}"`);
        console.log('   Opened in default image viewer');
      } catch (e) {
        console.log('   Note: Could not open image automatically');
      }
      
      return; // Exit after successful download
      
    } catch (error) {
      console.log(`❌ Could not access ${testScreenshot} directly:`, error.message);
      console.log('   Will try listing the bucket contents...');
    }
    
    // 2. If direct access failed, list the bucket to see what's there
    console.log('\n🔍 Listing bucket contents...');
    const listParams = {
      Bucket: bucket,
      MaxKeys: 100  // Limit the number of results
    };
    
    const listCommand = new ListObjectsV2Command(listParams);
    const listResult = await s3Client.send(listCommand);
    
    if (!listResult.Contents || listResult.Contents.length === 0) {
      console.log('ℹ️  No screenshots found in the bucket.');
      return;
    }
    
    console.log(`   Found ${listResult.Contents.length} files in the bucket:`);
    listResult.Contents.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.Key} (${file.Size} bytes)`);
    });
    
    // 2. Try to download a specific screenshot
    console.log(`\n📥 Testing download of: ${testScreenshot}`);
    const outputPath = `${testDir}/${testScreenshot}`;
    
    try {
      await downloadFile(bucket, testScreenshot, outputPath);
      console.log(`✅ Successfully downloaded to: ${outputPath}`);
      
      // 3. Verify the file exists and has content
      const stats = fs.statSync(outputPath);
      console.log(`   File size: ${stats.size} bytes`);
      console.log(`   Created at: ${stats.birthtime}`);
      console.log(`   Last modified: ${stats.mtime}`);
      
    } catch (error) {
      console.error(`❌ Error downloading ${testScreenshot}:`, error.message);
      
      // 4. If specific screenshot not found, try to find any image file
      console.log('\n🔄 Trying to find any image file in the bucket...');
      const imageFile = listResult.Contents.find(file => 
        /\.(jpg|jpeg|png|gif)$/i.test(file.Key)
      );
      
      if (imageFile) {
        console.log(`   Found image file: ${imageFile.Key}`);
        const outputPath = `${testDir}/found-${imageFile.Key.split('/').pop()}`;
        await downloadFile(bucket, imageFile.Key, outputPath);
        console.log(`✅ Successfully downloaded to: ${outputPath}`);
      } else {
        console.log('   No image files found in the bucket.');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing screenshot access:', error.message);
    if (error.$metadata) {
      console.log('   Status code:', error.$metadata.httpStatusCode);
      console.log('   Request ID:', error.$metadata.requestId);
    }
  }
}

// Run the test
testScreenshotAccess().catch(console.error);
