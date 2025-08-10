// Home page content script for YouTube AI Video Analyzer
class YouTubeHomeAnalyzer {
  constructor() {
    this.analyzeButton = null;
    this.init();
  }

  init() {
    // Wait for YouTube home page to load
    this.waitForHomePage();
    
    // Listen for navigation changes in YouTube SPA
    this.observeNavigation();
  }

  waitForHomePage() {
    const checkForHomePage = () => {
      // Check if we're on the home page
      if (this.isHomePage()) {
        console.log('YouTube home page detected');
        setTimeout(() => {
          this.injectAnalyzeButtonsOnVideos();
        }, 2000); // Wait for page to fully load
      }
    };

    // Check immediately
    checkForHomePage();

    // Check periodically for SPA navigation and new videos
    setInterval(checkForHomePage, 5000);
  }

  isHomePage() {
    const url = window.location.href;
    return url === 'https://www.youtube.com/' || 
           url.startsWith('https://www.youtube.com/?') ||
           url.startsWith('https://www.youtube.com/#');
  }

  observeNavigation() {
    // Listen for YouTube's navigation events
    let lastUrl = location.href;

    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        
        // Wait a bit for YouTube to update the page
        setTimeout(() => {
          if (this.isHomePage()) {
            this.injectAnalyzeButtonsOnVideos();
          } else {
            this.removeAllAnalyzeButtons();
          }
        }, 1000);
      }
    }).observe(document, { subtree: true, childList: true });

    // Also listen for popstate events
    window.addEventListener('popstate', () => {
      setTimeout(() => {
        if (this.isHomePage()) {
          this.injectAnalyzeButtonsOnVideos();
        } else {
          this.removeAllAnalyzeButtons();
        }
      }, 1000);
    });
  }

  injectAnalyzeButtonsOnVideos() {
    console.log('Injecting analyze buttons on video thumbnails...');

    // Find all video thumbnails on the page
    const videoSelectors = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-grid-video-renderer'
    ];

    let videoElements = [];
    for (const selector of videoSelectors) {
      const elements = document.querySelectorAll(selector);
      videoElements = videoElements.concat(Array.from(elements));
    }

    console.log(`Found ${videoElements.length} video elements`);

    videoElements.forEach((videoElement, index) => {
      // Skip if already has analyze button
      if (videoElement.querySelector('.yt-video-analyze-btn')) {
        return;
      }

      // Find the video link to get the video ID
      const videoLink = videoElement.querySelector('a[href*="/watch?v="]');
      if (!videoLink) {
        return;
      }

      const videoId = this.extractVideoIdFromUrl(videoLink.href);
      if (!videoId) {
        return;
      }

      // Find thumbnail container
      const thumbnailContainer = videoElement.querySelector('ytd-thumbnail, .ytd-thumbnail');
      if (!thumbnailContainer) {
        return;
      }

      // Create and inject analyze button
      const analyzeBtn = this.createVideoAnalyzeButton(videoId, videoLink.href);

      // Position the button on the thumbnail
      analyzeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 100;
      `;

      // Make thumbnail container relative if not already
      const thumbnailStyle = window.getComputedStyle(thumbnailContainer);
      if (thumbnailStyle.position === 'static') {
        thumbnailContainer.style.position = 'relative';
      }

      thumbnailContainer.appendChild(analyzeBtn);
    });
  }

  createVideoAnalyzeButton(videoId, videoUrl) {
    const button = document.createElement('button');
    button.className = 'yt-video-analyze-btn';
    button.title = 'Analyze this video with AI';
    button.innerHTML = `A`;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleVideoAnalyzeClick(videoId, videoUrl);
    });

    return button;
  }

  async handleVideoAnalyzeClick(videoId, videoUrl) {
    try {
      console.log(`Analyzing video: ${videoId}`);

      // Get settings to determine tab behavior
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      const settings = response.success ? response.settings : {};
      const openInNewTab = settings.openVideoInNewTab !== false; // Default to true

      // Create the full video URL with a special parameter to force analysis
      const fullVideoUrl = `https://www.youtube.com/watch?v=${videoId}&autoAnalyze=true`;

      if (openInNewTab) {
        // Open in new tab
        const newTab = window.open(fullVideoUrl, '_blank');
        if (newTab) {
          console.log('Opened video in new tab for forced analysis');
        }
      } else {
        // Open in current tab
        window.location.href = fullVideoUrl;
      }

    } catch (error) {
      console.error('Error in video analyze click:', error);
      alert('Error analyzing video: ' + error.message);
    }
  }

  extractVideoIdFromUrl(url) {
    try {
      // Handle various YouTube URL formats
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting video ID:', error);
      return null;
    }
  }

  removeAllAnalyzeButtons() {
    // Remove all analyze buttons from video thumbnails
    const analyzeButtons = document.querySelectorAll('.yt-video-analyze-btn');
    analyzeButtons.forEach(button => {
      button.remove();
    });

    console.log(`Removed ${analyzeButtons.length} analyze buttons`);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new YouTubeHomeAnalyzer());
} else {
  new YouTubeHomeAnalyzer();
}
