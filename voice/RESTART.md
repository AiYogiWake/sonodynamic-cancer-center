# Restarting the on-box voice relay (short-term demo)

The demo relay runs on the Grok Bot box and has two processes: the local proxy (`local-proxy.mjs`, which runs `worker.js` under Node) and a cloudflared quick tunnel. The proxy reads `XAI_API_KEY` from the environment. It never prints or logs the key, and the key never goes in any file.

## 1. Start or restart the proxy (port 8787, CORS only for the live site)
```bash
pkill -f local-proxy.mjs
cd /workspace/sosdt-portal/voice
ALLOWED_ORIGINS=https://aiyogiwake.github.io PORT=8787 nohup node local-proxy.mjs > /workspace/voice-relay/proxy.log 2>&1 &
curl -s localhost:8787/health          # -> {"ok":true}
```
Rate limiting is built in: the in-memory limiter allows 20 requests per minute per IP. Because every request reaches the proxy through the tunnel, `CF-Connecting-IP` carries the visitor's IP.

## 2. Start or restart the quick tunnel
```bash
pkill -f "cloudflared tunnel"
nohup ~/.local/bin/cloudflared tunnel --no-autoupdate --url http://localhost:8787 > /workspace/voice-relay/tunnel.log 2>&1 &
sleep 15; grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /workspace/voice-relay/tunnel.log | head -1
grep -E 'Registered tunnel connection|ERR' /workspace/voice-relay/tunnel.log | tail -3   # need "Registered"
```
If QUIC is blocked, add `--protocol http2`. The tunnel needs outbound access to Cloudflare's edge on **port 7844** (TCP or UDP).

## 3. Point the site at the new URL (every quick-tunnel restart gives a NEW URL)
1. Set `const VOICE_PROXY_URL = "https://<new>.trycloudflare.com/chat";` at the top of `voice/voice.js`.
2. Run `python3 /workspace/build_site.py`, which copies it to `/workspace/site/voice/voice.js`.
3. Push `voice/voice.js` to the `gh-pages` and `main` branches.

## 4. Verify
```bash
T=https://<new>.trycloudflare.com
curl -s $T/health
curl -s $T/chat -H 'Origin: https://aiyogiwake.github.io' -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Hi Sona, how does SoSDT work?"}]}'
curl -s -o /dev/null -w '%{http_code}\n' $T/chat -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"x"}]}'   # 403
```

## Turning it off
`pkill -f local-proxy.mjs; pkill -f "cloudflared tunnel"`, then set `VOICE_PROXY_URL = ""` again. The widget falls back to "coming online soon".

## Permanent option
Deploy `worker.js` to Cloudflare Workers (see README.md). That gives a stable URL and doesn't depend on the box staying up.
