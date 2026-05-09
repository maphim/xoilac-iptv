// Xoilac Proxy Worker — Cloudflare Workers ($0/free)
// Proxy thuần: nhận CDN URL → fetch với đúng headers → pipe về client
// Fix mobile playback: CORS preflight + Range passthrough + dynamic Content-Type
export default {
  async fetch(request) {
    // CORS preflight (mobile browsers)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);

    // Decode stream URL: /p/<base64> or ?url=...
    const pathMatch = url.pathname.match(/^\/p\/([A-Za-z0-9\-_]+=*)$/);
    let decoded;

    if (pathMatch) {
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

    // Build headers — pass Range through for mobile seeking
    const reqHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Origin': isM3u8 ? 'https://xoilackt.tv' : 'https://xoilac.realtimegamepushz.com',
      'Referer': isM3u8 ? 'https://xoilackt.tv' : 'https://xoilac.realtimegamepushz.com/',
    };
    // Forward Range header from client (mobile seeking)
    const range = request.headers.get('Range');
    if (range) reqHeaders['Range'] = range;

    try {
      const res = await fetch(decoded, { headers: reqHeaders, cf: { cacheEverything: false, cacheTtl: 0 } });

      if (!res.ok) {
        return new Response('CDN error: ' + res.status, { status: 502 });
      }

      // Preserve CDN's original Content-Type — mobile players are picky
      const ct = res.headers.get('Content-Type') || (isM3u8 ? 'application/x-mpegurl' : 'video/x-flv');
      const respHeaders = {
        'Content-Type': ct,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Range',
      };
      // Pass through Content-Range for partial content (206)
      const contentRange = res.headers.get('Content-Range');
      if (contentRange) respHeaders['Content-Range'] = contentRange;
      if (res.status === 206) respHeaders['Accept-Ranges'] = 'bytes';

      return new Response(res.body, {
        status: res.status === 206 ? 206 : 200,
        headers: respHeaders,
      });
    } catch (err) {
      return new Response('Proxy error: ' + err.message, { status: 502 });
    }
  },
};