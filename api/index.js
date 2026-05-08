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

    // Football playlist
    if (pathname === '/playlist.m3u' || pathname === '/playlist.m3u8') {
      const type = urlObj.searchParams.get('type') || 'all';
      const playlist = await generatePlaylist(type, baseUrl);
      res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="xoilac_playlist.m3u"');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.statusCode = 200;
      return res.end(playlist);
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
