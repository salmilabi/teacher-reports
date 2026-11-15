// Cloudflare Worker for the teacher-reports page. Two jobs:
//   POST /       relays one short prompt (and optionally one photo) to the Anthropic API.
//   /sync        stores one encrypted blob per sync id in Workers KV (GET, PUT, DELETE).
// The API key lives only in the Worker secret ANTHROPIC_API_KEY, never in the page.
// The sync blob is encrypted in the browser with a key the Worker never sees.
// Setup: paste this file, add the secret ANTHROPIC_API_KEY, and bind a KV namespace named SYNC.

const ALLOWED_ORIGINS = ['https://salmilabi.github.io'];
const MODEL = 'claude-haiku-5-5';
const MAX_PROMPT_CHARS = 3000;
const MAX_OUTPUT_TOKENS = 1500;
const MAX_IMAGE_CHARS = 1500000; // base64 text of one photo, about 1.1 MB of image
const MAX_SYNC_CHARS = 2000000;
const SYNC_TTL = 60 * 60 * 24 * 400; // idle records expire after about 13 months
const AI_PER_MINUTE = 20;
const SYNC_PER_MINUTE = 60;

// Soft per-address limit kept in memory. Each Worker instance counts for itself, so this slows a
// flood from one address without being a hard guarantee; the credit cap on the API key is the hard one.
const hits = new Map();
function limited(bucket, ip, max) {
  const now = Date.now();
  const key = bucket + ip;
  const recent = (hits.get(key) || []).filter((t) => now - t < 60000);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > 60000) hits.delete(k);
    }
  }
  return false;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Id',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
}

function reply(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function relayPrompt(request, env, headers) {
  if (!env.ANTHROPIC_API_KEY) {
    return reply({ error: 'not_configured' }, 500, headers);
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return reply({ error: 'bad_json' }, 400, headers);
  }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT_CHARS) {
    return reply({ error: 'bad_prompt' }, 400, headers);
  }

  const content = [];
  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || body.images.length > 1) {
      return reply({ error: 'bad_image' }, 400, headers);
    }
    for (const src of body.images) {
      const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(typeof src === 'string' ? src : '');
      if (!m) return reply({ error: 'bad_image' }, 400, headers);
      if (m[2].length > MAX_IMAGE_CHARS) return reply({ error: 'image_too_big' }, 413, headers);
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/' + m[1], data: m[2] } });
    }
  }
  content.push({ type: 'text', text: prompt });

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      // Haiku 5.5 thinks by default and thinking tokens count toward max_tokens,
      // so a short budget can end with no text at all. Turn thinking off for this simple task.
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content }],
    }),
  });

  if (!upstream.ok) {
    return reply({ error: 'upstream_' + upstream.status }, upstream.status === 429 ? 429 : 502, headers);
  }
  const data = await upstream.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  if (!text) {
    return reply({ error: 'empty_answer' }, 502, headers);
  }
  return reply({ text }, 200, headers);
}

async function syncRecord(request, env, headers) {
  if (!env.SYNC) {
    return reply({ error: 'not_configured' }, 500, headers);
  }
  const id = request.headers.get('X-Sync-Id') || '';
  if (!/^[0-9a-f]{40}$/.test(id)) {
    return reply({ error: 'bad_id' }, 400, headers);
  }
  if (request.method === 'GET') {
    const stored = await env.SYNC.get(id);
    if (stored === null) return reply({ error: 'not_found' }, 404, headers);
    return new Response(stored, { status: 200, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
  }
  if (request.method === 'DELETE') {
    await env.SYNC.delete(id);
    return reply({ ok: true }, 200, headers);
  }
  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_SYNC_CHARS) return reply({ error: 'too_big' }, 413, headers);
    let blob;
    try {
      blob = JSON.parse(text);
    } catch (e) {
      return reply({ error: 'bad_json' }, 400, headers);
    }
    if (!blob || typeof blob.iv !== 'string' || typeof blob.ct !== 'string') {
      return reply({ error: 'bad_blob' }, 400, headers);
    }
    await env.SYNC.put(id, text, { expirationTtl: SYNC_TTL });
    return reply({ ok: true }, 200, headers);
  }
  return reply({ error: 'method_not_allowed' }, 405, headers);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const path = new URL(request.url).pathname;

    if (path === '/sync') {
      if (limited('s', ip, SYNC_PER_MINUTE)) return reply({ error: 'rate_limited' }, 429, headers);
      return syncRecord(request, env, headers);
    }
    if (request.method !== 'POST') {
      return reply({ error: 'method_not_allowed' }, 405, headers);
    }
    if (limited('a', ip, AI_PER_MINUTE)) {
      return reply({ error: 'rate_limited' }, 429, headers);
    }
    return relayPrompt(request, env, headers);
  },
};
