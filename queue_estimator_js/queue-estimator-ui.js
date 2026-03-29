/**
 * Queue Estimator UI Module
 * Handles user interface, file input, and results rendering
 */

window.queueEstimatorUI = (function() {
    'use strict';

    let currentAnalysis = null;
    let currentEstimate = null;
    let currentEntries = null;
 let currentSessions = null;
    let currentSelectedSession = null;
    let chartInstance = null;

    /**
     * Initialize UI event listeners
     */
    function init() {
        setupFileUpload();
      setupTextarea();
        setupKeyboardShortcuts();
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
     * Handle file upload
     */
    function handleFileUpload(file) {
 const reader = new FileReader();
        reader.onload = (e) => {
    const text = e.target.result;
       analyzeLogText(text);
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
          analyzeLogText(textarea.value);
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

     analyzeLogText(textarea.value);
    }

 /**
     * Analyze log text
     */
    function analyzeLogText(logText) {
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

    // Check for multiple sessions
   const sessionIds = Object.keys(currentSessions);
       if (sessionIds.length > 1) {
   showSessionSelector(currentSessions);
  } else {
    processSelectedSession(parseResult.entries);
       }
    }

 /**
     * Show session selector UI
     */
    function showSessionSelector(sessions) {
      const selector = document.getElementById('qeSessionSelector');
     const buttons = document.getElementById('qeSessionButtons');

     if (!selector || !buttons) return;

   buttons.innerHTML = '';
        const sessionIds = Object.keys(sessions).sort();

       for (const sessionId of sessionIds) {
  const sessionEntries = sessions[sessionId];
    const startPos = sessionEntries[0].position;
         const endPos = sessionEntries[sessionEntries.length - 1].position;
     const duration = ((sessionEntries[sessionEntries.length - 1].dateObj - sessionEntries[0].dateObj) / (1000 * 60)).toFixed(1);

      const btn = document.createElement('button');
         btn.className = 'session-btn';
btn.textContent = `Session ${parseInt(sessionId) + 1}: ${startPos} ? ${endPos} (${duration} min)`;
     btn.onclick = () => {
    processSelectedSession(sessionEntries);
     selector.style.display = 'none';
     };
         buttons.appendChild(btn);
      }

     selector.style.display = 'block';
   }

    /**
     * Process selected session
     */
   function processSelectedSession(entries) {
     currentSelectedSession = entries;

     // Validate log
    const validation = window.QueueEstimatorCore.validateLog(entries);
 if (!validation.valid) {
       showError('Invalid log: ' + validation.errors.join(', '));
      return;
   }

  if (validation.warnings.length > 0) {
      console.warn('Log warnings:', validation.warnings);
   }

        // Analyze progression
 const analysis = window.QueueEstimatorCore.analyzeQueueProgression(entries);
      if (!analysis) {
        showError('Failed to analyze queue progression.');
       return;
       }

    // Estimate time
    const estimate = window.QueueEstimatorCore.estimateTimeToZero(entries, analysis);

  currentAnalysis = analysis;
  currentEstimate = estimate;

   // Render results
   renderResults(entries, analysis, estimate);
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

       // Update estimate display
       const estimateTime = window.QueueEstimatorCore.formatTime(estimate.estimatedMinutes);
 const bestTime = window.QueueEstimatorCore.formatTime(estimate.bestCaseMinutes);
      const worstTime = window.QueueEstimatorCore.formatTime(estimate.worstCaseMinutes);

        document.getElementById('qeEstimateMain').textContent = estimateTime;
       document.getElementById('qeEstimateRange').textContent = `Best: ${bestTime} | Worst: ${worstTime}`;

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

      // Prepare data
     const labels = [];
        const positions = [];
        const projectionData = [];

    for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
        const elapsedMinutes = (entry.dateObj - entries[0].dateObj) / (1000 * 60);
        labels.push(elapsedMinutes.toFixed(1));
    positions.push(entry.position);
  }

    // Calculate trend line for projection
     const rate = analysis.ratePerMinute;
 const startPos = analysis.startPosition;
    for (let i = 0; i < entries.length; i++) {
        const elapsedMinutes = (entries[i].dateObj - entries[0].dateObj) / (1000 * 60);
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
       pointRadius: 0
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

  const estimateTime = window.QueueEstimatorCore.formatTime(currentEstimate.estimatedMinutes);
 const bestTime = window.QueueEstimatorCore.formatTime(currentEstimate.bestCaseMinutes);
    const worstTime = window.QueueEstimatorCore.formatTime(currentEstimate.worstCaseMinutes);

   const gameStartTimes = window.QueueEstimatorCore.calculateGameStartTime(currentEstimate);
    const estimatedGameStart = window.QueueEstimatorCore.formatGameStartTime(gameStartTimes.estimated);
   const bestGameStart = window.QueueEstimatorCore.formatGameStartTime(gameStartTimes.best);
    const worstGameStart = window.QueueEstimatorCore.formatGameStartTime(gameStartTimes.worst);

   const freezeInfo = window.QueueEstimatorCore.detectQueueFreeze(currentEstimate.lastLogEntryTime);
    const freezeStatus = freezeInfo.isFrozen ? `?? FROZEN (${freezeInfo.formattedTimeSinceLastEntry} ago)` : `? Active (${freezeInfo.formattedTimeSinceLastEntry} ago)`;

  const textToCopy = `
?? QUEUE TIME ESTIMATE
???????????????????????

Estimated Time to Position 0: ${estimateTime}
Confidence Level: ${currentEstimate.confidence.toUpperCase()}
Best Case: ${bestTime}
Worst Case: ${worstTime}

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
At Current Rate: ${window.QueueEstimatorCore.formatTime(currentEstimate.estimatedMinutes)}

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
        document.getElementById('qeSessionSelector').style.display = 'none';
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

      // Auto-hide after 10 seconds (or user can dismiss)
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

    // Public API
  return {
       init: init,
     analyzeLog: analyzeLog,
       copyResults: copyResults,
       downloadChart: downloadChart,
       reset: reset
  };
})();
