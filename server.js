/**
 * Xoilac IPTV — Unified Node.js server for Render.com
 * Handles: stream proxy + playlist generation + movie playlist + JSON API
 * No timeout limits (Render web service runs 24/7)
 */
const http = require('http');
const https = require('https');
const fetch = require('node-fetch');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const { generatePlaylist, getMatches, extractStreamUrl } = require('./lib/scraper');
const { generateMoviePlaylist } = require('./lib/movie-scraper');
const { renderHomepage } = require('./lib/homepage');

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || '';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const XOILAC_REFERER = 'https://xoilackt.tv';

// Headers for CDN (Xoilac streams require specific Origin/Referer)
const CDN_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://xoilac.realtimegamepushz.com',
  'Referer': 'https://xoilac.realtimegamepushz.com/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
};

function getBaseUrl(req) {
  if (BASE_URL) return BASE_URL;
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${host}`;
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

// ── Route: /proxy ──────────────────────────────────────
async function handleProxy(req, res, urlObj) {
  const matchUrl = decodeURIComponent(urlObj.searchParams.get('url') || '');
  if (!matchUrl) { res.writeHead(400); return res.end('Missing ?url='); }
  if (!matchUrl.startsWith('http')) { res.writeHead(400); return res.end('Invalid URL'); }

  console.log('[proxy]', matchUrl.split('/').pop());
  const info = await extractStreamUrl(matchUrl);
  if (!info || !info.streamUrl) {
    res.writeHead(404); return res.end('No stream found');
  }

  const streamUrl = info.streamUrl;
  const isM3u8 = streamUrl.includes('.m3u8');
  console.log('[proxy] stream:', streamUrl.substring(0, 70));

  const cdnHeaders = isM3u8
    ? { 'User-Agent': USER_AGENT, 'Referer': XOILAC_REFERER, 'Origin': XOILAC_REFERER }
    : CDN_HEADERS;

  try {
    const streamRes = await fetch(streamUrl, { agent: httpsAgent, headers: cdnHeaders, timeout: 15000 });
    if (!streamRes.ok) {
      console.log('[proxy] CDN:', streamRes.status);
      res.writeHead(502); return res.end('CDN error: ' + streamRes.status);
    }
    res.writeHead(200, {
      'Content-Type': isM3u8 ? 'application/x-mpegurl' : 'video/x-flv',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    streamRes.body.pipe(res);
    req.on('close', () => streamRes.body.destroy());
  } catch (err) {
    console.error('[proxy]', err.message);
    res.writeHead(502); res.end('Proxy error: ' + err.message);
  }
}

// ── Route: /playlist.m3u ──────────────────────────────
async function handlePlaylist(req, res, urlObj, baseUrl) {
  const type = urlObj.searchParams.get('type') || 'all';
  try {
    const playlist = await generatePlaylist(type, baseUrl);
    res.writeHead(200, {
      'Content-Type': 'application/x-mpegurl; charset=utf-8',
      'Content-Disposition': 'inline; filename="xoilac_playlist.m3u"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(playlist);
  } catch (err) {
    sendJson(res, 502, { error: err.message });
  }
}

// ── Route: /movie.m3u ─────────────────────────────────
async function handleMoviePlaylist(req, res, urlObj) {
  try {
    const limit = Math.min(parseInt(urlObj.searchParams.get('limit') || '20'), 30);
    const playlist = await generateMoviePlaylist(limit);
    res.writeHead(200, {
      'Content-Type': 'application/x-mpegurl; charset=utf-8',
      'Content-Disposition': 'inline; filename="movie.m3u"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(playlist);
  } catch (err) {
    sendJson(res, 502, { error: err.message });
  }
}

// ── Route: /api/matches ───────────────────────────────
async function handleMatches(req, res, urlObj) {
  const type = urlObj.searchParams.get('type') || 'all';
  try {
    const matches = await getMatches(type);
    sendJson(res, 200, { success: true, count: matches.length, matches });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

// ── Route: /api/stream ───────────────────────────────
async function handleStreamRedirect(req, res, urlObj) {
  const matchUrl = urlObj.searchParams.get('url');
  if (!matchUrl) return sendJson(res, 400, { error: 'Missing ?url=' });
  try {
    const info = await extractStreamUrl(decodeURIComponent(matchUrl));
    if (!info || !info.streamUrl) return sendJson(res, 404, { error: 'No stream found' });
    res.writeHead(302, { Location: info.streamUrl, 'Cache-Control': 'no-cache' });
    res.end();
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

// ── Route: /api/qr ────────────────────────────────────
async function handleQR(req, res, urlObj) {
  const qrUrl = urlObj.searchParams.get('url');
  const size = Math.min(parseInt(urlObj.searchParams.get('size') || '200'), 1000);
  const format = urlObj.searchParams.get('format') || 'svg';
  if (!qrUrl) return sendJson(res, 400, { error: 'URL required' });

  const QRCode = require('qrcode');
  try {
    if (format === 'png') {
      const png = await QRCode.toDataURL(decodeURIComponent(qrUrl), { width: size, errorCorrectionLevel: 'H', margin: 1 });
      const buf = Buffer.from(png.replace(/^data:image\/png;base64,/, ''), 'base64');
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
      res.end(buf);
    } else {
      const svg = await QRCode.toString(decodeURIComponent(qrUrl), { type: 'svg', width: size, errorCorrectionLevel: 'H', margin: 1 });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      res.end(svg);
    }
  } catch (err) {
    sendJson(res, 500, { error: 'QR failed: ' + err.message });
  }
}

// ── Server ─────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const p = urlObj.pathname;
  const baseUrl = getBaseUrl(req);
  const proxyUrl = process.env.CF_WORKER_URL || 'https://xoilac-proxy.maphim.workers.dev' || baseUrl;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    if (p === '/proxy' || p.startsWith('/api/proxy')) return handleProxy(req, res, urlObj);
    if (p === '/playlist.m3u' || p === '/playlist.m3u8') return handlePlaylist(req, res, urlObj, proxyUrl);
    if (p === '/movie.m3u' || p === '/movie.m3u8') return handleMoviePlaylist(req, res, urlObj);
    if (p === '/api/matches') return handleMatches(req, res, urlObj);
    if (p === '/api/stream') return handleStreamRedirect(req, res, urlObj);
    if (p === '/api/qr') return handleQR(req, res, urlObj);
    if (p === '/' || p === '') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(renderHomepage(baseUrl));
    }
    res.writeHead(404); res.end('Not Found\n');
  } catch (err) {
    console.error(err.message);
    res.writeHead(500); res.end('Error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log('=== Xoilac IPTV on Render ===');
  console.log('Playlist: http://localhost:' + PORT + '/playlist.m3u');
  console.log('Proxy:    http://localhost:' + PORT + '/proxy?url=...');
  console.log('Movies:   http://localhost:' + PORT + '/movie.m3u');
  console.log('Port:     ' + PORT);
});
