# 🚀 Installation Guide

## 📋 Prerequisites

- **Google Chrome** (or Chromium-based browser)
- **Google Account** (for API key)
- **5 minutes** of your time

## 🎯 Step-by-Step Installation

### Step 1: Download the Extension

**Option A: Download ZIP**
1. Click the green "Code" button on GitHub
2. Select "Download ZIP"
3. Extract the ZIP file to a folder (e.g., `Desktop/youtube-ai-analyzer`)

**Option B: Clone Repository**
```bash
git clone https://github.com/charithharshana/yt-ai-analyzer.git
cd yt-ai-analyzer
```

### Step 2: Install in Chrome

1. **Open Chrome Extensions**
   - Go to `chrome://extensions/`
   - Or click ⋮ → More tools → Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the extension folder (containing `manifest.json`)
   - The extension icon should appear in your toolbar

### Step 3: Get Your API Key

1. **Visit Google AI Studio**
   - Go to [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
   - Sign in with your Google account

2. **Create API Key**
   - Click "Create API Key"
   - Copy the generated key (starts with `AIza...`)
   - **Optional**: Create 2-3 keys for better performance

### Step 4: Configure the Extension

1. **Open Settings**
   - Click the extension icon in Chrome toolbar
   - Click "Settings" button

2. **Add API Keys**
   - Paste your API key(s) in the "Gemini API Keys" field
   - Use one key per line if you have multiple

3. **Choose AI Model**
   - Select "Gemini 2.5 Flash" for speed
   - Or "Gemini 2.5 Pro" for detailed analysis

4. **Save & Test**
   - Click "Save Settings"
   - Click "Test Configuration" to verify everything works

## ✅ Testing Your Installation

### 🎬 Quick Test

1. **Go to a YouTube Video**
   - Visit: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - Or any video with captions

2. **Find the Analyze Button**
   - Look for purple "AI Analyze" button below the video
   - Should appear within 2-3 seconds of page load

3. **Run Analysis**
   - Click the "AI Analyze" button
   - Wait 10-30 seconds for analysis to complete
   - Review the comprehensive results

### 🏠 Test Homepage Feature

1. **Visit YouTube Homepage**
   - Go to `https://www.youtube.com/`
   - Look for small "A" buttons on video thumbnails

2. **Analyze from Homepage**
   - Click any "A" button
   - Analysis opens in new tab
   - Perfect for quick video insights

### 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| **No button appears** | Refresh page, check extension is enabled |
| **"No API keys" error** | Add API key in settings |
| **Analysis fails** | Check API key validity & quota |
| **Slow performance** | Try Gemini Flash model |
| **Button missing** | Disable other YouTube extensions temporarily |

### 🚨 Common Installation Issues

**Extension won't load:**
- Ensure you selected the correct folder (with `manifest.json`)
- Check Chrome console for error messages
- Try restarting Chrome

**API key not working:**
- Verify key starts with `AIza...`
- Check you have quota remaining at [Google AI Studio](https://makersuite.google.com/)
- Try creating a new API key

**Button not appearing:**
- YouTube's layout changes frequently
- Try refreshing the page
- Check browser console (F12) for errors

## 📁 File Structure Check

Your extension folder should contain these files:

```
youtube-ai-analyzer/
├── 📄 manifest.json          ✅ Extension configuration
├── 🎨 content.js/css          ✅ YouTube page integration
├── 🏠 home-content.js/css     ✅ Homepage features
├── ⚙️ background.js           ✅ API handling
├── 🔧 utils.js               ✅ Utilities
├── 🖼️ popup.html/js/css       ✅ Extension popup
├── ⚙️ settings.html/js/css    ✅ Settings page
├── 📝 youtube-transcript.js   ✅ Transcript extraction
├── 🎯 icons/                 ✅ Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── 📖 README.md              ✅ Documentation
└── 📋 INSTALLATION.md        ✅ This guide
```

## 🎉 You're All Set!

### 🚀 What's Next?

1. **Start Analyzing Videos**
   - Visit any YouTube video
   - Click the purple "AI Analyze" button
   - Get instant insights!

2. **Explore Features**
   - Try different AI models
   - Create custom analysis prompts
   - Use homepage analysis buttons

3. **Optimize Performance**
   - Add multiple API keys
   - Choose the right model for your needs
   - Enable auto-analysis for research

### 💡 Pro Tips

- **Bookmark Favorite Videos**: Analyze educational content for better learning
- **Use Multiple Models**: Flash for quick summaries, Pro for detailed analysis
- **Create Custom Prompts**: Tailor analysis to your specific needs
- **Monitor API Usage**: Keep track of your quota in Google AI Studio

### 🆘 Need Help?

- **📖 Read the README**: Comprehensive feature documentation
- **🐛 Check Issues**: Common problems and solutions
- **💬 Ask Questions**: Open an issue on GitHub
- **🔧 Debug Mode**: Use browser console (F12) for error details

---

**🎊 Congratulations!** You've successfully installed YouTube AI Video Analyzer.

Start getting smarter insights from every video you watch! 🧠✨
