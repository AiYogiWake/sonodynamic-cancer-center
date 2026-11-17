// Local test harness: runs worker.js under Node (no Cloudflare needed).
// Reads XAI_API_KEY from the environment. Never logs it.
//   ALLOWED_ORIGINS=http://localhost:8765 node local-proxy.mjs
import http from 'node:http';
import worker from './worker.js';
const env = {
  XAI_API_KEY: process.env.XAI_API_KEY,
  XAI_MODEL: process.env.XAI_MODEL || 'grok-4.7',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:8765,https://aiyogiwake.github.io',
};
const PORT = +process.env.PORT || 8787;
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await worker.fetch(new Request(`http://localhost:${PORT}${req.url}`, {
    method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body,
  }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, () => console.log(`local proxy on http://localhost:${PORT}/chat (key ${env.XAI_API_KEY ? 'loaded' : 'MISSING'})`));
