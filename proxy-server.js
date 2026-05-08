const http = require('http');
const https = require('https');
const fetch = require('node-fetch');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const PORT = process.env.PORT || 3000;
const VERCEL_PLAYLIST = 'https://xoilac-iptv.vercel.app/playlist.m3u';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const REFERER = 'https://xoilackt.tv';
const CACHE_TTL = 30_000;

const streamCache = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of streamCache) {
    if (now - val.ts > CACHE_TTL) streamCache.delete(key);
  }
}, 15_000);

async function getStreamUrl(matchUrl) {
  const cached = streamCache.get(matchUrl);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.url;

  const r1 = await fetch(matchUrl, {
    headers: { 'User-Agent': USER_AGENT, 'Referer': REFERER },
    timeout: 10000,
  });
  const html = await r1.text();

  const m3u8Match = html.match(/file:\s*['"]([^'"]*index\.m3u8[^'"]*)['"]/);
  if (m3u8Match) {
    streamCache.set(matchUrl, { url: m3u8Match[1], ts: Date.now(), isM3u8: true });
    return m3u8Match[1];
  }

  const lsStart = html.indexOf('list_stream');
  if (lsStart >= 0) {
    const lsEnd = html.indexOf('];', lsStart) + 2;
    const section = html.substring(lsStart, lsEnd);
    const urls = [...section.matchAll(/"([^"]+)"/g)].map(m => m[1].replace(/\\\//g, '/'));
    if (urls.length > 0) {
      const r2 = await fetch(urls[0], {
        headers: { 'User-Agent': USER_AGENT, 'Referer': REFERER },
        timeout: 10000,
      });
      const embedHtml = await r2.text();
      const streamMatch = embedHtml.match(/Stream\s*=\s*["']([^"']+)["']/);
      if (streamMatch) {
        streamCache.set(matchUrl, { url: streamMatch[1], ts: Date.now(), isM3u8: false });
        return streamMatch[1];
      }
    }
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    if (pathname === '/proxy') {
      const matchUrl = decodeURIComponent(url.searchParams.get('url') || '');
      if (!matchUrl) { res.writeHead(400); return res.end('Missing ?url='); }

      const streamUrl = await getStreamUrl(matchUrl);
      if (!streamUrl) { res.writeHead(404); return res.end('No stream found'); }

      console.log('[proxy]', matchUrl.split('/').pop(), '->', streamUrl.substring(0, 70));
      const isM3u8 = streamUrl.includes('.m3u8');

      const streamRes = await fetch(streamUrl, {
        agent: httpsAgent,
        headers: { 'User-Agent': USER_AGENT, 'Referer': REFERER, 'Origin': 'https://xoilackt.tv' },
        timeout: 15000,
      });

      if (!streamRes.ok) {
        console.log('[proxy] CDN:', streamRes.status);
        res.writeHead(502);
        return res.end('CDN error: ' + streamRes.status);
      }

      res.writeHead(200, {
        'Content-Type': isM3u8 ? 'application/x-mpegurl' : 'video/x-flv',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      });
      streamRes.body.pipe(res);
      req.on('close', () => streamRes.body.destroy());
      return;
    }

    if (pathname === '/playlist.m3u' || pathname === '/playlist.m3u8') {
      const r = await fetch(VERCEL_PLAYLIST + (url.search || ''), {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 30000,
      });
      let playlist = await r.text();
      const host = req.headers.host || 'localhost:' + PORT;
      const proto = req.headers['x-forwarded-proto'] || 'http';
      playlist = playlist.replace(/https:\/\/[^\s]+(?:off-tvc|index\.m3u8)[^\s]*|https:\/\/[^\s]+\.m3u8[^\s]*/g,
        (m) => proto + '://' + host + '/proxy?url=' + encodeURIComponent(m));
      res.writeHead(200, { 'Content-Type': 'application/x-mpegurl; charset=utf-8' });
      return res.end(playlist);
    }

    if (pathname === '/' || pathname === '') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xoilac Proxy</title><style>
body{font-family:sans-serif;background:#111;color:#fff;padding:20px;max-width:600px;margin:auto}
a{color:#22c55e}h1{color:#22c55e}.url{background:#222;padding:10px;border-radius:8px;word-break:break-all}
</style></head><body>
<h1>⚽ Xoilac Proxy</h1>
<p>IPTV proxy for live football streams. No timeout limits.</p>
<h3>Playlist URL for MonPlayer/VLC</h3>
<div class="url">http://` + (req.headers.host || 'localhost:' + PORT) + `/playlist.m3u</div>
</body></html>`);
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    console.error('[proxy] Error:', err.message);
    res.writeHead(500);
    res.end(err.message);
  }
});

server.listen(PORT, () => {
  console.log('=== Xoilac Proxy ===');
  console.log('Playlist: http://localhost:' + PORT + '/playlist.m3u');
  console.log('Proxy:    http://localhost:' + PORT + '/proxy?url=...');
});
