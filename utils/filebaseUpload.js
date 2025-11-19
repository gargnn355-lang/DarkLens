// filebaseUpload.js
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

// Configuration - match the frontend's test-screenshots.js
const FILEBASE_ENDPOINT = process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com';
const FILEBASE_REGION = process.env.FILEBASE_REGION || 'us-east-1';
const FILEBASE_BUCKET = process.env.FILEBASE_BUCKET || 'darklens-screenshots';
const FILEBASE_ACCESS_KEY = process.env.FILEBASE_ACCESS_KEY;
const FILEBASE_SECRET_KEY = process.env.FILEBASE_SECRET_KEY;

// Initialize S3 client with Filebase configuration
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
 * Check if a file exists in the bucket
 * @param {string} fileName - Name of the file to check
 * @returns {Promise<boolean>} - True if file exists
 */
async function fileExists(fileName) {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: FILEBASE_BUCKET,
      Key: fileName
    }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Get a signed URL for a private file
 * @param {string} fileName - Name of the file
 * @param {number} expiresIn - Expiration time in seconds (default: 1 week)
 * @returns {Promise<string>} - Signed URL
 */
async function getSignedFileUrl(fileName, expiresIn = 604800) {
  try {
    const command = new GetObjectCommand({
      Bucket: FILEBASE_BUCKET,
      Key: fileName,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn 
    });

    return signedUrl;
  } catch (error) {
    console.error(`[ERROR] Failed to generate signed URL for ${fileName}:`, error.message);
    return null;
  }
}

/**
 * Upload a screenshot to Filebase with private access
 * @param {Buffer|string} imageBuffer - Image buffer or base64 string
 * @param {string} fileName - Name for the file
 * @returns {Promise<string|null>} - Signed URL of the uploaded file or null if failed
 */
async function uploadScreenshotToFilebase(imageBuffer, fileName) {
  if (!FILEBASE_ACCESS_KEY || !FILEBASE_SECRET_KEY) {
    console.error('[ERROR] Filebase credentials not configured. Set FILEBASE_ACCESS_KEY and FILEBASE_SECRET_KEY in .env');
    return null;
  }

  try {
    // Convert base64 string to buffer if needed
    const buffer = typeof imageBuffer === 'string' 
      ? Buffer.from(imageBuffer, 'base64')
      : imageBuffer;

    // Check if file already exists
    if (await fileExists(fileName)) {
      console.log(`[INFO] File ${fileName} already exists, generating new signed URL`);
      return await getSignedFileUrl(fileName);
    }

    // Upload to Filebase with private ACL
    const uploadCommand = new PutObjectCommand({
      Bucket: FILEBASE_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: 'image/png',
      ACL: 'private',
    });

    await s3Client.send(uploadCommand);
    console.log(`[INFO] Screenshot uploaded to Filebase: ${fileName}`);

    // Generate and return a signed URL
    return await getSignedFileUrl(fileName);
    
  } catch (error) {
    console.error(`[ERROR] Failed to upload screenshot to Filebase:`, error.message);
    return null;
  }
}

module.exports = { 
  uploadScreenshotToFilebase,
  getSignedFileUrl,
  s3Client,
  FILEBASE_BUCKET
};