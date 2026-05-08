const { extractStreamUrl } = require('../lib/scraper');

module.exports = async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const matchUrl = urlObj.searchParams.get('url');
    
    if (!matchUrl) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
    }
    
    const decodedUrl = decodeURIComponent(matchUrl);
    const streamUrl = await extractStreamUrl(decodedUrl);
    
    if (!streamUrl) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'No stream URL found' }));
    }
    
    // Redirect with 302 — MonPlayer/VLC will follow to the fresh stream
    res.statusCode = 302;
    res.setHeader('Location', streamUrl);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end();
  } catch (err) {
    console.error('Stream redirect error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
