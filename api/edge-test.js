// Vercel Edge Function test
// Uses only Web APIs (no Node.js deps like node-fetch)
export const config = {
  runtime: 'edge',
};

const BASE = 'https://xoilackt.tv';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export default async function handler(req) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'ping';

  try {
    // Action 1: Ping - test edge latency
    if (action === 'ping') {
      return new Response(JSON.stringify({
        action: 'ping',
        ok: true,
        region: process.env.VERCEL_REGION || 'unknown',
        time: new Date().toISOString(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      });
    }

    // Action 2: Fetch xoilackt.tv homepage - test edge fetch speed
    if (action === 'fetch') {
      const start = Date.now();
      const r = await fetch(BASE, {
        headers: { 'User-Agent': UA, 'Referer': BASE },
      });
      const html = await r.text();
      const duration = Date.now() - start;
      return new Response(JSON.stringify({
        action: 'fetch',
        ok: true,
        status: r.status,
        bytes: html.length,
        durationMs: duration,
        matches: (html.match(/\/truc-tiep\//g) || []).length,
        highlights: (html.match(/\/highlight\//g) || []).length,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action', actions: ['ping', 'fetch'] }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
