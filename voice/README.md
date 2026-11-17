# Sona voice guide

The frontend widget is `voice/voice.js`, which is loaded on every page. It contains **no API key**. It talks only to this Cloudflare Worker proxy. The Worker holds the xAI key as a secret and adds the system prompt (`system-prompt.md`) on the server side.

## Files
| File | Purpose |
|---|---|
| `voice.js` | Floating 40px mic button, an inline popover (a bottom sheet on mobile), Web Speech API speech-to-text, `speechSynthesis` spoken replies, text fallback, transcript. Set the `VOICE_PROXY_URL` constant at the top. |
| `system-prompt.md` | The guide's persona and site knowledge (source of truth). |
| `build-prompt.mjs` | Regenerates `prompt.js` from `system-prompt.md`. |
| `prompt.js` | Generated; imported by the worker. |
| `worker.js` | The proxy: POST `/chat` → `https://api.x.ai/v1/chat/completions` (model `grok-4.7`). |
| `wrangler.toml` | Worker config: allowed origin, model, rate-limit binding. |

## Deploy (when the Cloudflare account and xAI key are ready)
```bash
cd voice
npm i -g wrangler          # or: npx wrangler ...
wrangler login             # owner signs in to Cloudflare
node build-prompt.mjs      # refresh prompt.js after any prompt edit
wrangler secret put XAI_API_KEY   # paste the owner's xAI key when prompted (never commit it)
wrangler deploy            # prints https://sona-voice.<subdomain>.workers.dev
curl https://sona-voice.<subdomain>.workers.dev/health   # {"ok":true}
```
Then set `const VOICE_PROXY_URL = "https://sona-voice.<subdomain>.workers.dev/chat";` in `voice/voice.js` and publish it. Until that constant is set, the widget shows "The voice guide is coming online soon."

## Behavior and safety
- CORS: only `https://aiyogiwake.github.io` (change `ALLOWED_ORIGINS` for a custom domain; comma-separated). Requests from other origins get a 403.
- Rate limit: 20 requests per minute per IP using the Workers Rate Limiting binding, with an in-memory per-isolate fallback.
- Input limits: user and assistant roles only (any client "system" messages are dropped), the last 12 messages, and 1,000 characters each. `max_tokens` is 300.
- Optional hardening: add Cloudflare Turnstile, or set a usage or budget cap on the xAI key.
- Speech-to-text uses the browser's Web Speech API (Chrome, Edge, Safari). Firefox falls back to typing.
