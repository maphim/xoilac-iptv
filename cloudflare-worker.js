// Xoilac Proxy Worker — Cloudflare Workers ($0/free)
// Chỉ proxy thuần: nhận CDN URL → fetch với đúng headers → pipe về client
// CPU ~1-2ms (không scrape, không parse)
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Route: /p/<base64> — short proxy path
    const pathMatch = url.pathname.match(/^\/p\/([A-Za-z0-9\-_]+=*)$/);
    let decoded;

    if (pathMatch) {
      // base64url -> standard base64 -> UTF-8
      const b64 = pathMatch[1].replace(/-/g, '+').replace(/_/g, '/');
      decoded = atob(b64);
      try { decoded = decodeURIComponent(decoded); } catch {}
    } else {
      const streamUrl = url.searchParams.get('url') || url.searchParams.get('stream');
      if (!streamUrl) {
        return new Response('Missing ?url= or /p/<base64>', { status: 400 });
      }
      decoded = decodeURIComponent(streamUrl);
    }
    const isM3u8 = decoded.includes('.m3u8');

    // CDN headers chống hotlink — dùng Origin/Referer của realtimegamepushz.com
    const headers = isM3u8
      ? {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://xoilackt.tv',
          'Origin': 'https://xoilackt.tv',
        }
      : {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://xoilac.realtimegamepushz.com',
          'Referer': 'https://xoilac.realtimegamepushz.com/',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site',
        };

    try {
      const res = await fetch(decoded, { headers, cf: { cacheEverything: false, cacheTtl: 0 } });

      if (!res.ok) {
        return new Response('CDN error: ' + res.status, { status: 502 });
      }

      const ct = isM3u8 ? 'application/x-mpegurl' : 'video/x-flv';
      return new Response(res.body, {
        status: 200,
        headers: {
          'Content-Type': ct,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response('Proxy error: ' + err.message, { status: 502 });
    }
  },
};
