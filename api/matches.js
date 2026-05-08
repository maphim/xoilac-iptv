const { getMatches } = require('../lib/scraper');

module.exports = async (req, res) => {
  try {
    const type = new URL(req.url, `http://${req.headers.host}`).searchParams.get('type') || 'all';
    const matches = await getMatches(type);
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      count: matches.length,
      generated: new Date().toISOString(),
      matches
    }, null, 2));
  } catch (err) {
    console.error('Matches API error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
