// Sona voice-guide proxy: Cloudflare Worker.
// Holds XAI_API_KEY as a secret, injects the system prompt server-side,
// allows CORS only from the GitHub Pages origin, and rate-limits per IP.
import { SYSTEM_PROMPT } from './prompt.js';

const XAI_URL = 'https://api.x.ai/v1/chat/completions';
const MAX_MSGS = 12;          // conversation turns forwarded
const MAX_CHARS = 1000;       // per message
const MEM_LIMIT = 20;         // fallback limiter: requests per window per IP (per isolate)
const MEM_WINDOW_MS = 60_000;
const hits = new Map();

function allowed(env) {
  return (env.ALLOWED_ORIGINS || 'https://aiyogiwake.github.io').split(',').map(s => s.trim());
}
function cors(origin, env) {
  const h = { 'Vary': 'Origin' };
  if (allowed(env).includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}
const json = (obj, status, headers) =>
  new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

async function limited(ip, env) {
  if (env.VOICE_RL && typeof env.VOICE_RL.limit === 'function') {
    const { success } = await env.VOICE_RL.limit({ key: ip });   // Cloudflare Rate Limiting binding
    return !success;
  }
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < MEM_WINDOW_MS);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > MEM_LIMIT;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const ch = cors(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: allowed(env).includes(origin) ? 204 : 403, headers: ch });
    }
    if (url.pathname === '/health') return json({ ok: true }, 200, ch);
    if (url.pathname !== '/chat' || request.method !== 'POST') return json({ error: 'not found' }, 404, ch);
    if (!allowed(env).includes(origin)) return json({ error: 'origin not allowed' }, 403, ch);
    if (!env.XAI_API_KEY) return json({ error: 'not configured' }, 503, ch);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (await limited(ip, env)) return json({ error: 'rate limited' }, 429, { ...ch, 'Retry-After': '60' });

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, ch); }
    const msgs = (Array.isArray(body?.messages) ? body.messages : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_MSGS)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json({ error: 'no user message' }, 400, ch);

    const upstream = await fetch(XAI_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.XAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.XAI_MODEL || 'grok-4.7',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...msgs],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });
    if (!upstream.ok) {
      console.log('xai error', upstream.status, (await upstream.text()).slice(0, 300));
      return json({ error: 'upstream ' + upstream.status }, 502, ch);
    }
    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || '';
    return json({ reply }, 200, ch);
  },
};
