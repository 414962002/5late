# Translation Workflow

## Overview

```
User types text
      ↓
sidebar.js (Firefox Extension)
      ↓
Cloudflare Worker (proxy + auth)
      ↓
Google Translate API
      ↓
Result back to extension
```

---

## Step 1 — User Input (sidebar.js)

User types in the input textarea.

- Small input (typing): waits 1.5 seconds after last keystroke (debounce)
- Large input (paste, >50 chars at once): translates immediately
- Ctrl+Enter: triggers translation immediately at any time
- Textarea auto-resizes as content grows

---

## Step 1a — Sidebar vs Tab Mode (sidebar.js)

The extension runs in two modes:

| Mode    | State saved                 | Autocomplete | Clear button    |
| ------- | --------------------------- | ------------ | --------------- |
| Sidebar | yes (browser.storage.local) | on           | "clear storage" |
| Tab     | no (session only)           | off          | "clear history" |

Mode is detected from URL param `?mode=tab`.

---

## Step 2 — Auto Language Swap (sidebar.js)

Before translating, checks if the target language matches the input script.
Only applies to EN↔RU pair.

| Input script | Target          | Action            |
| ------------ | --------------- | ----------------- |
| Cyrillic     | RU              | swap target to EN |
| Latin        | EN              | swap target to RU |
| Any          | DE / FR / other | no swap           |

---

## Step 3 — Text Chunking (sidebar.js)

If text is longer than 3500 chars, splits into chunks by sentences.
Each chunk is translated separately and results are joined.

---

## Step 4 — Token Generation (sidebar.js + worker.js)

Extension generates a daily auth token:

```
token = SHA-256(today_date + SECRET_SALT)
```

Token is sent in the `X-Token` header with every request.
Worker generates the same token and compares — if mismatch, returns 401.

---

## Step 5 — Request to Cloudflare Worker (sidebar.js)

Extension sends POST to `https://5late-translator.5lateextentionfirefox.workers.dev/translate`

```json
{
  "text": "...",
  "target": "en"
}
```

Headers:

- `Content-Type: application/json`
- `X-Token: <daily_token>`

---

## Step 6 — Worker Validation (worker.js)

Worker checks:

1. Rate limit — max 100 requests per minute per IP
2. Token — must match daily token
3. Input — text must exist, max 5000 chars

---

## Step 7 — Query Building (worker.js)

Worker detects the input type and builds the Google query accordingly:

| Input type           | Query sent to Google                   | sl=  |
| -------------------- | -------------------------------------- | ---- |
| Single Cyrillic word | `значение слова {word}` | ru   |
| Single Latin word    | `{word}`                             | en   |
| Sentence / other     | `{text}`                             | auto |

Single word = letters only, max 30 chars (`/^[\p{L}]{1,30}$/u`)

---

## Step 8 — Google Translate Request (worker.js)

Primary endpoint:

```
https://translate.googleapis.com/translate_a/single
  ?client=gtx
  &sl={sourceLang}
  &tl={targetLang}
  &dt=t
  &q={encodeURIComponent(query)}
```

If primary fails → fallback to `clients5.google.com/translate_a/t`

---

## Step 9 — Response Cleanup (worker.js)

For single Cyrillic words, strips the context prefix from the result:

```
"meaning of the word peace" → "peace"
"значение слова совет" → "advice"
```

Cleanup regexes:

```javascript
.replace(/^значение слова\s+/i, "")
.replace(/^meaning of (the )?word\s+/i, "")
.replace(/^meaning of /i, "")
```

---

## Step 10 — Result Back to Extension (sidebar.js)

Worker returns:

```json
{
  "translatedText": "...",
  "detectedLang": "ru",
  "source": "gtx"
}
```

Extension:

1. Displays translation in output textarea (auto-resizes)
2. Normalizes detected language (short Cyrillic words → always `ru`)
3. Auto-copies result to clipboard without stealing focus from input
4. Saves state to browser storage (sidebar mode only)
5. Updates header line 1: `detected: RU → translated: EN → copied ✓`
6. Updates header line 2: `cloudflare worker • 12 chars • 377ms • secure ✓`
   - Shows `fallback ⚠` if Cloudflare Worker was not used
   - Shows `slow ⚠` if response took more than 2000ms

---

## Fallback Chain

```
Cloudflare Worker (primary)
      ↓ if fails
Google GTX direct (sidebar.js fallback)
      ↓ if fails
Google clients5 direct (sidebar.js fallback)
```
