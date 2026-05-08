const { generatePlaylist } = require('../lib/scraper');

module.exports = async (req, res) => {
  try {
    const type = new URL(req.url, `http://${req.headers.host}`).searchParams.get('type') || 'all';
    const playlist = await generatePlaylist(type);
    
    res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="xoilac_playlist.m3u"');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    res.statusCode = 200;
    res.end(playlist);
  } catch (err) {
    console.error('Playlist error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
