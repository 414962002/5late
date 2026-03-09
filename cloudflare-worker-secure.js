// Cloudflare Worker for 5LATE Translation Proxy
// With daily rotating token + rate limiting

// Secret salt for token generation (change this to your own random string)
const SECRET_SALT = "my-cat-fluffy-loves-fish-2026";

// Rate limiting configuration
const RATE_LIMIT = 100; // requests per window
const RATE_WINDOW = 60000; // 1 minute in milliseconds

// In-memory rate limit storage (resets on Worker restart)
const rateLimitMap = new Map();

// Generate daily token
function getDailyToken() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return hashString(today + SECRET_SALT);
}

// Simple hash function (SHA-256 equivalent for Workers)
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check rate limit for IP
function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_WINDOW };
  
  // Reset if window expired
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + RATE_WINDOW;
  }
  
  // Check limit
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  // Increment counter
  record.count++;
  rateLimitMap.set(ip, record);
  
  return true;
}

// Clean up old rate limit entries (prevent memory leak)
function cleanupRateLimits() {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime + RATE_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Token",
          "Access-Control-Max-Age": "86400",
        }
      });
    }

    const url = new URL(request.url);

    // Only accept /translate endpoint
    if (url.pathname !== "/translate") {
      return new Response(JSON.stringify({ error: "Not found" }), { 
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Only accept POST requests
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { 
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    try {
      // Get client IP
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      
      // Check rate limit
      if (!checkRateLimit(clientIP)) {
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again later."
        }), { 
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Retry-After": "60"
          }
        });
      }

      // Validate token
      const token = request.headers.get('X-Token');
      const validToken = await getDailyToken();
      
      if (!token || token !== validToken) {
        console.log('[AUTH] Invalid token from IP:', clientIP);
        return new Response(JSON.stringify({ 
          error: "Unauthorized",
          message: "Invalid or missing authentication token"
        }), { 
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // Parse request body
      const body = await request.json();
      const text = body.text;
      const targetLang = body.target || body.tl || "en";

      // Validate input
      if (!text) {
        return new Response(JSON.stringify({ error: "Missing text parameter" }), { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // Limit text size
      if (text.length > 5000) {
        return new Response(JSON.stringify({ 
          error: "Text too long",
          message: "Maximum 5000 characters allowed"
        }), { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // Try GTX endpoint first
      const gtxUrl = 
        "https://translate.googleapis.com/translate_a/single" +
        "?client=gtx" +
        "&sl=auto" +
        "&tl=" + encodeURIComponent(targetLang) +
        "&dt=t" +
        "&q=" + encodeURIComponent(text);

      let translatedText = '';
      let detectedLang = 'auto';
      let source = 'gtx';

      try {
        const response = await fetch(gtxUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9"
          }
        });

        if (!response.ok) {
          throw new Error(`GTX failed: ${response.status}`);
        }

        const result = await response.json();
        
        // Parse GTX response
        if (result && result[0]) {
          for (const part of result[0]) {
            if (part[0]) {
              translatedText += part[0];
            }
          }
        }
        
        detectedLang = result[2] || "auto";

      } catch (gtxError) {
        // Fallback to clients5
        console.log('[TRANSLATE] GTX failed, trying clients5:', gtxError.message);

        const clients5Url = "https://clients5.google.com/translate_a/t";
        
        const formData = new URLSearchParams();
        formData.append("client", "dict-chrome-ex");
        formData.append("sl", "auto");
        formData.append("tl", targetLang);
        formData.append("q", text);

        const response = await fetch(clients5Url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`clients5 failed: ${response.status}`);
        }

        const result = await response.json();
        
        // Parse clients5 response
        if (Array.isArray(result?.[0])) {
          translatedText = result[0].map(x => x[0]).join("");
        }

        source = 'clients5';
      }

      // Cleanup rate limits periodically
      if (Math.random() < 0.01) { // 1% chance per request
        cleanupRateLimits();
      }

      // Return normalized response
      return new Response(JSON.stringify({
        translatedText: translatedText,
        detectedLang: detectedLang,
        source: source
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600"
        }
      });

    } catch (error) {
      console.error('[ERROR]', error);
      
      return new Response(JSON.stringify({ 
        error: "Translation failed",
        message: error.message 
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }
};


