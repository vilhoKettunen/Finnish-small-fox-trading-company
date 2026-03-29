/**
 * Queue Estimator File Storage Manager
 * Handles persistent storage of analyzed queue files and sessions
 * Uses localStorage with graceful fallback to in-memory storage
 */

window.QueueEstimatorStorage = (function() {
    'use strict';

    const STORAGE_KEY = 'queueEstimatorFiles';
    const MAX_FILES = 10;
    const STORAGE_WARNING_THRESHOLD = 0.8; // 80% full
    
    let storageAvailable = true;
    let inMemoryStorage = null;

    /**
     * Initialize storage system
     * Check if localStorage is available, fallback to in-memory
     */
    function init() {
        try {
       const test = '__storage_test__';
       localStorage.setItem(test, test);
  localStorage.removeItem(test);
 storageAvailable = true;
    console.log('? localStorage available');
        } catch (e) {
            console.warn('? localStorage not available (private/incognito mode?), using in-memory storage');
            storageAvailable = false;
            inMemoryStorage = { files: [], lastSelectedFileId: null, lastSelectedSessionId: 0 };
  showStorageWarning();
        }
 }

    /**
     * Get current storage object (localStorage or in-memory)
     */
    function getStorage() {
        if (storageAvailable) {
try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { files: [], lastSelectedFileId: null, lastSelectedSessionId: 0 };
      } catch (e) {
        console.error('Error reading localStorage:', e);
                return { files: [], lastSelectedFileId: null, lastSelectedSessionId: 0 };
     }
        }
        return inMemoryStorage || { files: [], lastSelectedFileId: null, lastSelectedSessionId: 0 };
    }

    /**
     * Save storage object (localStorage or in-memory)
     */
    function saveStorage(data) {
        if (storageAvailable) {
            try {
         localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            } catch (e) {
       if (e.name === 'QuotaExceededError') {
             handleStorageFull();
   } else {
    console.error('Error writing to localStorage:', e);
  }
    }
   } else {
            inMemoryStorage = data;
        }
    }

    /**
     * Save a new file with its sessions and analysis
     */
    function saveFile(fileData) {
        const storage = getStorage();
        
        // Generate unique ID if not provided
  if (!fileData.id) {
     fileData.id = Date.now().toString();
        }
        
  // Add metadata
        fileData.uploadedAt = fileData.uploadedAt || new Date().toISOString();
        fileData.sessionCount = fileData.sessions ? fileData.sessions.length : 0;
        
     // Remove raw text to save space
        fileData.rawText = undefined;
        
        // Add to beginning of files array (newest first)
        storage.files.unshift(fileData);
      
        // Keep only last N files
     if (storage.files.length > MAX_FILES) {
   // Auto-delete oldest files and warn user
    const deletedCount = storage.files.length - MAX_FILES;
            storage.files = storage.files.slice(0, MAX_FILES);
      showAutoDeleteWarning(deletedCount);
        }
  
        // Set as selected file
    storage.lastSelectedFileId = fileData.id;
      storage.lastSelectedSessionId = 0;
  
        saveStorage(storage);
   return fileData;
    }

    /**
     * Get all stored files
     */
    function listFiles() {
        const storage = getStorage();
   return storage.files || [];
    }

    /**
     * Get specific file by ID
   */
    function getFile(fileId) {
        const storage = getStorage();
     return storage.files.find(f => f.id === fileId);
    }

    /**
   * Get most recently uploaded file
     */
    function getLatestFile() {
        const storage = getStorage();
        return storage.files && storage.files.length > 0 ? storage.files[0] : null;
    }

    /**
     * Delete specific file
     */
    function deleteFile(fileId) {
        const storage = getStorage();
        storage.files = storage.files.filter(f => f.id !== fileId);
        
 // If deleted file was selected, select latest
      if (storage.lastSelectedFileId === fileId) {
   storage.lastSelectedFileId = storage.files.length > 0 ? storage.files[0].id : null;
          storage.lastSelectedSessionId = 0;
  }
        
        saveStorage(storage);
    }

    /**
     * Delete all files
     */
    function clearAllFiles() {
 const storage = { files: [], lastSelectedFileId: null, lastSelectedSessionId: 0 };
   saveStorage(storage);
    }

    /**
   * Get last selected file ID
     */
    function getLastSelectedFileId() {
  const storage = getStorage();
        return storage.lastSelectedFileId;
    }

    /**
  * Get last selected session ID
     */
    function getLastSelectedSessionId() {
        const storage = getStorage();
        return storage.lastSelectedSessionId;
    }

    /**
     * Set selected file and session
     */
    function setSelected(fileId, sessionId) {
        const storage = getStorage();
   storage.lastSelectedFileId = fileId;
        storage.lastSelectedSessionId = sessionId || 0;
        saveStorage(storage);
    }

    /**
     * Get storage usage estimate
     */
  function getStorageInfo() {
        const storage = getStorage();
      const fileCount = storage.files ? storage.files.length : 0;
        
      // Estimate size (rough calculation)
        const storageSize = new Blob([JSON.stringify(storage)]).size;
        const storageLimit = 5 * 1024 * 1024; // ~5MB estimate for typical localStorage
        const percentUsed = Math.round((storageSize / storageLimit) * 100);
  
        return {
            fileCount: fileCount,
            sizeBytes: storageSize,
  limitBytes: storageLimit,
         percentUsed: percentUsed,
        isWarning: percentUsed >= (STORAGE_WARNING_THRESHOLD * 100)
};
    }

    /**
     * Handle storage full condition
     */
    function handleStorageFull() {
        const storage = getStorage();
  if (storage.files.length > 0) {
          // Delete oldest file
        storage.files.pop();
        saveStorage(storage);
        console.warn('Storage full - deleted oldest file');
 
            // Show warning to user
          if (window.queueEstimatorUI && window.queueEstimatorUI.showStorageFullWarning) {
    window.queueEstimatorUI.showStorageFullWarning();
            }
        }
    }

    /**
     * Show storage warning
     */
    function showStorageWarning() {
        const warning = document.createElement('div');
   warning.className = 'qe-storage-warning';
   warning.innerHTML = `
            <div class="warning-content">
  <strong>?? Private Mode Detected:</strong> Your queue estimator data will not be saved after closing the browser.
 <button onclick="this.parentElement.parentElement.remove()" class="close-btn">×</button>
         </div>
        `;
        warning.style.cssText = `
         position: fixed;
          top: 10px;
     right: 10px;
    background: #fff3cd;
  border: 2px solid #ffc107;
     padding: 12px;
            border-radius: 4px;
            z-index: 10000;
       max-width: 300px;
        `;
        warning.querySelector('.close-btn').style.cssText = `
    background: none;
     border: none;
      font-size: 20px;
        cursor: pointer;
       margin-left: 10px;
        `;
        document.body.appendChild(warning);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
  if (warning.parentElement) warning.remove();
   }, 10000);
    }

    /**
     * Show auto-delete warning
     */
    function showAutoDeleteWarning(count) {
        if (window.queueEstimatorUI && window.queueEstimatorUI.showAutoDeleteWarning) {
     window.queueEstimatorUI.showAutoDeleteWarning(count);
        }
    }

    /**
     * Export all files as JSON
     */
    function exportAsJSON() {
        const storage = getStorage();
        const dataStr = JSON.stringify(storage, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
   const url = URL.createObjectURL(dataBlob);
     const link = document.createElement('a');
        link.href = url;
 link.download = `queue-estimator-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Export all files as ZIP
     * Note: Requires JSZip library - fallback to JSON export if not available
     */
    function exportAsZIP() {
        if (typeof JSZip === 'undefined') {
            console.warn('JSZip not available, exporting as JSON instead');
            exportAsJSON();
 return;
        }
        
    // If JSZip is available, we can implement ZIP export
        // For now, implement JSON export as fallback
        exportAsJSON();
    }

    // Initialize on load
    if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', init);
    } else {
  init();
    }

    // Public API
  return {
  init: init,
 saveFile: saveFile,
        listFiles: listFiles,
  getFile: getFile,
      getLatestFile: getLatestFile,
     deleteFile: deleteFile,
        clearAllFiles: clearAllFiles,
        getLastSelectedFileId: getLastSelectedFileId,
   getLastSelectedSessionId: getLastSelectedSessionId,
        setSelected: setSelected,
   getStorageInfo: getStorageInfo,
        exportAsJSON: exportAsJSON,
        exportAsZIP: exportAsZIP,
        isStorageAvailable: () => storageAvailable
    };
})();
