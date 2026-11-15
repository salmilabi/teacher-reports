// Cloudflare Worker: relays one short prompt from the teacher-reports page to the Anthropic API.
// The API key lives only in the Worker secret ANTHROPIC_API_KEY, never in the page.
// Deploy: create a Worker, paste this file, then add the secret under Settings > Variables and Secrets.

const ALLOWED_ORIGINS = ['https://salmilabi.github.io'];
const MODEL = 'claude-haiku-5-5';
const MAX_PROMPT_CHARS = 3000;
const MAX_OUTPUT_TOKENS = 1500;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function reply(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
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
    if (request.method !== 'POST') {
      return reply({ error: 'method_not_allowed' }, 405, headers);
    }
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
        messages: [{ role: 'user', content: prompt }],
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
  },
};
