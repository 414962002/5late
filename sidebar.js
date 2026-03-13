// Quick Translate Sidebar Script

// Cloudflare Worker configuration
const WORKER_URL = "https://5late-translator.5lateextentionfirefox.workers.dev/translate";

const USE_WORKER = true;
const SECRET_SALT = "my-cat-fluffy-loves-small-fish-2026";

// Progress bar control
let progressTimer = null;

function startProgress() {
  console.log('startProgress() CALLED at:', performance.now());
  const bar = document.getElementById("progressBar");
  
  // Clear existing timer to prevent stacking
  if (progressTimer) {
    clearInterval(progressTimer);
  }
  
  let progress = 0;
  bar.style.width = "0%";
  console.log('Progress bar width set to 0%');
  
  progressTimer = setInterval(() => {
    progress += Math.random() * 10;
    if (progress > 90) progress = 90;
    bar.style.width = progress + "%";
  }, 120);
}

function finishProgress() {
  const bar = document.getElementById("progressBar");
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  bar.style.width = "100%";
  
  setTimeout(() => {
    bar.style.width = "0%";
  }, 200);
}

// Detect if running in sidebar or tab
const urlParams = new URLSearchParams(window.location.search);
const isSidebar = !urlParams.has('mode') || urlParams.get('mode') !== 'tab';

console.log('[TRANSLATE] Script loaded');
console.log('[TRANSLATE] Running in:', isSidebar ? 'SIDEBAR' : 'TAB');

// Auto-resize textarea based on content
function autoResizeTextarea(textarea) {
  // Reset height to 0 to get accurate scrollHeight
  textarea.style.height = '0';
  
  // Set new height based on content (add 2px buffer)
  textarea.style.height = (textarea.scrollHeight + 2) + 'px';
}

// Setup event listeners
function setupEventListeners() {
  console.log('[TRANSLATE] Setting up event listeners');
  
  // Disable form restoration for tabs only
  if (!isSidebar) {
    console.log('[TRANSLATE] Tab mode - disabling form restoration');
    document.getElementById('inputText').setAttribute('autocomplete', 'off');
    document.getElementById('outputText').setAttribute('autocomplete', 'off');
    
    // Clear any cached values
    document.getElementById('inputText').value = '';
    document.getElementById('outputText').value = '';
  }
  
  // Set button text based on sidebar or tab mode
  const clearStorageBtn = document.getElementById('clearStorageBtn');
  if (isSidebar) {
    clearStorageBtn.textContent = 'clear storage';
    clearStorageBtn.title = 'Clear saved translations from storage';
  } else {
    clearStorageBtn.textContent = 'clear history';
    clearStorageBtn.title = 'Clear current session history';
  }
  
  const targetLang = document.getElementById('targetLang');
  const inputText = document.getElementById('inputText');
  const outputText = document.getElementById('outputText');
  
  console.log('[TRANSLATE] Elements found:', {
    clearStorageBtn: !!clearStorageBtn,
    targetLang: !!targetLang,
    inputText: !!inputText,
    outputText: !!outputText
  });
  
  if (clearStorageBtn) clearStorageBtn.addEventListener('click', clearStorage);
  
  // Setup custom dropdown
  setupCustomDropdown();
  
  // Auto-translate on input (paste, typing, etc.) with auto-resize
  if (inputText) {
    let lastValue = "";
    let debounceTimer = null;
    let prevLength = 0;
    
    inputText.addEventListener('input', () => {
      // Auto-resize textarea first
      autoResizeTextarea(inputText);
      
      const text = inputText.value.trim();
      const currentLength = inputText.value.length;
      const diff = currentLength - prevLength;
      prevLength = currentLength;
      
      if (!text) {
        // Clear timer if input is empty
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        return;
      }
      
      // Detect instant large input (paste-like behavior)
      const isInstantLargeInput = diff > 50;
      
      if (isInstantLargeInput) {
        console.log('[TRANSLATE] Large input detected (paste-like), translating immediately');
        startProgress();
        setTimeout(() => {
          translateText();
        }, 0);
        return;
      }
      
      // Prevent duplicate triggers
      if (text === lastValue) return;
      lastValue = text;
      
      console.log('[TRANSLATE] Input detected:', text);
      
      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      // Wait 1.5 seconds after user stops typing
      debounceTimer = setTimeout(() => {
        console.log('[TRANSLATE] Debounce complete, translating...');
        startProgress();
        setTimeout(() => {
          translateText();
        }, 0);
      }, 1500);
    });
    
    // Initial resize
    autoResizeTextarea(inputText);
  }
  
  // Allow Enter key in input to trigger translation (with Ctrl/Cmd)
  if (inputText) {
    inputText.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        translateText();
      }
    });
  }
  
  // Initialize translation direction display
  updateTranslationDirection();
  
  // Restore saved state
  restoreState();
  
  console.log('[TRANSLATE] Event listeners setup complete');
}

// Setup custom dropdown functionality
function setupCustomDropdown() {
  const dropdown = document.getElementById('targetLangDropdown');
  const button = document.getElementById('dropdownButton');
  const menu = document.getElementById('dropdownMenu');
  const options = menu.querySelectorAll('.dropdown-option');
  const hiddenInput = document.getElementById('targetLang');
  const selectedLangSpan = document.getElementById('selectedLang');
  
  // Toggle dropdown
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });
  
  // Select option
  options.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      
      const value = option.getAttribute('data-value');
      const text = option.textContent;
      
      // Update hidden input
      hiddenInput.value = value;
      
      // Update button text
      selectedLangSpan.textContent = text;
      
      // Update selected state
      options.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      
      // Close dropdown
      dropdown.classList.remove('open');
      
      // Update header and save state
      updateTranslationDirection();
      saveState();
      
      console.log('[DROPDOWN] Language changed to:', value);
    });
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
  
  // Mark initial selected option
  const initialValue = hiddenInput.value;
  options.forEach(option => {
    if (option.getAttribute('data-value') === initialValue) {
      option.classList.add('selected');
    }
  });
}

// Initialize immediately (don't wait for DOMContentLoaded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupEventListeners);
} else {
  // DOM already loaded
  setupEventListeners();
}

// Check if text contains Cyrillic characters
function containsCyrillic(text) {
  return /[\u0400-\u04FF]/.test(text);
}

// Determine if auto-swap should be triggered (only for EN↔RU pair)
function shouldAutoSwap(text, targetLang) {
  // Only enable smart auto-swap for EN↔RU pair
  const isEnRuPair = (targetLang === 'en' || targetLang === 'ru');
  
  if (!isEnRuPair) {
    return { shouldSwap: false };
  }
  
  const hasCyrillic = containsCyrillic(text);
  
  // If target is RU and text has Cyrillic → swap to EN
  if (targetLang === 'ru' && hasCyrillic) {
    return { shouldSwap: true, newTarget: 'en' };
  }
  
  // If target is EN and text has NO Cyrillic → swap to RU
  if (targetLang === 'en' && !hasCyrillic) {
    return { shouldSwap: true, newTarget: 'ru' };
  }
  
  return { shouldSwap: false };
}

// Chunk text into smaller pieces for translation
function chunkText(text, maxChars = 3500) {
  // If text is small enough, return as-is
  if (text.length <= maxChars) {
    return [text];
  }
  
  const chunks = [];
  let currentChunk = '';
  
  // Split by sentences (period + space, newline, etc.)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  for (const sentence of sentences) {
    // If single sentence is too long, split by words
    if (sentence.length > maxChars) {
      const words = sentence.split(' ');
      for (const word of words) {
        if ((currentChunk + word).length > maxChars) {
          chunks.push(currentChunk.trim());
          currentChunk = word + ' ';
        } else {
          currentChunk += word + ' ';
        }
      }
    } else {
      // Add sentence to current chunk
      if ((currentChunk + sentence).length > maxChars) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Generate daily token (same algorithm as Worker)
async function getDailyToken() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const encoder = new TextEncoder();
  const data = encoder.encode(today + SECRET_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Show/hide progress indicator
function showProgress(current, total) {
  const progressIndicator = document.getElementById('progressIndicator');
  const progressText = document.getElementById('progressText');
  
  if (current > 0 && total > 1) {
    progressText.textContent = `translating chunk ${current} of ${total}...`;
    progressIndicator.style.display = 'block';
  } else {
    progressIndicator.style.display = 'none';
  }
}

// Translate a single chunk using Cloudflare Worker or direct API
async function translateChunk(text, sourceLang, targetLang) {
  
  // Try Cloudflare Worker first if enabled
  if (USE_WORKER) {
    try {
      console.log('[TRANSLATE] Using Cloudflare Worker with token auth');
      
      const token = await getDailyToken();
      
      const response = await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Token": token
        },
        body: JSON.stringify({
          text: text,
          target: targetLang
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Worker failed with status ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      console.log('[TRANSLATE] Worker success:', data.source);

      return {
        translatedText: data.translatedText,
        detectedLang: data.detectedLang || 'auto',
        service: 'cloudflare worker'
      };

    } catch (workerError) {
      console.warn('[TRANSLATE] Worker failed, falling back to direct API:', workerError.message);
      // Fall through to direct API fallback below
    }
  }
  
  // Direct API fallback (original method)
  // Try GTX endpoint first
  try {
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(gtxUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`GTX failed with status ${response.status}`);
      }
      
      const result = await response.json();
      
      // Parse GTX endpoint response
      let translatedText = '';
      if (result && result[0]) {
        for (const part of result[0]) {
          if (part[0]) {
            translatedText += part[0];
          }
        }
      }
      
      const detectedLang = result[2] ? result[2] : 'auto';
      
      return { translatedText, detectedLang, service: 'google gtx' };
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
    
  } catch (gtxError) {
    // GTX failed, try clients5 as fallback
    console.warn('[TRANSLATE] GTX failed, trying clients5 fallback:', gtxError.message);
    
    const clients5Url = 'https://clients5.google.com/translate_a/t';
    
    const body = new URLSearchParams();
    body.append("client", "dict-chrome-ex");
    body.append("sl", sourceLang);
    body.append("tl", targetLang);
    body.append("q", text);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(clients5Url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`clients5 failed with status ${response.status}`);
      }
      
      const result = await response.json();
      
      // Parse clients5 endpoint response
      let translatedText = '';
      if (Array.isArray(result?.[0])) {
        translatedText = result[0].map(x => x[0]).join("");
      }
      
      const detectedLang = 'auto';
      
      return { translatedText, detectedLang, service: 'google clients5' };
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Translation timed out - check your connection');
      }
      
      throw error;
    }
  }
}

// Translate text using Google Translate API with chunking support
async function translateText(isAutoSwapRetry = false) {
  const inputText = document.getElementById('inputText').value.trim();
  const targetLang = document.getElementById('targetLang').value;
  const outputText = document.getElementById('outputText');
  
  if (!inputText) {
    return;
  }
  
  // Smart auto-swap: Check if EN↔RU pair needs swapping
  if (!isAutoSwapRetry) {
    const swapCheck = shouldAutoSwap(inputText, targetLang);
    
    if (swapCheck.shouldSwap) {
      console.log('[TRANSLATE] Auto-swap triggered: EN↔RU pair, text script mismatch');
      
      // Swap target language
      const targetSelect = document.getElementById('targetLang');
      targetSelect.value = swapCheck.newTarget;
      
      console.log('[TRANSLATE] Swapped target to:', swapCheck.newTarget.toUpperCase());
      
      // Retry translation with swapped target (pass flag to prevent infinite loop)
      await translateText(true);
      return;
    }
  }
  
  // Track start time
  const startTime = performance.now();
  
  // Always use 'auto' for language detection
  const apiSourceLang = 'auto';
  
  console.log('[TRANSLATE] Starting translation...');
  console.log('[TRANSLATE] Input text length:', inputText.length);
  console.log('[TRANSLATE] Target lang:', targetLang);
  
  try {
    // Chunk the text
    const chunks = chunkText(inputText, 3500);
    const totalChunks = chunks.length;
    
    console.log('[TRANSLATE] Text split into', totalChunks, 'chunk(s)');
    
    let fullTranslation = '';
    let detectedLang = 'auto';
    let serviceName = '';
    
    // Translate each chunk
    for (let i = 0; i < chunks.length; i++) {
      // Show progress for multi-chunk translations
      if (totalChunks > 1) {
        showProgress(i + 1, totalChunks);
      }
      
      console.log(`[TRANSLATE] Translating chunk ${i + 1}/${totalChunks} (${chunks[i].length} chars)`);
      
      const result = await translateChunk(chunks[i], apiSourceLang, targetLang);
      
      if (!result.translatedText) {
        throw new Error(`Chunk ${i + 1} returned empty result`);
      }
      
      fullTranslation += result.translatedText;
      
      // Use detected language and service from first chunk
      if (i === 0) {
        detectedLang = result.detectedLang;
        serviceName = result.service || 'unknown';
      }
    }
    
    // Calculate character count
    const charCount = inputText.length;
    
    // Hide progress indicator
    showProgress(0, 0);
    
    // Finish progress bar
    finishProgress();
    
    // Guard against empty translation
    if (!fullTranslation) {
      throw new Error("Translation returned empty result");
    }
    
    // Calculate response time
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);
    
    console.log('[TRANSLATE] Response time:', responseTime, 'ms');
    console.log('[TRANSLATE] Final translated text length:', fullTranslation.length);
    
    outputText.value = fullTranslation;
    
    // Auto-resize output textarea
    autoResizeTextarea(outputText);
    
    // Auto-copy result to clipboard (always)
    autoCopyResult(fullTranslation);
    
    console.log('[TRANSLATE] Detected language:', detectedLang);
    console.log('[TRANSLATE] Target language:', targetLang);
    console.log('[TRANSLATE] Service used:', serviceName);
    
    // Update header with workflow status
    updateWorkflowStatus(detectedLang.toUpperCase(), targetLang.toUpperCase(), true, responseTime, serviceName, charCount, totalChunks);
    
    // Save state after successful translation
    saveState();
    
  } catch (error) {
    console.error('[TRANSLATE] Error:', error);
    
    // Hide progress indicator
    showProgress(0, 0);
    
    // Finish progress bar (even on error)
    finishProgress();
    
    // Update header to show error
    updateWorkflowStatus(null, null, false);
    
    showStatus(`Translation failed: ${error.message}`, 'error');
    outputText.value = '';
    
    // Reset output textarea height
    autoResizeTextarea(outputText);
  }
}

// Copy result to clipboard
function copyResult() {
  const outputText = document.getElementById('outputText');
  const copyBtn = document.getElementById('copyBtn');
  
  if (!outputText.value) {
    showStatus('No translation to copy', 'error');
    return;
  }
  
  // Copy to clipboard
  outputText.select();
  document.execCommand('copy');
  
  // Show feedback
  const originalText = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  
  setTimeout(() => {
    copyBtn.textContent = originalText;
  }, 2000);
}

// Auto-copy result to clipboard (reliable Firefox method without stealing focus)
function autoCopyResult(text) {
  // Save current focus
  const activeElement = document.activeElement;
  
  const textarea = document.getElementById('outputText');
  
  textarea.value = text;
  textarea.select();
  textarea.setSelectionRange(0, 99999);
  
  const success = document.execCommand('copy');
  
  if (success) {
    console.log('[TRANSLATE] Copied to clipboard');
  } else {
    console.log('[TRANSLATE] Copy failed');
  }
  
  // Restore focus to the element that had it before
  if (activeElement && activeElement !== textarea) {
    activeElement.focus();
    
    // If it was the input field, restore cursor position
    if (activeElement.id === 'inputText') {
      const cursorPos = activeElement.value.length;
      activeElement.setSelectionRange(cursorPos, cursorPos);
    }
  }
}

// Update translation direction display in header
function updateTranslationDirection() {
  const targetLangValue = document.getElementById('targetLang').value;
  const selectedLangSpan = document.getElementById('selectedLang');
  const line1 = document.getElementById('headerLine1');
  const line2 = document.getElementById('headerLine2');
  
  const targetText = selectedLangSpan.textContent;
  line1.textContent = `auto-detect → ${targetText}`;
  line2.textContent = 'ready to translate';
  
  updateStorageSize();
}

// Update workflow status in header
function updateWorkflowStatus(detectedLang, targetLang, success, responseTime, serviceName, charCount, totalChunks) {
  const line1 = document.getElementById('headerLine1');
  const line2 = document.getElementById('headerLine2');
  
  if (success && detectedLang && targetLang) {
    // Show successful workflow with service info
    line1.textContent = `detected: ${detectedLang} → translated: ${targetLang} → copied ✓`;
    
    // Format character count without comma separator
    const formattedChars = charCount.toString();
    
    // Build line 2 with service, chars, chunks (if multiple), time, and status
    let line2Parts = [serviceName || 'unknown'];
    
    // Add character count
    line2Parts.push(`${formattedChars} chars`);
    
    // Add chunk info if multiple chunks
    if (totalChunks > 1) {
      line2Parts.push(`${totalChunks} chunks`);
    }
    
    // Add response time
    line2Parts.push(`${responseTime}ms`);
    
    // Add status indicator
    const isFallback = serviceName !== 'cloudflare worker';
    const isSlow = responseTime > 2000;
    
    if (isFallback) {
      line2Parts.push('fallback ⚠');
    } else if (isSlow) {
      line2Parts.push('slow ⚠');
    } else {
      line2Parts.push('secure ✓');
    }
    
    line2.textContent = line2Parts.join(' • ');
  } else if (success === false) {
    // Show error state
    line1.textContent = 'translation failed';
    line2.textContent = 'check connection';
  } else {
    // Show default state
    updateTranslationDirection();
  }
  
  updateStorageSize();
}

// Update storage size display
async function updateStorageSize() {
  try {
    const sizeElement = document.getElementById('storageSize');
    
    // Tabs show warning message (no persistent storage)
    if (!isSidebar) {
      sizeElement.textContent = 'warning - no persistent storage';
      return;
    }
    
    // Sidebar shows actual storage size
    const result = await browser.storage.local.get('slateState');
    
    if (result.slateState) {
      // Calculate size in bytes
      const jsonString = JSON.stringify(result.slateState);
      const bytes = new Blob([jsonString]).size;
      
      // Format size
      let sizeText;
      if (bytes < 1024) {
        sizeText = `${bytes} bytes`;
      } else {
        const kb = (bytes / 1024).toFixed(1);
        sizeText = `${kb} kb`;
      }
      
      sizeElement.textContent = sizeText;
    } else {
      sizeElement.textContent = '0 kb';
    }
  } catch (error) {
    console.error('[STORAGE] Failed to calculate size:', error);
  }
}

// Show status message
function showStatus(message, type = 'info') {
  const statusMessage = document.getElementById('statusMessage');
  
  statusMessage.textContent = message;
  statusMessage.className = 'status-message ' + type;
  statusMessage.style.display = 'block';
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 3000);
}

console.log('[TRANSLATE] Event listeners registered');

// Save state to browser storage
async function saveState() {
  // Tabs don't save state - only sidebar persists
  if (!isSidebar) {
    console.log('[STORAGE] Tab mode - state not saved');
    return;
  }
  
  try {
    const state = {
      inputText: document.getElementById('inputText').value,
      outputText: document.getElementById('outputText').value,
      targetLang: document.getElementById('targetLang').value,
      timestamp: Date.now()
    };
    
    await browser.storage.local.set({ slateState: state });
    console.log('[STORAGE] Sidebar state saved:', state);
  } catch (error) {
    console.error('[STORAGE] Failed to save state:', error);
  }
}

// Restore state from browser storage
async function restoreState() {
  // Tabs don't restore state - only sidebar persists
  if (!isSidebar) {
    console.log('[STORAGE] Tab mode - starting fresh');
    return;
  }
  
  try {
    const result = await browser.storage.local.get('slateState');
    
    if (result.slateState) {
      const state = result.slateState;
      console.log('[STORAGE] Sidebar state restored:', state);
      
      // Restore input/output text
      if (state.inputText) {
        document.getElementById('inputText').value = state.inputText;
        autoResizeTextarea(document.getElementById('inputText'));
      }
      if (state.outputText) {
        document.getElementById('outputText').value = state.outputText;
        autoResizeTextarea(document.getElementById('outputText'));
      }
      
      // Restore target language selection
      if (state.targetLang) {
        const hiddenInput = document.getElementById('targetLang');
        const selectedLangSpan = document.getElementById('selectedLang');
        const menu = document.getElementById('dropdownMenu');
        const options = menu.querySelectorAll('.dropdown-option');
        
        hiddenInput.value = state.targetLang;
        
        // Update button text and selected state
        options.forEach(option => {
          if (option.getAttribute('data-value') === state.targetLang) {
            selectedLangSpan.textContent = option.textContent;
            option.classList.add('selected');
          } else {
            option.classList.remove('selected');
          }
        });
      }
      
      // Update header
      updateTranslationDirection();
    } else {
      console.log('[STORAGE] No saved state found');
    }
  } catch (error) {
    console.error('[STORAGE] Failed to restore state:', error);
  }
}

// Clear storage and reset UI
async function clearStorage() {
  try {
    // Only sidebar clears persistent storage
    if (isSidebar) {
      await browser.storage.local.remove('slateState');
      console.log('[STORAGE] Sidebar state cleared');
    } else {
      console.log('[STORAGE] Tab mode - clearing UI only');
    }
    
    // Reset UI to defaults (both sidebar and tabs)
    document.getElementById('inputText').value = '';
    document.getElementById('outputText').value = '';
    document.getElementById('targetLang').value = 'ru';
    
    // Reset textarea heights
    autoResizeTextarea(document.getElementById('inputText'));
    autoResizeTextarea(document.getElementById('outputText'));
    
    // Update header
    updateTranslationDirection();
    
    updateStorageSize();
    
    // Show brief confirmation
    const btn = document.getElementById('clearStorageBtn');
    const originalText = btn.textContent;
    btn.textContent = 'cleared!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1500);
  } catch (error) {
    console.error('[STORAGE] Failed to clear state:', error);
  }
}
