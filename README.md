# 🎬 YouTube AI Video Analyzer

A powerful Chrome extension that provides AI-powered analysis of YouTube videos using Google's Gemini API. Get comprehensive video summaries, key points, and insights with clickable timestamps - all without leaving the YouTube page.

## ✨ Features

- **🤖 AI-Powered Analysis**: Get comprehensive video summaries using Google Gemini AI
- **📝 Smart Transcript Extraction**: Automatically extracts and analyzes video transcripts when available
- **⏰ Clickable Timestamps**: Jump to specific moments with timestamp navigation
- **🎯 Key Points Extraction**: Identify and highlight the most important content
- **🔄 Multiple API Key Support**: Rotate between multiple API keys to avoid rate limits
- **⚙️ Model Selection**: Choose from Gemini Flash, Flash Lite, and Pro models
- **📱 YouTube Homepage Integration**: Analyze videos directly from YouTube homepage
- **🎨 Custom Analysis Prompts**: Create and manage your own analysis templates
- **🌟 Favorite Models**: Mark your preferred AI models for quick access
- **📋 Multiple Analysis Types**: Full Video Brief, Longer Video Brief, and custom prompts

[![Watch the video](https://img.youtube.com/vi/qnbbILwU__0/maxresdefault.jpg)](https://youtu.be/qnbbILwU__0)

### [How to Use](https://youtu.be/qnbbILwU__0)

## 🚀 Quick Start

### 1. Installation

1. **Download** this repository:
   ```bash
   git clone https://github.com/charithharshana/yt-ai-analyzer.git
   ```
   Or click "Code" → "Download ZIP" and extract

2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top right corner)
4. **Click "Load unpacked"** and select the extension folder
5. The extension icon should now appear in your Chrome toolbar

### 2. Get Your API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key (starts with `AIza...`)
5. (Optional) Create multiple keys for better performance

### 3. Configure the Extension

1. Click the extension icon in Chrome toolbar
2. Click "Settings" button
3. Paste your API key(s) in the "Gemini API Keys" field (one per line)
4. Select your preferred AI model:
   - **Gemini 2.5 Flash** ⭐ - Fast and efficient (recommended)
   - **Gemini 2.5 Pro** ⭐ - Most detailed analysis
   - **Gemini 2.5 Flash Lite** - Lightweight option
5. Click "Save Settings"
6. You're ready to go!

## 📖 How to Use

### Method 1: Analyze Individual Videos
1. **Go to any YouTube video** (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)
2. **Look for the purple "AI Analyze" button** below the video player
3. **Click the button** to start analysis
4. **Wait for the AI analysis** to complete (usually 10-30 seconds)
5. **Review the comprehensive analysis** with clickable timestamps

### Method 2: Analyze from YouTube Homepage
1. **Visit YouTube homepage** (https://www.youtube.com/)
2. **Look for small "A" buttons** on video thumbnails
3. **Click any "A" button** to analyze that video
4. **Analysis opens in a new tab** with full results

### Method 3: Auto-Analysis (Optional)
1. **Enable "Auto-analyze" in settings**
2. **Visit any YouTube video**
3. **Analysis starts automatically** after page loads
4. **Perfect for hands-free analysis**

## 🎯 What You Get

### 📊 Comprehensive Analysis
- **📝 Full Video Summary**: Complete overview from start to finish
- **🔑 Key Points**: Most important topics and insights extracted
- **⏰ Clickable Timestamps**: Jump to specific moments instantly
- **📋 Structured Content**: Well-organized, easy-to-read format
- **💡 Actionable Insights**: Practical takeaways you can use

### 🎨 Customization Options
- **🤖 Multiple AI Models**: Choose from Gemini Pro, Flash, and more
- **📝 Custom Prompts**: Create your own analysis templates
- **⭐ Favorite Models**: Mark preferred models for quick access
- **🔄 API Key Rotation**: Use multiple keys to avoid rate limits

## ⚙️ Settings & Configuration

### 🔑 API Key Management
- **Multiple Keys Supported**: Add multiple API keys for better performance
- **Automatic Rotation**: Keys rotate automatically to prevent rate limits
- **Secure Storage**: Keys stored safely in Chrome's secure storage

### 🤖 AI Model Options
- **Gemini 2.5 Pro**: Best for detailed, comprehensive analysis
- **Gemini 2.5 Flash**: Faster analysis, great for quick summaries
- **Custom Models**: Add your own model IDs for specialized needs
- **Favorite System**: Star your preferred models for easy access

### 📝 Analysis Prompts
- **Full Video Brief**: Complete summary with timestamps (default)
- **Custom Prompts**: Create your own analysis templates
- **Variable Support**: Use {transcript}, {title}, {description}, {videoUrl}
- **Template Management**: Edit, delete, and organize your prompts

## 🔧 Available AI Models

| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| **Gemini 2.5 Flash** ⭐ | Fast | High | Quick summaries, daily use (default) |
| **Gemini 2.5 Pro** ⭐ | Medium | Highest | Detailed analysis, research |
| **Gemini 2.5 Flash Lite** | Fastest | Good | Basic summaries, lightweight |

⭐ = Recommended models

### 📝 Analysis Prompts

- **Full Video Brief** - Quick summary with key points and timestamps
- **Longer Video Brief** - Comprehensive timeline analysis with detailed coverage
- **Default Analysis Prompt** - Traditional detailed analysis
- **Custom Prompts** - Create your own analysis templates

## 💰 Cost & Quotas

- **Free Tier**: Generous free quotas for personal use
- **API Costs**: Very affordable - typically $0.01-0.05 per video analysis
- **Multiple Keys**: Use multiple API keys to increase your daily quota
- **Rate Limits**: Automatic key rotation prevents hitting limits

## 🔒 Privacy & Security

- **🔐 Local Storage**: API keys stored securely in Chrome's encrypted storage
- **🚫 No Data Collection**: We don't collect or store any personal data
- **🎯 Direct API Calls**: Video data sent only to Google's Gemini API
- **🗑️ No Persistence**: Analysis results not stored permanently

## 🛠️ Troubleshooting

### ❌ Common Issues

| Problem | Solution |
|---------|----------|
| **"No API keys configured"** | Go to Settings → Add your Gemini API key |
| **"Analysis failed"** | Check API key validity & quota remaining |
| **Button not appearing** | Refresh YouTube page, ensure extension is enabled |
| **Slow analysis** | Try Gemini Flash model for faster results |
| **Rate limit errors** | Add multiple API keys for rotation |

### 🔍 Debug Steps

1. **Check Extension Status**
   - Go to `chrome://extensions/`
   - Ensure "YouTube AI Video Analyzer" is enabled
   - Look for any error messages

2. **Verify API Keys**
   - Open extension settings
   - Click "Test Configuration" button
   - Ensure keys are valid and have quota

3. **Browser Console**
   - Press F12 on YouTube page
   - Check Console tab for error messages
   - Look for network request failures

### 💡 Pro Tips

- **Use Multiple API Keys**: Add 2-3 keys for better performance
- **Choose Right Model**: Flash for speed, Pro for quality
- **Check Video Captions**: Extension works best with videos that have captions
- **Clear Cache**: If issues persist, try clearing browser cache

## 🚀 Advanced Usage

### Custom Analysis Prompts

Create your own analysis templates:

```
Analyze this video about {title}:

Transcript: {transcript}

Please provide:
1. Main topic summary
2. Key learning points
3. Practical applications
4. Target audience

Video URL: {videoUrl}
```

### Model Management

- **Add Custom Models**: Enter any Gemini model ID
- **Favorite System**: Star frequently used models
- **Edit Names**: Customize model display names
- **Remove Models**: Delete unused custom models

## 📁 Project Structure

```
youtube-ai-analyzer/
├── 📄 manifest.json          # Extension configuration
├── 🎨 content.js/css          # YouTube page integration
├── 🏠 home-content.js/css     # YouTube homepage features
├── ⚙️ background.js           # API handling & analysis
├── 🔧 utils.js               # Utility functions
├── 🖼️ popup.html/js/css       # Extension popup
├── ⚙️ settings.html/js/css    # Settings page
├── 📝 youtube-transcript.js   # Transcript extraction
├── 🎯 icons/                 # Extension icons
└── 📖 README.md              # Documentation
```

## 🤝 Contributing

We welcome contributions! Here's how you can help:

- **🐛 Report Bugs**: Open an issue with details
- **💡 Suggest Features**: Share your ideas
- **🔧 Submit Code**: Fork, improve, and create pull requests
- **📖 Improve Docs**: Help make instructions clearer

## 📄 License

This project is open source and available under the MIT License. Feel free to modify and distribute according to your needs.

---

**Made with ❤️ for the YouTube community**

*Get smarter insights from every video you watch!*
