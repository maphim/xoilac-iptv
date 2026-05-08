// Vercel Edge proxy: lấy stream URL + proxy với headers đúng
// Timeout 30s (edge limit), phù hợp cho highlight và test live short
export const config = { runtime: 'edge' };

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0';

// Headers đúng cho CDN: Origin/Referer phải là realtimegamepushz.com
const CDN_HEADERS = {
  'User-Agent': UA,
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://xoilac.realtimegamepushz.com',
  'Referer': 'https://xoilac.realtimegamepushz.com/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
};

async function getStreamUrl(pageUrl) {
  const r = await fetch(pageUrl, {
    headers: { 'User-Agent': UA, 'Referer': 'https://xoilackt.tv' },
  });
  const html = await r.text();

  // Highlight: direct m3u8
  const m3 = html.match(/file:\s*['"]([^'"]*index\.m3u8[^'"]*)['"]/);
  if (m3) return { url: m3[1], type: 'hls' };

  // Live: extract from list_stream
  const ls = html.indexOf('list_stream');
  if (ls >= 0) {
    const end = html.indexOf('];', ls) + 2;
    const urls = [...html.substring(ls, end).matchAll(/"([^"]+)"/g)]
      .map(m => m[1].replace(/\\\//g, '/'));
    for (const embedUrl of urls) {
      try {
        const e = await fetch(embedUrl, {
          headers: { 'User-Agent': UA, 'Referer': 'https://xoilackt.tv' }
        });
        const s = (await e.text()).match(/Stream\s*=\s*["']([^"']+)["']/);
        if (s) return { url: s[1], type: s[1].includes('.m3u8') ? 'hls' : 'flv' };
      } catch(e) {}
    }
  }
  return null;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const pageUrl = url.searchParams.get('url') || url.searchParams.get('match');

  if (!pageUrl) {
    return new Response(JSON.stringify({ error: 'Missing ?url=', usage: '/proxy?url=https://xoilackt.tv/truc-tiep/...' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const decodedUrl = decodeURIComponent(pageUrl);
  if (!decodedUrl.startsWith('http')) {
    return new Response('Invalid URL', { status: 400 });
  }

  try {
    // Get fresh stream URL from match page
    const info = await getStreamUrl(decodedUrl);
    if (!info) {
      return new Response('No stream found - match may not be live yet', { status: 404 });
    }

    // Fetch stream from CDN with correct headers
    const headers = info.type === 'hls'
      ? { 'User-Agent': UA, 'Referer': 'https://xoilackt.tv', 'Origin': 'https://xoilackt.tv' }
      : CDN_HEADERS;

    const streamRes = await fetch(info.url, { headers });

    if (!streamRes.ok) {
      return new Response('CDN error: ' + streamRes.status, { status: 502 });
    }

    // Stream response back to client
    const ct = info.type === 'hls' ? 'application/x-mpegurl' : 'video/x-flv';
    return new Response(streamRes.body, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(err.message, { status: 502 });
  }
}
