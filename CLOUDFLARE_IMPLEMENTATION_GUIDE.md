# Cloudflare Worker Implementation Guide

## Why Implement This?

**Current Problem:**
- Google blocks direct browser requests (429 errors)
- Extension is fragile and unreliable

**Solution:**
- Cloudflare Worker acts as proxy
- 80-95% reduction in blocking
- More stable and reliable

---

## Step-by-Step Implementation

### Step 1: Create Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up (free, no credit card needed)
3. Verify your email
4. Log in to dashboard

### Step 2: Create Worker

1. In Cloudflare dashboard, click **Workers & Pages** in left sidebar
2. Click **Create Application**
3. Click **Create Worker**
4. Give it a name (e.g., `5late-translator`)
5. Click **Deploy**

### Step 3: Edit Worker Code

1. After deployment, click **Edit Code**
2. Delete all existing code
3. Copy the entire contents of `cloudflare-worker.js`
4. Paste into the editor
5. Click **Save and Deploy**

### Step 4: Get Your Worker URL

Your Worker URL will be:
```
https://5late-translator.workers.dev/translate
```

(Replace `5late-translator` with your actual worker name)

### Step 5: Test Worker

Test in browser or with curl:

**Browser test:**
```
https://5late-translator.workers.dev/translate?text=hello&tl=ru
```

**Expected response:**
```json
{
  "translatedText": "привет",
  "detectedLang": "en",
  "source": "gtx"
}
```

### Step 6: Update Extension

**Option A: Simple replacement (recommended)**

Open `sidebar.js` and find the `translateChunk` function (around line 249).

Replace the entire function with the one from `sidebar-with-worker.js`.

Then update these two lines at the top:
```javascript
const WORKER_URL = "https://YOUR-WORKER-NAME.workers.dev/translate";
const USE_WORKER = true; // Change to true
```

**Option B: Manual update**

1. Open `sidebar.js`
2. Find line ~249: `async function translateChunk(text, sourceLang, targetLang) {`
3. Add at the top of the file (after line 1):
```javascript
const WORKER_URL = "https://YOUR-WORKER-NAME.workers.dev/translate";
const USE_WORKER = true;
```

4. Replace the entire `translateChunk` function with:
```javascript
async function translateChunk(text, sourceLang, targetLang) {
  if (USE_WORKER) {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, target: targetLang })
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
  
  // Keep existing fallback code here...
}
```

### Step 7: Update Manifest Permissions

Open `manifest.json` and add your Worker domain to permissions:

```json
"permissions": [
  "https://translate.googleapis.com/*",
  "https://clients5.google.com/*",
  "https://*.workers.dev/*",
  "clipboardWrite",
  "storage"
]
```

### Step 8: Test Extension

1. Reload extension in Firefox
2. Open sidebar
3. Try translating text
4. Check browser console for `[TRANSLATE]` logs
5. Should see faster, more reliable translations

---

## Verification Checklist

- [ ] Cloudflare account created
- [ ] Worker deployed
- [ ] Worker URL tested in browser
- [ ] Extension code updated with Worker URL
- [ ] USE_WORKER set to true
- [ ] Manifest permissions updated
- [ ] Extension reloaded
- [ ] Translation tested and working
- [ ] No console errors

---

## Troubleshooting

### Worker returns 404
- Check Worker URL is correct
- Ensure `/translate` endpoint is in URL
- Verify Worker is deployed

### Worker returns 500
- Check Worker logs in Cloudflare dashboard
- Look for errors in Worker code
- Test Worker directly in browser

### Extension still uses direct API
- Verify `USE_WORKER = true`
- Check console logs for Worker requests
- Ensure Worker URL is correct

### CORS errors
- Worker code includes CORS headers
- Check browser console for specific error
- Verify Worker is handling OPTIONS requests

### Translations fail
- Test Worker URL directly in browser
- Check if Google is blocking Worker IP
- Try again in a few minutes (temporary block)

---

## Cost & Limits

**Cloudflare Workers Free Tier:**
- 100,000 requests per day
- 10ms CPU time per request
- Unlimited bandwidth

**For your extension:**
- Average user: ~100-500 translations/day
- Free tier supports: ~200-1000 users
- More than enough for personal use

**If you exceed limits:**
- Upgrade to Workers Paid ($5/month)
- 10 million requests/month included

---

## Monitoring

**Check Worker usage:**
1. Go to Cloudflare dashboard
2. Click **Workers & Pages**
3. Click your Worker name
4. View **Metrics** tab

**What to monitor:**
- Requests per day
- Success rate
- Error rate
- CPU time

---

## Rollback Plan

**If Worker doesn't work:**

1. Set `USE_WORKER = false` in sidebar.js
2. Reload extension
3. Extension will use direct API again

**No need to redeploy or change anything else.**

---

## Advanced: Custom Domain (Optional)

Instead of `*.workers.dev`, use your own domain:

1. Add domain to Cloudflare
2. Go to Worker settings
3. Add custom route: `translate.yourdomain.com/*`
4. Update extension with new URL

**Benefits:**
- Professional URL
- Better branding
- More control

---

## Security Notes

**Worker is public:**
- Anyone can use your Worker URL
- Add rate limiting if needed
- Monitor usage regularly

**Rate limiting (optional):**
Add to Worker code:
```javascript
// Limit to 100 requests per minute per IP
const rateLimiter = new Map();

// Check rate limit
const ip = request.headers.get('CF-Connecting-IP');
const now = Date.now();
const requests = rateLimiter.get(ip) || [];
const recentRequests = requests.filter(t => now - t < 60000);

if (recentRequests.length >= 100) {
  return new Response("Rate limit exceeded", { status: 429 });
}

recentRequests.push(now);
rateLimiter.set(ip, recentRequests);
```

---

## Next Steps After Implementation

1. **Test thoroughly** - Try all languages, large texts, edge cases
2. **Monitor usage** - Check Cloudflare dashboard daily for first week
3. **Update documentation** - Add Worker info to README
4. **Update privacy policy** - Mention data passes through your Worker
5. **Create new ZIP** - Package updated extension for submission

---

## Comparison: Before vs After

### Before (Direct API)
```
Extension → Google Translate
```
- ❌ Browser fingerprint detected
- ❌ Extension origin visible
- ❌ Frequent 429 errors
- ❌ CAPTCHA redirects
- ❌ Unreliable

### After (Worker Proxy)
```
Extension → Cloudflare Worker → Google Translate
```
- ✅ Server-side request
- ✅ Cloudflare IP (trusted)
- ✅ 80-95% fewer blocks
- ✅ Caching support
- ✅ Much more reliable

---

## Estimated Time

- **Setup Cloudflare account**: 5 minutes
- **Deploy Worker**: 5 minutes
- **Update extension code**: 10 minutes
- **Test and verify**: 10 minutes

**Total: ~30 minutes**

---

## Support

**Cloudflare Workers Documentation:**
https://developers.cloudflare.com/workers/

**Cloudflare Community:**
https://community.cloudflare.com/

**Worker Limits:**
https://developers.cloudflare.com/workers/platform/limits/

---

## Summary

Implementing the Cloudflare Worker will make your extension **much more stable and reliable**. It's free, takes ~30 minutes, and solves the rate limiting problem.

**Recommended:** Implement this before submitting to Firefox Add-ons store for better user experience.
