// Edge proxy - forwards all client headers + overrides critical CDN headers
// Based on: https://github.com/maphim/film/blob/main/src/pages/api/v1/proxy/index.ts
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const target = url.searchParams.get('url');
  if (!target) {
    return new Response('Missing url', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const decodedUrl = decodeURIComponent(target);
  if (!decodedUrl.startsWith('http')) {
    return new Response('Invalid url', { status: 400 });
  }

  try {
    // Forward ALL incoming client headers
    // Then override critical ones for the CDN
    const headers = new Headers();

    // First, copy all client headers
    for (const [key, value] of req.headers.entries()) {
      if (typeof value === 'string') {
        headers.set(key, value);
      }
    }

    // Then override critical CDN headers (these are what the CDN checks)
    headers.set('Origin', 'https://xoilac.realtimegamepushz.com');
    headers.set('Referer', 'https://xoilac.realtimegamepushz.com/');
    headers.set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0');
    headers.set('Accept', '*/*');

    const response = await fetch(decodedUrl, {
      method: req.method || 'GET',
      headers,
    });

    // Stream the response back
    if (response.body) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('content-type') || 'video/x-flv',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(null, { status: response.status });
  } catch (err) {
    return new Response(err.message, { status: 502 });
  }
}
