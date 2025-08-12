// Content script for YouTube AI Video Analyzer
class YouTubeAnalyzer {
  constructor() {
    this.analyzeButton = null;
    this.currentVideoId = null;
    this.transcriptCache = new Map(); // Cache for transcript data
    this.init();
  }

  init() {
    // Wait for YouTube to load
    this.waitForYouTube();
    
    // Listen for navigation changes in YouTube SPA
    this.observeNavigation();
  }

  waitForYouTube() {
    const checkForVideo = async () => {
      const videoElement = document.querySelector('video');
      const videoId = this.extractVideoId();

      if (videoElement && videoId && videoId !== this.currentVideoId) {
        console.log(`New video detected: ${videoId}`);
        this.currentVideoId = videoId;

        // Wait a bit for YouTube to fully load the page elements
        setTimeout(() => {
          this.injectAnalyzeButton();
        }, 1500);

        // Check if auto-analyze is enabled or forced via URL parameter
        try {
          // Check if forced analysis is requested via URL parameter
          const urlParams = new URLSearchParams(window.location.search);
          const forceAnalyze = urlParams.get('autoAnalyze') === 'true';

          let shouldAnalyze = forceAnalyze;

          if (!forceAnalyze) {
            // Check regular auto-analyze setting
            const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
            shouldAnalyze = response.success && response.settings.autoAnalyze;
          }

          if (shouldAnalyze) {
            console.log(forceAnalyze ? 'Forced analysis requested via URL parameter' : 'Auto-analyze enabled');
            // Wait a bit for the page to fully load, then auto-analyze
            setTimeout(() => {
              if (this.analyzeButton && !this.analyzeButton.classList.contains('loading')) {
                this.handleAnalyzeClick();
              }
            }, 4000);
          }
        } catch (error) {
          console.error('Error checking auto-analyze setting:', error);
        }
      }
    };

    // Check immediately
    checkForVideo();

    // Check periodically for SPA navigation
    setInterval(checkForVideo, 2000);
  }

  observeNavigation() {
    // Listen for YouTube's navigation events
    let lastUrl = location.href;
    let lastVideoId = this.currentVideoId;

    new MutationObserver(() => {
      const url = location.href;
      const currentVideoId = this.extractVideoId();

      // Check if URL changed OR video ID changed (for playlist navigation)
      if (url !== lastUrl || currentVideoId !== lastVideoId) {
        lastUrl = url;
        lastVideoId = currentVideoId;

        // Reset current video ID to force re-injection
        this.currentVideoId = null;

        // Wait a bit for YouTube to update the page
        setTimeout(() => this.waitForYouTube(), 500);
      }
    }).observe(document, { subtree: true, childList: true });

    // Also listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      setTimeout(() => {
        this.currentVideoId = null;
        this.waitForYouTube();
      }, 500);
    });
  }

  extractVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');

    // Handle playlist URLs - always get the current video ID
    if (videoId) {
      return videoId;
    }

    // Fallback: try to extract from URL path for different YouTube URL formats
    const pathMatch = window.location.pathname.match(/\/watch\/([a-zA-Z0-9_-]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    return null;
  }

  extractPlaylistId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('list');
  }

  injectAnalyzeButton() {
    // Remove existing button if any
    if (this.analyzeButton) {
      this.analyzeButton.remove();
      this.analyzeButton = null;
    }

    console.log('Attempting to inject analyze button...');

    // Try multiple methods to find the best container
    let targetContainer = null;
    let insertMethod = 'append';

    // Method 1: Look for subscribe button area (most preferred)
    const subscribeSelectors = [
      '#subscribe-button ytd-subscribe-button-renderer',
      'ytd-subscribe-button-renderer',
      '#subscribe-button',
      '[aria-label*="Subscribe"]',
      'button[aria-label*="Subscribe"]'
    ];

    for (const selector of subscribeSelectors) {
      const subscribeButton = document.querySelector(selector);
      if (subscribeButton) {
        // Look for a good container near the subscribe button
        let container = subscribeButton.closest('#owner, #upload-info, ytd-video-owner-renderer, .ytd-video-owner-renderer');
        if (!container) {
          container = subscribeButton.parentElement;
        }
        if (container) {
          targetContainer = container;
          insertMethod = 'after-subscribe';
          console.log('Found subscribe button area:', selector);
          break;
        }
      }
    }

    // Method 2: Look for the video owner/channel section
    if (!targetContainer) {
      const ownerSelectors = [
        '#owner #subscribe-button',
        '#owner',
        '#upload-info',
        'ytd-video-owner-renderer',
        '.ytd-video-owner-renderer',
        '#top-row #owner'
      ];

      for (const selector of ownerSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          targetContainer = element;
          insertMethod = 'append';
          console.log('Found owner section:', selector);
          break;
        }
      }
    }

    // Method 3: Look for action buttons area (like, dislike, share)
    if (!targetContainer) {
      const actionSelectors = [
        '#actions-inner',
        '#top-level-buttons-computed',
        '#menu-container',
        '.ytd-menu-renderer',
        '#actions',
        'ytd-menu-renderer'
      ];

      for (const selector of actionSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          targetContainer = element;
          insertMethod = 'append';
          console.log('Found actions container:', selector);
          break;
        }
      }
    }

    // Method 4: Look for any reasonable container in the video info area
    if (!targetContainer) {
      const fallbackSelectors = [
        '#info',
        '#info-contents',
        'ytd-video-primary-info-renderer',
        '#primary-inner',
        '#columns #primary'
      ];

      for (const selector of fallbackSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          targetContainer = element;
          insertMethod = 'prepend';
          console.log('Found fallback container:', selector);
          break;
        }
      }
    }

    if (!targetContainer) {
      console.log('No suitable container found, retrying in 2 seconds...');
      setTimeout(() => this.injectAnalyzeButton(), 2000);
      return;
    }

    // Create analyze button
    this.analyzeButton = this.createAnalyzeButton();

    // Insert button based on the method determined
    try {
      if (insertMethod === 'after-subscribe') {
        const subscribeButton = targetContainer.querySelector('#subscribe-button, ytd-subscribe-button-renderer, [aria-label*="Subscribe"]');
        if (subscribeButton && subscribeButton.parentElement) {
          subscribeButton.parentElement.insertBefore(this.analyzeButton, subscribeButton.nextSibling);
        } else {
          targetContainer.appendChild(this.analyzeButton);
        }
      } else if (insertMethod === 'prepend') {
        targetContainer.insertBefore(this.analyzeButton, targetContainer.firstChild);
      } else {
        targetContainer.appendChild(this.analyzeButton);
      }

      console.log('Successfully injected analyze button');
    } catch (error) {
      console.error('Error inserting button:', error);
      // Fallback: try to append to body
      document.body.appendChild(this.analyzeButton);
    }
  }

  createAnalyzeButton() {
    const container = document.createElement('div');
    container.className = 'yt-ai-analyzer-container';
    
    const button = document.createElement('button');
    button.className = 'yt-ai-analyzer-btn';
    button.innerHTML = `
      <div class="yt-ai-analyzer-btn-content">
        <svg class="play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
        <span>AI Analyze</span>
      </div>
      <div class="loading-progress"></div>
    `;

    const dropdownButton = document.createElement('button');
    dropdownButton.className = 'yt-ai-analyzer-dropdown-btn';
    dropdownButton.innerHTML = `
      <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 10l5 5 5-5z"/>
      </svg>
    `;

    const dropdown = document.createElement('div');
    dropdown.className = 'yt-ai-method-dropdown';
    dropdown.innerHTML = `
      <div class="method-option" data-method="transcript">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
        <div class="method-info">
          <div class="method-title">Transcript Method</div>
          <div class="method-desc">Extract and analyze video transcript</div>
        </div>
      </div>
      <div class="method-option" data-method="videolink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.09 1.49.09 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.09-3.59.09L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.09-1.49-.09-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.09 3.59-.09L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/>
        </svg>
        <div class="method-info">
          <div class="method-title">Video Link Method</div>
          <div class="method-desc">Send video URL directly to AI</div>
        </div>
      </div>
      <div class="method-option" data-method="transcriptlink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
        </svg>
        <div class="method-info">
          <div class="method-title">Transcript + Link</div>
          <div class="method-desc">Combine transcript and video URL</div>
        </div>
      </div>
    `;

    container.appendChild(button);
    container.appendChild(dropdownButton);
    container.appendChild(dropdown);

    // Handle main button click - analyze with default method
    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (button.classList.contains('loading')) return;
      
      // Get default method from settings
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
        const defaultMethod = response.success && response.settings.defaultAnalysisMethod ? response.settings.defaultAnalysisMethod : 'transcript';
        this.handleAnalyzeClick(defaultMethod);
      } catch (error) {
        console.error('Error getting default method:', error);
        this.handleAnalyzeClick('transcript'); // fallback to transcript
      }
    });

    // Handle dropdown button click to show dropdown
    dropdownButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (button.classList.contains('loading')) return;
      
      dropdown.classList.toggle('show');
    });

    // Handle method selection
    dropdown.addEventListener('click', (e) => {
      const methodOption = e.target.closest('.method-option');
      if (methodOption) {
        const method = methodOption.dataset.method;
        dropdown.classList.remove('show');
        this.handleAnalyzeClick(method);
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });

    this.analyzeButton = button;
    this.dropdownButton = dropdownButton;
    this.analyzeContainer = container;
    return container;
  }

  async handleAnalyzeClick(method = 'transcript') {
    const videoId = this.currentVideoId;
    if (!videoId) {
      console.error('No video ID found');
      return;
    }

    // Show loading state
    this.analyzeButton.classList.add('loading');
    const buttonContent = this.analyzeButton.querySelector('.yt-ai-analyzer-btn-content');
    
    try {
      // Get video title and description from the page
      const videoTitle = this.getVideoTitle();
      const videoDescription = this.getVideoDescription();

      // Create or show the chat popup
      this.createChatPopup();

      if (method === 'transcript') {
        // Original transcript extraction method
        if (buttonContent) {
          buttonContent.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Extracting transcript...</span>
          `;
        }

        console.log('Using transcript extraction method...');
        this.showChatMessage('🤖 AI Assistant', 'Extracting transcript from video...', 'assistant');

        // Update button text to show progress
        if (buttonContent) {
          buttonContent.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Opening transcript panel...</span>
          `;
        }

        const transcriptData = await this.extractTranscriptFromPanel();

        // Update progress during extraction
        if (buttonContent) {
          buttonContent.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Extracting complete transcript...</span>
          `;
        }

        console.log('Transcript extraction result:', transcriptData);
        this.showChatMessage('🤖 AI Assistant', 'Transcript extracted successfully! Analyzing video content...', 'assistant');

        // Update button text to show analysis in progress
        if (buttonContent) {
          buttonContent.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Analyzing...</span>
          `;
        }

        // Send message to background script for analysis
        const response = await chrome.runtime.sendMessage({
          action: 'analyzeVideoInline',
          videoId: videoId,
          videoUrl: window.location.href,
          transcriptData: transcriptData,
          videoTitle: videoTitle,
          videoDescription: videoDescription,
          method: 'transcript'
        });

        if (response.success) {
          this.displayAnalysisInChat(response.analysis);
        } else {
          throw new Error(response.error || 'Analysis failed');
        }
      } else if (method === 'videolink') {
        // New video link method
        if (buttonContent) {
          buttonContent.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Sending video link...</span>
          `;
        }

        console.log('Using video link method...');
        this.showChatMessage('🤖 AI Assistant', 'Sending video URL directly to AI for analysis...', 'assistant');

        // Update button text to show analysis in progress
        if (buttonContent) {
          buttonContent.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Analyzing video...</span>
          `;
        }

        // Send message to background script for video link analysis
        const response = await chrome.runtime.sendMessage({
          action: 'analyzeVideoByLink',
          videoId: videoId,
          videoUrl: window.location.href,
          videoTitle: videoTitle,
          videoDescription: videoDescription,
          method: 'videolink'
        });

        if (response.success) {
          this.displayAnalysisInChat(response.analysis);
        } else {
          throw new Error(response.error || 'Analysis failed');
        }
      } else if (method === 'transcriptlink') {
        // New transcript + link method
        if (buttonContent) {
          buttonContent.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Extracting transcript...</span>
          `;
        }

        console.log('Using transcript + link method...');
        this.showChatMessage('🤖 AI Assistant', 'Extracting transcript and preparing video URL for comprehensive analysis...', 'assistant');

        // Update button text to show progress
        if (buttonContent) {
          buttonContent.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Opening transcript panel...</span>
          `;
        }

        const transcriptData = await this.extractTranscriptFromPanel();

        // Update progress during extraction
        if (buttonContent) {
          buttonContent.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Extracting complete transcript...</span>
          `;
        }

        console.log('Transcript extraction result:', transcriptData);
        this.showChatMessage('🤖 AI Assistant', 'Transcript extracted! Analyzing with both transcript and video URL...', 'assistant');

        // Update button text to show analysis in progress
        if (buttonContent) {
          buttonContent.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Analyzing...</span>
          `;
        }

        // Send message to background script for transcript + link analysis
        const response = await chrome.runtime.sendMessage({
          action: 'analyzeVideoTranscriptLink',
          videoId: videoId,
          videoUrl: window.location.href,
          transcriptData: transcriptData,
          videoTitle: videoTitle,
          videoDescription: videoDescription,
          method: 'transcriptlink'
        });

        if (response.success) {
          this.displayAnalysisInChat(response.analysis);
        } else {
          throw new Error(response.error || 'Analysis failed');
        }
      }

      // Reset button after a short delay
      setTimeout(() => this.resetButton(), 2000);
    } catch (error) {
      console.error('Error during analysis:', error);

      // Show error in chat popup
      this.showChatMessage('❌ Error', `Analysis failed: ${error.message}`, 'error');

      // Update button to show error state briefly
      if (buttonContent) {
        buttonContent.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span>Error</span>
        `;
      }

      setTimeout(() => this.resetButton(), 3000);
    }
  }

  resetButton() {
    if (this.analyzeButton) {
      this.analyzeButton.classList.remove('loading');
      const buttonContent = this.analyzeButton.querySelector('.yt-ai-analyzer-btn-content');
      if (buttonContent) {
        buttonContent.innerHTML = `
          <svg class="play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <span>AI Analyze</span>
        `;
      }
    }
  }

  /**
   * Extract transcript directly from YouTube's transcript panel
   */
  async extractTranscriptFromPanel() {
    try {
      console.log('Starting transcript extraction from YouTube panel...');

      // Check cache first
      const videoId = this.currentVideoId;
      if (this.transcriptCache.has(videoId)) {
        console.log('Using cached transcript data');
        return this.transcriptCache.get(videoId);
      }

      // First, try to find and click the transcript button
      const transcriptOpened = await this.openTranscriptPanel();

      if (!transcriptOpened) {
        throw new Error('Could not open transcript panel - transcript may not be available for this video');
      }

      // Wait for transcript panel to load
      await this.waitForElement('[data-testid="transcript-segment"], .ytd-transcript-segment-renderer, .segment-text', 5000);

      // Extract transcript segments
      const transcriptSegments = await this.extractTranscriptSegments();

      if (!transcriptSegments || transcriptSegments.length === 0) {
        throw new Error('No transcript segments found');
      }

      console.log(`Successfully extracted ${transcriptSegments.length} transcript segments`);

      // Update progress for long transcripts
      if (transcriptSegments.length > 100) {
        const buttonContent = document.querySelector('.yt-ai-analyzer-btn .yt-ai-analyzer-btn-content');
        if (buttonContent) {
          buttonContent.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Processing ${transcriptSegments.length} segments...</span>
          `;
        }
      }

      // Close transcript panel to clean up
      this.closeTranscriptPanel();

      const transcriptData = {
        segments: transcriptSegments,
        totalSegments: transcriptSegments.length,
        extractedAt: new Date().toISOString(),
        method: 'youtube-panel'
      };

      // Cache the result
      this.transcriptCache.set(videoId, transcriptData);

      return transcriptData;

    } catch (error) {
      console.error('Error extracting transcript from panel:', error);

      // Try to close panel if it was opened
      this.closeTranscriptPanel();

      throw error;
    }
  }

  /**
   * Open YouTube's transcript panel
   */
  async openTranscriptPanel() {
    try {
      // Look for transcript button with various selectors
      const transcriptButtonSelectors = [
        'button[aria-label*="transcript" i]',
        'button[aria-label*="Show transcript" i]',
        'button[title*="transcript" i]',
        '[data-testid="transcript-button"]',
        'ytd-button-renderer[aria-label*="transcript" i]',
        // More specific YouTube selectors
        'ytd-menu-renderer button[aria-label*="transcript" i]',
        '#description button[aria-label*="transcript" i]',
        '.ytd-video-description-transcript-section-renderer button'
      ];

      let transcriptButton = null;

      // Try to find transcript button
      for (const selector of transcriptButtonSelectors) {
        transcriptButton = document.querySelector(selector);
        if (transcriptButton) {
          console.log(`Found transcript button with selector: ${selector}`);
          break;
        }
      }

      // If not found, try to find it in the more actions menu
      if (!transcriptButton) {
        console.log('Transcript button not visible, checking more actions menu...');

        // Look for "more actions" or "..." button
        const moreActionsSelectors = [
          'button[aria-label*="More actions" i]',
          'button[aria-label*="More" i]',
          'ytd-menu-renderer button[aria-label*="More" i]',
          '#description button[aria-label*="More" i]'
        ];

        for (const selector of moreActionsSelectors) {
          const moreButton = document.querySelector(selector);
          if (moreButton) {
            console.log(`Found more actions button: ${selector}`);
            moreButton.click();

            // Wait for menu to appear
            await this.sleep(200);

            // Look for transcript option in the menu
            const menuTranscriptSelectors = [
              'ytd-menu-service-item-renderer[aria-label*="transcript" i]',
              'tp-yt-paper-item[aria-label*="transcript" i]',
              '[role="menuitem"][aria-label*="transcript" i]',
              'ytd-menu-navigation-item-renderer:contains("transcript")'
            ];

            for (const menuSelector of menuTranscriptSelectors) {
              transcriptButton = document.querySelector(menuSelector);
              if (transcriptButton) {
                console.log(`Found transcript in menu: ${menuSelector}`);
                break;
              }
            }

            if (transcriptButton) break;
          }
        }
      }

      if (!transcriptButton) {
        console.log('Transcript button not found, transcript may not be available');
        return false;
      }

      // Click the transcript button
      console.log('Clicking transcript button...');
      transcriptButton.click();

      // Wait a bit for the panel to open
      await this.sleep(400);

      return true;

    } catch (error) {
      console.error('Error opening transcript panel:', error);
      return false;
    }
  }
  /**
   * Extract transcript segments from the opened transcript panel
   */
  async extractTranscriptSegments() {
    try {
      console.log('Starting transcript segment extraction...');

      // Wait for initial segments to load with shorter delay
      await this.sleep(800);

      // Scroll to load all transcript segments - optimized version
      console.log('Scrolling to load all transcript segments...');
      await this.scrollTranscriptToLoadAllOptimized();

      // Shorter wait after scrolling
      await this.sleep(1000);

      // Look for transcript segments with various selectors
      const segmentSelectors = [
        '[data-testid="transcript-segment"]',
        '.ytd-transcript-segment-renderer',
        '.segment-text',
        'ytd-transcript-segment-renderer',
        '.transcript-segment',
        // Fallback selectors
        '[role="button"][tabindex="0"]' // transcript segments are often clickable buttons
      ];

      let segments = [];
      let bestSelector = null;
      let maxSegmentCount = 0;

      // Try all selectors and use the one that finds the most segments
      for (const selector of segmentSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > maxSegmentCount) {
          maxSegmentCount = elements.length;
          bestSelector = selector;
        }
      }

      if (!bestSelector || maxSegmentCount === 0) {
        console.log('No transcript segments found with any selector');
        return [];
      }

      console.log(`Using selector "${bestSelector}" which found ${maxSegmentCount} segments`);
      const elements = document.querySelectorAll(bestSelector);

      // Process all segments
      segments = Array.from(elements).map((element, index) => {
        try {
          // Extract text content
          let text = element.textContent || element.innerText || '';
          text = text.trim();

          // Skip empty segments
          if (!text || text.length === 0) {
            return null;
          }

          // Try to extract timestamp if available
          let timestamp = null;
          let startTime = null;

          // Look for timestamp in various formats
          const timestampPatterns = [
            /(\d{1,2}:\d{2}:\d{2})/,  // HH:MM:SS format (try this first)
            /(\d{1,2}:\d{2})/,       // MM:SS format
            /^(\d+:\d+)/, // Start of text
          ];

          for (const pattern of timestampPatterns) {
            const match = text.match(pattern);
            if (match) {
              timestamp = match[1];
              // Convert to seconds
              const parts = timestamp.split(':').map(Number);
              if (parts.length === 2) {
                startTime = parts[0] * 60 + parts[1]; // MM:SS
              } else if (parts.length === 3) {
                startTime = parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
              }

              // Remove timestamp from text
              text = text.replace(pattern, '').trim();
              break;
            }
          }

          // If no timestamp found, try to get it from data attributes or aria-label
          if (!timestamp) {
            const ariaLabel = element.getAttribute('aria-label') || '';
            const timestampMatch = ariaLabel.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
            if (timestampMatch) {
              timestamp = timestampMatch[1];
              const parts = timestamp.split(':').map(Number);
              if (parts.length === 2) {
                startTime = parts[0] * 60 + parts[1];
              } else if (parts.length === 3) {
                startTime = parts[0] * 3600 + parts[1] * 60 + parts[2];
              }
            }
          }

          // Enhanced fallback: try to extract from element structure
          if (!timestamp) {
            // Look for timestamp in child elements
            const timestampElement = element.querySelector('[data-start], .timestamp, .time');
            if (timestampElement) {
              const timeText = timestampElement.textContent || timestampElement.getAttribute('data-start');
              if (timeText) {
                const match = timeText.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
                if (match) {
                  timestamp = match[1];
                  const parts = timestamp.split(':').map(Number);
                  if (parts.length === 2) {
                    startTime = parts[0] * 60 + parts[1];
                  } else if (parts.length === 3) {
                    startTime = parts[0] * 3600 + parts[1] * 60 + parts[2];
                  }
                }
              }
            }
          }

          // Final fallback: estimate timestamp based on position
          if (!timestamp && !startTime) {
            startTime = index * 8; // More realistic estimate: 8 seconds per segment
            const hours = Math.floor(startTime / 3600);
            const minutes = Math.floor((startTime % 3600) / 60);
            const seconds = startTime % 60;

            if (hours > 0) {
              timestamp = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
              timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
          }

          // Clean up text content
          text = text.replace(/\s+/g, ' ').trim();

          return {
            text: text,
            timestamp: timestamp,
            start: startTime,
            index: index
          };
        } catch (segmentError) {
          console.error('Error processing segment:', segmentError);
          return null;
        }
      }).filter(segment => segment && segment.text.length > 0);

      console.log(`Successfully extracted ${segments.length} transcript segments`);

      // Calculate total transcript length for verification
      const totalTranscriptText = segments.map(s => s.text).join(' ');
      console.log(`Total transcript text length: ${totalTranscriptText.length} characters`);

      // Verify we have a reasonable number of segments for the video
      if (segments.length < 5) {
        console.warn(`Only found ${segments.length} segments, this might indicate incomplete extraction`);
      }

      // Log first and last segments for verification
      if (segments.length > 0) {
        console.log('First segment:', segments[0]);
        console.log('Last segment:', segments[segments.length - 1]);
      }

      return segments;

    } catch (error) {
      console.error('Error extracting transcript segments:', error);
      return [];
    }
  }

  /**
   * Close the transcript panel
   */
  closeTranscriptPanel() {
    try {
      // Look for close button or click transcript button again to close
      const closeSelectors = [
        'button[aria-label*="Close transcript" i]',
        'button[aria-label*="Hide transcript" i]',
        '[data-testid="transcript-close"]'
      ];

      for (const selector of closeSelectors) {
        const closeButton = document.querySelector(selector);
        if (closeButton) {
          closeButton.click();
          return;
        }
      }

      // If no close button found, try clicking transcript button again
      const transcriptButton = document.querySelector('button[aria-label*="transcript" i]');
      if (transcriptButton) {
        transcriptButton.click();
      }

    } catch (error) {
      console.error('Error closing transcript panel:', error);
    }
  }

  /**
   * Get video title from the page
   */
  getVideoTitle() {
    try {
      const titleSelectors = [
        'h1.ytd-video-primary-info-renderer',
        'h1.title',
        '.ytd-video-primary-info-renderer h1',
        'ytd-video-primary-info-renderer h1',
        '#container h1'
      ];

      for (const selector of titleSelectors) {
        const titleElement = document.querySelector(selector);
        if (titleElement) {
          return titleElement.textContent.trim();
        }
      }

      // Fallback to document title
      return document.title.replace(' - YouTube', '').trim();
    } catch (error) {
      console.error('Error getting video title:', error);
      return 'Unknown Title';
    }
  }

  /**
   * Get video description from the page
   */
  getVideoDescription() {
    try {
      const descriptionSelectors = [
        // New YouTube layout selectors
        'ytd-watch-metadata #description-inline-expander #description-text',
        'ytd-watch-metadata #description-text',
        '#watch-description-text',
        '#description-inline-expander #description-text',
        '#description-text',
        // Fallback selectors
        '#description ytd-text-inline-expander-renderer',
        '.ytd-video-secondary-info-renderer #description',
        '#description .content',
        'ytd-video-secondary-info-renderer #description',
        // Meta tag fallback
        'meta[name="description"]',
        'meta[property="og:description"]'
      ];

      for (const selector of descriptionSelectors) {
        const descElement = document.querySelector(selector);
        if (descElement) {
          // For meta tags, get content attribute
          if (selector.includes('meta')) {
            const content = descElement.getAttribute('content');
            if (content && content.trim().length > 0) {
              return content.trim();
            }
          } else {
            const text = descElement.textContent || descElement.innerText;
            if (text && text.trim().length > 0) {
              return text.trim();
            }
          }
        }
      }

      // Try to get description from page data
      try {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const content = script.textContent || script.innerText;
          if (content.includes('videoDetails') && content.includes('shortDescription')) {
            const match = content.match(/"shortDescription":"([^"]*?)"/);
            if (match && match[1]) {
              // Decode escaped characters
              const description = match[1]
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .replace(/\\\\/g, '\\');
              if (description.trim().length > 0) {
                return description.trim();
              }
            }
          }
        }
      } catch (scriptError) {
        console.log('Error parsing script data for description:', scriptError);
      }

      return 'No description available';
    } catch (error) {
      console.error('Error getting video description:', error);
      return 'No description available';
    }
  }

  /**
   * Wait for an element to appear
   */
  async waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Pause the YouTube player
   */
  pauseYouTubePlayer() {
    try {
      // Method 1: Try to find and click the pause button
      const pauseButton = document.querySelector('.ytp-play-button[aria-label*="Pause"], .ytp-play-button[title*="Pause"]');
      if (pauseButton) {
        console.log('Pausing YouTube player via pause button');
        pauseButton.click();
        return;
      }

      // Method 2: Try to pause via video element
      const videoElement = document.querySelector('video');
      if (videoElement && !videoElement.paused) {
        console.log('Pausing YouTube player via video element');
        videoElement.pause();
        return;
      }

      // Method 3: Try keyboard shortcut (spacebar)
      const playerContainer = document.querySelector('#movie_player, .html5-video-player');
      if (playerContainer) {
        console.log('Pausing YouTube player via keyboard event');
        const spaceEvent = new KeyboardEvent('keydown', {
          key: ' ',
          code: 'Space',
          keyCode: 32,
          which: 32,
          bubbles: true
        });
        playerContainer.dispatchEvent(spaceEvent);
      }

    } catch (error) {
      console.error('Error pausing YouTube player:', error);
    }
  }

  /**
   * Optimized scroll transcript panel to load all segments
   */
  async scrollTranscriptToLoadAllOptimized() {
    try {
      // Find the transcript container with more comprehensive selectors
      const transcriptContainerSelectors = [
        '#transcript-scrollbox',
        '.ytd-transcript-renderer',
        '[data-testid="transcript-container"]',
        'ytd-transcript-renderer #body',
        'ytd-transcript-renderer .ytd-transcript-body-renderer',
        '#transcript .ytd-transcript-body-renderer',
        '.ytd-transcript-body-renderer',
        // Additional selectors for different YouTube layouts
        'ytd-transcript-segment-list-renderer',
        '#segments-container',
        '.transcript-segment-list'
      ];

      let transcriptContainer = null;
      for (const selector of transcriptContainerSelectors) {
        transcriptContainer = document.querySelector(selector);
        if (transcriptContainer) {
          console.log(`Found transcript container with selector: ${selector}`);
          break;
        }
      }

      if (!transcriptContainer) {
        console.log('Transcript container not found, trying to find scrollable parent...');

        // Try to find any transcript segment and get its scrollable parent
        const anySegment = document.querySelector('[data-testid="transcript-segment"], .ytd-transcript-segment-renderer');
        if (anySegment) {
          let parent = anySegment.parentElement;
          while (parent && parent !== document.body) {
            const style = window.getComputedStyle(parent);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll' || parent.scrollHeight > parent.clientHeight) {
              transcriptContainer = parent;
              console.log('Found scrollable parent container');
              break;
            }
            parent = parent.parentElement;
          }
        }
      }

      if (!transcriptContainer) {
        console.log('No transcript container found, skipping scroll');
        return;
      }

      console.log('Starting comprehensive transcript scrolling for complete extraction...');

      let previousSegmentCount = 0;
      let currentSegmentCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 50; // Significantly increased for very long videos
      let stableCount = 0; // Count how many times segment count stayed the same
      const maxStableCount = 5; // Increased stability requirement
      let lastScrollHeight = 0;
      let scrollHeightStableCount = 0;

      // Initial segment count
      const initialSegments = transcriptContainer.querySelectorAll('[data-testid="transcript-segment"], .ytd-transcript-segment-renderer, .segment-text');
      currentSegmentCount = initialSegments.length;
      console.log(`Initial segment count: ${currentSegmentCount}`);

      do {
        previousSegmentCount = currentSegmentCount;
        const currentScrollHeight = transcriptContainer.scrollHeight;

        // Optimized scrolling strategy - much faster

        // Quick scroll to bottom to trigger loading
        transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
        await this.sleep(200);

        // Fast incremental scrolls to trigger lazy loading
        const totalHeight = transcriptContainer.scrollHeight;
        const scrollSteps = 8; // Fewer steps for speed
        const scrollStep = totalHeight / scrollSteps;

        for (let i = 1; i <= scrollSteps; i++) {
          transcriptContainer.scrollTop = scrollStep * i;
          await this.sleep(50); // Much shorter wait

          // Force reflow
          transcriptContainer.offsetHeight;
        }

        // Final scroll to bottom
        transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
        await this.sleep(300); // Shorter final wait

        // Count current segments with multiple selectors
        const segmentSelectors = [
          '[data-testid="transcript-segment"]',
          '.ytd-transcript-segment-renderer',
          '.segment-text',
          'ytd-transcript-segment-renderer',
          '.transcript-segment'
        ];

        let maxSegmentCount = 0;
        for (const selector of segmentSelectors) {
          const segments = transcriptContainer.querySelectorAll(selector);
          if (segments.length > maxSegmentCount) {
            maxSegmentCount = segments.length;
          }
        }
        currentSegmentCount = maxSegmentCount;

        // Check scroll height stability
        if (currentScrollHeight === lastScrollHeight) {
          scrollHeightStableCount++;
        } else {
          scrollHeightStableCount = 0;
          lastScrollHeight = currentScrollHeight;
        }

        console.log(`Scroll attempt ${scrollAttempts + 1}: Found ${currentSegmentCount} segments (previous: ${previousSegmentCount}), scroll height: ${currentScrollHeight}`);

        // Update button with progress for longer videos
        if (scrollAttempts > 5) {
          const buttonContent = document.querySelector('.yt-ai-analyzer-btn .yt-ai-analyzer-btn-content');
          if (buttonContent) {
            buttonContent.innerHTML = `
              <div class="loading-spinner"></div>
              <span>Loading transcript... (${currentSegmentCount} segments)</span>
            `;
          }
        }

        // Check if segment count is stable
        if (currentSegmentCount === previousSegmentCount) {
          stableCount++;
          console.log(`Segment count stable for ${stableCount} attempts`);
        } else {
          stableCount = 0; // Reset stable count if we found new segments
        }

        scrollAttempts++;

        // Continue if:
        // 1. We're still finding new segments, OR
        // 2. We haven't reached stable count, OR
        // 3. Scroll height is still changing (content still loading)
      } while ((currentSegmentCount > previousSegmentCount || stableCount < maxStableCount || scrollHeightStableCount < 3) && scrollAttempts < maxScrollAttempts);

      console.log(`Finished scrolling after ${scrollAttempts} attempts. Total segments loaded: ${currentSegmentCount}`);

      // Quick final verification
      console.log('Performing final verification scroll...');

      // Quick scroll to top and bottom
      transcriptContainer.scrollTop = 0;
      await this.sleep(100);
      transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
      await this.sleep(300); // Much shorter wait

      // Final count with all possible selectors
      const allPossibleSelectors = [
        '[data-testid="transcript-segment"]',
        '.ytd-transcript-segment-renderer',
        '.segment-text',
        'ytd-transcript-segment-renderer',
        '.transcript-segment',
        '[role="button"][tabindex="0"]' // Fallback for clickable segments
      ];

      let finalCount = 0;
      for (const selector of allPossibleSelectors) {
        const segments = transcriptContainer.querySelectorAll(selector);
        if (segments.length > finalCount) {
          finalCount = segments.length;
        }
      }

      console.log(`Final verification: ${finalCount} segments found after comprehensive scrolling`);

      // Additional verification: check if we have a reasonable amount of content
      const allSegmentText = Array.from(transcriptContainer.querySelectorAll(allPossibleSelectors[0]))
        .map(el => el.textContent || '')
        .join(' ');

      console.log(`Total transcript text length after scrolling: ${allSegmentText.length} characters`);

      if (allSegmentText.length < 500) {
        console.warn('Transcript seems very short, might be incomplete');
      }

    } catch (error) {
      console.error('Error scrolling transcript:', error);
    }
  }

  /**
   * Sleep utility function
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create chat popup interface
   */
  createChatPopup() {
    // Remove existing popup if any
    const existingPopup = document.getElementById('yt-ai-chat-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup container
    const popup = document.createElement('div');
    popup.id = 'yt-ai-chat-popup';
    popup.className = 'yt-ai-chat-popup';

    popup.innerHTML = `
      <div class="yt-ai-chat-header">
        <div class="yt-ai-chat-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span>AI Video Analysis</span>
        </div>
        <div class="yt-ai-chat-controls">
          <button class="yt-ai-minimize-btn" onclick="this.closest('.yt-ai-chat-popup').classList.toggle('minimized')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,13H5V11H19V13Z"/>
            </svg>
          </button>
          <button class="yt-ai-close-btn" onclick="this.closest('.yt-ai-chat-popup').remove()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="yt-ai-chat-messages" id="yt-ai-chat-messages">
        <div class="yt-ai-welcome-message">
          <div class="yt-ai-message assistant">
            <div class="yt-ai-message-avatar">🤖</div>
            <div class="yt-ai-message-content">
              <div class="yt-ai-message-header">AI Assistant</div>
              <div class="yt-ai-message-text">Hi! I'll analyze this YouTube video for you. Click the "AI Analyze" button to get started.</div>
            </div>
          </div>
        </div>
      </div>
      <div class="yt-ai-chat-input-container" id="yt-ai-chat-input-container" style="display: none;">
        <!-- Saved Prompts Section -->
        <div class="yt-ai-saved-prompts" id="yt-ai-saved-prompts">
          <div class="yt-ai-saved-prompts-header">
            <button id="yt-ai-toggle-prompts-btn" class="yt-ai-toggle-prompts-btn" title="Toggle Quick Prompts">
              <svg class="yt-ai-chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
              <span class="yt-ai-saved-prompts-title">Quick Prompts</span>
            </button>
            <button id="yt-ai-manage-prompts-btn" class="yt-ai-manage-prompts-btn" title="Manage saved prompts">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
              </svg>
            </button>
          </div>
          <div class="yt-ai-saved-prompts-list" id="yt-ai-saved-prompts-list" style="display: none;">
            <!-- Saved prompts will be populated here -->
          </div>
        </div>
        
        <div class="yt-ai-chat-input-wrapper">
          <input type="text"
                 id="yt-ai-chat-input"
                 class="yt-ai-chat-input"
                 placeholder="Ask a question about this video..."
                 maxlength="500">
          <button id="yt-ai-send-btn" class="yt-ai-send-btn" title="Send message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
            </svg>
          </button>
        </div>
      </div>
      <!-- Resize handles -->
      <div class="yt-ai-resize-handle yt-ai-resize-n" data-direction="n"></div>
      <div class="yt-ai-resize-handle yt-ai-resize-s" data-direction="s"></div>
      <div class="yt-ai-resize-handle yt-ai-resize-e" data-direction="e"></div>
      <div class="yt-ai-resize-handle yt-ai-resize-w" data-direction="w"></div>
      <div class="yt-ai-resize-handle yt-ai-resize-ne" data-direction="ne"></div>
      <div class="yt-ai-resize-handle yt-ai-resize-nw" data-direction="nw"></div>
      <div class="yt-ai-resize-handle yt-ai-resize-se" data-direction="se"></div>
      <div class="yt-ai-resize-handle yt-ai-resize-sw" data-direction="sw"></div>
    `;

    // Add popup to page
    document.body.appendChild(popup);

    // Make popup draggable and resizable
    this.makeDraggable(popup);
    this.makeResizable(popup);

    // Add event listeners for chat input
    this.setupChatInput(popup);

    return popup;
  }

  /**
   * Show a message in the chat popup
   */
  showChatMessage(sender, message, type = 'assistant') {
    const messagesContainer = document.getElementById('yt-ai-chat-messages');
    if (!messagesContainer) return;

    // Remove welcome message if it exists
    const welcomeMessage = messagesContainer.querySelector('.yt-ai-welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }

    const messageElement = document.createElement('div');
    messageElement.className = `yt-ai-message ${type}`;

    const avatar = type === 'assistant' ? '🤖' : type === 'error' ? '❌' : '👤';

    // Process message to make timestamps clickable if it's from assistant
    let processedMessage = message;
    if (type === 'assistant') {
      processedMessage = this.processAnalysisText(message);
    }

    messageElement.innerHTML = `
      <div class="yt-ai-message-avatar">${avatar}</div>
      <div class="yt-ai-message-content">
        <div class="yt-ai-message-header">${sender}</div>
        <div class="yt-ai-message-text">${processedMessage}</div>
      </div>
    `;

    messagesContainer.appendChild(messageElement);

    // Add event listeners for timestamps in this message
    const timestamps = messageElement.querySelectorAll('.yt-ai-timestamp');
    timestamps.forEach(timestamp => {
      timestamp.addEventListener('click', (e) => {
        e.preventDefault();
        const timeStr = timestamp.getAttribute('data-timestamp');
        this.seekToTime(timeStr);
      });
    });

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Display analysis results in chat popup
   */
  displayAnalysisInChat(analysis) {
    if (!analysis) return;

    // Show analysis as a formatted message
    let analysisHtml = '';

    if (analysis.isRawFormat && analysis.rawAnalysis) {
      // Process raw analysis to make timestamps clickable
      analysisHtml = this.processAnalysisText(analysis.rawAnalysis);
    } else {
      // Fallback for structured analysis
      analysisHtml = '<div class="yt-ai-analysis-fallback">Analysis completed but formatting not available.</div>';
    }

    const messagesContainer = document.getElementById('yt-ai-chat-messages');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = 'yt-ai-message assistant analysis';

    messageElement.innerHTML = `
      <div class="yt-ai-message-avatar">📊</div>
      <div class="yt-ai-message-content">
        <div class="yt-ai-message-header">Analysis Results</div>
        <div class="yt-ai-message-text yt-ai-analysis-content">${analysisHtml}</div>
      </div>
    `;

    messagesContainer.appendChild(messageElement);

    // Add event listeners for timestamps in this message
    const timestamps = messageElement.querySelectorAll('.yt-ai-timestamp');
    timestamps.forEach(timestamp => {
      timestamp.addEventListener('click', (e) => {
        e.preventDefault();
        const timeStr = timestamp.getAttribute('data-timestamp');
        this.seekToTime(timeStr);
      });
    });

    // Show chat input after analysis is complete
    const inputContainer = document.getElementById('yt-ai-chat-input-container');
    if (inputContainer) {
      inputContainer.style.display = 'block';
    }

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Process analysis text to make timestamps clickable
   */
  processAnalysisText(text) {
    // Convert markdown-style formatting to HTML
    let processedText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Wrap in paragraphs
    processedText = '<p>' + processedText + '</p>';

    // Make timestamps clickable - store reference to this instance
    const self = this;
    processedText = processedText.replace(
      /(\d{1,2}:\d{2}(?::\d{2})?)/g,
      '<span class="yt-ai-timestamp" data-timestamp="$1" title="Click to jump to this time">$1</span>'
    );

    return processedText;
  }

  /**
   * Seek to specific time in YouTube video
   */
  seekToTime(timeStr) {
    try {
      console.log(`Attempting to seek to: ${timeStr}`);

      // Parse time string (MM:SS or HH:MM:SS)
      const parts = timeStr.split(':').map(Number);
      let seconds = 0;

      if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1]; // MM:SS
      } else if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
      }

      console.log(`Parsed time: ${seconds} seconds`);

      // Method 1: Try using YouTube player API directly
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = seconds;
        console.log(`Seeked video element to ${seconds} seconds`);

        // Also try to trigger YouTube's internal player update
        const player = document.querySelector('#movie_player');
        if (player && player.seekTo) {
          player.seekTo(seconds);
          console.log(`Used YouTube player seekTo: ${seconds}`);
        }

        return;
      }

      // Method 2: Try using YouTube's URL parameter method
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('t', `${seconds}s`);

      // Update URL without reloading page
      window.history.replaceState({}, '', currentUrl.toString());

      // Try to trigger a seek by dispatching events
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoElement.currentTime = seconds;

        // Dispatch timeupdate event
        const event = new Event('timeupdate');
        videoElement.dispatchEvent(event);

        console.log(`Updated video time to ${seconds} seconds via URL method`);
      }

    } catch (error) {
      console.error('Error seeking to time:', error);

      // Fallback: Show user a message about the timestamp
      this.showChatMessage('🕐 Timestamp', `Timestamp ${timeStr} clicked. Please manually seek to this time in the video.`, 'assistant');
    }
  }

  /**
   * Setup chat input functionality
   */
  setupChatInput(popup) {
    const chatInput = popup.querySelector('#yt-ai-chat-input');
    const sendBtn = popup.querySelector('#yt-ai-send-btn');
    const managePromptsBtn = popup.querySelector('#yt-ai-manage-prompts-btn');

    if (!chatInput || !sendBtn) return;

    // Handle send button click
    sendBtn.addEventListener('click', () => {
      this.sendChatMessage();
    });

    // Handle Enter key press
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });

    // Handle input focus/blur for better UX
    chatInput.addEventListener('focus', () => {
      chatInput.parentElement.classList.add('focused');
    });

    chatInput.addEventListener('blur', () => {
      chatInput.parentElement.classList.remove('focused');
    });

    // Handle manage prompts button click
    if (managePromptsBtn) {
      managePromptsBtn.addEventListener('click', () => {
        this.openSavedPromptsManager();
      });
    }

    // Handle toggle prompts button click
    const togglePromptsBtn = popup.querySelector('#yt-ai-toggle-prompts-btn');
    if (togglePromptsBtn) {
      togglePromptsBtn.addEventListener('click', () => {
        this.toggleSavedPrompts();
      });
    }

    // Load and display saved prompts
    this.loadSavedPrompts();
  }

  /**
   * Send chat message and get AI response
   */
  async sendChatMessage() {
    const chatInput = document.getElementById('yt-ai-chat-input');
    const sendBtn = document.getElementById('yt-ai-send-btn');

    if (!chatInput || !sendBtn) return;

    const message = chatInput.value.trim();
    if (!message) return;

    // Clear input and disable send button
    chatInput.value = '';
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<div class="yt-ai-loading-spinner"></div>';

    // Show user message
    this.showChatMessage('You', message, 'user');

    try {
      // Send message to background script for processing
      const response = await chrome.runtime.sendMessage({
        action: 'chatWithVideo',
        message: message,
        videoId: this.currentVideoId,
        videoUrl: window.location.href
      });

      if (response.success) {
        // Show AI response
        this.showChatMessage('🤖 AI Assistant', response.reply, 'assistant');
      } else {
        throw new Error(response.error || 'Chat failed');
      }
    } catch (error) {
      console.error('Chat error:', error);
      this.showChatMessage('❌ Error', `Sorry, I couldn't process your message: ${error.message}`, 'error');
    } finally {
      // Re-enable send button
      sendBtn.disabled = false;
      sendBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
        </svg>
      `;

      // Focus back on input
      chatInput.focus();
    }
  }

  /**
   * Make popup draggable
   */
  makeDraggable(popup) {
    const header = popup.querySelector('.yt-ai-chat-header');
    let isDragging = false;
    let startX, startY;
    let startTranslateX = 0, startTranslateY = 0;

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
      // Don't start dragging if clicking on control buttons or resize handles
      if (e.target.closest('.yt-ai-chat-controls') || e.target.closest('.yt-ai-resize-handle')) {
        return;
      }

      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        // Get current transform values
        const currentTransform = popup.style.transform;
        const transformMatch = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (transformMatch) {
          startTranslateX = parseFloat(transformMatch[1]) || 0;
          startTranslateY = parseFloat(transformMatch[2]) || 0;
        } else {
          startTranslateX = 0;
          startTranslateY = 0;
        }

        header.style.cursor = 'grabbing';
        popup.style.userSelect = 'none';

        e.preventDefault();
      }
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const newTranslateX = startTranslateX + deltaX;
        const newTranslateY = startTranslateY + deltaY;

        // Keep popup within viewport bounds
        const rect = popup.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        const clampedX = Math.max(-rect.width + 100, Math.min(maxX, newTranslateX));
        const clampedY = Math.max(0, Math.min(maxY, newTranslateY));

        popup.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
      }
    }

    function dragEnd() {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'grab';
        popup.style.userSelect = '';
      }
    }
  }

  /**
   * Make popup resizable
   */
  makeResizable(popup) {
    const resizeHandles = popup.querySelectorAll('.yt-ai-resize-handle');
    let isResizing = false;
    let currentHandle = null;
    let startX, startY, startWidth, startHeight;
    let startTranslateX = 0, startTranslateY = 0;

    resizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', startResize);
    });

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);

    function startResize(e) {
      isResizing = true;
      currentHandle = e.target;
      startX = e.clientX;
      startY = e.clientY;

      const rect = popup.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;

      // Get current transform values
      const currentTransform = popup.style.transform;
      const transformMatch = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      if (transformMatch) {
        startTranslateX = parseFloat(transformMatch[1]) || 0;
        startTranslateY = parseFloat(transformMatch[2]) || 0;
      } else {
        startTranslateX = 0;
        startTranslateY = 0;
      }

      popup.style.userSelect = 'none';
      document.body.style.cursor = getResizeCursor(currentHandle.dataset.direction);

      e.preventDefault();
      e.stopPropagation();
    }

    function doResize(e) {
      if (!isResizing || !currentHandle) return;

      const direction = currentHandle.dataset.direction;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newTranslateX = startTranslateX;
      let newTranslateY = startTranslateY;

      // Minimum and maximum dimensions
      const minWidth = 300;
      const minHeight = 200;
      const maxWidth = window.innerWidth - 50;
      const maxHeight = window.innerHeight - 50;

      // Handle different resize directions
      if (direction.includes('e')) {
        newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + deltaX));
      }
      if (direction.includes('w')) {
        const proposedWidth = Math.max(minWidth, startWidth - deltaX);
        if (proposedWidth >= minWidth && proposedWidth <= maxWidth) {
          newWidth = proposedWidth;
          newTranslateX = startTranslateX + deltaX;
        }
      }
      if (direction.includes('s')) {
        newHeight = Math.min(maxHeight, Math.max(minHeight, startHeight + deltaY));
      }
      if (direction.includes('n')) {
        const proposedHeight = Math.max(minHeight, startHeight - deltaY);
        if (proposedHeight >= minHeight && proposedHeight <= maxHeight) {
          newHeight = proposedHeight;
          newTranslateY = startTranslateY + deltaY;
        }
      }

      // Apply the new dimensions
      popup.style.width = newWidth + 'px';
      popup.style.height = newHeight + 'px';

      // Apply the new position using transform
      popup.style.transform = `translate(${newTranslateX}px, ${newTranslateY}px)`;

      e.preventDefault();
    }

    function stopResize() {
      if (isResizing) {
        isResizing = false;
        currentHandle = null;
        popup.style.userSelect = '';
        document.body.style.cursor = '';
      }
    }

    function getResizeCursor(direction) {
      const cursors = {
        'n': 'n-resize',
        's': 's-resize',
        'e': 'e-resize',
        'w': 'w-resize',
        'ne': 'ne-resize',
        'nw': 'nw-resize',
        'se': 'se-resize',
        'sw': 'sw-resize'
      };
      return cursors[direction] || 'default';
    }
  }

  /**
   * Load and display saved prompts
   */
  async loadSavedPrompts() {
    try {
      const result = await chrome.storage.local.get(['savedChatPrompts']);
      const savedPrompts = result.savedChatPrompts || this.getDefaultChatPrompts();
      
      // Save default prompts if none exist
      if (!result.savedChatPrompts) {
        await chrome.storage.local.set({ savedChatPrompts: savedPrompts });
      }
      
      this.displaySavedPrompts(savedPrompts);
    } catch (error) {
      console.error('Error loading saved prompts:', error);
      // Fallback to default prompts
      this.displaySavedPrompts(this.getDefaultChatPrompts());
    }
  }

  /**
   * Get default chat prompts
   */
  getDefaultChatPrompts() {
    return [
      "What are the main points of this video?",
      "Can you summarize this in 3 key takeaways?",
      "What questions does this video answer?",
      "Are there any important timestamps I should know?",
      "What's the most valuable insight from this video?"
    ];
  }

  /**
   * Display saved prompts in the UI
   */
  displaySavedPrompts(prompts) {
    const promptsList = document.getElementById('yt-ai-saved-prompts-list');
    if (!promptsList) return;

    promptsList.innerHTML = '';

    prompts.forEach((prompt, index) => {
      const promptChip = document.createElement('button');
      promptChip.className = 'yt-ai-prompt-chip';
      promptChip.textContent = prompt;
      promptChip.title = prompt; // Show full text on hover
      
      promptChip.addEventListener('click', () => {
        this.insertPromptToChat(prompt);
      });

      promptsList.appendChild(promptChip);
    });
  }

  /**
   * Insert prompt into chat input
   */
  insertPromptToChat(prompt) {
    const chatInput = document.getElementById('yt-ai-chat-input');
    if (!chatInput) return;

    chatInput.value = prompt;
    chatInput.focus();
    
    // Trigger input event for any listeners
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Open saved prompts manager
   */
  openSavedPromptsManager() {
    this.createSavedPromptsModal();
  }

  /**
   * Create and show saved prompts management modal
   */
  async createSavedPromptsModal() {
    // Remove existing modal if any
    const existingModal = document.getElementById('yt-ai-saved-prompts-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const result = await chrome.storage.local.get(['savedChatPrompts']);
    const savedPrompts = result.savedChatPrompts || this.getDefaultChatPrompts();

    const modal = document.createElement('div');
    modal.id = 'yt-ai-saved-prompts-modal';
    modal.className = 'yt-ai-modal';
    modal.innerHTML = `
      <div class="yt-ai-modal-content">
        <div class="yt-ai-modal-header">
          <h3>Manage Quick Prompts</h3>
          <button class="yt-ai-modal-close" id="yt-ai-close-prompts-modal">&times;</button>
        </div>
        <div class="yt-ai-modal-body">
          <div class="yt-ai-prompts-manager">
            <div class="yt-ai-add-prompt-section">
              <input type="text" id="yt-ai-new-prompt-input" placeholder="Enter a new prompt..." maxlength="200">
              <button id="yt-ai-add-prompt-btn" class="yt-ai-btn-primary">Add Prompt</button>
            </div>
            <div class="yt-ai-prompts-list" id="yt-ai-manage-prompts-list">
              <!-- Prompts will be populated here -->
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Populate prompts list
    this.populatePromptsManager(savedPrompts);

    // Add event listeners
    this.setupPromptsManagerEvents(modal, savedPrompts);

    // Show modal
    modal.style.display = 'flex';
  }

  /**
   * Populate prompts manager with current prompts
   */
  populatePromptsManager(prompts) {
    const promptsList = document.getElementById('yt-ai-manage-prompts-list');
    if (!promptsList) return;

    promptsList.innerHTML = '';

    prompts.forEach((prompt, index) => {
      const promptItem = document.createElement('div');
      promptItem.className = 'yt-ai-prompt-item';
      promptItem.innerHTML = `
        <span class="yt-ai-prompt-text">${prompt}</span>
        <div class="yt-ai-prompt-actions">
          <button class="yt-ai-btn-edit" data-index="${index}">Edit</button>
          <button class="yt-ai-btn-delete" data-index="${index}">Delete</button>
        </div>
      `;
      promptsList.appendChild(promptItem);
    });
  }

  /**
   * Setup event listeners for prompts manager
   */
  setupPromptsManagerEvents(modal, prompts) {
    const closeBtn = modal.querySelector('#yt-ai-close-prompts-modal');
    const addBtn = modal.querySelector('#yt-ai-add-prompt-btn');
    const newPromptInput = modal.querySelector('#yt-ai-new-prompt-input');
    const promptsList = modal.querySelector('#yt-ai-manage-prompts-list');

    // Close modal
    closeBtn.addEventListener('click', () => {
      modal.remove();
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Add new prompt
    const addPrompt = async () => {
      const newPrompt = newPromptInput.value.trim();
      if (!newPrompt) return;

      prompts.push(newPrompt);
      await chrome.storage.local.set({ savedChatPrompts: prompts });
      
      newPromptInput.value = '';
      this.populatePromptsManager(prompts);
      this.loadSavedPrompts(); // Refresh the main UI
    };

    addBtn.addEventListener('click', addPrompt);
    newPromptInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addPrompt();
      }
    });

    // Handle edit and delete buttons
    promptsList.addEventListener('click', async (e) => {
      const index = parseInt(e.target.dataset.index);
      if (isNaN(index)) return;

      if (e.target.classList.contains('yt-ai-btn-edit')) {
        const newText = prompt('Edit prompt:', prompts[index]);
        if (newText && newText.trim()) {
          prompts[index] = newText.trim();
          await chrome.storage.local.set({ savedChatPrompts: prompts });
          this.populatePromptsManager(prompts);
          this.loadSavedPrompts(); // Refresh the main UI
        }
      } else if (e.target.classList.contains('yt-ai-btn-delete')) {
        if (confirm('Are you sure you want to delete this prompt?')) {
          prompts.splice(index, 1);
          await chrome.storage.local.set({ savedChatPrompts: prompts });
          this.populatePromptsManager(prompts);
          this.loadSavedPrompts(); // Refresh the main UI
        }
      }
    });
  }

  // Toggle the visibility of saved prompts list
  toggleSavedPrompts() {
    const promptsList = document.getElementById('yt-ai-saved-prompts-list');
    const chevronIcon = document.querySelector('.yt-ai-chevron-icon');
    
    if (!promptsList || !chevronIcon) return;
    
    const isVisible = promptsList.style.display !== 'none';
    
    if (isVisible) {
      promptsList.style.display = 'none';
      chevronIcon.style.transform = 'rotate(-90deg)';
    } else {
      promptsList.style.display = 'block';
      chevronIcon.style.transform = 'rotate(0deg)';
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.youtubeAnalyzer = new YouTubeAnalyzer();
  });
} else {
  window.youtubeAnalyzer = new YouTubeAnalyzer();
}
