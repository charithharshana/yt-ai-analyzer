// Utility functions for YouTube AI Video Analyzer

export class GeminiAPI {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.currentKeyIndex = 0;
  }

  async getSettings() {
    const result = await chrome.storage.sync.get(['settings']);
    return result.settings || { apiKeys: [], selectedModel: 'gemini-2.5-flash-preview-05-20' };
  }

  async getNextApiKey() {
    const settings = await this.getSettings();
    const apiKeys = settings.apiKeys || [];
    
    if (apiKeys.length === 0) {
      throw new Error('No API keys configured. Please add API keys in settings.');
    }

    const apiKey = apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % apiKeys.length;
    
    return apiKey;
  }

  async analyzeVideo(videoData) {
    const settings = await this.getSettings();
    const model = settings.selectedModel;
    
    const prompt = `Brief this and identify the key points along with the timestamp for this ${videoData.videoUrl}

Video Title: ${videoData.title}
Video Description: ${videoData.description}

Please provide:
1. A comprehensive summary of the video content
2. Key points with timestamps (format: MM:SS or HH:MM:SS)
3. Main topics covered
4. Important insights or takeaways

Format the response as JSON with the following structure:
{
  "summary": "Brief summary of the video",
  "keyPoints": [
    {
      "timestamp": "MM:SS",
      "title": "Key point title",
      "description": "Detailed description"
    }
  ],
  "topics": ["topic1", "topic2", "topic3"],
  "insights": ["insight1", "insight2"]
}`;

    try {
      const response = await this.makeGeminiRequest(model, prompt);
      return this.parseAnalysisResponse(response);
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error('Failed to analyze video with AI: ' + error.message);
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
            maxOutputTokens: 2048,
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429 && retryCount < maxRetries) {
          // Rate limit hit, try with next API key
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

  parseAnalysisResponse(response) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback: parse manually if JSON extraction fails
      return this.parseManualResponse(response);
    } catch (error) {
      console.error('Failed to parse analysis response:', error);
      return this.createFallbackResponse(response);
    }
  }

  parseManualResponse(response) {
    // Manual parsing logic for non-JSON responses
    const lines = response.split('\n').filter(line => line.trim());
    
    const analysis = {
      summary: '',
      keyPoints: [],
      topics: [],
      insights: []
    };

    let currentSection = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.toLowerCase().includes('summary')) {
        currentSection = 'summary';
      } else if (trimmed.toLowerCase().includes('key points') || trimmed.toLowerCase().includes('timestamp')) {
        currentSection = 'keyPoints';
      } else if (trimmed.toLowerCase().includes('topics')) {
        currentSection = 'topics';
      } else if (trimmed.toLowerCase().includes('insights')) {
        currentSection = 'insights';
      } else if (trimmed && currentSection === 'summary') {
        analysis.summary += trimmed + ' ';
      }
      // Add more parsing logic as needed
    }

    return analysis;
  }

  createFallbackResponse(response) {
    return {
      summary: response.substring(0, 500) + '...',
      keyPoints: [
        {
          timestamp: '00:00',
          title: 'Analysis Available',
          description: 'AI analysis completed. Full content available above.'
        }
      ],
      topics: ['General Content'],
      insights: ['Analysis generated successfully']
    };
  }
}

export class TimestampParser {
  static parseTimestamp(timestamp) {
    const parts = timestamp.split(':').map(part => parseInt(part, 10));
    
    if (parts.length === 2) {
      // MM:SS format
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS format
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    
    return 0;
  }

  static formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }
}
