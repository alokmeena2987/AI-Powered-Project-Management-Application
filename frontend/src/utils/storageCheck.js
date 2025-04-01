/**
 * Utility to check for available storage space
 * 
 * This helps prevent IO errors related to insufficient disk space
 * by checking available space before performing operations that
 * might consume significant storage.
 */

// Check if the browser supports the Storage API
const isStorageEstimateSupported = () => {
  return 'storage' in navigator && 'estimate' in navigator.storage;
};

// Get estimate of available storage (works in modern browsers)
export const checkStorageSpace = async () => {
  if (!isStorageEstimateSupported()) {
    console.warn('Storage estimation not supported in this browser');
    return { supported: false };
  }

  try {
    const { quota, usage } = await navigator.storage.estimate();
    const availableSpace = quota - usage;
    const usedPercentage = (usage / quota) * 100;
    
    return {
      supported: true,
      quota: formatBytes(quota),
      usage: formatBytes(usage),
      available: formatBytes(availableSpace),
      usedPercentage: Math.round(usedPercentage),
      isLow: usedPercentage > 90 // Consider space low if more than 90% used
    };
  } catch (error) {
    console.error('Error checking storage space:', error);
    return { supported: false, error: error.message };
  }
};

// Helper to format bytes into human-readable format
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Clear browser cache to free up space
export const clearAppCache = async () => {
  try {
    // Clear local storage
    localStorage.clear();
    
    // Clear indexed DB if available
    if ('indexedDB' in window) {
      const databases = await indexedDB.databases();
      databases.forEach(db => {
        indexedDB.deleteDatabase(db.name);
      });
    }
    
    // Clear cache API if available
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error clearing cache:', error);
    return { success: false, error: error.message };
  }
};

export default { checkStorageSpace, clearAppCache }; 