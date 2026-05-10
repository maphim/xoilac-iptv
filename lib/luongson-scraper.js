/**
 * LuongSonTV Playlist Scraper
 * Uses LuongSonTV's actual API to get stream URLs from cdnok9.com
 */
const fetch = require('node-fetch');
const fs = require('fs');

const LS_API = 'https://api-ls.cdnokvip.com/api';
const LS_REFERER = 'https://www.satochain.io';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

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
  const matches = await getAllMatches();
  console.log(`Found ${matches.length} matches in livestream group`);

  const sportMap = { 0: 'football', 1: 'basketball', 2: 'tennis' };
  const now = Math.floor(Date.now() / 1000);

  let m3u = '#EXTM3U\n';
  m3u += '#PLAYLIST:LuongSonTV - Live Football & Sports\n';
  m3u += `# Generated: ${new Date().toISOString()}\n`;
  m3u += `# Source: LuongSonTV API (cdnok9.com)\n`;
  m3u += '# Supports: VLC, IPTV Smarters, TiviMate\n\n';

  let count = 0;
  for (const m of matches) {
    // Get detail for stream URL
    const detail = await getMatchDetail(m.slugUrl);
    const hlsUrl = detail?.linkLive;
    const flvUrl = detail?.linkLiveFlv;

    if (!hlsUrl && !flvUrl) {
      console.log(`  Skip ${m.homeName} vs ${m.awayName} — no stream URL`);
      continue;
    }

    const sport = sportMap[m.typeSport] || 'sport';
    const group = m.liveGame ? '🔴 Live Now' : (m.leagueName || 'Matches');
    const time = new Date(m.matchTime * 1000);
    const timeStr = time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const title = `${m.homeName} vs ${m.awayName}`;
    const logo = m.homeLogo || '';
    const blvInfo = m.commentator ? ` [${m.commentator}]` : '';
    const liveScore = m.liveGame && m.homeScore !== null ? ` (${m.homeScore}:${m.awayScore})` : '';

    // Prefer HLS (m3u8), fallback to FLV
    const streamUrl = hlsUrl || flvUrl;

    m3u += `#EXTINF:0 tvg-id="ls-${m.matchId}" tvg-name="${title}" tvg-logo="${logo}" group-title="${group}",${title}${liveScore}${timeStr}${blvInfo}\n`;
    m3u += `#EXTVLCOPT:http-user-agent=Mozilla/5.0\n`;
    m3u += `#EXTVLCOPT:http-referrer=${LS_REFERER}\n`;
    if (!hlsUrl && flvUrl) {
      // FLV needs proxy if not directly playable
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

// Run directly
if (require.main === module) {
  generatePlaylist()
    .then(playlist => {
      fs.writeFileSync('/home/anhnc/luongson_new.m3u', playlist, 'utf8');
      console.log('Saved to /home/anhnc/luongson_new.m3u');
      console.log('First 20 lines:');
      console.log(playlist.split('\n').slice(0, 20).join('\n'));
    })
    .catch(err => console.error('Error:', err.message));
}

module.exports = { generatePlaylist, getAllMatches, getMatchDetail };
