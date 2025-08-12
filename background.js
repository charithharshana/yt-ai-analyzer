// Background script for YouTube AI Video Analyzer
// Import the YouTube Transcript API
importScripts('youtube-transcript.js');

class GeminiAPI {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.currentKeyIndex = 0;
  }

  async getSettings() {
    // Get settings from sync storage and prompts from local storage
    const [syncResult, localResult] = await Promise.all([
      chrome.storage.sync.get(['settings']),
      chrome.storage.local.get(['prompts'])
    ]);
    
    const defaultSettings = {
      apiKeys: [],
      geminiApiKeys: [],
      youtubeApiKey: '',
      selectedModel: 'gemini-2.5-pro',
      autoAnalyze: false,
      openVideoInNewTab: true,
      availableModels: [
        {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          description: 'Latest Pro model with enhanced capabilities',
          isFavorite: true
        },
        {
          id: 'gemini-2.5-pro-preview-05-06',
          name: 'Gemini 2.5 Pro (05-06)',
          description: 'Pro model preview version',
          isFavorite: false
        },
        {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          description: 'Fast and efficient model',
          isFavorite: true
        },
        {
          id: 'gemini-2.5-flash-preview-04-17',
          name: 'Gemini 2.5 Flash (04-17)',
          description: 'Flash model preview version',
          isFavorite: false
        },
        {
          id: 'gemini-2.5-flash-lite-preview-06-17',
          name: 'Gemini 2.5 Flash Lite (06-17)',
          description: 'Lightweight Flash model',
          isFavorite: false
        }
      ],
      prompts: []
    };
    
    const settings = syncResult.settings || defaultSettings;
    
    // Get prompts from local storage
    const prompts = localResult.prompts || [];
    settings.prompts = prompts;
    
    return settings;
  }

  async getNextApiKey() {
    const settings = await this.getSettings();
    const apiKeys = settings.geminiApiKeys || settings.apiKeys || [];

    if (apiKeys.length === 0) {
      throw new Error('No Gemini API keys configured. Please add API keys in settings.');
    }

    const apiKey = apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % apiKeys.length;

    return apiKey;
  }

  async analyzeVideo(videoData) {
    const settings = await this.getSettings();
    const model = settings.selectedModel;

    // Get the method-specific prompt template, fallback to global selected prompt
    const methodPromptId = settings.methodSpecificPrompts?.transcript || settings.selectedPromptId || 'full_brief';
    const selectedPrompt = settings.prompts.find(p => p.id === methodPromptId) || settings.prompts[0];

    if (!selectedPrompt) {
      throw new Error('No analysis prompt configured. Please check your settings.');
    }

    // Create prompt using the selected template
    let prompt = selectedPrompt.prompt;

    // Replace variables in the prompt
    prompt = prompt.replace(/\{title\}/g, videoData.title || 'Unknown Title');
    prompt = prompt.replace(/\{description\}/g, videoData.description || 'No description available');
    prompt = prompt.replace(/\{videoUrl\}/g, videoData.videoUrl || '');

    // Add video metadata to the prompt
    prompt += `

Video Title: ${videoData.title}
Video Description: ${videoData.description}
Video URL: ${videoData.videoUrl}`;

    if (videoData.transcript && videoData.transcript !== 'No transcript available') {
      // Significantly increase transcript length limit for complete analysis
      const maxTranscriptLength = 100000; // Increased from 20000 to 100000 characters
      let transcript = videoData.transcript;

      // Only truncate if absolutely necessary (very long transcripts)
      if (transcript.length > maxTranscriptLength) {
        console.warn(`Transcript is very long (${transcript.length} chars), truncating to ${maxTranscriptLength} chars`);
        transcript = transcript.substring(0, maxTranscriptLength) + '\n\n[Note: Transcript truncated due to length. Analysis based on first portion of video.]';
      } else {
        console.log(`Using complete transcript (${transcript.length} characters)`);
      }

      // Replace transcript variable in prompt
      prompt = prompt.replace(/\{transcript\}/g, transcript);

      // If no transcript variable was found, append transcript
      if (!selectedPrompt.prompt.includes('{transcript}')) {
        prompt += `

Here is the complete YouTube video transcript with timestamps:

${transcript}`;
      }
    } else {
      // Replace transcript variable with no transcript message
      prompt = prompt.replace(/\{transcript\}/g, 'No transcript available for this video.');

      prompt += `

Note: No transcript was available for this video. Please provide an analysis based on the title and description following the same format above, but note that specific timestamps cannot be provided due to lack of transcript.`;
    }

    try {
      // Log the prompt being sent to verify transcript inclusion
      console.log('=== GEMINI API PROMPT DEBUG ===');
      console.log('Prompt length:', prompt.length);
      console.log('Contains transcript:', prompt.includes('Video Transcript with Timestamps:') || prompt.includes('[') && prompt.includes(']'));
      if (videoData.transcript && videoData.transcript !== 'No transcript available') {
        console.log('Original transcript length:', videoData.transcript.length);
        console.log('First 200 chars of transcript:', videoData.transcript.substring(0, 200));
        console.log('Last 200 chars of transcript:', videoData.transcript.substring(videoData.transcript.length - 200));

        // Count transcript segments
        const segmentCount = (videoData.transcript.match(/\[[\d:]+\]/g) || []).length;
        console.log('Transcript segments found:', segmentCount);

        // Check if transcript was truncated
        if (prompt.includes('[Note: Transcript truncated due to length')) {
          console.warn('⚠️ TRANSCRIPT WAS TRUNCATED - Analysis may be incomplete');
        } else {
          console.log('✅ Complete transcript included in analysis');
        }
      }
      console.log('=== END PROMPT DEBUG ===');

      const response = await this.makeGeminiRequest(model, prompt);

      // Log the response to verify LLM is generating timestamps
      console.log('=== GEMINI API RESPONSE ===');
      console.log('Response length:', response.length);
      console.log('Contains timestamps:', /\d{1,2}:\d{2}/.test(response));
      console.log('First 300 chars of response:', response.substring(0, 300));
      console.log('=== END RESPONSE DEBUG ===');

      return this.parseRawAnalysisResponse(response);
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error('Failed to analyze video with AI: ' + error.message);
    }
  }

  async analyzeVideoByLink(videoData) {
    const settings = await this.getSettings();
    const model = settings.selectedModel;

    // Get the method-specific prompt template, fallback to global selected prompt
    const methodPromptId = settings.methodSpecificPrompts?.videolink || settings.selectedPromptId || 'full_brief';
    const selectedPrompt = settings.prompts.find(p => p.id === methodPromptId) || settings.prompts[0];

    if (!selectedPrompt) {
      throw new Error('No analysis prompt configured. Please check your settings.');
    }

    // Create prompt using the selected template
    let prompt = selectedPrompt.prompt;

    // Replace variables in the prompt
    prompt = prompt.replace(/\{title\}/g, videoData.title || 'Unknown Title');
    prompt = prompt.replace(/\{description\}/g, videoData.description || 'No description available');
    prompt = prompt.replace(/\{videoUrl\}/g, videoData.videoUrl || '');
    prompt = prompt.replace(/\{transcript\}/g, 'Video content will be analyzed directly from the YouTube URL.');

    // Add video metadata to the prompt
    prompt += `

Video Title: ${videoData.title}
Video Description: ${videoData.description}
Video URL: ${videoData.videoUrl}

Note: This analysis is performed using the video URL directly. The AI will analyze the video content including audio and visual elements.`;

    try {
      console.log('=== GEMINI API VIDEO LINK DEBUG ===');
      console.log('Using video link method for:', videoData.videoUrl);
      console.log('Prompt length:', prompt.length);
      console.log('=== END VIDEO LINK DEBUG ===');

      const response = await this.makeGeminiRequestWithVideoUrl(model, prompt, videoData.videoUrl);

      console.log('=== GEMINI API VIDEO LINK RESPONSE ===');
      console.log('Response length:', response.length);
      console.log('Contains timestamps:', /\d{1,2}:\d{2}/.test(response));
      console.log('First 300 chars of response:', response.substring(0, 300));
      console.log('=== END VIDEO LINK RESPONSE DEBUG ===');

      return this.parseRawAnalysisResponse(response);
    } catch (error) {
      console.error('Gemini API video link error:', error);
      throw new Error('Failed to analyze video by link with AI: ' + error.message);
    }
  }

  async analyzeVideoTranscriptLink(videoData) {
    const settings = await this.getSettings();
    const model = settings.selectedModel;

    // Get the method-specific prompt template, fallback to global selected prompt
    const methodPromptId = settings.methodSpecificPrompts?.transcriptlink || settings.selectedPromptId || 'full_brief';
    const selectedPrompt = settings.prompts.find(p => p.id === methodPromptId) || settings.prompts[0];

    if (!selectedPrompt) {
      throw new Error('No analysis prompt configured. Please check your settings.');
    }

    // Create prompt using the selected template
    let prompt = selectedPrompt.prompt;

    // Replace variables in the prompt
    prompt = prompt.replace(/\{title\}/g, videoData.title || 'Unknown Title');
    prompt = prompt.replace(/\{description\}/g, videoData.description || 'No description available');
    prompt = prompt.replace(/\{videoUrl\}/g, videoData.videoUrl || '');
    prompt = prompt.replace(/\{transcript\}/g, videoData.transcript || 'No transcript available');

    // Add video metadata to the prompt
    prompt += `

Video Title: ${videoData.title}
Video Description: ${videoData.description}
Video URL: ${videoData.videoUrl}

Note: This analysis combines both the video transcript and direct video URL access for comprehensive analysis.`;

    try {
      console.log('=== GEMINI API TRANSCRIPT + LINK DEBUG ===');
      console.log('Using transcript + link method for:', videoData.videoUrl);
      console.log('Transcript length:', videoData.transcript ? videoData.transcript.length : 0);
      console.log('Prompt length:', prompt.length);
      console.log('=== END TRANSCRIPT + LINK DEBUG ===');

      const response = await this.makeGeminiRequestWithVideoUrl(model, prompt, videoData.videoUrl);

      console.log('=== GEMINI API TRANSCRIPT + LINK RESPONSE ===');
      console.log('Response length:', response.length);
      console.log('Contains timestamps:', /\d{1,2}:\d{2}/.test(response));
      console.log('First 300 chars of response:', response.substring(0, 300));
      console.log('=== END TRANSCRIPT + LINK RESPONSE DEBUG ===');

      return this.parseRawAnalysisResponse(response);
    } catch (error) {
      console.error('Gemini API transcript + link error:', error);
      throw new Error('Failed to analyze video with transcript + link: ' + error.message);
    }
  }

  async makeGeminiRequest(model, prompt, retryCount = 0) {
    const maxRetries = 3;

    try {
      const apiKey = await this.getNextApiKey();
      const url = `${this.baseUrl}/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
            candidateCount: 1
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429 && retryCount < maxRetries) {
          console.log('Rate limit hit, trying next API key...');
          return this.makeGeminiRequest(model, prompt, retryCount + 1);
        }

        throw new Error(`API request failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response format from Gemini API');
      }

      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      if (retryCount < maxRetries) {
        console.log(`Request failed, retrying... (${retryCount + 1}/${maxRetries})`);
        return this.makeGeminiRequest(model, prompt, retryCount + 1);
      }
      throw error;
    }
  }

  async makeGeminiRequestWithVideoUrl(model, prompt, videoUrl, retryCount = 0) {
    const maxRetries = 3;

    try {
      const apiKey = await this.getNextApiKey();
      const url = `${this.baseUrl}/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: prompt
              },
              {
                fileData: {
                  fileUri: videoUrl
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
            candidateCount: 1
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429 && retryCount < maxRetries) {
          console.log('Rate limit hit, trying next API key...');
          return this.makeGeminiRequestWithVideoUrl(model, prompt, videoUrl, retryCount + 1);
        }

        throw new Error(`API request failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response format from Gemini API');
      }

      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      if (retryCount < maxRetries) {
        console.log(`Request failed, retrying... (${retryCount + 1}/${maxRetries})`);
        return this.makeGeminiRequestWithVideoUrl(model, prompt, videoUrl, retryCount + 1);
      }
      throw error;
    }
  }


  parseRawAnalysisResponse(response) {
    try {
      // Clean up the response by removing unwanted characters and formatting
      let cleanedResponse = response.trim();

      // Remove "---" characters at the beginning and end
      cleanedResponse = cleanedResponse.replace(/^---+\s*/g, '');
      cleanedResponse = cleanedResponse.replace(/\s*---+$/g, '');

      // Remove any remaining standalone "---" lines
      cleanedResponse = cleanedResponse.replace(/\n\s*---+\s*\n/g, '\n\n');

      // Clean up extra whitespace
      cleanedResponse = cleanedResponse.replace(/\n{3,}/g, '\n\n');

      return {
        rawAnalysis: cleanedResponse,
        isRawFormat: true
      };
    } catch (error) {
      console.error('Failed to parse raw analysis response:', error);
      console.log('Raw response:', response);
      return {
        rawAnalysis: response || 'Analysis failed to generate',
        isRawFormat: true
      };
    }
  }

  parseAnalysisResponse(response) {
    try {
      // Try to find JSON in the response
      let jsonStr = '';

      // Method 1: Look for JSON block markers
      const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        jsonStr = jsonBlockMatch[1];
      } else {
        // Method 2: Look for JSON object
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      if (jsonStr) {
        // Clean up the JSON string
        jsonStr = jsonStr.trim();

        // Try to parse the JSON
        const parsed = JSON.parse(jsonStr);

        // Validate the structure
        if (parsed.summary || parsed.keyPoints || parsed.topics || parsed.insights) {
          return {
            summary: parsed.summary || 'No summary available',
            keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
            topics: Array.isArray(parsed.topics) ? parsed.topics : [],
            insights: Array.isArray(parsed.insights) ? parsed.insights : [],
            targetAudience: parsed.targetAudience || null,
            contentStyle: parsed.contentStyle || null
          };
        }
      }

      // If JSON parsing fails, try manual parsing
      return this.parseManualResponse(response);
    } catch (error) {
      console.error('Failed to parse analysis response:', error);
      console.log('Raw response:', response);
      return this.createFallbackResponse(response);
    }
  }

  parseManualResponse(response) {
    const lines = response.split('\n').filter(line => line.trim());

    const analysis = {
      summary: '',
      keyPoints: [],
      topics: [],
      insights: []
    };

    let currentSection = '';
    let currentKeyPoint = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Section detection
      if (trimmed.toLowerCase().includes('summary') || trimmed.toLowerCase().includes('overview')) {
        currentSection = 'summary';
        continue;
      } else if (trimmed.toLowerCase().includes('key points') || trimmed.toLowerCase().includes('timestamp')) {
        currentSection = 'keyPoints';
        continue;
      } else if (trimmed.toLowerCase().includes('topics') || trimmed.toLowerCase().includes('covered')) {
        currentSection = 'topics';
        continue;
      } else if (trimmed.toLowerCase().includes('insights') || trimmed.toLowerCase().includes('takeaways')) {
        currentSection = 'insights';
        continue;
      }

      // Content parsing based on current section
      if (trimmed && currentSection === 'summary') {
        analysis.summary += trimmed + ' ';
      } else if (currentSection === 'keyPoints') {
        // Look for timestamp patterns
        const timestampMatch = trimmed.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
        if (timestampMatch) {
          if (currentKeyPoint) {
            analysis.keyPoints.push(currentKeyPoint);
          }
          currentKeyPoint = {
            timestamp: timestampMatch[1],
            title: trimmed.replace(timestampMatch[0], '').replace(/[:-]/, '').trim(),
            description: ''
          };
        } else if (currentKeyPoint && trimmed) {
          currentKeyPoint.description += trimmed + ' ';
        }
      } else if (currentSection === 'topics' && trimmed) {
        // Extract topics from bullet points or comma-separated lists
        if (trimmed.includes(',')) {
          const topicList = trimmed.split(',').map(t => t.trim()).filter(t => t);
          analysis.topics.push(...topicList);
        } else if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          analysis.topics.push(trimmed.replace(/^[-•]\s*/, ''));
        } else {
          analysis.topics.push(trimmed);
        }
      } else if (currentSection === 'insights' && trimmed) {
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          analysis.insights.push(trimmed.replace(/^[-•]\s*/, ''));
        } else {
          analysis.insights.push(trimmed);
        }
      }
    }

    // Add the last key point if exists
    if (currentKeyPoint) {
      analysis.keyPoints.push(currentKeyPoint);
    }

    // Clean up
    analysis.summary = analysis.summary.trim();
    analysis.keyPoints = analysis.keyPoints.map(kp => ({
      ...kp,
      title: kp.title || 'Key Point',
      description: kp.description.trim() || 'No description available'
    }));

    return analysis;
  }

  createFallbackResponse(response) {
    console.log('Creating fallback response from:', response.substring(0, 200));

    // Try to extract some meaningful content even if JSON parsing failed
    const lines = response.split('\n').filter(line => line.trim());
    let summary = '';
    let keyPoints = [];
    let topics = [];
    let insights = [];

    // Look for summary-like content
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].trim();
      if (line.length > 20 && !line.includes('{') && !line.includes('}')) {
        summary += line + ' ';
        if (summary.length > 300) break;
      }
    }

    // Look for timestamp patterns
    const timestampPattern = /(\d{1,2}:\d{2}(?::\d{2})?)/g;
    let match;
    while ((match = timestampPattern.exec(response)) !== null && keyPoints.length < 5) {
      const timestamp = match[1];
      const context = response.substring(Math.max(0, match.index - 50), match.index + 100);
      const title = context.split(/[.!?]/).find(s => s.includes(timestamp))?.replace(timestamp, '').trim() || 'Key Point';

      keyPoints.push({
        timestamp: timestamp,
        title: title.substring(0, 50) || 'Key Point',
        description: context.trim().substring(0, 100) || 'Analysis point identified'
      });
    }

    // If no key points found, create a default one
    if (keyPoints.length === 0) {
      keyPoints.push({
        timestamp: '00:00',
        title: 'Analysis Available',
        description: 'AI analysis completed. Raw response: ' + response.substring(0, 200) + '...'
      });
    }

    return {
      summary: summary.trim() || response.substring(0, 500) + '...',
      keyPoints: keyPoints,
      topics: ['General Content', 'Video Analysis'],
      insights: ['Analysis generated successfully', 'Check raw response for more details']
    };
  }
}

class BackgroundService {
  constructor() {
    this.geminiAPI = new GeminiAPI();
    this.init();
  }

  init() {
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Handle extension installation
    chrome.runtime.onInstalled.addListener(() => {
      this.onInstalled();
    });
    
    // Run migration on startup to handle extension updates
    this.migratePromptsToLocalStorage();
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'analyzeVideo':
          const analysis = await this.analyzeVideo(request.videoId, request.videoUrl);
          sendResponse({ success: true, analysis });
          break;

        case 'analyzeVideoInline':
          try {
            const inlineAnalysis = await this.analyzeVideoInline(request.videoId, request.videoUrl, request.transcriptData, request.videoTitle, request.videoDescription);
            sendResponse({ success: true, analysis: inlineAnalysis });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'analyzeVideoByLink':
          try {
            const linkAnalysis = await this.analyzeVideoByLink(request.videoId, request.videoUrl, request.videoTitle, request.videoDescription);
            sendResponse({ success: true, analysis: linkAnalysis });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'analyzeVideoTranscriptLink':
          try {
            const transcriptLinkAnalysis = await this.analyzeVideoTranscriptLink(request.videoId, request.videoUrl, request.transcriptData, request.videoTitle, request.videoDescription);
            sendResponse({ success: true, analysis: transcriptLinkAnalysis });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'chatWithVideo':
          try {
            const chatReply = await this.chatWithVideo(request.message, request.videoId, request.videoUrl);
            sendResponse({ success: true, reply: chatReply });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;
        
        case 'getSettings':
          const settings = await this.getSettings();
          sendResponse({ success: true, settings });
          break;
        
        case 'saveSettings':
          await this.saveSettings(request.settings);
          sendResponse({ success: true });
          break;

        case 'getStoredTranscript':
          const storedData = await chrome.storage.local.get([`analysis_${request.videoId}`]);
          sendResponse({ success: true, data: storedData[`analysis_${request.videoId}`] || null });
          break;

        case 'getBasicVideoInfo':
          try {
            const basicInfo = await this.getBasicVideoInfo(request.videoId);
            sendResponse({ success: true, ...basicInfo });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'extractTranscriptInNewTab':
          try {
            await this.extractTranscriptInNewTab(request.videoId, request.videoUrl);
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'getPrompts':
          try {
            const settings = await this.getSettings();
            sendResponse({ success: true, prompts: settings.prompts, selectedPromptId: settings.selectedPromptId });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'savePrompt':
          try {
            await this.savePrompt(request.prompt);
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'deletePrompt':
          try {
            await this.deletePrompt(request.promptId);
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'setDefaultPrompt':
          try {
            await this.setDefaultPrompt(request.promptId);
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'ping':
          sendResponse({ success: true, message: 'Extension is working' });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }



  async analyzeVideo(videoId, videoUrl) {
    try {
      console.log(`Starting analysis for video ${videoId}...`);

      // Get video transcript or metadata
      const videoData = await this.getVideoData(videoId, videoUrl);

      console.log('Video data retrieved:', {
        hasTitle: !!videoData.title,
        hasDescription: !!videoData.description,
        hasTranscript: !!videoData.transcript,
        transcriptLength: videoData.transcript?.length || 0,
        extractionMethod: videoData.extractionMethod
      });

      // Generate AI analysis using Gemini
      const analysis = await this.geminiAPI.analyzeVideo(videoData);

      // Include video metadata in the analysis result
      analysis.videoTitle = videoData.videoTitle || videoData.title;
      analysis.videoDescription = videoData.videoDescription || videoData.description;
      analysis.extractionMethod = videoData.extractionMethod;

      // Store transcript data for refresh functionality
      if (videoData.transcript && videoData.transcript !== 'No transcript available') {
        await chrome.storage.local.set({
          [`transcript_${videoId}`]: {
            transcript: videoData.transcript,
            videoTitle: videoData.videoTitle || videoData.title,
            videoDescription: videoData.videoDescription || videoData.description,
            timestamp: Date.now()
          }
        });
      }

      console.log('Analysis completed successfully');
      return analysis;
    } catch (error) {
      console.error('Video analysis error:', error);
      throw new Error('Failed to analyze video: ' + error.message);
    }
  }

  async analyzeVideoInline(videoId, videoUrl, transcriptData, videoTitle, videoDescription) {
    try {
      console.log(`Starting inline analysis for video ${videoId}...`);

      // Create video data object from provided parameters
      const videoData = {
        videoId,
        videoUrl,
        title: videoTitle || 'Unknown Title',
        description: videoDescription || 'No description available',
        transcript: this.formatContentScriptTranscript(transcriptData),
        hasTranscript: !!(transcriptData && transcriptData.segments && transcriptData.segments.length > 0),
        extractionMethod: 'content-script-inline',
        videoTitle: videoTitle,
        videoDescription: videoDescription
      };

      console.log('Inline video data prepared:', {
        hasTitle: !!videoData.videoTitle,
        hasDescription: !!videoData.videoDescription,
        hasTranscript: !!videoData.transcript,
        transcriptLength: videoData.transcript?.length || 0,
        segmentCount: transcriptData?.segments?.length || 0
      });

      // Generate AI analysis using Gemini
      const analysis = await this.geminiAPI.analyzeVideo(videoData);

      // Include video metadata in the analysis result
      analysis.videoTitle = videoData.videoTitle;
      analysis.videoDescription = videoData.videoDescription;
      analysis.extractionMethod = videoData.extractionMethod;

      // Store transcript data and analysis result for potential future use
      if (videoData.transcript && videoData.transcript !== 'No transcript available') {
        await chrome.storage.local.set({
          [`transcript_${videoId}`]: {
            transcript: videoData.transcript,
            videoTitle: videoData.videoTitle,
            videoDescription: videoData.videoDescription,
            timestamp: Date.now()
          },
          [`analysis_result_${videoId}`]: {
            rawAnalysis: analysis.rawAnalysis,
            isRawFormat: analysis.isRawFormat,
            timestamp: Date.now()
          }
        });
      }

      console.log('Inline analysis completed successfully');
      return analysis;
    } catch (error) {
      console.error('Inline video analysis error:', error);
      throw new Error('Failed to analyze video: ' + error.message);
    }
  }

  async analyzeVideoByLink(videoId, videoUrl, videoTitle, videoDescription) {
    try {
      console.log(`Starting video link analysis for video ${videoId}...`);

      // Create video data object for link-based analysis
      const videoData = {
        videoId,
        videoUrl,
        title: videoTitle || 'Unknown Title',
        description: videoDescription || 'No description available',
        transcript: null, // No transcript for link method
        hasTranscript: false,
        extractionMethod: 'video-link',
        videoTitle: videoTitle,
        videoDescription: videoDescription
      };

      console.log('Video link data prepared:', {
        hasTitle: !!videoData.videoTitle,
        hasDescription: !!videoData.videoDescription,
        videoUrl: videoData.videoUrl,
        extractionMethod: videoData.extractionMethod
      });

      // Generate AI analysis using Gemini with video URL
      const analysis = await this.geminiAPI.analyzeVideoByLink(videoData);

      // Include video metadata in the analysis result
      analysis.videoTitle = videoData.videoTitle;
      analysis.videoDescription = videoData.videoDescription;
      analysis.extractionMethod = videoData.extractionMethod;

      // Store analysis result for potential future use
      await chrome.storage.local.set({
        [`analysis_result_${videoId}`]: {
          rawAnalysis: analysis.rawAnalysis,
          isRawFormat: analysis.isRawFormat,
          timestamp: Date.now(),
          method: 'video-link'
        }
      });

      console.log('Video link analysis completed successfully');
      return analysis;
    } catch (error) {
      console.error('Video link analysis error:', error);
      throw new Error('Failed to analyze video by link: ' + error.message);
    }
  }

  async analyzeVideoTranscriptLink(videoId, videoUrl, transcriptData, videoTitle, videoDescription) {
    try {
      console.log(`Starting transcript + link analysis for video ${videoId}...`);

      // Format transcript data from content script
      const formattedTranscript = this.formatContentScriptTranscript(transcriptData);

      // Create video data object for transcript + link analysis
      const videoData = {
        videoId,
        videoUrl,
        title: videoTitle || 'Unknown Title',
        description: videoDescription || 'No description available',
        transcript: formattedTranscript,
        hasTranscript: true,
        extractionMethod: 'transcript-link',
        videoTitle: videoTitle,
        videoDescription: videoDescription
      };

      console.log('Transcript + link data prepared:', {
        hasTitle: !!videoData.videoTitle,
        hasDescription: !!videoData.videoDescription,
        hasTranscript: !!videoData.transcript,
        transcriptLength: videoData.transcript ? videoData.transcript.length : 0,
        videoUrl: videoData.videoUrl,
        extractionMethod: videoData.extractionMethod
      });

      // Generate AI analysis using Gemini with both transcript and video URL
      const analysis = await this.geminiAPI.analyzeVideoTranscriptLink(videoData);

      // Include video metadata in the analysis result
      analysis.videoTitle = videoData.videoTitle;
      analysis.videoDescription = videoData.videoDescription;
      analysis.extractionMethod = videoData.extractionMethod;

      // Store analysis result and transcript for potential future use
      await chrome.storage.local.set({
        [`transcript_${videoId}`]: formattedTranscript,
        [`analysis_result_${videoId}`]: {
          rawAnalysis: analysis.rawAnalysis,
          isRawFormat: analysis.isRawFormat,
          timestamp: Date.now(),
          method: 'transcript-link'
        }
      });

      console.log('Transcript + link analysis completed successfully');
      return analysis;
    } catch (error) {
      console.error('Transcript + link analysis error:', error);
      throw new Error('Failed to analyze video with transcript + link: ' + error.message);
    }
  }

  async chatWithVideo(userMessage, videoId, videoUrl) {
    try {
      console.log(`Processing chat message for video ${videoId}: ${userMessage}`);

      // Get stored transcript and analysis data
      const storedData = await chrome.storage.local.get([`transcript_${videoId}`, `analysis_${videoId}`]);
      const transcriptData = storedData[`transcript_${videoId}`];
      const analysisData = storedData[`analysis_${videoId}`];

      if (!transcriptData) {
        throw new Error('No video context available. Please analyze the video first.');
      }

      // Try to get the previous analysis result for better context
      let previousAnalysis = '';
      try {
        // Check if we have a stored analysis result
        const analysisResult = await chrome.storage.local.get([`analysis_result_${videoId}`]);
        if (analysisResult[`analysis_result_${videoId}`] && analysisResult[`analysis_result_${videoId}`].rawAnalysis) {
          previousAnalysis = analysisResult[`analysis_result_${videoId}`].rawAnalysis;
          console.log('Found previous analysis for chat context');
        }
      } catch (error) {
        console.log('Could not retrieve previous analysis:', error);
      }

      // Create comprehensive context-aware prompt for chat
      const chatPrompt = `You are an AI assistant helping users understand a YouTube video. You have access to the video's complete transcript and previous AI analysis.

Video Title: ${transcriptData.videoTitle || 'Unknown Title'}
Video Description: ${transcriptData.videoDescription || 'No description available'}

${previousAnalysis ? `Previous AI Analysis of this video:
${previousAnalysis}

` : ''}Complete Video Transcript with Timestamps:
${transcriptData.transcript}

User Question: ${userMessage}

Instructions:
- Use the video transcript and previous analysis as your knowledge base
- Provide helpful, conversational responses based on the video content
- When referencing specific parts of the video, include relevant timestamps in MM:SS format
- If the user asks about topics covered in the video, reference the specific timestamps where those topics are discussed
- Keep responses informative but conversational
- If the question cannot be answered from the video content, politely explain that the information isn't available in this video

Please provide your response:`;

      // Generate response using Gemini API
      const response = await this.geminiAPI.makeGeminiRequest(
        'gemini-2.5-flash-preview-05-20', // Use fast model for chat
        chatPrompt
      );

      console.log('Chat response generated successfully');
      return response;

    } catch (error) {
      console.error('Chat processing error:', error);
      throw new Error('Failed to process chat message: ' + error.message);
    }
  }

  async getVideoData(videoId, videoUrl) {
    try {
      console.log(`Getting video data for ${videoId}...`);

      // First, check if we have stored transcript data from content script or previous analysis
      const storedData = await chrome.storage.local.get([`analysis_${videoId}`, `transcript_${videoId}`]);
      const analysisData = storedData[`analysis_${videoId}`];
      const transcriptData = storedData[`transcript_${videoId}`];

      console.log('Checking stored data for video:', videoId);
      console.log('Analysis data available:', !!analysisData);
      console.log('Transcript data available:', !!transcriptData);
      if (analysisData) {
        console.log('Analysis data segments:', analysisData.transcriptData?.segments?.length || 0);
      }

      if (analysisData && analysisData.transcriptData) {
        console.log('Using transcript data from content script extraction');

        // Format transcript from content script data
        const formattedTranscript = this.formatContentScriptTranscript(analysisData.transcriptData);

        // Clean up stored data
        chrome.storage.local.remove([`analysis_${videoId}`]);

        const result = {
          videoId,
          videoUrl,
          title: analysisData.videoTitle || 'Unknown Title',
          description: analysisData.videoDescription || 'No description available',
          transcript: formattedTranscript,
          hasTranscript: true,
          extractionMethod: 'content-script-panel',
          videoTitle: analysisData.videoTitle,
          videoDescription: analysisData.videoDescription
        };

        console.log('Returning video data from content script extraction:', {
          hasTitle: !!result.videoTitle,
          hasDescription: !!result.videoDescription,
          hasTranscript: !!result.transcript,
          transcriptLength: result.transcript?.length || 0
        });

        return result;
      }

      // Check for stored transcript data from previous analysis (for refresh functionality)
      if (transcriptData && transcriptData.transcript) {
        console.log('Using stored transcript data for refresh');

        const result = {
          videoId,
          videoUrl,
          title: transcriptData.videoTitle || 'Unknown Title',
          description: transcriptData.videoDescription || 'No description available',
          transcript: transcriptData.transcript,
          hasTranscript: true,
          extractionMethod: 'stored-transcript',
          videoTitle: transcriptData.videoTitle,
          videoDescription: transcriptData.videoDescription
        };

        console.log('Using stored transcript for refresh:', {
          transcriptLength: transcriptData.transcript.length
        });

        return result;
      }

      // Fallback: try direct transcript extraction
      console.log('No content script data found, trying direct transcript extraction...');

      // Final fallback: HTML parsing method
      console.log('Falling back to HTML parsing method...');
      const [title, description, transcript] = await Promise.all([
        this.getVideoTitle(videoId),
        this.getVideoDescription(videoId),
        this.fetchYouTubeTranscript(videoId)
      ]);

      return {
        videoId,
        videoUrl,
        title,
        description,
        transcript: transcript || 'No transcript available',
        hasTranscript: transcript !== null,
        extractionMethod: 'html-parsing'
      };

    } catch (error) {
      console.error('All video data extraction methods failed:', error);
      return {
        videoId,
        videoUrl,
        title: 'Unknown Title',
        description: 'No description available',
        transcript: 'No transcript available',
        hasTranscript: false,
        error: error.message,
        extractionMethod: 'failed'
      };
    }
  }

  /**
   * Format transcript data from content script extraction
   */
  formatContentScriptTranscript(transcriptData) {
    if (!transcriptData || !transcriptData.segments || transcriptData.segments.length === 0) {
      return 'No transcript available';
    }

    console.log(`Formatting transcript with ${transcriptData.segments.length} segments`);

    const formattedTranscript = transcriptData.segments
      .map(segment => `[${segment.timestamp}] ${segment.text}`)
      .join('\n');

    console.log(`Formatted transcript length: ${formattedTranscript.length} characters`);

    return formattedTranscript;
  }

  /**
   * Get basic video info quickly for immediate display
   */
  async getBasicVideoInfo(videoId) {
    try {
      // First check if we have stored data from content script
      const storedData = await chrome.storage.local.get([`analysis_${videoId}`]);
      const analysisData = storedData[`analysis_${videoId}`];

      if (analysisData) {
        return {
          title: analysisData.videoTitle || 'Video Title',
          description: analysisData.videoDescription || 'Video Description'
        };
      }

      // No fallback available for basic video info

      // Final fallback
      return {
        title: 'Analyzing video...',
        description: 'Extracting transcript and generating AI analysis...'
      };

    } catch (error) {
      console.error('Error getting basic video info:', error);
      return {
        title: 'Analyzing video...',
        description: 'Extracting transcript and generating AI analysis...'
      };
    }
  }

  async getVideoTitle(videoId) {
    try {
      // Fetch video page to extract title
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
      const html = await response.text();

      // Extract title from meta tag
      const titleMatch = html.match(/<meta name="title" content="([^"]*)"/) ||
                        html.match(/<title>([^<]*)<\/title>/);

      if (titleMatch) {
        return titleMatch[1].replace(' - YouTube', '').trim();
      }

      return 'Unknown Title';
    } catch (error) {
      console.error('Error getting video title:', error);
      return 'Unknown Title';
    }
  }

  async getVideoDescription(videoId) {
    try {
      // Fetch video page to extract description
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
      const html = await response.text();

      // Extract description from meta tag
      const descMatch = html.match(/<meta name="description" content="([^"]*)"/) ||
                       html.match(/<meta property="og:description" content="([^"]*)"/);

      if (descMatch) {
        return descMatch[1].trim();
      }

      return 'No description available';
    } catch (error) {
      console.error('Error getting video description:', error);
      return 'No description available';
    }
  }

  async getVideoTranscript(videoId) {
    try {
      // Try multiple methods to get transcript
      const transcript = await this.fetchYouTubeTranscript(videoId);
      return transcript || 'No transcript available';
    } catch (error) {
      console.error('Error getting video transcript:', error);
      return 'No transcript available';
    }
  }

  async fetchYouTubeTranscript(videoId) {
    try {
      console.log(`Attempting to fetch transcript for video: ${videoId}`);

      // Method 1: Try to get transcript from YouTube's internal API
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      console.log('Successfully fetched YouTube page');

      // Enhanced method to extract transcript data
      const playerResponseMatches = [
        // Try different patterns to find ytInitialPlayerResponse
        html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s),
        html.match(/ytInitialPlayerResponse["']\s*:\s*(\{.+?\}),\s*["']ytInitialData/s),
        html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s),
        html.match(/window\["ytInitialPlayerResponse"\]\s*=\s*(\{.+?\});/s)
      ];

      for (const match of playerResponseMatches) {
        if (match && match[1]) {
          try {
            // Clean up the JSON string
            let jsonStr = match[1];

            // Handle potential issues with the JSON
            jsonStr = jsonStr.replace(/\n/g, '').replace(/\r/g, '');

            const playerResponse = JSON.parse(jsonStr);
            const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

            if (captions && captions.length > 0) {
              console.log(`Found ${captions.length} caption tracks`);

              // Prefer English captions, then auto-generated, then any available
              let selectedTrack = captions.find(track =>
                track.languageCode === 'en' || track.languageCode === 'en-US'
              ) || captions.find(track =>
                track.kind === 'asr' // auto-generated
              ) || captions[0];

              let transcriptUrl = selectedTrack.baseUrl;

              // Ensure the URL is properly formatted
              if (!transcriptUrl.startsWith('http')) {
                transcriptUrl = 'https://www.youtube.com' + transcriptUrl;
              }

              console.log('Fetching transcript from:', transcriptUrl);

              const transcriptResponse = await fetch(transcriptUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
              });

              if (!transcriptResponse.ok) {
                console.error(`Transcript fetch failed: ${transcriptResponse.status}`);
                continue;
              }

              const transcriptXml = await transcriptResponse.text();
              console.log('Transcript XML length:', transcriptXml.length);

              // Enhanced XML parsing with better regex
              const textMatches = transcriptXml.match(/<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([^<]*)<\/text>/g);

              if (textMatches && textMatches.length > 0) {
                const transcriptWithTimestamps = textMatches.map(match => {
                  const startMatch = match.match(/start="([^"]*)"/);
                  const durMatch = match.match(/dur="([^"]*)"/);
                  const textMatch = match.match(/>([^<]*)</);

                  if (startMatch && textMatch) {
                    const startTime = parseFloat(startMatch[1]);
                    const duration = durMatch ? parseFloat(durMatch[1]) : 0;
                    let text = textMatch[1];

                    // Decode HTML entities
                    text = text.replace(/&amp;/g, '&')
                              .replace(/&lt;/g, '<')
                              .replace(/&gt;/g, '>')
                              .replace(/&quot;/g, '"')
                              .replace(/&#39;/g, "'")
                              .replace(/&nbsp;/g, ' ')
                              .trim();

                    if (text.length === 0) return null;

                    // Convert seconds to MM:SS format
                    const minutes = Math.floor(startTime / 60);
                    const seconds = Math.floor(startTime % 60);
                    const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;

                    return { timestamp, text, startTime, duration };
                  }
                  return null;
                }).filter(item => item && item.text.length > 0);

                if (transcriptWithTimestamps.length > 0) {
                  // Create timestamped transcript for analysis
                  const timestampedTranscript = transcriptWithTimestamps
                    .map(item => `[${item.timestamp}] ${item.text}`)
                    .join('\n');

                  console.log(`Successfully extracted transcript: ${transcriptWithTimestamps.length} segments, ${timestampedTranscript.length} characters`);

                  // Return the timestamped version for better analysis
                  return timestampedTranscript;
                }
              } else {
                console.log('No text matches found in transcript XML');
              }
            } else {
              console.log('No captions found in player response');
            }
          } catch (parseError) {
            console.error('Error parsing player response:', parseError);
            continue;
          }
        }
      }

      // Method 2: Try to extract from captions object (fallback)
      const captionsMatch = html.match(/"captions":(\{.*?\}),"videoDetails"/);
      if (captionsMatch) {
        try {
          const captionsData = JSON.parse(captionsMatch[1]);
          const tracks = captionsData?.playerCaptionsTracklistRenderer?.captionTracks;

          if (tracks && tracks.length > 0) {
            const transcriptUrl = tracks[0].baseUrl;
            const transcriptResponse = await fetch(transcriptUrl);
            const transcriptXml = await transcriptResponse.text();

            const textMatches = transcriptXml.match(/<text[^>]*>([^<]*)<\/text>/g);
            if (textMatches) {
              const transcript = textMatches
                .map(match => match.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim())
                .filter(text => text.length > 0)
                .join(' ');

              console.log(`Fallback method extracted transcript: ${transcript.length} characters`);
              return transcript;
            }
          }
        } catch (parseError) {
          console.error('Error parsing captions data:', parseError);
        }
      }

      console.log('No transcript found for this video');
      return null;
    } catch (error) {
      console.error('Error fetching YouTube transcript:', error);
      return null;
    }
  }

  async getSettings() {
    const defaultPrompt = `You are an AI assistant specialized in analyzing video content from transcripts. Analyze the provided YouTube video transcript and provide a comprehensive analysis in the exact format shown below.

This video provides an excellent visual explanation of [MAIN TOPIC].

Brief Summary:
[Provide a concise paragraph (3-5 sentences) that synthesizes the core subject matter, main arguments, and overall key takeaways of the entire video. Focus on what the video is about and why it's significant, emphasizing strategic insights and analytical synthesis rather than just transcription summary.]

Key Points with Timestamps:

[List the most important concepts, topics, or sections discussed in the video. For each point, use this exact format:]

HH:MM:SS - HH:MM:SS | [Concept/Heading]: [Brief explanation of what is discussed in that specific segment]

[Continue with additional key points following the same timestamp format]`;

    const defaultSettings = {
      apiKeys: [],
      geminiApiKeys: [],
      selectedModel: 'gemini-2.5-flash',
      autoAnalyze: false,
      detailedAnalysis: false,
      availableModels: [
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
      ],
      prompts: [
        {
          id: 'full_brief',
          name: 'Full Video Brief',
          prompt: 'Please summarize this video from beginning to end. Identify all key points with their timestamps and present the information in a short, well-formatted, and easy-to-understand way.',
          isDefault: true,
          createdAt: Date.now()
        },
        {
          id: 'longer_brief',
          name: 'Longer Video Brief',
          prompt: 'Please analyze the entire transcript from start to finish. Create a comprehensive timeline of key points with their exact timestamps (in MM:SS format). Present your analysis in a concise, well-structured format with clear headings, bullet points, and brief descriptions for each major point. Ensure complete coverage of the full video content without omitting any sections.',
          isDefault: true,
          createdAt: Date.now()
        },
        {
          id: 'default',
          name: 'Default Analysis Prompt',
          prompt: defaultPrompt,
          isDefault: true,
          createdAt: Date.now()
        },
        {
          id: 'detailed_walkthrough',
          name: 'Detailed Video Walkthrough',
          prompt: `You are an expert video summarizer and content creator. Your task is to provide a detailed, well-formatted, and easy-to-understand summary of the given video transcript, with precise timestamps for key points. Each timestamp should correspond to a specific visual or auditory event in the video, making it suitable for a step-by-step walkthrough article where each timestamp corresponds to a screenshot.

**Video Title:** {title}
**Video URL:** {videoUrl}

**Video Transcript with Timestamps:**
{transcript}

---

**Please provide a detailed summary of the video based on the transcript, following these guidelines:**

1. **Introduction:** Start with a brief overview of the video's main topic and purpose.
2. **Key Points with Timestamps (mm:ss format):**
   * Break down the video into its core sections and individual steps.
   * For each significant point, identify the **exact timestamp** (mm:ss) from the transcript where that point is introduced or visually represented.
   * Describe the content at each timestamp concisely but informatively, as if it were accompanying a screenshot in an article.
   * Use bullet points for readability.
3. **Visual Cues/Actions:** Include brief descriptions of what is being shown or done on screen at each timestamp, especially for practical demonstrations or important visuals.
4. **Clarity and Flow:** Ensure the summary flows logically and is easy to follow, even for someone who hasn't watched the video.
5. **Conciseness:** While detailed, avoid unnecessary jargon or overly long sentences.
6. **Conclusion:** Briefly summarize the overall outcome or main takeaway.`,
          isDefault: true,
          createdAt: Date.now()
        }
      ],
      selectedPromptId: 'full_brief',
      methodSpecificPrompts: {
        transcript: 'full_brief',
        videolink: 'full_brief',
        transcriptlink: 'full_brief'
      }
    };

    // Get settings from sync storage and prompts from local storage
    const [syncResult, localResult] = await Promise.all([
      chrome.storage.sync.get(['settings']),
      chrome.storage.local.get(['prompts'])
    ]);
    
    const settings = syncResult.settings || defaultSettings;
    
    // Get prompts from local storage, fallback to default if not found
    const prompts = localResult.prompts || defaultSettings.prompts;
    settings.prompts = prompts;

    // Ensure prompts array exists and has default prompt
    if (!settings.prompts || settings.prompts.length === 0) {
      settings.prompts = defaultSettings.prompts;
      settings.selectedPromptId = 'full_brief';
      // Save default prompts to local storage
      await chrome.storage.local.set({ prompts: defaultSettings.prompts });
    }

    // Ensure methodSpecificPrompts exists
    if (!settings.methodSpecificPrompts) {
      settings.methodSpecificPrompts = defaultSettings.methodSpecificPrompts;
    }

    return settings;
  }

  async extractTranscriptInNewTab(videoId, videoUrl) {
    try {
      console.log(`Extracting transcript for video: ${videoId}`);

      // Method 1: Try using the existing YouTube Transcript API directly
      try {
        console.log('Trying YouTube Transcript API...');
        const transcriptAPI = new YouTubeTranscriptAPI();
        const transcript = await transcriptAPI.getTranscript(videoId);

        if (transcript && transcript.length > 0) {
          console.log(`Successfully extracted ${transcript.length} segments using API`);

          // Get basic video info
          const [title, description] = await Promise.all([
            this.getVideoTitle(videoId),
            this.getVideoDescription(videoId)
          ]);

          // Create transcript data structure
          const transcriptData = {
            segments: transcript.map((segment, index) => ({
              text: segment.text,
              timestamp: this.formatTimestamp(segment.start),
              start: segment.start,
              index: index
            })),
            totalSegments: transcript.length,
            extractedAt: new Date().toISOString(),
            method: 'youtube-api'
          };

          // Store the extracted data
          await chrome.storage.local.set({
            [`analysis_${videoId}`]: {
              transcriptData: transcriptData,
              videoTitle: title,
              videoDescription: description,
              timestamp: Date.now()
            }
          });

          console.log('Transcript extraction completed successfully using API');
          return;
        }
      } catch (apiError) {
        console.log('YouTube API method failed:', apiError.message);
      }

      // Method 2: Fallback to HTML parsing method
      console.log('Trying HTML parsing fallback...');
      const transcript = await this.fetchYouTubeTranscript(videoId);

      if (!transcript || transcript === 'No transcript available') {
        throw new Error('No transcript available for this video - video may not have captions');
      }

      // Get basic video info
      const [title, description] = await Promise.all([
        this.getVideoTitle(videoId),
        this.getVideoDescription(videoId)
      ]);

      // Parse the transcript text into segments
      const segments = this.parseTranscriptText(transcript);

      // Create transcript data structure
      const transcriptData = {
        segments: segments,
        totalSegments: segments.length,
        extractedAt: new Date().toISOString(),
        method: 'html-parsing'
      };

      // Store the extracted data
      await chrome.storage.local.set({
        [`analysis_${videoId}`]: {
          transcriptData: transcriptData,
          videoTitle: title,
          videoDescription: description,
          timestamp: Date.now()
        }
      });

      console.log('Transcript extraction completed successfully using HTML parsing');
      console.log('Stored transcript data:', {
        videoId: videoId,
        segmentCount: transcriptData.segments.length,
        title: title
      });

    } catch (error) {
      console.error('Error extracting transcript:', error);
      throw new Error(`Transcript extraction failed: ${error.message}`);
    }
  }

  parseTranscriptText(transcriptText) {
    // Parse transcript text that contains timestamps
    const lines = transcriptText.split('\n').filter(line => line.trim());
    const segments = [];

    lines.forEach((line, index) => {
      const timestampMatch = line.match(/^\[(\d{1,2}:\d{2})\]\s*(.+)$/);
      if (timestampMatch) {
        segments.push({
          text: timestampMatch[2].trim(),
          timestamp: timestampMatch[1],
          start: this.parseTimestamp(timestampMatch[1]),
          index: index
        });
      } else if (line.trim()) {
        // Line without timestamp, estimate based on position
        const estimatedTime = index * 10;
        segments.push({
          text: line.trim(),
          timestamp: this.formatTimestamp(estimatedTime),
          start: estimatedTime,
          index: index
        });
      }
    });

    return segments;
  }

  parseTimestamp(timeStr) {
    const parts = timeStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  formatTimestamp(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }



  async saveSettings(settings) {
    // Split settings to avoid quota issues
    // Store prompts separately in local storage to avoid sync quota limits
    const { prompts, ...syncSettings } = settings;
    
    // Save prompts to local storage (larger quota)
    if (prompts) {
      await chrome.storage.local.set({ prompts });
    }
    
    // Save other settings to sync storage
    await chrome.storage.sync.set({ settings: syncSettings });
  }

  async savePrompt(promptData) {
    const settings = await this.getSettings();

    if (promptData.id) {
      // Update existing prompt
      const index = settings.prompts.findIndex(p => p.id === promptData.id);
      if (index !== -1) {
        settings.prompts[index] = {
          ...settings.prompts[index],
          ...promptData,
          updatedAt: Date.now()
        };
      } else {
        throw new Error('Prompt not found');
      }
    } else {
      // Create new prompt
      const newPrompt = {
        id: 'prompt_' + Date.now(),
        name: promptData.name,
        prompt: promptData.prompt,
        isDefault: false,
        createdAt: Date.now()
      };
      settings.prompts.push(newPrompt);
    }

    await this.saveSettings(settings);
  }

  async deletePrompt(promptId) {
    const settings = await this.getSettings();

    // Don't allow deleting the default prompts
    if (promptId === 'default' || promptId === 'full_brief' || promptId === 'longer_brief' || promptId === 'detailed_walkthrough') {
      throw new Error('Cannot delete the default prompts');
    }

    const index = settings.prompts.findIndex(p => p.id === promptId);
    if (index === -1) {
      throw new Error('Prompt not found');
    }

    // If deleting the currently selected prompt, switch to default
    if (settings.selectedPromptId === promptId) {
      settings.selectedPromptId = 'full_brief';
    }

    settings.prompts.splice(index, 1);
    await this.saveSettings(settings);
  }

  async setDefaultPrompt(promptId) {
    const settings = await this.getSettings();

    const prompt = settings.prompts.find(p => p.id === promptId);
    if (!prompt) {
      throw new Error('Prompt not found');
    }

    settings.selectedPromptId = promptId;
    await this.saveSettings(settings);
  }

  async onInstalled() {
    // Set default settings on installation
    const settings = await this.getSettings();
    await this.saveSettings(settings);
    
    // Migrate existing prompts from sync to local storage
    await this.migratePromptsToLocalStorage();

    console.log('YouTube AI Video Analyzer installed successfully');
  }
  
  async migratePromptsToLocalStorage() {
    try {
      // Check if prompts are already in local storage
      const localResult = await chrome.storage.local.get(['prompts']);
      if (localResult.prompts && localResult.prompts.length > 0) {
        console.log('Prompts already migrated to local storage');
        return;
      }
      
      // Get settings from sync storage (old format)
      const syncResult = await chrome.storage.sync.get(['settings']);
      if (syncResult.settings && syncResult.settings.prompts && syncResult.settings.prompts.length > 0) {
        console.log('Migrating prompts from sync to local storage...');
        
        // Save prompts to local storage
        await chrome.storage.local.set({ prompts: syncResult.settings.prompts });
        
        // Remove prompts from sync storage to save space
        const { prompts, ...settingsWithoutPrompts } = syncResult.settings;
        await chrome.storage.sync.set({ settings: settingsWithoutPrompts });
        
        console.log('Prompts migration completed successfully');
      }
    } catch (error) {
      console.error('Error during prompts migration:', error);
    }
  }
}

// Initialize background service
new BackgroundService();
