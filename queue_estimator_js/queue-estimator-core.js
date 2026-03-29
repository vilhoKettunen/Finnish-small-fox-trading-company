/**
 * Queue Estimator Core Logic
 * Handles log parsing, queue progression analysis, and time estimation
 */

window.QueueEstimatorCore = (function() {
    'use strict';

    /**
     * Parse log file and extract queue position entries
     * @param {string} logText - Raw log file content
     * @returns {object} {entries: [], sessions: [], errors: []}
     */
    function parseLogFile(logText) {
 const entries = [];
const errors = [];
    
        if (!logText || typeof logText !== 'string' || logText.trim().length === 0) {
  errors.push('Log file is empty');
            return { entries: [], sessions: [], errors };
    }

        // Regex to match queue position lines
        // Format: DD.MM.YYYY HH:MM:SS or DD.MM.YYYY HH.MM.SS [Notification] Client is in connect queue at position: N
        // Updated to accept both colon (:) and dot (.) separators for time
   const queueRegex = /(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2})[:.](\d{1,2})[:.](\d{1,2})\s+\[Notification\]\s+Client is in connect queue at position:\s+(\d+)/g;
   
let match;
 let currentSessionId = 0;
        let lastPosition = null;

   while ((match = queueRegex.exec(logText)) !== null) {
     try {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
         const year = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
     const minute = parseInt(match[5], 10);
        const second = parseInt(match[6], 10);
     const position = parseInt(match[7], 10);

  // Validate date components
if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
          continue; // Skip invalid timestamps
           }

          // Create ISO date string
  const dateObj = new Date(year, month - 1, day, hour, minute, second);
   const isoString = dateObj.toISOString();

  // DETECT NEW SESSION: Queue position goes UP (player left and re-joined queue)
     // In normal queueing, position always goes down or stays same
  // If it goes up, that means a new queue session started
        if (lastPosition !== null && position > lastPosition) {
   currentSessionId++;
        }
        lastPosition = position;

  entries.push({
             timestamp: isoString,
          dateObj: dateObj,
    position: position,
      sessionId: currentSessionId
        });

   } catch (e) {
                // Skip malformed entries
    console.warn('Failed to parse log entry:', match[0], e);
         }
   }

   // Group entries by session
   const sessions = {};
  for (const entry of entries) {
  if (!sessions[entry.sessionId]) {
     sessions[entry.sessionId] = [];
    }
            sessions[entry.sessionId].push(entry);
      }

        // If no entries found
        if (entries.length === 0) {
            errors.push('No queue position entries found in log file. Log file may be invalid or in unexpected format.');
      }

     return {
  entries: entries,
   sessions: sessions,
         errors: errors
        };
    }

    /**
     * Validate parsed entries
     * @param {array} entries - Parsed log entries
     * @returns {object} {valid: boolean, errors: [], warnings: []}
     */
    function validateLog(entries) {
        const result = {
  valid: true,
            errors: [],
            warnings: []
        };

        if (!entries || !Array.isArray(entries)) {
      result.valid = false;
        result.errors.push('Invalid entries format');
       return result;
        }

        if (entries.length === 0) {
 result.valid = false;
         result.errors.push('No queue entries found');
        return result;
        }

        if (entries.length === 1) {
            result.valid = false;
            result.errors.push('Need at least 2 queue entries to calculate progression rate');
            return result;
        }

        // Check for reasonable queue positions
        for (const entry of entries) {
       if (entry.position < 0 || entry.position > 500) {
            result.valid = false;
            result.errors.push(`Invalid queue position: ${entry.position}`);
             return result;
            }
        }

      // Check time deltas
   const firstEntry = entries[0];
        const lastEntry = entries[entries.length - 1];
        const totalTimeMs = lastEntry.dateObj - firstEntry.dateObj;
const totalTimeMinutes = totalTimeMs / (1000 * 60);

  if (totalTimeMinutes < 1) {
          result.valid = false;
   result.errors.push('Log entries span less than 1 minute. Need a longer time period.');
            return result;
        }

        if (totalTimeMinutes < 5) {
   result.warnings.push('Log entries span less than 5 minutes. Estimates may be less accurate.');
        }

        if (totalTimeMinutes < 30) {
            result.warnings.push('For best accuracy, use a log covering at least 30 minutes of queue time.');
      }

        return result;
    }

    /**
     * Analyze queue progression
     * @param {array} entries - Parsed log entries
   * @returns {object} Analysis result
     */
    function analyzeQueueProgression(entries) {
        if (!entries || entries.length < 2) {
       return null;
  }

      const firstEntry = entries[0];
        const lastEntry = entries[entries.length - 1];
        
        const startPosition = firstEntry.position;
  const endPosition = lastEntry.position;
        const positionsCleared = startPosition - endPosition;
        
        const totalTimeMs = lastEntry.dateObj - firstEntry.dateObj;
        const totalTimeMinutes = totalTimeMs / (1000 * 60);
    const totalTimeSeconds = totalTimeMs / 1000;
        
      // Calculate average rate (positions per minute)
        const ratePerMinute = positionsCleared / totalTimeMinutes;
        const secondsPerPosition = totalTimeSeconds / positionsCleared;

        // Detect stalls (periods where queue didn't move for 2+ minutes)
        const stalls = [];
     let currentStallStart = null;
        let currentStallPosition = null;

        for (let i = 1; i < entries.length; i++) {
     const prev = entries[i - 1];
     const curr = entries[i];
            const timeDiffMinutes = (curr.dateObj - prev.dateObj) / (1000 * 60);

        if (curr.position === prev.position && timeDiffMinutes >= 1) {
if (!currentStallStart) {
         currentStallStart = prev;
        currentStallPosition = prev.position;
                }
            } else if (currentStallStart && curr.position < currentStallPosition) {
      // Stall ended
       const stallDuration = (curr.dateObj - currentStallStart.dateObj) / (1000 * 60);
          if (stallDuration >= 2) {
 stalls.push({
 position: currentStallPosition,
    startTime: currentStallStart.timestamp,
     endTime: curr.timestamp,
    durationMinutes: stallDuration
          });
  }
    currentStallStart = null;
    currentStallPosition = null;
            }
        }

 // Calculate recent rate (last 25% of entries, if available)
        let recentRatePerMinute = ratePerMinute;
        if (entries.length >= 4) {
            const recentStartIdx = Math.floor(entries.length * 0.75);
     const recentStart = entries[recentStartIdx];
       const recentEnd = entries[entries.length - 1];
  const recentPositionsCleared = recentStart.position - recentEnd.position;
 const recentTimeMinutes = (recentEnd.dateObj - recentStart.dateObj) / (1000 * 60);
            if (recentTimeMinutes > 0 && recentPositionsCleared > 0) {
 recentRatePerMinute = recentPositionsCleared / recentTimeMinutes;
 }
        }

 return {
   startPosition: startPosition,
            endPosition: endPosition,
   positionsCleared: positionsCleared,
            totalTimeMs: totalTimeMs,
   totalTimeMinutes: totalTimeMinutes,
            totalTimeSeconds: totalTimeSeconds,
          ratePerMinute: ratePerMinute,
  secondsPerPosition: secondsPerPosition,
         recentRatePerMinute: recentRatePerMinute,
       stalls: stalls,
     entryCount: entries.length,
       averageEntryIntervalSeconds: totalTimeSeconds / (entries.length - 1)
 };
    }

    /**
     * Estimate time to reach queue position 0
     * @param {array} entries - Parsed log entries
     * @param {object} analysis - Analysis result from analyzeQueueProgression
     * @returns {object} Estimate result
     */
    function estimateTimeToZero(entries, analysis) {
     if (!analysis || analysis.endPosition === 0) {
 return {
         estimatedMinutes: 0,
      estimatedSeconds: 0,
 confidence: 'high',
  bestCaseMinutes: 0,
       worstCaseMinutes: 0,
         breakdown: null,
     message: 'Already at queue position 0!'
   };
     }

   const remainingPositions = analysis.endPosition;
  
     // Use average rate as primary estimate
     let estimatedMinutes = remainingPositions / analysis.ratePerMinute;
      let estimatedSeconds = remainingPositions * analysis.secondsPerPosition;

 // Calculate best case (using recent/better rate)
        const bestRate = Math.max(analysis.ratePerMinute, analysis.recentRatePerMinute);
    let bestCaseMinutes = remainingPositions / bestRate;

     // Calculate worst case (slower rate, add stall time)
        let worstCaseMinutes = estimatedMinutes;
        if (analysis.stalls.length > 0) {
 // Estimate additional stall time
  const avgStallMinutes = analysis.stalls.reduce((sum, s) => sum + s.durationMinutes, 0) / analysis.stalls.length;
          const stallProbability = analysis.stalls.length / (analysis.entryCount / 100); // Rough stall frequency
            worstCaseMinutes += avgStallMinutes * stallProbability;
        }
        // Also factor in slower queue clearing
     const slowerRate = analysis.ratePerMinute * 0.7; // 30% slower
        worstCaseMinutes = Math.max(worstCaseMinutes, remainingPositions / slowerRate);

        // Determine confidence level
        let confidence = 'high';
     let confidenceReasons = [];

 if (analysis.totalTimeMinutes < 30) {
     confidence = 'medium';
     confidenceReasons.push('Log covers less than 30 minutes');
 }

  if (analysis.totalTimeMinutes < 15) {
   confidence = 'low';
            confidenceReasons.push('Log covers less than 15 minutes');
    }

        if (analysis.stalls.length > 3) {
          confidence = confidence === 'high' ? 'medium' : 'low';
    confidenceReasons.push(`${analysis.stalls.length} stalls detected`);
  }

        const positionRange = analysis.startPosition - analysis.endPosition;
    if (positionRange < 10) {
 confidence = 'low';
   confidenceReasons.push('Queue moved only ' + positionRange + ' positions');
        }

        return {
 estimatedMinutes: Math.round(estimatedMinutes),
       estimatedSeconds: Math.round(estimatedSeconds),
  confidence: confidence,
     confidenceReasons: confidenceReasons,
     bestCaseMinutes: Math.round(bestCaseMinutes),
     worstCaseMinutes: Math.round(worstCaseMinutes),
    remainingPositions: remainingPositions,
            ratePerMinute: analysis.ratePerMinute,
       analysisTimeMinutes: analysis.totalTimeMinutes,
        lastLogEntryTime: entries[entries.length - 1].dateObj
        };
 }

    /**
     * Calculate game start time (when player reaches position 0)
     * @param {object} estimate - Estimate result
     * @returns {object} Game start time details
   */
    function calculateGameStartTime(estimate) {
        const now = new Date();
  
        // Convert minutes to milliseconds
        const estimatedMs = estimate.estimatedMinutes * 60 * 1000;
        const bestCaseMs = estimate.bestCaseMinutes * 60 * 1000;
        const worstCaseMs = estimate.worstCaseMinutes * 60 * 1000;
   
        // Calculate game start times
        const estimatedStartTime = new Date(now.getTime() + estimatedMs);
        const bestCaseStartTime = new Date(now.getTime() + bestCaseMs);
     const worstCaseStartTime = new Date(now.getTime() + worstCaseMs);
        
        return {
            estimated: estimatedStartTime,
      best: bestCaseStartTime,
            worst: worstCaseStartTime
      };
    }

    /**
     * Format time for display (HH:MM AM/PM)
     * @param {Date} date - Date object
     * @returns {string} Formatted time
     */
    function formatGameStartTime(date) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = String(minutes).padStart(2, '0');
        return `${displayHours}:${displayMinutes} ${ampm}`;
    }

    /**
     * Detect queue freeze by comparing last log entry time to current time
     * @param {Date} lastLogEntryTime - Timestamp of last log entry
     * @returns {object} Freeze detection result
     */
    function detectQueueFreeze(lastLogEntryTime) {
        const now = new Date();
        const timeSinceLastEntry = now - lastLogEntryTime;
        const minutesSinceLastEntry = Math.floor(timeSinceLastEntry / (60 * 1000));
        const secondsSinceLastEntry = Math.floor((timeSinceLastEntry % (60 * 1000)) / 1000);
  
        const isFrozen = minutesSinceLastEntry >= 5;
        
        return {
            isFrozen: isFrozen,
            minutesSinceLastEntry: minutesSinceLastEntry,
            secondsSinceLastEntry: secondsSinceLastEntry,
     formattedTimeSinceLastEntry: `${minutesSinceLastEntry}m ${secondsSinceLastEntry}s`,
          warningLevel: isFrozen ? 'critical' : (minutesSinceLastEntry >= 2 ? 'warning' : 'ok')
        };
    }

    /**
     * Format time for display - shows minutes/seconds if under 1 hour, or hours/minutes if 1+ hours
     * @param {number} totalSeconds - Total seconds to format
     * @returns {string} Formatted time with clear labels
     */
    function formatTimeDisplay(totalSeconds) {
        if (!totalSeconds || totalSeconds < 0) {
            return '0 seconds';
        }

        const hours = Math.floor(totalSeconds / 3600);
   const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);

        if (hours >= 1) {
            // Show hours and minutes for durations >= 1 hour
         return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
       // Show minutes and seconds for durations < 1 hour
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`;
      }
    }

    /**
     * Format minutes as HH:MM string
  * @param {number} minutes - Number of minutes
     * @returns {string} Formatted time (HH:MM)
     */
    function formatTime(minutes) {
   if (!minutes || minutes < 0) {
            return '0:00';
   }
        
    const hours = Math.floor(minutes / 60);
 const mins = Math.round(minutes % 60);
  
        // Pad minutes with leading zero if needed
   const paddedMins = String(mins).padStart(2, '0');
        
     if (hours === 0) {
  return `${mins}:${paddedMins}`;
        }

        return `${hours}:${paddedMins}`;
    }

    // Public API
    return {
        parseLogFile: parseLogFile,
        validateLog: validateLog,
      analyzeQueueProgression: analyzeQueueProgression,
  estimateTimeToZero: estimateTimeToZero,
     formatTime: formatTime,
      formatTimeDisplay: formatTimeDisplay,
      calculateGameStartTime: calculateGameStartTime,
formatGameStartTime: formatGameStartTime,
        detectQueueFreeze: detectQueueFreeze
    };
})();
