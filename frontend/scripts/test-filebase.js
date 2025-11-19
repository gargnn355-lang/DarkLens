// frontend/scripts/test-filebase.js
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

// Initialize the S3 client
const s3Client = new S3Client({
  endpoint: process.env.VITE_FILEBASE_ENDPOINT || 'https://s3.filebase.com',
  region: process.env.VITE_FILEBASE_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.VITE_FILEBASE_ACCESS_KEY,
    secretAccessKey: process.env.VITE_FILEBASE_SECRET_KEY,
  },
  forcePathStyle: true,
});

async function testFilebase() {
  console.log('🚀 Starting Filebase Test\n');
  
  // Test configuration
  const testContent = 'Hello, this is a test file for Filebase!';
  const fileName = `test-file-${Date.now()}.txt`;
  const uploadPath = `test-uploads/${fileName}`;

  try {
    console.log('📤 Uploading test file...');
    
    const params = {
      Bucket: process.env.VITE_FILEBASE_BUCKET,
      Key: uploadPath,
      Body: testContent,
      ContentType: 'text/plain',
      ACL: 'public-read',
    };

    const command = new PutObjectCommand(params);
    const result = await s3Client.send(command);
    
    console.log('✅ File uploaded successfully!');
    console.log('   ETag:', result.ETag);
    
    // Get the file using the S3 client to verify it was uploaded correctly
    console.log('\n🔍 Verifying file access via S3 API...');
    try {
      // First, let's list objects to verify the file exists
      console.log('   Listing objects in the bucket...');
      const listParams = {
        Bucket: process.env.VITE_FILEBASE_BUCKET,
        Prefix: 'test-uploads/'
      };
      const listCommand = new ListObjectsV2Command(listParams);
      const listResult = await s3Client.send(listCommand);
      
      if (listResult.Contents) {
        console.log(`   Found ${listResult.Contents.length} objects in the bucket:`);
        listResult.Contents.forEach((obj, index) => {
          console.log(`   ${index + 1}. ${obj.Key} (${obj.Size} bytes)`);
        });
      } else {
        console.log('   No objects found in the bucket');
      }
      
      // Now try to get the object directly
      console.log('\n   Getting object directly...');
      const getParams = {
        Bucket: process.env.VITE_FILEBASE_BUCKET,
        Key: uploadPath
      };
      const getCommand = new GetObjectCommand(getParams);
      const getResult = await s3Client.send(getCommand);
      
      // Read the stream into a string
      const chunks = [];
      for await (const chunk of getResult.Body) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString('utf-8');
      
      console.log('✅ Successfully retrieved file via S3 API!');
      console.log('   Content matches:', content === testContent);
      console.log('   Content type:', getResult.ContentType);
      console.log('   Content length:', getResult.ContentLength);
      
    } catch (error) {
      console.error('❌ Error accessing file via S3 API:', error.message);
      if (error.$metadata) {
        console.log('   Status code:', error.$metadata.httpStatusCode);
        console.log('   Request ID:', error.$metadata.requestId);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.$metadata) {
      console.log('Status Code:', error.$metadata.httpStatusCode);
      console.log('Request ID:', error.$metadata.requestId);
    }
  }
}

testFilebase().catch(console.error);