// YouTube Transcript API - JavaScript implementation for browser extensions
// This provides similar functionality to the Python youtube-transcript-api

class YouTubeTranscriptAPI {
  constructor() {
    // No longer requires YouTube API key - uses direct transcript extraction
  }

  /**
   * Get transcript for a YouTube video
   * @param {string} videoId - YouTube video ID
   * @param {string[]} languages - Preferred languages (default: ['en', 'en-US'])
   * @returns {Promise<Array>} Array of transcript segments with timestamps
   */
  async getTranscript(videoId, languages = ['en', 'en-US']) {
    try {
      console.log(`Fetching transcript for video: ${videoId}`);

      // Try multiple methods in order of preference
      let transcript = null;

      // Method 1: Try YouTube's internal subtitle API (most reliable)
      console.log('Trying internal subtitle API...');
      transcript = await this.getTranscriptFromInternalAPI(videoId, languages);

      if (!transcript) {
        // Method 2: Try extracting from YouTube page HTML
        console.log('Trying HTML parsing method...');
        transcript = await this.getTranscriptFromHTML(videoId, languages);
      }

      // YouTube Data API method removed - not practical for browser extensions

      if (transcript && transcript.length > 0) {
        console.log(`Successfully extracted transcript: ${transcript.length} segments`);
        return transcript;
      }

      console.log('No transcript found for this video using any method');
      return null;

    } catch (error) {
      console.error('Error fetching transcript:', error);
      throw new Error(`Failed to fetch transcript: ${error.message}`);
    }
  }

  /**
   * Get transcript using YouTube's internal subtitle API
   * This method doesn't require OAuth and works for most videos
   */
  async getTranscriptFromInternalAPI(videoId, languages = ['en', 'en-US']) {
    try {
      // First, get the video page to extract subtitle information
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch video page: ${response.status}`);
      }

      const html = await response.text();

      // Extract subtitle tracks from the page
      const subtitleTracks = this.extractSubtitleTracks(html);

      if (!subtitleTracks || subtitleTracks.length === 0) {
        console.log('No subtitle tracks found in video page');
        return null;
      }

      // Find the best subtitle track
      const selectedTrack = this.selectBestTrack(subtitleTracks, languages);

      if (!selectedTrack) {
        console.log('No suitable subtitle track found');
        return null;
      }

      console.log(`Selected subtitle track: ${selectedTrack.name?.simpleText || selectedTrack.languageCode}`);

      // Fetch the subtitle content
      const subtitleUrl = selectedTrack.baseUrl;
      const subtitleResponse = await fetch(subtitleUrl);

      if (!subtitleResponse.ok) {
        throw new Error(`Failed to fetch subtitle: ${subtitleResponse.status}`);
      }

      const subtitleXML = await subtitleResponse.text();
      return this.parseCaptionXML(subtitleXML);

    } catch (error) {
      console.error('Error getting transcript from internal API:', error);
      return null;
    }
  }

  /**
   * Extract subtitle tracks from YouTube page HTML
   */
  extractSubtitleTracks(html) {
    try {
      // Look for different patterns where subtitle data might be stored
      const patterns = [
        // Pattern 1: ytInitialPlayerResponse
        /var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s,
        /ytInitialPlayerResponse["']\s*:\s*(\{.+?\}),\s*["']ytInitialData/s,
        /ytInitialPlayerResponse\s*=\s*(\{.+?\});/s,
        // Pattern 2: Direct captions object
        /"captions":\s*(\{.+?"captionTracks":\s*\[.+?\]\s*\})/s
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          try {
            const data = JSON.parse(match[1]);

            // Try different paths to find caption tracks
            let captionTracks = null;

            if (data.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
              captionTracks = data.captions.playerCaptionsTracklistRenderer.captionTracks;
            } else if (data.captionTracks) {
              captionTracks = data.captionTracks;
            }

            if (captionTracks && captionTracks.length > 0) {
              console.log(`Found ${captionTracks.length} subtitle tracks`);
              return captionTracks;
            }
          } catch (parseError) {
            console.log('Failed to parse JSON, trying next pattern...');
            continue;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting subtitle tracks:', error);
      return null;
    }
  }

  /**
   * Select the best subtitle track based on language preferences
   */
  selectBestTrack(tracks, languages) {
    if (!tracks || tracks.length === 0) return null;

    // First, try to find manual captions in preferred languages
    for (const lang of languages) {
      const track = tracks.find(t =>
        (t.languageCode === lang || t.languageCode === lang.split('-')[0]) &&
        t.kind !== 'asr' // Not auto-generated
      );
      if (track) return track;
    }

    // Then try auto-generated captions in preferred languages
    for (const lang of languages) {
      const track = tracks.find(t =>
        t.languageCode === lang || t.languageCode === lang.split('-')[0]
      );
      if (track) return track;
    }

    // Finally, use the first available track
    return tracks[0];
  }

  // YouTube Data API methods removed - not practical for browser extensions

  /**
   * Get transcript by parsing YouTube page HTML (enhanced fallback method)
   */
  async getTranscriptFromHTML(videoId, languages) {
    try {
      console.log('Trying enhanced HTML parsing method for transcript');

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
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();

      // Extract caption tracks using multiple methods
      let captionTracks = this.extractCaptionTracksFromHTML(html);

      if (!captionTracks || captionTracks.length === 0) {
        // Try alternative extraction method
        captionTracks = this.extractCaptionTracksAlternative(html);
      }

      if (!captionTracks || captionTracks.length === 0) {
        console.log('No caption tracks found in HTML');
        return null;
      }

      console.log(`Found ${captionTracks.length} caption tracks in HTML`);

      // Find best track
      const selectedTrack = this.selectBestTrack(captionTracks, languages);

      if (!selectedTrack) {
        console.log('No suitable track found');
        return null;
      }

      // Fetch transcript XML
      const transcriptResponse = await fetch(selectedTrack.baseUrl);
      if (!transcriptResponse.ok) {
        throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`);
      }

      const transcriptXML = await transcriptResponse.text();
      return this.parseCaptionXML(transcriptXML);

    } catch (error) {
      console.error('Error getting transcript from HTML:', error);
      return null;
    }
  }

  /**
   * Extract caption tracks from YouTube page HTML (primary method)
   */
  extractCaptionTracksFromHTML(html) {
    try {
      // Look for ytInitialPlayerResponse with multiple patterns
      const playerResponsePatterns = [
        /var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s,
        /ytInitialPlayerResponse["']\s*:\s*(\{.+?\}),\s*["']ytInitialData/s,
        /ytInitialPlayerResponse\s*=\s*(\{.+?\});/s,
        /"ytInitialPlayerResponse":\s*(\{.+?\}),"ytInitialData"/s
      ];

      for (const pattern of playerResponsePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          try {
            const playerResponse = JSON.parse(match[1]);
            const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

            if (captions && captions.length > 0) {
              console.log(`Found ${captions.length} caption tracks via ytInitialPlayerResponse`);
              return captions;
            }
          } catch (parseError) {
            console.log('Failed to parse ytInitialPlayerResponse, trying next pattern...');
            continue;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting caption tracks from HTML:', error);
      return null;
    }
  }

  /**
   * Alternative method to extract caption tracks
   */
  extractCaptionTracksAlternative(html) {
    try {
      // Look for direct captions object
      const captionsPattern = /"captions":\s*\{[^}]*"playerCaptionsTracklistRenderer":\s*\{[^}]*"captionTracks":\s*(\[[^\]]+\])/s;
      const match = html.match(captionsPattern);

      if (match && match[1]) {
        try {
          const captionTracks = JSON.parse(match[1]);
          if (captionTracks && captionTracks.length > 0) {
            console.log(`Found ${captionTracks.length} caption tracks via alternative method`);
            return captionTracks;
          }
        } catch (parseError) {
          console.log('Failed to parse alternative caption tracks');
        }
      }

      return null;
    } catch (error) {
      console.error('Error in alternative caption extraction:', error);
      return null;
    }
  }

  /**
   * Parse caption XML to extract transcript with timestamps
   */
  parseCaptionXML(xmlContent) {
    try {
      console.log(`Parsing caption XML (${xmlContent.length} characters)`);

      // Handle different XML formats
      let textMatches = null;

      // Try standard format with start and dur attributes
      textMatches = xmlContent.match(/<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([^<]*)<\/text>/g);

      // If that fails, try simpler format
      if (!textMatches || textMatches.length === 0) {
        textMatches = xmlContent.match(/<text[^>]*start="([^"]*)"[^>]*>([^<]*)<\/text>/g);
      }

      // If still no matches, try even simpler format
      if (!textMatches || textMatches.length === 0) {
        textMatches = xmlContent.match(/<text[^>]*>([^<]+)<\/text>/g);
      }

      if (!textMatches || textMatches.length === 0) {
        console.log('No text matches found in XML');
        return null;
      }

      console.log(`Found ${textMatches.length} text segments`);

      const transcript = textMatches.map((match, index) => {
        try {
          const startMatch = match.match(/start="([^"]*)"/);
          const durMatch = match.match(/dur="([^"]*)"/);
          const textMatch = match.match(/>([^<]*)</);

          if (textMatch) {
            const startTime = startMatch ? parseFloat(startMatch[1]) : index * 5; // Fallback timing
            const duration = durMatch ? parseFloat(durMatch[1]) : 5; // Default duration
            let text = textMatch[1];

            // Decode HTML entities more comprehensively
            text = text.replace(/&amp;/g, '&')
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&quot;/g, '"')
                      .replace(/&#39;/g, "'")
                      .replace(/&#x27;/g, "'")
                      .replace(/&nbsp;/g, ' ')
                      .replace(/&apos;/g, "'")
                      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
                      .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
                      .trim();

            if (text.length === 0) return null;

            // Convert seconds to MM:SS format
            const minutes = Math.floor(startTime / 60);
            const seconds = Math.floor(startTime % 60);
            const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            return {
              text: text,
              start: startTime,
              duration: duration,
              timestamp: timestamp
            };
          }
          return null;
        } catch (segmentError) {
          console.error('Error parsing segment:', segmentError);
          return null;
        }
      }).filter(item => item !== null);

      console.log(`Successfully parsed ${transcript.length} transcript segments`);
      return transcript;

    } catch (error) {
      console.error('Error parsing caption XML:', error);
      return null;
    }
  }

  /**
   * Format transcript for analysis
   */
  formatTranscriptForAnalysis(transcript) {
    if (!transcript || transcript.length === 0) {
      return 'No transcript available';
    }

    return transcript
      .map(segment => `[${segment.timestamp}] ${segment.text}`)
      .join('\n');
  }

  /**
   * Get available subtitle languages for a video
   */
  async getAvailableLanguages(videoId) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch video page: ${response.status}`);
      }

      const html = await response.text();
      const subtitleTracks = this.extractSubtitleTracks(html);

      if (!subtitleTracks || subtitleTracks.length === 0) {
        return [];
      }

      return subtitleTracks.map(track => ({
        code: track.languageCode,
        name: track.name?.simpleText || track.languageCode,
        isAutoGenerated: track.kind === 'asr'
      }));

    } catch (error) {
      console.error('Error getting available languages:', error);
      return [];
    }
  }

  /**
   * Test if transcript is available for a video
   */
  async isTranscriptAvailable(videoId) {
    try {
      const languages = await this.getAvailableLanguages(videoId);
      return languages.length > 0;
    } catch (error) {
      console.error('Error checking transcript availability:', error);
      return false;
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YouTubeTranscriptAPI;
} else if (typeof window !== 'undefined') {
  window.YouTubeTranscriptAPI = YouTubeTranscriptAPI;
}
