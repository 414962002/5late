# Cloudflare Workers Setup

*Windows 11 / Wrangler v4 / Cloudflare*

&nbsp;

### menu:

```
Step 1: Install Wrangler Locally
Step 2: Create API Token
Step 3: Create Project Structure
Step 4: Find Your Account ID and Verify Token
Step 5: Deploy Your Worker
```

&nbsp;

## Step 1: Install Wrangler Locally

**Note:** *Cloudflare recommends local installation (not global) for better security, team consistency, and avoiding permission issues.*

your project folder:

```powershell
npm install --save-dev wrangler
```

verify installation:

```powershell
npx wrangler --version
```

&nbsp;

## Step 2: Create API Token

1. `https://dash.cloudflare.com/`
2. Manage account → API Tokens
3. `"Create Token"`
4. `"Edit Cloudflare Workers"`

```
Recommended Minimal Token
Keep ONLY:

Workers Scripts - Edit
Workers KV Storage - Edit (if needed)
Workers R2 Storage - Edit (if needed)
```

5. `"Continue to summary"`
6. `"Create Token"`

&nbsp;

## Step 3: Create Project Structure

Create these additional files in your project folder:

```
.env
wrangler.toml
src/index.js
```

&nbsp;

**.env:**

```
CLOUDFLARE_API_TOKEN=your_api_token_here
```

*Replace `YOUR_ACCOUNT_ID` with your Cloudflare Account ID (see Step 4 for how to find it).*

&nbsp;

**wrangler.toml:**

```toml
name = "5late-translator"
main = "src/index.js"
compatibility_date = "2026-03-11"
account_id = "YOUR_ACCOUNT_ID"
```

Replace `YOUR_ACCOUNT_ID` with your Cloudflare Account ID (see Step 4 for how to find it).

&nbsp;

**src/index.js:**
*Create `src/` and here is the `index.js`:*

*example of the .js:*
`https://github.com/[your-username]/translate-extension/blob/main/src/index.js`

**What it contains:**

```
- Daily rotating token validation (SHA-256)
- Rate limiting (100 requests/minute per IP)
- Proxy to Google Translate (GTX + clients5 fallback)
- CORS headers and error handling
- Falls back from GTX to clients5 if needed
- Returns `"service": "cloudflare worker"` to identify the Worker handled the request
```

If you need to modify the Worker:

1. Edit `src/index.js` locally
2. Run `npx wrangler deploy` to deploy changes
3. Your changes are live immediately

&nbsp;

## Step 4: Find Your Account ID and Verify Token

**Find Your Account ID:**

1. Go to https://dash.cloudflare.com/
2. Look on the browser's address bar -
   `https://dash.cloudflare.com/<your account ID>/home/developer-platform`
3. Copy your **Account ID** (32-character hex string)
4. Update `wrangler.toml` with this ID:
   ```toml
   account_id = "your_account_id_here"
   ```

**Verify Token is Valid:**

```powershell
curl.exe "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/tokens/verify" `
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

Replace:

- `YOUR_ACCOUNT_ID` - Your Cloudflare Account ID from above
- `YOUR_API_TOKEN` - Your API token from Step 1

Expected response:

```json
{
  "result": {
    "status": "active"
  },
  "success": true
}
```

If you get `"status": "active"`, your token is valid and ready to use.

&nbsp;

## Step 5: Deploy Your Worker

**First time deployment:**

```powershell
npx wrangler deploy
```

&nbsp;

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

Your Worker is now live at: `https://5late-translator.5lateextentionfirefox.workers.dev/translate`

(Replace `5late-translator` with your actual Worker name if different)

&nbsp;

**Verify deployment:**

*Test your Worker is working:*

```powershell
curl.exe -X POST "https://5late-translator.5lateextentionfirefox.workers.dev/translate" `
  -H "Content-Type: application/json" `
  -H "X-Token: $(node -e "const d = new Date().toISOString().slice(0,10); const c = require('crypto'); console.log(c.createHash('sha256').update(d + 'my-cat-fluffy-loves-small-fish-2026').digest('hex'))")" `
  -d '{"text":"hello","target":"es"}'
```

*Expected response:*

```json
{
  "translatedText": "hola",
  "detectedLang": "en",
  "source": "gtx",
  "service": "cloudflare worker"
}
```

*If you see `"service": "cloudflare worker"`, your Worker is working correctly!*

&nbsp;

## Quick Reference

```powershell
# First time only (in project folder)
npm install --save-dev wrangler

# Every time you edit
# 1. Edit src/index.js
# 2. Run:
npx wrangler deploy
```

&nbsp;

---

&nbsp;

## Security Notes

- **Never commit `.env` to GitHub** - Add to `.gitignore`
- **Never share your API token** - Treat it like a password
- **Use minimal permissions** - Only "Workers Scripts - Edit" is needed
- **Rotate tokens regularly** - Delete old tokens from Cloudflare dashboard
- **Use environment variables** - Don't hardcode tokens in code
- **Local installation** - Safer than global, avoids permission issues

&nbsp;

## How the Worker Works

**Request Flow:**

1. Extension sends POST to `/translate` with text and target language
2. Worker validates token (daily rotating, generated from SECRET_SALT)
3. Worker checks rate limit (100 requests/minute per IP)
4. Worker tries GTX endpoint first
5. If GTX fails, falls back to clients5
6. Worker returns: `{ translatedText, detectedLang, source, service: "cloudflare worker" }`
7. Extension shows "cloudflare worker" in status (indicates Worker handled it)

&nbsp;

**Token Generation:**

- Token changes daily (based on date)
- Generated from: `SHA256(YYYY-MM-DD + SECRET_SALT)`
- Extension generates same token locally using same logic
- Both must match for request to succeed

&nbsp;

**Rate Limiting:**

- 100 requests per minute per IP
- Resets after 1 minute of inactivity
- Returns 429 status if exceeded

&nbsp;

## Troubleshooting

**"Unknown argument: pull"**

- `pull` command doesn't exist in Wrangler v4
- Use `npx wrangler deploy` instead

&nbsp;

**"Authentication failed (status: 400) [code: 9106]"**

- Make sure `wrangler.toml` has `account_id` field set to your Account ID
- Check `.env` has `CLOUDFLARE_API_TOKEN=` (not `CF_API_TOKEN`)
- Verify token is still active using curl command from Step 4
- Make sure `.env` is in your project folder
- Restart terminal after changing `.env`
- Alternative: Set token directly in PowerShell:
  ```powershell
  $env:CLOUDFLARE_API_TOKEN="your_token_here"
  npx wrangler deploy
  ```

&nbsp;

**"Unexpected \xff" error during deployment**

- File encoding issue - `src/index.js` has BOM (Byte Order Mark)
- Solution: Save `src/index.js` as UTF-8 without BOM
- In VS Code: Click "UTF-8" in bottom right → "Save with Encoding" → "UTF-8"

&nbsp;

**"Cannot find module"**

- Make sure `src/index.js` exists
- Check `wrangler.toml` has correct `main = "src/index.js"`

&nbsp;

**"wrangler: The term 'wrangler' is not recognized"**

- Use `npx wrangler` (not just `wrangler`)
- Make sure you're in your project folder
- Verify `npm install --save-dev wrangler` completed successfully

&nbsp;

**"Invalid or expired token" from Worker**

- Extension and Worker token generation must match
- Both use same `SECRET_SALT` value
- Check system time is correct (token is date-based)
- Verify `sidebar.js` has same `SECRET_SALT` as `src/index.js`

&nbsp;

**Worker returns 429 (Rate limit exceeded)**

- You've made 100+ requests in the last minute
- Wait 1 minute and try again
- Increase `RATE_LIMIT` in `src/index.js` if needed (then redeploy)

&nbsp;

**Worker returns 401 (Unauthorized)**

- Token mismatch between extension and Worker
- Verify both use same `SECRET_SALT`: `"my-cat-fluffy-loves-small-fish-2026"`
- Check system time is correct (token is date-based)
- Try restarting the browser extension

&nbsp;

---

&nbsp;
