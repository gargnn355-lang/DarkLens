const BUCKET_NAME = import.meta.env.VITE_FILEBASE_BUCKET || 'darklens-screenshots';
const FILEBASE_ENDPOINT = import.meta.env.VITE_FILEBASE_ENDPOINT || 'https://s3.filebase.com';

/**
 * Get direct Filebase URL from a path
 * @param {string} path - The path to the file in Filebase
 * @returns {string} - The direct Filebase URL or null if path is invalid
 */
export const getFilebaseUrl = (path) => {
  if (!path) return null;
  
  // If it's already a full URL, return as is
  if (path.startsWith('http')) {
    return path;
  }
  
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // Construct direct URL
  return `${FILEBASE_ENDPOINT}/${BUCKET_NAME}/${cleanPath}`;
};

// Export other functions as stubs for compatibility
export const getSignedScreenshotUrl = (path) => getFilebaseUrl(path);

export const fileExists = async (path) => {
  if (!path) return false;
  
  try {
    const response = await fetch(getFilebaseUrl(path), { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Error checking file existence:', error);
    return false;
  }
};

export const getFileAsDataUrl = async (path) => {
  if (!path) return null;
  
  try {
    const response = await fetch(getFilebaseUrl(path));
    if (!response.ok) throw new Error('Failed to fetch file');
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error getting file as data URL:', error);
    return null;
  }
};

// Stub for upload functionality (if needed)
export const uploadToFilebase = async (file, path) => {
  console.warn('Upload functionality requires server-side implementation');
  return getFilebaseUrl(path);
};

// Stub for delete functionality (if needed)
export const deleteFromFilebase = async (path) => {
  console.warn('Delete functionality requires server-side implementation');
  return false;
};