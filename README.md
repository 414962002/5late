# 5LATE - Firefox Sidebar Translate Extension

A Firefox sidebar extension for quick text translation with Google Translate & Cloudflare Worker proxy.

&nbsp;  

## Features

- **Auto Translation**: Paste text, automatic translation after 1.5s
- **Auto Language Detection**: Automatically detects source language
- **10 Languages Supported**: Russian, English, Spanish, French, German, Italian, Japanese, Chinese, Arabic, Hindi
- **Smart EN↔RU Auto-Swap**: Automatically swaps direction based on Cyrillic detection
- **Auto-Copy**: Translation automatically copied to clipboard
- **Text Chunking**: Handles large texts (splits at 3,500 chars, preserves sentences)
- **Separate Tab Mode**: Click extension icon to open translator in a dedicated tab
- **Cloudflare Worker Proxy**: Enhanced reliability with rate limiting protection  
- **State Persistence**: Automatically saves input text, translation results, and language selection in Firefox browser storage   

&nbsp;  

## Project Files

- **`manifest.json`** - Extension configuration, permissions, and metadata
- **`sidebar.html`** - HTML structure for sidebar and tab interface
- **`sidebar.css`** - Styling and layout for the translator interface
- **`sidebar.js`** - Main translation logic, API calls, and UI handling
- **`background.js`** - Background service worker for extension lifecycle
- **`icon16.svg`** - Extension icon (16x16px)
- **`icon32.svg`** - Extension icon (32x32px)
- **`icon48.svg`** - Extension icon (48x48px)
- **`icon96.svg`** - Extension icon (96x96px)

&nbsp;  

## Installation  

### From Firefox Add-ons Store
Coming soon!

&nbsp;  

### Development Installation
1. Open Firefox → `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to extension folder
4. Select `manifest.json`
5. Open sidebar: Click extension icon

&nbsp;

## Usage

1. **Open sidebar**: Click the extension icon
2. **Paste text**: Text is automatically detected
3. **Wait 1.5 seconds**: Translation starts automatically
4. **Result auto-copied**: Translation is copied to clipboard
5. **Change language**: Use dropdown to select target language

&nbsp;  

## 🔧 Architecture

### System Overview

```
┌──────────────────┐
│  Firefox Browser │
│   (Your Device)  │
└────────┬─────────┘
         │
         │ 1. User pastes text
         │ 2. Extension generates daily token
         │ 3. Sends to Worker with token
         │
         ▼
┌─────────────────────────┐
│  Cloudflare Worker      │
│  (Edge Network)         │
│  ┌──────────────────┐   │
│  │ Token Validation │   │
│  │ Rate Limiting    │   │
│  │ Request Routing  │   │
│  └──────────────────┘   │
└────────┬────────────────┘
         │
         │ 4. Validates token
         │ 5. Checks rate limit
         │ 6. Forwards to Google
         │
         ▼
┌─────────────────────────┐
│  Google Translate API   │
│  (GTX Endpoint)         │
│  ┌──────────────────┐   │
│  │ Language Detect  │   │
│  │ Translation      │   │
│  └──────────────────┘   │
└────────┬────────────────┘
         │
         │ 7. Returns translation
         │
         ▼
┌─────────────────────────┐
│  Cloudflare Worker      │
│  ┌──────────────────┐   │
│  │ Response Format  │   │
│  │ CORS Headers     │   │
│  └──────────────────┘   │
└────────┬────────────────┘
         │
         │ 8. Normalized JSON response
         │
         ▼
┌──────────────────┐
│  Firefox Browser │
│  ┌───────────┐   │
│  │ Auto-copy │   │
│  │ Display   │   │
│  │ Save      │   │
│  └───────────┘   │
└──────────────────┘
```

&nbsp;

### Translation Flow

**Step 1: User Input**
- User types or pastes text into input textarea
- Extension waits 1.5 seconds (debounce)

&nbsp;  

**Step 2: Text Processing**
- Check for EN↔RU auto-swap (Cyrillic detection)
- Split text into chunks (max 3,500 chars per chunk)
- Preserve sentence boundaries

&nbsp;  

**Step 3: Authentication**
- Generate daily token: `SHA-256(current_date + secret_salt)`
- Token changes automatically at midnight UTC
- Same algorithm in extension and Worker

&nbsp;  

**Step 4: Request to Worker**
```javascript
POST https://5late-translator.workers.dev/translate
Headers: {
  "Content-Type": "application/json",
  "X-Token": "daily-generated-token"
}
Body: {
  "text": "hello",
  "target": "ru"
}
```

&nbsp;  

**Step 5: Worker Processing**
- Validates token (rejects if invalid)
- Checks rate limit (100 req/min per IP)
- Forwards to Google Translate GTX endpoint
- If GTX fails → tries clients5 endpoint

&nbsp;  

**Step 6: Google Translation**
- Auto-detects source language
- Translates to target language
- Returns JSON response

&nbsp;  


**Step 7: Response Processing**
- Worker normalizes response format
- Adds CORS headers
- Returns to extension

&nbsp;  


**Step 8: Display Results**
- Extension combines chunks (if multiple)
- Auto-copies to clipboard
- Displays in output textarea
- Saves to browser storage

&nbsp;  


### Fallback System

```
Primary:   Cloudflare Worker → Google GTX
           ↓ (if fails)
Fallback1: Direct → Google GTX
           ↓ (if fails)
Fallback2: Direct → Google clients5
           ↓ (if fails)
Error:     Show error message to user
```

&nbsp;  


### Component Responsibilities

#### Extension (sidebar.js)
- **UI Management**: Input/output textareas, dropdowns
- **Token Generation**: Daily SHA-256 token
- **Text Chunking**: Split at sentence boundaries
- **State Management**: Save/restore via browser.storage
- **Auto-copy**: Clipboard integration
- **Debouncing**: 1.5s delay after typing stops

&nbsp;  


#### Cloudflare Worker
- **Authentication**: Token validation
- **Rate Limiting**: 100 req/min per IP
- **Request Proxying**: Forward to Google Translate
- **Response Normalization**: Consistent JSON format
- **Error Handling**: Graceful fallbacks
- **CORS**: Cross-origin headers

&nbsp;  


#### Google Translate API
- **Language Detection**: Auto-detect source language
- **Translation**: Text translation service
- **No Authentication**: Public endpoint
- **No Storage**: Temporary processing only

&nbsp;  


### Data Storage

**Browser Storage (Local)**
```javascript
{
  inputText: "hello",
  outputText: "привет",
  targetLang: "ru",
  timestamp: 1773034433659
}
```

&nbsp;  


**Worker Storage (In-Memory)**
```javascript
// Rate limiting only
{
  "192.168.1.1": {
    count: 45,
    resetTime: 1773034500000
  }
}
```

&nbsp;  


**No Persistent Storage**
- No databases
- No user accounts
- No tracking
- No analytics

&nbsp;  


### Performance Optimization

**Caching**
- Worker responses cached for 1 hour
- Reduces duplicate translation requests
- Faster response times

&nbsp;  


**Chunking**
- Splits large texts at sentence boundaries
- Parallel processing possible (currently sequential)
- Progress indicator for multi-chunk

&nbsp;  


**Debouncing**
- 1.5 second delay after typing stops
- Prevents unnecessary API calls
- Reduces rate limit usage

&nbsp;  


### Scalability

**Current Limits**
- Cloudflare Free Tier: 100,000 requests/day
- Rate Limit: 100 requests/min per IP
- Text Size: 5,000 chars per request
- Chunk Size: 3,500 chars per chunk

&nbsp;  


**Estimated Capacity**
- ~200-1000 active users on free tier
- Average user: 50-100 translations/day
- Peak usage: ~1000 requests/hour supported  

&nbsp;  


## Security & Privacy

### Data Flow
```
Your Browser → Cloudflare Worker → Google Translate → Cloudflare Worker → Your Browser
```

&nbsp;  


### Security Layers

#### 1. Cloudflare (Infrastructure Security)
**Provider**: Cloudflare, Inc.
- **Rate Limiting**: 100 requests/min per IP address
- **DDoS Protection**: Automatic protection against attacks
- **SSL/TLS Encryption**: All traffic encrypted in transit
- **Bot Detection**: Filters malicious automated requests
- **IP-based Blocking**: Prevents abuse from specific addresses

&nbsp;  


#### 2. Extension (Authentication Security)
**Provider**: This extension (5LATE)
- **Daily Rotating Tokens**: SHA-256 hashed authentication tokens
- **Token Validation**: Worker verifies every request
- **Automatic Rotation**: New token generated daily at midnight UTC
- **No Stored Credentials**: No API keys or passwords stored

&nbsp;  


#### 3. Google Translate (Translation Service)
**Provider**: Google LLC
- **HTTPS Only**: All requests use secure connections
- **No Authentication Required**: Public API endpoint
- **No Personal Data**: Only text content is sent
- **Temporary Processing**: Text not stored by Google

&nbsp;  


### Privacy

**What We Collect**: Nothing
- No user accounts
- No tracking
- No analytics
- No personal information

&nbsp;  


**What We Send**:
- Text to translate (to Google Translate via Cloudflare)
- Target language selection
- Authentication token (daily rotating)

&nbsp;  


**What We Store Locally**:
- Last translation (in browser storage)
- Language preference
- Input/output text (for session persistence)

&nbsp;  


**Third-Party Services**:
1. **Cloudflare Workers** - Proxy service (no data retention)
2. **Google Translate** - Translation service (temporary processing)

&nbsp;  


### Security Best Practices

**For Users**:
- Extension is open source (code is auditable)
- No external tracking or analytics
- All data stays in your browser except during translation
- Clear storage button removes all saved data

&nbsp;  


**For Developers**:
- Token-based authentication prevents unauthorized access
- Rate limiting prevents abuse
- Triple fallback system ensures reliability
- No hardcoded secrets or API keys

&nbsp;  


## Permissions

- `https://translate.googleapis.com/*`: Google Translate GTX endpoint
- `https://clients5.google.com/*`: Google Translate clients5 fallback
- `https://*.5lateextentionfirefox.workers.dev/*`: Cloudflare Worker proxy
- `clipboardWrite`: Auto-copy translations
- `storage`: Save state between sessions

&nbsp;  


## Documentation

- `DEPLOYMENT_GUIDE.md` - How to deploy Cloudflare Worker
- `WORKFLOW.md` - Detailed translation workflow

&nbsp;  

---

**Version**: 1.0.0  
**Status**: Production Ready ✅  

&nbsp;  



