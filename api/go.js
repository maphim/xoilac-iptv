const { extractStreamUrl, getMatches } = require('../lib/scraper');

module.exports = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/\/api\/go\//, '').replace(/\/go\//, '').replace(/\/$/, '');
  const matchUrlParam = url.searchParams.get('url');

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!path && !matchUrlParam) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'Missing slug. Examples:',
      formats: [
        '/go/al-hilal-vs-al-kholood',
        '/go/Dortmund',
        '/go?url=https://xoilackt.tv/truc-tiep/...',
      ],
    }));
  }

  try {
    // If url param provided, use it directly
    if (matchUrlParam) {
      const decoded = decodeURIComponent(matchUrlParam);
      const info = await extractStreamUrl(decoded);
      if (!info.streamUrl) {
        res.statusCode = 404;
        return res.end('Stream not found');
      }
      res.statusCode = 302;
      res.setHeader('Location', info.streamUrl);
      return res.end();
    }

    // Search by keyword in slug or title
    const matches = await getMatches('all');
    const q = path.toLowerCase().replace(/[^a-z0-9\s-]/g, '');

    const found = matches.find(m => {
      const s = (m.slug || '').toLowerCase();
      const t = (m.displayTitle || m.title || '').toLowerCase();
      return s.includes(q) || t.includes(q);
    });

    if (!found) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      const suggestions = matches.slice(0, 10).map(m => ({
        slug: (m.slug || '').split('-').slice(0, 4).join('-'),
        title: m.displayTitle || m.title,
      }));
      return res.end(JSON.stringify({
        error: `No match for "${path}". Try:`,
        suggestions,
      }));
    }

    const info = await extractStreamUrl(found.url);
    if (!info.streamUrl) {
      res.statusCode = 404;
      return res.end('Stream not live yet');
    }
    res.statusCode = 302;
    res.setHeader('Location', info.streamUrl);
    res.end();
  } catch (err) {
    console.error('Go error:', err.message);
    res.statusCode = 500;
    res.end(err.message);
  }
};
