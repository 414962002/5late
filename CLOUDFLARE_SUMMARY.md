# Cloudflare Worker - Developer Guide  

&nbsp;

## Menu

```
Part 1: CLOUDFLARE Implementation
- 01: sidebar.js - Constants
- 02: sidebar.js - Token Generation
- 03: sidebar.js - translateChunk Function
- 04: manifest.json - Permissions
- 05: Test Extension

Part 2: CLOUDFLARE Use Remote
- 01: Create Cloudflare Account
- 02: Create Worker
- 03: Deploy cloudflare-worker.js Code
- 04: Get Your Worker URL
- 05: Test Worker

Part 3: CLOUDFLARE Use Local
- 01: Install Wrangler Locally
- 02: Create API Token
- 03: Create Project Structure
- 04: Find Your Account ID
- 05: Deploy & Edit Worker (local workflow)
```

&nbsp;

## Part 1: CLOUDFLARE Implementation

***Purpose:** Build extension with Worker integration from the start*

**Architecture:**
```
`Extension → Cloudflare Worker → Google Translate`
```

***Why:** Google blocks browser requests (429 errors). Worker proxy = 80-95% fewer blocks.*
 
&nbsp;

### 01: [sidebar.js](sidebar.js) - Constants

*Set Worker URL and enable Worker mode:*

Add at top:
```javascript
const WORKER_URL = "https://YOUR-WORKER-NAME.workers.dev/translate";
const USE_WORKER = true;
const SECRET_SALT = "my-cat-fluffy-loves-small-fish-2026";
```
 
&nbsp;

### 02: sidebar.js - Token Generation

*Generate daily rotating token for Worker authentication:*

```javascript
async function generateDailyToken() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const token = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(today + SECRET_SALT)
  );
  return Array.from(new Uint8Array(token))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```
 
&nbsp;

### 03: sidebar.js - translateChunk Function

*Main translation function that sends requests to Worker:*

```javascript
async function translateChunk(text, sourceLang, targetLang) {
  if (USE_WORKER) {
    const token = await generateDailyToken();
    
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Token": token
      },
      body: JSON.stringify({ text, target: targetLang })
    });

    if (!response.ok) {
      throw new Error(`Worker failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.message || data.error);
    }

    return {
      translatedText: data.translatedText,
      detectedLang: data.detectedLang || 'auto'
    };
  }
  
  // Fallback to direct API if needed
}
```
 
&nbsp;

### 04: manifest.json - Permissions

*Add Worker domain to extension permissions:*

```json
"permissions": [
  "https://translate.googleapis.com/*",
  "https://clients5.google.com/*",
  "https://*.workers.dev/*",
  "clipboardWrite",
  "storage"
]
```
 
&nbsp;

### 05: Test Extension

*Verify extension works with Worker:*

```
1. Reload extension in Firefox
2. Open sidebar
3. Translate text
4. Check console for Worker requests
```
 
&nbsp;


## Part 2: CLOUDFLARE Use Remote

***Purpose:** Create account, Worker, get URLs and IDs (initial setup)*

### 01: Create Cloudflare Account  

```
1. `https://dash.cloudflare.com/sign-up`  
2. Verify email  
```

&nbsp;

### 02: Create Worker

1. Dashboard → **Workers & Pages**
2. **Create Application** → **Create Worker**
3. Name: `5late-translator`
4. **Deploy**
 
&nbsp;

### 03: Deploy [cloudflare-worker.js](https://github.com/414962002/5late/blob/main/cloudflare-worker-secure.js) Code

1. Click **Edit Code**
2. Delete existing code
3. Paste `cloudflare-worker.js` content
4. **Save and Deploy**
 
&nbsp;

**Worker contains:**
- Daily token validation (SHA-256)
- Rate limiting (100 req/min per IP)
- GTX → clients5 fallback
- CORS headers
 
&nbsp;

### 04: Get Your Worker URL  

*Replace `5late-translator` with your worker name*  

Format: `https://5late-translator.workers.dev/translate`  
 
&nbsp;

### 05: Test Worker

**Browser:**
```
https://5late-translator.workers.dev/translate?text=hello&tl=ru
```

**Expected:**
```json
{
  "translatedText": "привет",
  "detectedLang": "en",
  "source": "gtx"
}
```
 
&nbsp;

## Part 3: CLOUDFLARE Use Local

***Purpose:** Create and edit Worker files locally (faster than Dashboard editor)*  

### 01: Install Wrangler Locally

```powershell
npm install --save-dev wrangler
npx wrangler --version
```
 
&nbsp;

### 02: Create API Token

1. `https://dash.cloudflare.com/` → Manage account → API Tokens
2. **Create Token** → **Edit Cloudflare Workers**
3. Keep only: **Workers Scripts - Edit**
4. **Create Token**
 
&nbsp;

### 03: Create Project Structure

**.env:**
```
CLOUDFLARE_API_TOKEN=your_api_token_here
```
 
&nbsp;

**wrangler.toml:**
```toml
name = "5late-translator"
main = "src/index.js"
compatibility_date = "2026-03-11"
account_id = "YOUR_ACCOUNT_ID"
```
 
&nbsp;

**src/index.js:**  

```
- Daily rotating token validation (SHA-256)
- Rate limiting (100 req/min per IP)
- GTX + clients5 fallback
- CORS headers
- Returns `"service": "cloudflare worker"`
```

&nbsp;

### 04: Find Your Account ID

```
1. `https://dash.cloudflare.com/`
2. URL shows: `https://dash.cloudflare.com/<ACCOUNT_ID>/home/...`
3. Copy 32-char hex string
4. Update `wrangler.toml`
```

**Verify Token:**
```powershell
curl.exe "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/tokens/verify" `
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

*Expected: `"status": "active"`*
 
&nbsp;

### 05: Deploy Your Worker

```powershell
npx wrangler deploy
```

**Expected output:**
```
⛅️ wrangler 4.72.0
───────────────────
Total Upload: 6.02 KiB / gzip: 1.77 KiB
Uploaded 5late-translator (15.48 sec)
Deployed 5late-translator triggers (5.56 sec)
https://5late-translator.5lateextentionfirefox.workers.dev
Current Version ID: [version-id]
```

*Your Worker is live at: `https://5late-translator.5lateextentionfirefox.workers.dev/translate`*
 
&nbsp;

**Test deployment:**
```powershell
curl.exe -X POST "https://5late-translator.5lateextentionfirefox.workers.dev/translate" `
  -H "Content-Type: application/json" `
  -H "X-Token: $(node -e "const d = new Date().toISOString().slice(0,10); const c = require('crypto'); console.log(c.createHash('sha256').update(d + 'my-cat-fluffy-loves-small-fish-2026').digest('hex'))")" `
  -d '{"text":"hello","target":"es"}'
```
 
&nbsp;

**Expected response:**
```json
{
  "translatedText": "hola",
  "detectedLang": "en",
  "source": "gtx",
  "service": "cloudflare worker"
}
```

*If you see `"service": "cloudflare worker"` - deployment successful!*
 
&nbsp;

**How to edit Worker code later:**

*Example: Change rate limit from 100 to 200 requests/min*  

```
1. Open `src/index.js` in your editor
2. Find line: `const RATE_LIMIT = 100;`
3. Change to: `const RATE_LIMIT = 200;`
4. Save file
5. Run: `npx wrangler deploy`
6. Worker updated immediately (no Dashboard needed)
```

&nbsp;

**Why use local editing:**

```
- Dashboard editor is slow
- No syntax highlighting
- Can't use your IDE
- Local = faster workflow
```

&nbsp;

---

```
Free tier: 100k requests/day
Security: Never commit `.env` to GitHub
```

&nbsp;




