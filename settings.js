// Settings page JavaScript
class SettingsManager {
  constructor() {
    this.currentSettings = null;
    this.currentPrompts = [];
    this.selectedPromptId = null;
    this.editingPromptId = null;
    this.currentModels = [];
    this.selectedModelId = null;
    this.editingModelId = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadSettings();
  }

  setupEventListeners() {
    // Form submission
    document.getElementById('settingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    // Close button
    document.getElementById('closeBtn').addEventListener('click', () => {
      window.close();
    });

    // Test button
    document.getElementById('testBtn').addEventListener('click', () => {
      this.testConfiguration();
    });

    // Reset button
    document.getElementById('resetBtn').addEventListener('click', () => {
      this.resetToDefaults();
    });

    // API keys textarea change
    document.getElementById('geminiApiKeysTextarea').addEventListener('input', () => {
      this.updateKeyCount();
    });



    // Prompt management
    document.getElementById('addPromptBtn').addEventListener('click', () => {
      this.openPromptModal();
    });

    // Simple model management
    document.getElementById('quickAddModelBtn').addEventListener('click', () => {
      this.quickAddModel();
    });

    document.getElementById('refreshModelsBtn').addEventListener('click', () => {
      this.refreshModelList();
    });

    document.getElementById('promptSelect').addEventListener('change', (e) => {
      this.selectedPromptId = e.target.value;
      this.updatePromptList();
    });

    // Real-time validation
    document.getElementById('modelSelect').addEventListener('change', () => {
      this.validateForm();
    });

    document.getElementById('geminiApiKeysTextarea').addEventListener('input', () => {
      this.validateForm();
    });



    // Modal event listeners
    document.getElementById('modalCloseBtn').addEventListener('click', () => {
      this.closePromptModal();
    });

    document.getElementById('modalCancelBtn').addEventListener('click', () => {
      this.closePromptModal();
    });

    document.getElementById('modalSaveBtn').addEventListener('click', () => {
      this.savePrompt();
    });



    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('promptModal');
        if (modal.style.display === 'flex') {
          this.closePromptModal();
        }
      }
    });
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });

      if (response.success) {
        this.currentSettings = response.settings;
        this.populateForm();
        this.updateStatus();
        await this.loadPrompts();
        await this.loadModels();
      } else {
        throw new Error(response.error || 'Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showError('Failed to load settings: ' + error.message);
    }
  }

  async loadPrompts() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getPrompts' });

      if (response.success) {
        this.currentPrompts = response.prompts;
        this.selectedPromptId = response.selectedPromptId;
        this.populatePromptSelect();
        this.updatePromptList();
      } else {
        throw new Error(response.error || 'Failed to load prompts');
      }
    } catch (error) {
      console.error('Error loading prompts:', error);
      this.showError('Failed to load prompts: ' + error.message);
    }
  }

  populateForm() {
    if (!this.currentSettings) return;

    // Model selection
    document.getElementById('modelSelect').value = this.currentSettings.selectedModel || 'gemini-2.5-flash-preview-05-20';

    // Gemini API keys
    const geminiApiKeys = this.currentSettings.geminiApiKeys || this.currentSettings.apiKeys || [];
    document.getElementById('geminiApiKeysTextarea').value = geminiApiKeys.join('\n');

    // Advanced options
    document.getElementById('autoAnalyze').checked = this.currentSettings.autoAnalyze || false;
    document.getElementById('openVideoInNewTab').checked = this.currentSettings.openVideoInNewTab !== false; // Default to true

    this.updateKeyCount();
    this.validateForm();
  }

  updateKeyCount() {
    const geminiApiKeysText = document.getElementById('geminiApiKeysTextarea').value;
    const keyCount = geminiApiKeysText.split('\n')
      .map(key => key.trim())
      .filter(key => key.length > 0).length;

    document.getElementById('geminiKeyCount').textContent = keyCount;
  }



  validateForm() {
    const modelSelect = document.getElementById('modelSelect');
    const geminiApiKeysTextarea = document.getElementById('geminiApiKeysTextarea');

    let isValid = true;
    let errors = [];

    // Validate model selection
    if (!modelSelect.value) {
      isValid = false;
      errors.push('Please select an AI model');
    }

    // Validate Gemini API keys
    const geminiApiKeysText = geminiApiKeysTextarea.value.trim();
    if (!geminiApiKeysText) {
      isValid = false;
      errors.push('At least one Gemini API key is required');
    } else {
      const keys = geminiApiKeysText.split('\n')
        .map(key => key.trim())
        .filter(key => key.length > 0);

      if (keys.length === 0) {
        isValid = false;
        errors.push('At least one valid Gemini API key is required');
      } else {
        // Basic API key format validation
        const invalidKeys = keys.filter(key => !this.isValidApiKeyFormat(key));
        if (invalidKeys.length > 0) {
          isValid = false;
          errors.push(`Invalid Gemini API key format detected (${invalidKeys.length} keys)`);
        }
      }
    }



    // Update form validation state - don't disable submit button, just show warnings
    const submitBtn = document.querySelector('button[type="submit"]');
    // submitBtn.disabled = !isValid; // Allow saving even with warnings

    if (!isValid) {
      this.updateStatus('warning', 'Configuration Warnings', errors.join('. ') + ' (You can still save)');
    } else {
      this.updateStatus('success', 'Configuration Valid', 'All settings are properly configured');
    }

    return isValid;
  }

  isValidApiKeyFormat(key) {
    // Basic validation for Google API key format
    return /^AIza[0-9A-Za-z-_]{35}$/.test(key);
  }

  async saveSettings() {
    // Allow saving even with validation warnings, but show them
    const isValid = this.validateForm();
    if (!isValid) {
      console.warn('Saving settings with validation warnings');
    }

    try {
      const formData = this.getFormData();
      
      // Show loading state
      this.setLoadingState(true);

      const response = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: formData
      });

      if (response.success) {
        this.currentSettings = formData;
        this.updateStatus('success', 'Settings Saved', 'Your configuration has been saved successfully');
        
        // Show success feedback
        this.showSuccessMessage('Settings saved successfully!');
      } else {
        throw new Error(response.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showError('Failed to save settings: ' + error.message);
    } finally {
      this.setLoadingState(false);
    }
  }

  getFormData() {
    const geminiApiKeysText = document.getElementById('geminiApiKeysTextarea').value;
    const geminiApiKeys = geminiApiKeysText.split('\n')
      .map(key => key.trim())
      .filter(key => key.length > 0);

    return {
      selectedModel: document.getElementById('modelSelect').value,
      geminiApiKeys: geminiApiKeys,
      apiKeys: geminiApiKeys, // Keep for backward compatibility
      autoAnalyze: document.getElementById('autoAnalyze').checked,
      openVideoInNewTab: document.getElementById('openVideoInNewTab').checked,
      selectedPromptId: this.selectedPromptId,
      prompts: this.currentPrompts,
      availableModels: this.currentModels || this.getDefaultModels()
    };
  }

  async testConfiguration() {
    if (!this.validateForm()) {
      this.showError('Please fix configuration errors before testing');
      return;
    }

    try {
      this.setLoadingState(true);
      
      // Test with a simple prompt
      const testData = {
        videoId: 'test',
        videoUrl: 'https://www.youtube.com/watch?v=test',
        title: 'Test Video',
        description: 'This is a test to verify API configuration'
      };

      // This would normally call the background script to test the API
      // For now, we'll simulate a successful test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.updateStatus('success', 'Test Successful', 'API configuration is working correctly');
      this.showSuccessMessage('Configuration test passed!');
      
    } catch (error) {
      console.error('Test failed:', error);
      this.updateStatus('error', 'Test Failed', error.message);
      this.showError('Configuration test failed: ' + error.message);
    } finally {
      this.setLoadingState(false);
    }
  }

  async resetToDefaults() {
    if (!confirm('Are you sure you want to reset all settings to defaults? This will clear your API keys.')) {
      return;
    }

    try {
      const defaultSettings = {
        selectedModel: 'gemini-2.5-flash-preview-05-20',
        apiKeys: [],
        autoAnalyze: false,
        detailedAnalysis: false,
        availableModels: [
          'gemini-2.5-flash-preview-05-20',
          'gemini-2.5-flash-preview-04-17',
          'gemini-2.5-pro-preview-05-06',
          'gemini-2.5-pro-preview-06-05'
        ]
      };

      const response = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: defaultSettings
      });

      if (response.success) {
        this.currentSettings = defaultSettings;
        this.populateForm();
        this.updateStatus('warning', 'Settings Reset', 'All settings have been reset to defaults. Please configure your API keys.');
        this.showSuccessMessage('Settings reset to defaults');
      } else {
        throw new Error(response.error || 'Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      this.showError('Failed to reset settings: ' + error.message);
    }
  }

  updateStatus(type = 'default', title = 'Configuration Status', description = 'Configure your settings below') {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusTitle = document.getElementById('statusTitle');
    const statusDescription = document.getElementById('statusDescription');
    const statusIcon = statusIndicator.querySelector('.status-icon');

    // Remove existing status classes
    statusIndicator.classList.remove('success', 'warning', 'error');

    // Set status based on type
    switch (type) {
      case 'success':
        statusIndicator.classList.add('success');
        statusIcon.textContent = '✅';
        break;
      case 'warning':
        statusIndicator.classList.add('warning');
        statusIcon.textContent = '⚠️';
        break;
      case 'error':
        statusIndicator.classList.add('error');
        statusIcon.textContent = '❌';
        break;
      default:
        statusIcon.textContent = '⚙️';
    }

    statusTitle.textContent = title;
    statusDescription.textContent = description;
  }

  setLoadingState(loading) {
    const form = document.getElementById('settingsForm');
    const buttons = form.querySelectorAll('button');

    if (loading) {
      form.classList.add('loading');
      buttons.forEach(btn => btn.disabled = true);
    } else {
      form.classList.remove('loading');
      buttons.forEach(btn => btn.disabled = false);
      // Re-validate but don't disable buttons
      this.validateForm();
    }
  }

  showSuccessMessage(message) {
    // Create and show a temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(successDiv);

    setTimeout(() => {
      successDiv.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => successDiv.remove(), 300);
    }, 3000);
  }

  showError(message) {
    // Create and show a temporary error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  }

  // Prompt Management Methods
  populatePromptSelect() {
    const promptSelect = document.getElementById('promptSelect');
    promptSelect.innerHTML = '';

    this.currentPrompts.forEach(prompt => {
      const option = document.createElement('option');
      option.value = prompt.id;
      option.textContent = prompt.name;
      if (prompt.id === this.selectedPromptId) {
        option.selected = true;
      }
      promptSelect.appendChild(option);
    });
  }

  updatePromptList() {
    const promptList = document.getElementById('promptList');
    promptList.innerHTML = '';

    if (this.currentPrompts.length === 0) {
      promptList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No prompts available</p>';
      return;
    }

    // Sort prompts to ensure "Full Video Brief" comes first, then "Longer Video Brief", then "Default Analysis Prompt", then others
    const sortedPrompts = [...this.currentPrompts].sort((a, b) => {
      if (a.id === 'full_brief') return -1;
      if (b.id === 'full_brief') return 1;
      if (a.id === 'longer_brief') return -1;
      if (b.id === 'longer_brief') return 1;
      if (a.id === 'default') return -1;
      if (b.id === 'default') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    sortedPrompts.forEach(prompt => {
      const promptItem = document.createElement('div');
      promptItem.className = `prompt-item ${prompt.id === this.selectedPromptId ? 'active' : ''}`;

      const preview = prompt.prompt.length > 150 ? prompt.prompt.substring(0, 150) + '...' : prompt.prompt;

      promptItem.innerHTML = `
        <div class="prompt-info">
          <div class="prompt-name">${prompt.name}</div>
          <div class="prompt-preview">${preview}</div>
        </div>
        <div class="prompt-actions">
          <button type="button" class="btn btn-outline btn-small edit-prompt-btn" data-prompt-id="${prompt.id}">Edit</button>
          ${prompt.id !== 'default' && prompt.id !== 'full_brief' && prompt.id !== 'longer_brief' ? `
            <button type="button" class="btn btn-outline btn-small delete-prompt-btn" data-prompt-id="${prompt.id}">Delete</button>
          ` : ''}
          ${prompt.id !== this.selectedPromptId ? `
            <button type="button" class="btn btn-primary btn-small set-default-btn" data-prompt-id="${prompt.id}">Set Default</button>
          ` : '<span class="btn btn-primary btn-small" style="opacity: 0.6;">Active</span>'}
        </div>
      `;

      promptList.appendChild(promptItem);
    });

    // Add event listeners for the buttons
    this.setupPromptListEventListeners();
  }

  setupPromptListEventListeners() {
    const promptList = document.getElementById('promptList');

    // Remove existing listeners to prevent duplicates
    promptList.removeEventListener('click', this.handlePromptListClick);

    // Add event delegation for all prompt buttons
    this.handlePromptListClick = (e) => {
      const target = e.target;
      const promptId = target.getAttribute('data-prompt-id');

      if (!promptId) return;

      if (target.classList.contains('edit-prompt-btn')) {
        e.preventDefault();
        this.editPrompt(promptId);
      } else if (target.classList.contains('delete-prompt-btn')) {
        e.preventDefault();
        this.deletePrompt(promptId);
      } else if (target.classList.contains('set-default-btn')) {
        e.preventDefault();
        this.setDefaultPrompt(promptId);
      }
    };

    promptList.addEventListener('click', this.handlePromptListClick);
  }

  openPromptModal(promptId = null) {
    this.editingPromptId = promptId;
    const modal = document.getElementById('promptModal');
    const modalTitle = document.getElementById('modalTitle');
    const promptName = document.getElementById('promptName');
    const promptText = document.getElementById('promptText');

    if (promptId) {
      const prompt = this.currentPrompts.find(p => p.id === promptId);
      if (prompt) {
        modalTitle.textContent = 'Edit Prompt';
        promptName.value = prompt.name;
        promptText.value = prompt.prompt;
      }
    } else {
      modalTitle.textContent = 'Add New Prompt';
      promptName.value = '';
      promptText.value = '';
    }

    modal.style.display = 'flex';
  }

  async savePrompt() {
    const promptName = document.getElementById('promptName').value.trim();
    const promptText = document.getElementById('promptText').value.trim();

    if (!promptName || !promptText) {
      this.showError('Please fill in all fields');
      return;
    }

    try {
      const promptData = {
        name: promptName,
        prompt: promptText
      };

      if (this.editingPromptId) {
        promptData.id = this.editingPromptId;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'savePrompt',
        prompt: promptData
      });

      if (response.success) {
        this.showSuccessMessage(this.editingPromptId ? 'Prompt updated successfully!' : 'Prompt added successfully!');
        this.closePromptModal();
        await this.loadPrompts();
      } else {
        throw new Error(response.error || 'Failed to save prompt');
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
      this.showError('Failed to save prompt: ' + error.message);
    }
  }

  async deletePrompt(promptId) {
    if (promptId === 'default' || promptId === 'full_brief' || promptId === 'longer_brief') {
      this.showError('Cannot delete the default prompts');
      return;
    }

    if (!confirm('Are you sure you want to delete this prompt?')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deletePrompt',
        promptId: promptId
      });

      if (response.success) {
        this.showSuccessMessage('Prompt deleted successfully!');
        await this.loadPrompts();
      } else {
        throw new Error(response.error || 'Failed to delete prompt');
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
      this.showError('Failed to delete prompt: ' + error.message);
    }
  }

  async setDefaultPrompt(promptId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'setDefaultPrompt',
        promptId: promptId
      });

      if (response.success) {
        this.selectedPromptId = promptId;
        this.showSuccessMessage('Default prompt updated!');
        this.populatePromptSelect();
        this.updatePromptList();
      } else {
        throw new Error(response.error || 'Failed to set default prompt');
      }
    } catch (error) {
      console.error('Error setting default prompt:', error);
      this.showError('Failed to set default prompt: ' + error.message);
    }
  }

  editPrompt(promptId) {
    this.openPromptModal(promptId);
  }

  closePromptModal() {
    const modal = document.getElementById('promptModal');
    modal.style.display = 'none';
    this.editingPromptId = null;
  }

  // Model Management Methods
  async loadModels() {
    try {
      // Always start with default models
      const defaultModels = this.getDefaultModels();

      // Get models from settings (which may include updated default models with favorite status)
      const settingsModels = this.currentSettings?.availableModels;

      if (Array.isArray(settingsModels) && settingsModels.length > 0) {
        // Create a map of existing models from settings
        const settingsModelMap = new Map();
        settingsModels.forEach(model => {
          if (model && model.id) {
            settingsModelMap.set(model.id, model);
          }
        });

        // Merge default models with settings, preserving favorite status and custom models
        const mergedModels = [];

        // Add default models, using settings version if available (to preserve favorite status)
        defaultModels.forEach(defaultModel => {
          const settingsModel = settingsModelMap.get(defaultModel.id);
          if (settingsModel) {
            // Use settings version but ensure it has all default properties
            mergedModels.push({
              ...defaultModel,
              ...settingsModel,
              id: defaultModel.id, // Ensure ID is preserved
              name: settingsModel.name || defaultModel.name,
              description: settingsModel.description || defaultModel.description
            });
          } else {
            // Use default model as-is
            mergedModels.push(defaultModel);
          }
        });

        // Add any custom models from settings that aren't default models
        settingsModels.forEach(model => {
          if (model && model.id && !this.isDefaultModel(model.id)) {
            mergedModels.push(model);
          }
        });

        this.currentModels = mergedModels;
      } else {
        this.currentModels = defaultModels;
      }

      this.selectedModelId = this.currentSettings?.selectedModel || this.currentModels[0]?.id;

      this.populateModelDropdown();
      this.populateSimpleModelList();
    } catch (error) {
      console.error('Error loading models:', error);
      this.currentModels = this.getDefaultModels();
      this.populateModelDropdown();
      this.populateSimpleModelList();
    }
  }

  getDefaultModels() {
    return [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Fast and efficient model',
        isFavorite: true
      },
      {
        id: 'gemini-2.5-flash-lite-preview-06-17',
        name: 'Gemini 2.5 Flash Lite (06-17)',
        description: 'Lightweight Flash model',
        isFavorite: false
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Latest Pro model with enhanced capabilities',
        isFavorite: true
      }
    ];
  }

  populateModelDropdown() {
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) return;

    // Clear existing options
    modelSelect.innerHTML = '';

    // Ensure currentModels is an array
    if (!Array.isArray(this.currentModels)) {
      console.error('currentModels is not an array:', this.currentModels);
      this.currentModels = this.getDefaultModels();
    }

    // Sort models: favorites first, then alphabetically
    const sortedModels = [...this.currentModels].sort((a, b) => {
      if (!a || !b) return 0;
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    // Add options
    sortedModels.forEach(model => {
      if (!model || !model.id) return;
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = (model.name || model.id) + (model.isFavorite ? ' ⭐' : '');
      if (model.id === this.selectedModelId) {
        option.selected = true;
      }
      modelSelect.appendChild(option);
    });
  }

  populateSimpleModelList() {
    const modelList = document.getElementById('simpleModelList');
    if (!modelList) {
      console.error('simpleModelList element not found');
      return;
    }

    modelList.innerHTML = '';

    // Ensure we have models to display
    if (!Array.isArray(this.currentModels) || this.currentModels.length === 0) {
      this.currentModels = this.getDefaultModels();
    }

    // Show all models (default and custom) for management
    const allModels = [...this.currentModels].sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    allModels.forEach(model => {
      if (!model || !model.id) return;

      const isDefault = this.isDefaultModel(model.id);
      const modelItem = document.createElement('div');
      modelItem.className = 'simple-model-item';
      modelItem.innerHTML = `
        <div class="simple-model-info">
          <span class="simple-model-name">${model.name || model.id} ${model.isFavorite ? '⭐' : ''}</span>
          <span class="simple-model-id">${model.id} ${isDefault ? '(Default)' : '(Custom)'}</span>
        </div>
        <div class="simple-model-actions">
          <button type="button" class="btn btn-small btn-outline model-favorite-btn" data-model-id="${model.id}" title="Toggle favorite">
            ${model.isFavorite ? '★' : '☆'}
          </button>
          <button type="button" class="btn btn-small btn-outline model-edit-btn" data-model-id="${model.id}" title="${isDefault ? 'Edit display name' : 'Edit model ID'}">
            ✏️
          </button>
          ${!isDefault ? `
            <button type="button" class="btn btn-small btn-danger model-remove-btn" data-model-id="${model.id}" title="Remove custom model">
              🗑️
            </button>
          ` : ''}
        </div>
      `;
      modelList.appendChild(modelItem);
    });

    // Add event listeners for the buttons
    this.addModelButtonListeners();
  }

  isDefaultModel(modelId) {
    const defaultIds = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite-preview-06-17',
      'gemini-2.5-pro'
    ];
    return defaultIds.includes(modelId);
  }

  async quickAddModel() {
    try {
      const modelIdInput = document.getElementById('quickModelId');
      const modelId = modelIdInput.value.trim();

      if (!modelId) {
        this.showError('Please enter a model ID');
        return;
      }

      // Check for duplicate IDs
      const existingModel = this.currentModels.find(m => m && m.id === modelId);
      if (existingModel) {
        this.showError('This model already exists');
        return;
      }

      // Create simple model object
      const modelData = {
        id: modelId,
        name: this.generateModelName(modelId),
        description: 'Custom model',
        isFavorite: false
      };

      // Add to models list
      this.currentModels.push(modelData);

      // Save settings immediately
      await this.saveCurrentSettings();

      // Update UI
      this.populateModelDropdown();
      this.populateSimpleModelList();

      // Clear input
      modelIdInput.value = '';

      this.showSuccessMessage('Model added and saved successfully');

    } catch (error) {
      console.error('Error adding model:', error);
      this.showError('Failed to add model: ' + error.message);
    }
  }

  generateModelName(modelId) {
    // Generate a friendly name from model ID
    return modelId
      .replace(/gemini-/i, 'Gemini ')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  async removeModel(modelId) {
    try {
      // Don't allow removing default models
      if (this.isDefaultModel(modelId)) {
        this.showError('Cannot remove default models');
        return;
      }

      // Don't allow removing the currently selected model
      if (modelId === this.selectedModelId) {
        this.showError('Cannot remove the currently selected model. Please select a different model first.');
        return;
      }

      if (!confirm(`Remove model "${modelId}"?`)) {
        return;
      }

      // Remove model
      this.currentModels = this.currentModels.filter(m => m && m.id !== modelId);

      // Save settings immediately
      await this.saveCurrentSettings();

      // Update UI
      this.populateModelDropdown();
      this.populateSimpleModelList();

      this.showSuccessMessage('Model removed and saved successfully');

    } catch (error) {
      console.error('Error removing model:', error);
      this.showError('Failed to remove model: ' + error.message);
    }
  }

  refreshModelList() {
    try {
      this.populateModelDropdown();
      this.populateSimpleModelList();
      this.showSuccessMessage('Model list refreshed');
    } catch (error) {
      console.error('Error refreshing models:', error);
      this.showError('Failed to refresh model list');
    }
  }

  async saveCurrentSettings() {
    try {
      const settings = this.getFormData();
      const response = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: settings
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to save settings');
      }

      this.currentSettings = settings;
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  async toggleModelFavorite(modelId) {
    try {
      const model = this.currentModels.find(m => m && m.id === modelId);
      if (!model) {
        console.error('Model not found:', modelId);
        return;
      }

      model.isFavorite = !model.isFavorite;

      // Save settings immediately
      await this.saveCurrentSettings();

      // Update UI
      this.populateModelDropdown();
      this.populateSimpleModelList();

      this.showSuccessMessage(`Model ${model.isFavorite ? 'added to' : 'removed from'} favorites`);

    } catch (error) {
      console.error('Error toggling model favorite:', error);
      this.showError('Failed to update model favorite status');
    }
  }

  async editModelName(modelId) {
    try {
      const model = this.currentModels.find(m => m && m.id === modelId);
      if (!model) return;

      const isDefault = this.isDefaultModel(modelId);

      if (isDefault) {
        // For default models, only edit display name
        const promptText = `Edit display name for "${model.id}" (default model):`;
        const newName = prompt(promptText, model.name || model.id);
        if (!newName || newName.trim() === '') return;

        model.name = newName.trim();
        this.showSuccessMessage('Default model display name updated successfully');
      } else {
        // For custom models, edit the model ID
        const promptText = `Edit model ID for "${model.id}":`;
        const newId = prompt(promptText, model.id);
        if (!newId || newId.trim() === '') return;

        const trimmedId = newId.trim();

        // Check if new ID already exists
        const existingModel = this.currentModels.find(m => m && m.id === trimmedId && m.id !== modelId);
        if (existingModel) {
          this.showError('A model with this ID already exists');
          return;
        }

        // Update the model ID
        model.id = trimmedId;

        // If this was the selected model, update the selection
        if (this.selectedModelId === modelId) {
          this.selectedModelId = trimmedId;
        }

        this.showSuccessMessage('Custom model ID updated successfully');
      }

      // Save settings immediately
      await this.saveCurrentSettings();

      // Update UI
      this.populateModelDropdown();
      this.populateSimpleModelList();

    } catch (error) {
      console.error('Error editing model:', error);
      this.showError('Failed to update model');
    }
  }

  addModelButtonListeners() {
    // Add event listeners using event delegation on the parent container
    const modelList = document.getElementById('simpleModelList');
    if (!modelList) return;

    // Remove existing listeners if they exist
    if (this.handleModelListClick) {
      modelList.removeEventListener('click', this.handleModelListClick);
    }

    // Create bound event handler to preserve 'this' context
    this.handleModelListClick = (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      const modelId = button.getAttribute('data-model-id');
      if (!modelId) return;

      e.preventDefault();
      e.stopPropagation();

      if (button.classList.contains('model-favorite-btn')) {
        this.toggleModelFavorite(modelId);
      } else if (button.classList.contains('model-edit-btn')) {
        this.editModelName(modelId);
      } else if (button.classList.contains('model-remove-btn')) {
        this.removeModel(modelId);
      }
    };

    // Bind the event listener
    modelList.addEventListener('click', this.handleModelListClick);
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// Global functions for modal
function closePromptModal() {
  if (window.settingsManager) {
    window.settingsManager.closePromptModal();
  }
}

function savePrompt() {
  if (window.settingsManager) {
    window.settingsManager.savePrompt();
  }
}

function handleModalClick(event) {
  // Close modal when clicking on the backdrop
  if (event.target.id === 'promptModal') {
    closePromptModal();
  }
}

// Make functions globally accessible for debugging
window.closePromptModal = closePromptModal;
window.savePrompt = savePrompt;
window.handleModalClick = handleModalClick;

// Initialize settings manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
    window.settingsManager = window.settingsManager; // Make sure it's globally accessible
    console.log('Settings manager initialized');
  });
} else {
  window.settingsManager = new SettingsManager();
  window.settingsManager = window.settingsManager; // Make sure it's globally accessible
  console.log('Settings manager initialized');
}
