/**
 * Queue Estimator UI Module - ENHANCED WITH MULTI-FILE SUPPORT
 * Handles user interface, file input, results rendering, and file management
 */

window.queueEstimatorUI = (function() {
    'use strict';

    let currentFileId = null;
  let currentSessionId = 0;
    let currentAnalysis = null;
    let currentEstimate = null;
    let currentEntries = null;
    let currentSessions = null;
    let currentSelectedSession = null;
    let currentFileName = null;
    let chartInstance = null;

    /**
  * Initialize UI event listeners and restore saved state
     */
    function init() {
  setupFileUpload();
        setupTextarea();
        setupKeyboardShortcuts();
      loadStoredState();
    }

    /**
     * Load previously saved files on page load
     */
    function loadStoredState() {
  if (!window.QueueEstimatorStorage) {
   console.error('Storage module not loaded');
            return;
        }

        const latestFile = window.QueueEstimatorStorage.getLatestFile();
        if (latestFile) {
            currentFileId = latestFile.id;
            currentSessionId = 0;
         loadFileForDisplay(latestFile);
      updateFileSelector();
   showFileHistoryPanel();
        }
    }

    /**
   * Setup file upload / drag-drop functionality
     */
    function setupFileUpload() {
        const uploadArea = document.getElementById('qeUploadArea');
        const fileInput = document.getElementById('qeFileInput');

        if (!uploadArea || !fileInput) return;

        // Click to upload
        uploadArea.addEventListener('click', () => fileInput.click());

        // File input change
     fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
     handleFileUpload(e.target.files[0]);
    fileInput.value = ''; // Reset input for same file re-upload
            }
     });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
 e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
     uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
   if (e.dataTransfer.files.length > 0) {
              handleFileUpload(e.dataTransfer.files[0]);
    }
});

        // Keyboard enter/space to activate
        uploadArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
            fileInput.click();
            }
    });
    }

    /**
     * Handle file upload - parse and store
     */
    function handleFileUpload(file) {
        const reader = new FileReader();
        currentFileName = file.name;
        
        reader.onload = (e) => {
            const text = e.target.result;
       analyzeLogText(text, file.name);
 };
        reader.onerror = () => {
      showError('Error reading file. Please try again.');
      };
 reader.readAsText(file);
    }

    /**
     * Setup textarea paste detection
     */
  function setupTextarea() {
    const textarea = document.getElementById('qeTextarea');
        if (!textarea) return;

        // Clear errors when user starts typing
    textarea.addEventListener('focus', () => {
     clearError();
      });
    }

    /**
     * Setup keyboard shortcuts
     */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to analyze
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
   const textarea = document.getElementById('qeTextarea');
  if (textarea && textarea.value.trim().length > 0) {
          analyzeLogText(textarea.value, 'pasted-log.txt');
  }
         }
        });
  }

    /**
     * Main analysis function
     */
    function analyzeLog() {
        const textarea = document.getElementById('qeTextarea');
        if (!textarea || textarea.value.trim().length === 0) {
   showError('Please paste or upload a log file first.');
            return;
        }

        analyzeLogText(textarea.value, 'pasted-log.txt');
    }

    /**
     * Analyze log text and store results
     */
    function analyzeLogText(logText, fileName) {
        clearError();

        // Check if core module is loaded
  if (!window.QueueEstimatorCore) {
     showError('Queue Estimator core module failed to load. Please refresh the page.');
            return;
    }

        // Parse log
        const parseResult = window.QueueEstimatorCore.parseLogFile(logText);

     if (parseResult.errors.length > 0) {
    showError('Error parsing log: ' + parseResult.errors.join(', '));
            return;
    }

        if (parseResult.entries.length === 0) {
            showError('No queue position entries found in log file.');
            return;
     }

        currentEntries = parseResult.entries;
  currentSessions = parseResult.sessions;

        // Process sessions and store file
     processParsedFile(fileName, parseResult);
    }

    /**
  * Process parsed file and store in storage
     */
    function processParsedFile(fileName, parseResult) {
        const sessionIds = Object.keys(parseResult.sessions);
   
        // Build sessions data with analysis
        const sessionsData = [];
        for (const sessionId of sessionIds) {
    const entries = parseResult.sessions[sessionId];
            
   // Validate
  const validation = window.QueueEstimatorCore.validateLog(entries);
            if (!validation.valid) continue;

    // Analyze
    const analysis = window.QueueEstimatorCore.analyzeQueueProgression(entries);
            if (!analysis) continue;

         // Estimate
            const estimate = window.QueueEstimatorCore.estimateTimeToZero(entries, analysis);

            sessionsData.push({
      sessionId: parseInt(sessionId),
        startPosition: analysis.startPosition,
                endPosition: analysis.endPosition,
                positionsCleared: analysis.positionsCleared,
         duration: analysis.totalTimeMinutes,
   analysis: analysis,
        estimate: estimate,
           entries: entries
        });
        }

  if (sessionsData.length === 0) {
            showError('Failed to analyze any sessions in the file.');
            return;
     }

  // Save file to storage
    const fileData = {
  name: fileName,
      uploadedAt: new Date().toISOString(),
            sessions: sessionsData
 };

        const savedFile = window.QueueEstimatorStorage.saveFile(fileData);
        currentFileId = savedFile.id;
      currentSessionId = 0;

        // Load and display
        loadFileForDisplay(savedFile);
        updateFileSelector();
        showFileHistoryPanel();
    }

    /**
     * Load file data and display results
 */
    function loadFileForDisplay(fileData) {
      if (!fileData || !fileData.sessions || fileData.sessions.length === 0) {
          showError('Invalid file data');
    return;
     }

   // Get selected session - DEFAULT TO NEWEST (last session = newest)
        let session = fileData.sessions[currentSessionId];
        if (!session) {
          // Default to newest session (last one in array)
         currentSessionId = fileData.sessions.length - 1;
    session = fileData.sessions[currentSessionId];
        }

        currentAnalysis = session.analysis;
     currentEstimate = session.estimate;
        currentEntries = session.entries;
     currentFileName = fileData.name;

        // Update UI
    renderResults(session.entries, session.analysis, session.estimate);
    updateSessionButtons(fileData);
 updateFileSessionInfo(fileData, session);
    }

    /**
     * Update file selector dropdown
     */
    function updateFileSelector() {
const selector = document.getElementById('qeFileSelector');
        if (!selector) return;

   const files = window.QueueEstimatorStorage.listFiles();
        selector.innerHTML = '';

   if (files.length === 0) {
      selector.innerHTML = '<option value="">No files uploaded yet</option>';
   return;
        }

        for (const file of files) {
    const option = document.createElement('option');
  option.value = file.id;
     const uploadDate = new Date(file.uploadedAt).toLocaleDateString(undefined, {
       year: 'numeric',
     month: 'short',
            day: 'numeric'
            });
       const uploadTime = new Date(file.uploadedAt).toLocaleTimeString(undefined, {
                hour: '2-digit',
minute: '2-digit'
       });
 option.textContent = `${uploadDate} ${uploadTime} - ${file.sessionCount} session${file.sessionCount !== 1 ? 's' : ''}`;
     if (file.id === currentFileId) {
              option.selected = true;
            }
     selector.appendChild(option);
        }

        // Update file count
        const fileCount = document.getElementById('qeFileCount');
        if (fileCount) {
          fileCount.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
   }
    }

    /**
     * Update session buttons
     */
  function updateSessionButtons(fileData) {
      const buttonsContainer = document.getElementById('qeSessionButtonsContainer');
        const selectorSection = document.getElementById('qeSessionSelectorButtons');
   if (!buttonsContainer || !selectorSection) return;

        buttonsContainer.innerHTML = '';

if (!fileData.sessions || fileData.sessions.length === 0) {
         buttonsContainer.innerHTML = '<p>No sessions</p>';
 selectorSection.style.display = 'none';
        return;
        }

        // If only one session, hide the selector
   if (fileData.sessions.length === 1) {
       selectorSection.style.display = 'none';
    } else {
    // Multiple sessions - show all as buttons
          selectorSection.style.display = 'block';
            for (let i = 0; i < fileData.sessions.length; i++) {
    const session = fileData.sessions[i];
       const btn = document.createElement('button');
   btn.className = `session-btn ${i === currentSessionId ? 'active' : ''}`;
 btn.textContent = `Session ${i + 1}`;
 btn.title = `Queue progression: ${session.startPosition}?${session.endPosition} (${session.duration.toFixed(1)}m)`;
  btn.onclick = () => selectSessionFromFile(i);
         buttonsContainer.appendChild(btn);
   }
        }
    }

    /**
     * Select file from dropdown
     */
    window.selectFile = function() {
        const selector = document.getElementById('qeFileSelector');
    if (!selector || !selector.value) return;

        const fileId = selector.value;
        currentFileId = fileId;
      currentSessionId = 0;

        const file = window.QueueEstimatorStorage.getFile(fileId);
        if (file) {
            loadFileForDisplay(file);
            updateFileSelector();
            updateSessionButtons(file);
        }
    };
    
    // Add to public API
    const selectFile_func = window.selectFile;

    /**
     * Select session from current file
     */
    function selectSessionFromFile(sessionId) {
        if (!currentFileId) return;

     currentSessionId = sessionId;
        const file = window.QueueEstimatorStorage.getFile(currentFileId);
        if (file) {
loadFileForDisplay(file);
     updateSessionButtons(file);
  window.QueueEstimatorStorage.setSelected(currentFileId, sessionId);
    }
    }

    /**
     * Update file/session info display
     */
    function updateFileSessionInfo(fileData, session) {
        const infoPanel = document.getElementById('qeFileSessionInfo');
        if (!infoPanel) return;

        const uploadDate = new Date(fileData.uploadedAt).toLocaleDateString(undefined, {
     year: 'numeric',
    month: 'short',
            day: 'numeric'
     });
        const uploadTime = new Date(fileData.uploadedAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit'
        });

        document.getElementById('qeDisplayFileName').textContent = fileData.name;
        document.getElementById('qeDisplayUploadTime').textContent = `${uploadDate} ${uploadTime}`;
        document.getElementById('qeDisplaySessionInfo').textContent = 
         `Session ${currentSessionId + 1} of ${fileData.sessions.length}`;

        infoPanel.style.display = 'block';
    }

    /**
     * Show/toggle file history panel
     */
    function toggleFilePanel() {
        const panel = document.getElementById('qeFilePanelContent');
        if (!panel) return;

        const isHidden = panel.style.display === 'none' || !panel.style.display;
        panel.style.display = isHidden ? 'block' : 'none';

        // Toggle icon
        const icon = document.querySelector('.panel-toggle .toggle-icon');
        if (icon) {
            icon.textContent = isHidden ? '?' : '?';
        }
    }

    /**
     * Show file history panel
*/
    function showFileHistoryPanel() {
        const panel = document.getElementById('qeFileHistoryPanel');
        if (panel) panel.style.display = 'block';
    }

    /**
     * Open storage manager modal
     */
    function openStorageManager() {
        const modal = document.getElementById('qeStorageManagerModal');
        if (!modal) return;

        updateStorageInfo();
        updateStorageFilesList();
        modal.style.display = 'block';
    }

    /**
     * Close storage manager modal
  */
    function closeStorageManager() {
   const modal = document.getElementById('qeStorageManagerModal');
        if (modal) modal.style.display = 'none';
    }

    /**
  * Update storage info display
     */
    function updateStorageInfo() {
        const info = window.QueueEstimatorStorage.getStorageInfo();
        const infoEl = document.getElementById('qeStorageInfo');
  if (!infoEl) return;

        const sizeKB = (info.sizeBytes / 1024).toFixed(2);
     const limitMB = (info.limitBytes / (1024 * 1024)).toFixed(1);
        
infoEl.innerHTML = `
     <div class="storage-bar">
     <div class="storage-used" style="width: ${info.percentUsed}%"></div>
            </div>
    <p>${sizeKB} KB / ${limitMB} MB (${info.percentUsed}% used)</p>
            <p>${info.fileCount} file${info.fileCount !== 1 ? 's' : ''} stored</p>
            ${info.isWarning ? '<p class="warning">?? Storage getting full</p>' : ''}
        `;
    }

 /**
     * Update files list in storage manager
     */
    function updateStorageFilesList() {
        const listEl = document.getElementById('qeStorageFilesList');
        if (!listEl) return;

        const files = window.QueueEstimatorStorage.listFiles();
      if (files.length === 0) {
       listEl.innerHTML = '<p>No files uploaded yet</p>';
            return;
   }

    let html = '';
        for (const file of files) {
      const uploadDate = new Date(file.uploadedAt).toLocaleDateString();
 html += `
       <div class="file-item">
          <div class="file-name">${file.name}</div>
    <div class="file-meta">${uploadDate} - ${file.sessionCount} session${file.sessionCount !== 1 ? 's' : ''}</div>
        <button onclick="window.queueEstimatorUI && window.queueEstimatorUI.deleteFileConfirm('${file.id}')" class="btn-delete">Delete</button>
   </div>
  `;
        }
        listEl.innerHTML = html;
    }

    /**
     * Delete specific file (with confirmation)
     */
    window.deleteFileConfirm = function(fileId) {
        if (confirm('Are you sure you want to delete this file?')) {
            window.QueueEstimatorStorage.deleteFile(fileId);

          // If deleted file was selected, load new one
            if (fileId === currentFileId) {
    const latestFile = window.QueueEstimatorStorage.getLatestFile();
         if (latestFile) {
        currentFileId = latestFile.id;
       currentSessionId = 0;
         loadFileForDisplay(latestFile);
} else {
      // No more files
      reset();
        }
        }
     
          updateFileSelector();
            updateStorageInfo();
       updateStorageFilesList();
   }
    };

    /**
     * Clear all files (with confirmation)
     */
    function clearAllFilesConfirm() {
        if (confirm('Are you sure you want to delete ALL files? This cannot be undone.')) {
            window.QueueEstimatorStorage.clearAllFiles();
    reset();
    closeStorageManager();
  }
    }

    /**
     * Export files as JSON
     */
    function exportFiles() {
        window.QueueEstimatorStorage.exportAsJSON();
    }

    /**
     * Render results
     */
    function renderResults(entries, analysis, estimate) {
        const resultsSection = document.getElementById('qeResultsSection');
    if (!resultsSection) return;

        // Hide input section, show results
  document.getElementById('qeInputSection').style.display = 'none';
      resultsSection.style.display = 'block';

      // Update estimate display with clear formatting
    // Convert minutes to seconds for better formatting
        const estimateTotalSeconds = estimate.estimatedMinutes * 60;
        const bestTotalSeconds = estimate.bestCaseMinutes * 60;
      const worstTotalSeconds = estimate.worstCaseMinutes * 60;

        const estimateDisplay = window.QueueEstimatorCore.formatTimeDisplay(estimateTotalSeconds);
        const bestDisplay = window.QueueEstimatorCore.formatTimeDisplay(bestTotalSeconds);
        const worstDisplay = window.QueueEstimatorCore.formatTimeDisplay(worstTotalSeconds);

        document.getElementById('qeEstimateMain').textContent = estimateDisplay;
        document.getElementById('qeEstimateRange').textContent = `Best: ${bestDisplay} | Worst: ${worstDisplay}`;

  // Calculate and display game start time
        const gameStartTimes = window.QueueEstimatorCore.calculateGameStartTime(estimate);
      const estimatedGameStart = window.QueueEstimatorCore.formatGameStartTime(gameStartTimes.estimated);
   const bestGameStart = window.QueueEstimatorCore.formatGameStartTime(gameStartTimes.best);
        const worstGameStart = window.QueueEstimatorCore.formatGameStartTime(gameStartTimes.worst);

        document.getElementById('qeGameStartTimeMain').textContent = estimatedGameStart;
        document.getElementById('qeGameStartTimeRange').textContent = `Best: ${bestGameStart} | Worst: ${worstGameStart}`;

 // Detect queue freeze
        const freezeInfo = window.QueueEstimatorCore.detectQueueFreeze(estimate.lastLogEntryTime);
        const freezeContainer = document.getElementById('qeFreezeWarningContainer');
        const freezeWarning = document.getElementById('qeFreezeWarning');

   if (freezeInfo.isFrozen) {
       freezeWarning.innerHTML = `
<div class="freeze-critical">
  ?? <strong>QUEUE FROZEN!</strong> No position updates for ${freezeInfo.formattedTimeSinceLastEntry}
     </div>
      <p class="freeze-advice">The queue may be frozen or your log file is outdated.</p>
     <p class="freeze-advice">? Try refreshing the game or check if your log file is recent</p>
   `;
         freezeContainer.style.display = 'block';
        } else if (freezeInfo.warningLevel === 'warning') {
   freezeWarning.innerHTML = `
<div class="freeze-warning">
      ?? Last queue update: ${freezeInfo.formattedTimeSinceLastEntry} ago
     </div>
       `;
    freezeContainer.style.display = 'block';
    } else {
    freezeContainer.style.display = 'none';
        }

        // Update confidence badge
        const confidenceBadge = document.getElementById('qeConfidenceBadge');
        const confidenceClass = `confidence-${estimate.confidence}`;
   confidenceBadge.className = `confidence-badge ${confidenceClass}`;
   confidenceBadge.textContent = estimate.confidence.toUpperCase();
        if (estimate.confidenceReasons.length > 0) {
         confidenceBadge.title = estimate.confidenceReasons.join('; ');
        }

        // Update breakdown
   document.getElementById('qeStartPos').textContent = analysis.startPosition;
        document.getElementById('qeEndPos').textContent = analysis.endPosition;
      document.getElementById('qePositionsCleared').textContent = analysis.positionsCleared;
document.getElementById('qeTimeAnalyzed').textContent = `${analysis.totalTimeMinutes.toFixed(1)} minutes`;
   document.getElementById('qeAvgRate').textContent = `${analysis.ratePerMinute.toFixed(2)} pos/min`;
     document.getElementById('qeEntryCount').textContent = analysis.entryCount;

    // Show/hide issues
 const issuesContainer = document.getElementById('qeIssuesContainer');
     const issuesList = document.getElementById('qeIssuesList');
if (analysis.stalls.length > 0 || estimate.confidenceReasons.length > 0) {
 issuesList.innerHTML = '';
            for (const stall of analysis.stalls) {
         const stallItem = document.createElement('div');
    stallItem.className = 'issue-item';
          stallItem.innerHTML = `<strong>Stall at position ${stall.position}:</strong> ${stall.durationMinutes.toFixed(1)} minutes`;
          issuesList.appendChild(stallItem);
    }
     for (const reason of estimate.confidenceReasons) {
const reasonItem = document.createElement('div');
   reasonItem.className = 'issue-item';
       reasonItem.textContent = reason;
  issuesList.appendChild(reasonItem);
}
        issuesContainer.style.display = 'block';
        } else {
   issuesContainer.style.display = 'none';
        }

      // Render chart
renderChart(entries, analysis);

      // Scroll to results
     setTimeout(() => {
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, 100);
    }

    /**
     * Render chart using Chart.js
   */
    function renderChart(entries, analysis) {
    const ctx = document.getElementById('qeChart');
        if (!ctx) return;

        // Verify entries have dateObj
 if (!entries || entries.length === 0) {
 console.error('No entries to render chart');
         return;
        }

        // Check if first entry has dateObj
        if (!entries[0].dateObj) {
  console.error('Entries missing dateObj property');
   return;
        }

    // Get the start time for this session
        const sessionStartTime = entries[0].dateObj;
        
        // Prepare data
        const labels = [];
const positions = [];
        const projectionData = [];

        // Build labels and positions
   for (let i = 0; i < entries.length; i++) {
       const entry = entries[i];
     
   // Calculate elapsed time from SESSION START
        const elapsedMs = entry.dateObj - sessionStartTime;
            const elapsedMinutes = elapsedMs / (1000 * 60);
      
   labels.push(elapsedMinutes.toFixed(1));
         positions.push(entry.position);
        }

      // Calculate trend line for projection - START FROM SESSION START
        const rate = analysis.ratePerMinute;
        const startPos = analysis.startPosition;
        
 for (let i = 0; i < entries.length; i++) {
     // Calculate elapsed time from SESSION START
     const elapsedMs = entries[i].dateObj - sessionStartTime;
 const elapsedMinutes = elapsedMs / (1000 * 60);
         
   // Calculate projected position based on rate and elapsed time
 const projectedPos = Math.max(0, startPos - (rate * elapsedMinutes));
   projectionData.push(projectedPos);
        }

        // Destroy existing chart if any
        if (chartInstance) {
chartInstance.destroy();
        }

        // Create new chart
        chartInstance = new Chart(ctx, {
            type: 'line',
  data: {
          labels: labels,
      datasets: [
      {
        label: 'Actual Queue Position',
     data: positions,
            borderColor: '#FF6B6B',
      backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderWidth: 2,
                    fill: true,
         tension: 0.1,
pointRadius: 3,
   pointBackgroundColor: '#FF6B6B',
           pointBorderColor: '#fff',
       pointBorderWidth: 1
        },
         {
         label: 'Trend Line (Projected to 0)',
         data: projectionData,
  borderColor: '#4ECDC4',
             borderWidth: 2,
    borderDash: [5, 5],
              fill: false,
         tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 0
       }
    ]
       },
    options: {
         responsive: true,
     maintainAspectRatio: true,
                plugins: {
  legend: {
 position: 'top'
                    }
                },
  scales: {
          y: {
          title: {
          display: true,
      text: 'Queue Position'
              },
         beginAtZero: true,
      max: analysis.startPosition + 5,
       reverse: false
       },
       x: {
               title: {
         display: true,
         text: 'Elapsed Time (Minutes)'
 }
           }
 }
  }
        });
    }

    /**
     * Copy results to clipboard
     */
    function copyResults() {
     if (!currentEstimate || !currentAnalysis) {
       showError('No results to copy');
            return;
        }

        const estimateTotalSeconds = currentEstimate.estimatedMinutes * 60;
        const bestTotalSeconds = currentEstimate.bestCaseMinutes * 60;
        const worstTotalSeconds = currentEstimate.worstCaseMinutes * 60;

        const estimateDisplay = window.QueueEstimatorCore.formatTimeDisplay(estimateTotalSeconds);
   const bestDisplay = window.QueueEstimatorCore.formatTimeDisplay(bestTotalSeconds);
    const worstDisplay = window.QueueEstimatorCore.formatTimeDisplay(worstTotalSeconds);

        const gameStartTimes = window.QueueEstimatorCore.calculateGameStartTime(currentEstimate);
      const estimatedGameStart = window.QueueEstimatorCore.formatGameStartTime(gameStartTimes.estimated);
        const bestGameStart = window.QueueEstimatorCore.formatGameStartTime(gameStartTimes.best);
        const worstGameStart = window.QueueEstimatorCore.formatGameStartTime(gameStartTimes.worst);

    const freezeInfo = window.QueueEstimatorCore.detectQueueFreeze(currentEstimate.lastLogEntryTime);
        const freezeStatus = freezeInfo.isFrozen ? `?? FROZEN (${freezeInfo.formattedTimeSinceLastEntry} ago)` : `? Active (${freezeInfo.formattedTimeSinceLastEntry} ago)`;

  const textToCopy = `
?? QUEUE TIME ESTIMATE
???????????????????????

Estimated Time to Position 0: ${estimateDisplay}
Confidence Level: ${currentEstimate.confidence.toUpperCase()}
Best Case: ${bestDisplay}
Worst Case: ${worstDisplay}

?? GAME START TIME (When you'll reach queue position 0)
?????????????????????????????????????????????????????
Estimated: ${estimatedGameStart}
Best Case: ${bestGameStart}
Worst Case: ${worstGameStart}

?? QUEUE STATUS
???????????????
${freezeStatus}

ANALYSIS BREAKDOWN
?????????????????
Starting Position: ${currentAnalysis.startPosition}
Ending Position: ${currentAnalysis.endPosition}
Positions Cleared: ${currentAnalysis.positionsCleared}
Time Period: ${currentAnalysis.totalTimeMinutes.toFixed(1)} minutes
Average Rate: ${currentAnalysis.ratePerMinute.toFixed(2)} positions/minute
Queue Entries: ${currentAnalysis.entryCount}

Remaining Positions: ${currentEstimate.remainingPositions}
At Current Rate: ${estimateDisplay}

Generated by Vak Store Queue Estimator
https://vakstore.com/QueueEstimator.html
`.trim();

        navigator.clipboard.writeText(textToCopy).then(() => {
      // Show feedback
   const btn = document.getElementById('qeCopyBtn');
        const originalText = btn.textContent;
     btn.textContent = '? Copied!';
       setTimeout(() => {
    btn.textContent = originalText;
          }, 2000);
  }).catch(err => {
      showError('Failed to copy: ' + err.message);
        });
    }

    /**
     * Download chart as PNG
     */
    function downloadChart() {
     if (!chartInstance) {
            showError('No chart to download');
  return;
        }

        try {
            const image = chartInstance.toBase64Image();
         const link = document.createElement('a');
            link.href = image;
            link.download = `queue-estimate-${new Date().toISOString().split('T')[0]}.png`;
     link.click();
    } catch (e) {
   showError('Failed to download chart: ' + e.message);
     }
    }

    /**
     * Reset and go back to input
   */
    function reset() {
        currentFileId = null;
        currentSessionId = 0;
 currentAnalysis = null;
    currentEstimate = null;
        currentEntries = null;
        currentSessions = null;
        currentSelectedSession = null;

        const textarea = document.getElementById('qeTextarea');
        if (textarea) {
  textarea.value = '';
        }

        document.getElementById('qeInputSection').style.display = 'block';
        document.getElementById('qeResultsSection').style.display = 'none';
  document.getElementById('qeFileHistoryPanel').style.display = 'none';
        clearError();

        // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Show error message
     */
 function showError(message) {
        const errorContainer = document.getElementById('qeErrorContainer');
      const errorMessage = document.getElementById('qeErrorMessage');

        if (!errorContainer || !errorMessage) return;

        errorMessage.textContent = message;
        errorContainer.style.display = 'block';

      // Auto-hide after 10 seconds
        setTimeout(() => {
   clearError();
   }, 10000);
    }

    /**
     * Clear error message
     */
    function clearError() {
        const errorContainer = document.getElementById('qeErrorContainer');
        if (!errorContainer) return;
   errorContainer.style.display = 'none';
    }

    /**
     * Show auto-delete warning
     */
    function showAutoDeleteWarning(count) {
        const warning = document.createElement('div');
        warning.className = 'qe-warning-banner';
        warning.innerHTML = `
            <strong>?? Storage Cleaned:</strong> Deleted ${count} oldest file(s) to make room for new data.
            <button onclick="this.parentElement.remove()" class="close-btn">×</button>
`;
        warning.style.cssText = `
     position: fixed;
     top: 60px;
            right: 10px;
          background: #fff3cd;
 border: 2px solid #ffc107;
            padding: 12px;
   border-radius: 4px;
         z-index: 10000;
    max-width: 400px;
    `;
        warning.querySelector('.close-btn').style.cssText = `
            background: none;
            border: none;
      cursor: pointer;
        margin-left: 10px;
        `;
        document.body.appendChild(warning);

   // Auto-remove after 8 seconds
        setTimeout(() => {
  if (warning.parentElement) warning.remove();
        }, 8000);
    }

    /**
     * Show storage full warning
     */
    function showStorageFullWarning() {
        showAutoDeleteWarning(1);
    }

    // Public API
    return {
     init: init,
        analyzeLog: analyzeLog,
  copyResults: copyResults,
     downloadChart: downloadChart,
     reset: reset,
        toggleFilePanel: toggleFilePanel,
        selectFile: window.selectFile,
        deleteFileConfirm: window.deleteFileConfirm,
   clearAllFilesConfirm: clearAllFilesConfirm,
        openStorageManager: openStorageManager,
   closeStorageManager: closeStorageManager,
        exportFiles: exportFiles,
        showAutoDeleteWarning: showAutoDeleteWarning,
        showStorageFullWarning: showStorageFullWarning
    };
})();
