// Auto-select cached version if Upstash Redis env vars are set
let scraper;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    scraper = require('../lib/scraper-cached');
  } else {
    scraper = require('../lib/scraper');
  }
} catch(e) {
  scraper = require('../lib/scraper');
}

const { renderHomepage } = require('../lib/homepage');
const { generatePlaylist } = scraper;
const { generateMoviePlaylist } = require('../lib/movie-scraper');

module.exports = async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${host}`;

  try {
    // Movie playlist (direct API fetch from ophim1.com)
    if (pathname === '/movie.m3u' || pathname === '/movie.m3u8') {
      try {
        const limit = parseInt(urlObj.searchParams.get('limit') || '20');
        const playlist = await generateMoviePlaylist(Math.min(limit, 30));
        res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="movie.m3u"');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.statusCode = 200;
        return res.end(playlist);
      } catch (e) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Movie playlist error: ' + e.message }));
      }
    }

    // LuongSonTV fast playlist — redirect M3U (instant load, stream on click)
    if (pathname === '/luongson.m3u' || pathname === '/luongson.m3u8') {
      const { generateFastPlaylist } = require('../lib/luongson-scraper');
      const playlist = await generateFastPlaylist(baseUrl);
      res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="luongson.m3u"');
      res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=240, stale-while-revalidate=60');
      res.statusCode = 200;
      return res.end(playlist);
    }

    if (pathname === '/playlist.m3u' || pathname === '/playlist.m3u8') {
      const type = urlObj.searchParams.get('type') || 'all';
      // CF_WORKER_URL env: proxy CDN URLs through Cloudflare Worker (no timeout)
      const proxyUrl = process.env.CF_WORKER_URL || 'https://xoilac-proxy.maphim.workers.dev' || baseUrl;
      const playlist = await generatePlaylist(type, proxyUrl);
      res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="xoilac_playlist.m3u"');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.statusCode = 200;
      return res.end(playlist);
    }

    if (pathname === '/api/ls-stream') {
      const { resolveStreamUrl } = require('../lib/luongson-scraper');
      const slug = urlObj.searchParams.get('slug');
      if (!slug) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Missing ?slug=' }));
      }
      try {
        const result = await resolveStreamUrl(slug);
        if (!result || !result.hls) {
          console.log('ls-stream: no stream for', slug);
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Stream not available yet' }));
        }
        const streamUrl = result.hls || result.flv;
        console.log('ls-stream:', result.name, '->', streamUrl.substring(0, 60));
        res.statusCode = 302;
        res.setHeader('Location', streamUrl);
        res.setHeader('Cache-Control', 'public, max-age=30');
        return res.end();
      } catch(e) {
        console.error('ls-stream error:', e.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    if (pathname === '/api/matches') {
      const { getMatches } = scraper;
      const type = urlObj.searchParams.get('type') || 'all';
      const matches = await getMatches(type);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, count: matches.length, matches }));
    }

    if (pathname === '/api/stream') {
      const matchUrl = urlObj.searchParams.get('url');
      if (!matchUrl) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
      }
      const decodedUrl = decodeURIComponent(matchUrl);
      const info = await scraper.extractStreamUrl(decodedUrl);
      if (!info.streamUrl) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'No stream URL found' }));
      }
      res.statusCode = 302;
      res.setHeader('Location', info.streamUrl);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.end();
    }

    if (pathname === '/api/qr') {
      const QRCode = require('qrcode');
      const qrUrl = urlObj.searchParams.get('url');
      const size = Math.min(parseInt(urlObj.searchParams.get('size') || '200'), 1000);
      const format = urlObj.searchParams.get('format') || 'svg';
      if (!qrUrl) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'URL parameter required' }));
      }
      try {
        if (format === 'png') {
          const png = await QRCode.toDataURL(decodeURIComponent(qrUrl), { width: size, errorCorrectionLevel: 'H', margin: 1 });
          const buf = Buffer.from(png.replace(/^data:image\/png;base64,/, ''), 'base64');
          res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
          return res.end(buf);
        } else {
          const svg = await QRCode.toString(decodeURIComponent(qrUrl), { type: 'svg', width: size, errorCorrectionLevel: 'H', margin: 1 });
          res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
          return res.end(svg);
        }
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'QR generation failed: ' + err.message }));
      }
    }

    const html = renderHomepage(baseUrl);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    res.end(html);
  } catch (err) {
    console.error('Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
