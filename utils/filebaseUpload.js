// filebaseUpload.js
// Utility for uploading screenshots to Filebase (S3-compatible storage)

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

// Filebase configuration from environment variables
const FILEBASE_ACCESS_KEY = process.env.FILEBASE_ACCESS_KEY;
const FILEBASE_SECRET_KEY = process.env.FILEBASE_SECRET_KEY;
const FILEBASE_BUCKET = process.env.FILEBASE_BUCKET || 'screenshots';
const FILEBASE_ENDPOINT = process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com';
const FILEBASE_REGION = process.env.FILEBASE_REGION || 'us-east-1';

// Initialize S3 client for Filebase
const s3Client = new S3Client({
  endpoint: FILEBASE_ENDPOINT,
  region: FILEBASE_REGION,
  credentials: {
    accessKeyId: FILEBASE_ACCESS_KEY,
    secretAccessKey: FILEBASE_SECRET_KEY,
  },
  forcePathStyle: true, // Required for Filebase
});

/**
 * Upload a screenshot to Filebase
 * @param {Buffer|string} imageBuffer - Image buffer or base64 string
 * @param {string} fileName - Name for the file
 * @returns {Promise<string|null>} - Public URL of the uploaded file or null if failed
 */
async function uploadScreenshotToFilebase(imageBuffer, fileName) {
  if (!FILEBASE_ACCESS_KEY || !FILEBASE_SECRET_KEY) {
    console.error('[ERROR] Filebase credentials not configured. Set FILEBASE_ACCESS_KEY and FILEBASE_SECRET_KEY in .env');
    return null;
  }

  try {
    // Convert base64 string to buffer if needed
    let buffer;
    if (typeof imageBuffer === 'string') {
      buffer = Buffer.from(imageBuffer, 'base64');
    } else {
      buffer = imageBuffer;
    }

    // Upload to Filebase
    const command = new PutObjectCommand({
      Bucket: FILEBASE_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: 'image/png',
      ACL: 'public-read', // Make file publicly accessible
    });

    await s3Client.send(command);

    // Construct public URL
    // Filebase public URLs format: https://<bucket>.filebase.com/<key>
    // This is the standard format for public Filebase buckets
    const publicUrl = `https://${FILEBASE_BUCKET}.filebase.com/${fileName}`;
    
    console.log(`[INFO] Screenshot uploaded to Filebase: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(`[ERROR] Failed to upload screenshot to Filebase:`, error.message);
    return null;
  }
}

module.exports = { uploadScreenshotToFilebase };

