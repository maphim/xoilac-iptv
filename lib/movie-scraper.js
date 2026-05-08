const fetch = require('node-fetch');
const API = 'https://ophim1.com';
const IMG = 'https://img.ophim.live/uploads/movies';

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function generateMoviePlaylist(maxMovies = 20) {
  const data = await fetchJson(`${API}/danh-sach/phim-moi-cap-nhat?page=1`);
  const items = (data.items || []).slice(0, maxMovies);

  // Fetch all movie details in parallel
  const details = await Promise.allSettled(
    items.map(item => fetchJson(`${API}/phim/${item.slug}`))
  );

  let m3u = '#EXTM3U\n#PLAYLIST:OPHIM Movies\n';
  m3u += `# Generated: ${new Date().toISOString()}\n`;
  m3u += `# Total movies: ${items.length}\n\n`;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const detail = details[i];
    if (detail.status !== 'fulfilled') continue;

    const movie = detail.value.movie || {};
    const episodes = detail.value.episodes || [];
    const title = movie.name || item.name || item.slug;
    const posterUrl = movie.poster_url || item.poster_url || '';
    const poster = posterUrl.startsWith('http') ? posterUrl : `${IMG}/${posterUrl}`;

    const servers = episodes[0];
    if (!servers || !servers.server_data) continue;

    for (const ep of servers.server_data) {
      const streamUrl = ep.link_m3u8 || ep.link_embed;
      if (!streamUrl) continue;
      const epName = ep.name || '1';
      m3u += `#EXTINF:-1 tvg-logo="${poster}" tvg-id="${item.slug}-tap-${epName}",${title} - Tập ${epName}\n`;
      m3u += `#EXTVLCOPT:http-user-agent=Mozilla/5.0\n`;
      m3u += `#EXTVLCOPT:http-referrer=${API}\n`;
      m3u += `${streamUrl}\n`;
    }
  }

  return m3u;
}

module.exports = { generateMoviePlaylist };
