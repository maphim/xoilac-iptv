/**
 * LuongSonTV Playlist Scraper
 * Stream URLs from LuongSonTV API (cdnok9.com)
 * Team logos from Xoilac source (sportpulseapiz.com) — more reliable
 */
const fetch = require('node-fetch');
const fs = require('fs');

const LS_API = 'https://api-ls.cdnokvip.com/api';
const LS_REFERER = 'https://www.satochain.io';
const XOILAC_REFERER = 'https://xoilackm.tv';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ── Team logo cache from Xoilac (sportpulseapiz.com) ──
let teamLogoCache = null;

async function buildTeamLogoCache() {
  try {
    // Use Xoilac's scraper to get team → logo mapping
    // Or scrape homepage for team names + logos
    const res = await fetch('https://xoilackm.tv', {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'vi-VN,vi;q=0.9' },
      timeout: 15000,
    });
    const html = await res.text();
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const cache = {};

    // Grid matches
    $('div.grid-match[href*="/truc-tiep/"]').each((i, el) => {
      const $el = $(el);
      const home = $el.find('.gmd-home_team .team-name-group p').first().text().trim().toLowerCase();
      const away = $el.find('.gmd-away_team .team-name-group p').first().text().trim().toLowerCase();
      const logos = $el.find('.team-logo-group img.lazy, .team-logo-group img');
      if (logos.length >= 2) {
        cache[home] = $(logos[0]).attr('src') || '';
        cache[away] = $(logos[1]).attr('src') || '';
      }
    });

    // Horizontal matches
    $('a.match-horizontals-item[href*="/truc-tiep/"]').each((i, el) => {
      const $el = $(el);
      const imgs = $el.find('> img');
      const teams = [];
      $el.find('> p').each((i, p) => {
        const txt = $(p).text().trim();
        if (txt && !txt.match(/^(Hôm nay|Ngày mai|\d{2}:\d{2})/)) teams.push(txt.toLowerCase());
      });
      if (imgs.length >= 2 && teams.length >= 2) {
        cache[teams[0]] = $(imgs[0]).attr('src') || '';
        cache[teams[1]] = $(imgs[1]).attr('src') || '';
      }
    });

    teamLogoCache = cache;
    console.log(`Cached ${Object.keys(cache).length} team logos from Xoilac`);
  } catch (e) {
    console.warn('Failed to build logo cache:', e.message);
    teamLogoCache = {};
  }
}

function getLogo(teamName, fallbackUrl) {
  if (!teamName) return fallbackUrl || '';
  const key = teamName.toLowerCase().trim();
  if (teamLogoCache && teamLogoCache[key]) return teamLogoCache[key];
  return fallbackUrl || '';
}

// ── LuongSonTV API ──

async function callAPI(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json', 'Referer': LS_REFERER },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getAllMatches() {
  const data = await callAPI(`${LS_API}/get-livestream-group`);
  if (!data?.value?.success) return [];
  return data.value.datas || [];
}

async function getMatchDetail(slug) {
  try {
    const data = await callAPI(`${LS_API}/match-detail-slug?slug=${encodeURIComponent(slug)}`);
    if (data?.value?.success && data?.value?.datas) return data.value.datas;
  } catch (e) {}
  return null;
}

async function generatePlaylist() {
  // Build team logo cache from Xoilac first
  await buildTeamLogoCache();

  const matches = await getAllMatches();
  console.log(`Found ${matches.length} matches in livestream group`);

  const sportMap = { 0: 'football', 1: 'basketball', 2: 'tennis' };

  let m3u = '#EXTM3U\n';
  m3u += '#PLAYLIST:LuongSonTV - Live Football & Sports\n';
  m3u += `# Generated: ${new Date().toISOString()}\n`;
  m3u += `# Source: LuongSonTV API (cdnok9.com)\n`;
  m3u += '# Supports: VLC, IPTV Smarters, TiviMate\n\n';

  let count = 0;
  for (const m of matches) {
    const detail = await getMatchDetail(m.slugUrl);
    const hlsUrl = detail?.linkLive;
    const flvUrl = detail?.linkLiveFlv;

    if (!hlsUrl && !flvUrl) {
      console.log(`  Skip ${m.homeName} vs ${m.awayName} — no stream URL`);
      continue;
    }

    const group = m.liveGame ? '🔴 Live Now' : (m.leagueName || 'Matches');
    const time = new Date(m.matchTime * 1000);
    const timeStr = time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const title = `${m.homeName} vs ${m.awayName}`;
    const blvInfo = m.commentator ? ` [${m.commentator}]` : '';
    const liveScore = m.liveGame && m.homeScore !== null ? ` (${m.homeScore}:${m.awayScore})` : '';

    // Use Xoilac logos (sportpulseapiz.com) as primary, fallback to LuongSonTV
    const logo = getLogo(m.homeName, m.homeLogo || '');

    // Prefer HLS (m3u8), fallback to FLV
    const streamUrl = hlsUrl || flvUrl;

    m3u += `#EXTINF:0 tvg-id="ls-${m.matchId}" tvg-name="${title}" tvg-logo="${logo}" group-title="${group}",${title}${liveScore}${timeStr}${blvInfo}\n`;
    m3u += `#EXTVLCOPT:http-user-agent=Mozilla/5.0\n`;
    m3u += `#EXTVLCOPT:http-referrer=${LS_REFERER}\n`;
    if (!hlsUrl && flvUrl) {
      m3u += `#EXTVLCOPT:http-origin=${LS_REFERER}\n`;
    }
    m3u += `${streamUrl}\n`;
    count++;
  }

  if (count === 0) {
    m3u += '# No streams currently available. Check during match times.\n';
  }

  console.log(`Generated ${count} entries`);
  return m3u;
}

if (require.main === module) {
  generatePlaylist()
    .then(playlist => {
      fs.writeFileSync('/home/anhnc/luongson_new.m3u', playlist, 'utf8');
      console.log('Saved to /home/anhnc/luongson_new.m3u');
      console.log(playlist.split('\n').slice(0, 20).join('\n'));
    })
    .catch(err => console.error('Error:', err.message));
}

module.exports = { generatePlaylist, getAllMatches, getMatchDetail };
