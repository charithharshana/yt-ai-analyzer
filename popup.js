// Popup JavaScript
class PopupManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadSettings();
    this.checkCurrentTab();
  }

  setupEventListeners() {
    // Open YouTube button
    document.getElementById('openYouTubeBtn').addEventListener('click', () => {
      this.openYouTube();
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      
      if (response.success) {
        const settings = response.settings;
        
        // Update model display
        const modelName = this.getModelDisplayName(settings.selectedModel);
        document.getElementById('currentModel').textContent = modelName;
        
        // Update API key count
        const keyCount = settings.apiKeys ? settings.apiKeys.length : 0;
        document.getElementById('apiKeyCount').textContent = `${keyCount} configured`;
        
        // Update status based on configuration
        this.updateStatus(settings);
      } else {
        throw new Error(response.error || 'Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      document.getElementById('currentModel').textContent = 'Error loading';
      document.getElementById('apiKeyCount').textContent = 'Error loading';
      this.updateStatus(null, 'error');
    }
  }

  getModelDisplayName(modelId) {
    const modelNames = {
      'gemini-2.5-flash-preview-05-20': 'Gemini 2.5 Flash (05-20)',
      'gemini-2.5-flash-preview-04-17': 'Gemini 2.5 Flash (04-17)',
      'gemini-2.5-pro-preview-05-06': 'Gemini 2.5 Pro (05-06)',
      'gemini-2.5-pro-preview-06-05': 'Gemini 2.5 Pro (06-05)'
    };
    
    return modelNames[modelId] || modelId;
  }

  async checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
        this.updateStatus(null, 'ready', 'YouTube Video Detected', 'Click the AI Analyze button below the video to start analysis');
      }
    } catch (error) {
      console.error('Error checking current tab:', error);
    }
  }

  updateStatus(settings, type = 'default', title = null, description = null) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusTitle = document.getElementById('statusTitle');
    const statusDescription = document.getElementById('statusDescription');
    const statusIcon = statusIndicator.querySelector('.status-icon');

    // Remove existing status classes
    statusIndicator.classList.remove('success', 'warning', 'error');

    if (settings && settings.apiKeys && settings.apiKeys.length === 0) {
      type = 'warning';
      title = 'API Keys Required';
      description = 'Please configure your Gemini API keys in settings to use the analyzer';
      statusIcon.textContent = '⚠️';
    } else if (type === 'ready') {
      type = 'success';
      statusIcon.textContent = '✅';
    } else if (type === 'error') {
      statusIcon.textContent = '❌';
      title = title || 'Configuration Error';
      description = description || 'Please check your settings and try again';
    } else {
      // Default state
      statusIcon.textContent = '📊';
      title = title || 'Ready to Analyze';
      description = description || 'Navigate to a YouTube video and click the AI Analyze button';
    }

    if (type !== 'default') {
      statusIndicator.classList.add(type);
    }

    if (title) statusTitle.textContent = title;
    if (description) statusDescription.textContent = description;
  }

  async openYouTube() {
    try {
      await chrome.tabs.create({
        url: 'https://www.youtube.com',
        active: true
      });
      window.close();
    } catch (error) {
      console.error('Error opening YouTube:', error);
    }
  }

  async openSettings() {
    try {
      // Check if settings page is already open
      const tabs = await chrome.tabs.query({});
      const settingsTab = tabs.find(tab => 
        tab.url && tab.url.includes(chrome.runtime.getURL('settings.html'))
      );

      if (settingsTab) {
        // Focus existing settings tab
        await chrome.tabs.update(settingsTab.id, { active: true });
        await chrome.windows.update(settingsTab.windowId, { focused: true });
      } else {
        // Open new settings tab
        await chrome.tabs.create({
          url: chrome.runtime.getURL('settings.html'),
          active: true
        });
      }
      
      window.close();
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  }

  // Method to refresh popup data
  async refresh() {
    await this.loadSettings();
    await this.checkCurrentTab();
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupManager());
} else {
  new PopupManager();
}

// Listen for tab updates to refresh status
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    // Small delay to ensure popup is ready
    setTimeout(() => {
      if (window.popupManager) {
        window.popupManager.checkCurrentTab();
      }
    }, 100);
  }
});

// Listen for storage changes to update settings display
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.settings) {
    if (window.popupManager) {
      window.popupManager.loadSettings();
    }
  }
});
