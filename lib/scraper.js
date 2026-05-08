const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://xoilackm.tv';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TEAM_LOGOS = {};

async function fetchHTML(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      'Referer': BASE_URL,
    },
    timeout: 15000,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function scrapeHomepage() {
  const html = await fetchHTML(BASE_URL);
  const $ = cheerio.load(html);
  const matches = [];
  const seen = new Set();

  // 1) Horizontal (upcoming) — <a class="match-horizontals-item" href="/truc-tiep/...">
  $('a.match-horizontals-item[href*="/truc-tiep/"]').each((i, el) => {
    const href = $(el).attr('href');
    if (!href || seen.has(href)) return;
    seen.add(href);
    const m = parseMatchCard($, el, href);
    if (m) matches.push(m);
  });

  // 2) Grid (live/current) — <div class="grid-match" href="/truc-tiep/...">
  $('div.grid-match[href*="/truc-tiep/"]').each((i, el) => {
    const href = $(el).attr('href');
    if (!href || seen.has(href)) return;
    seen.add(href);
    const m = parseMatchCard($, el, href);
    if (m) matches.push(m);
  });

  // Filter: only football (data-sport="football" via competition URL pattern)
  return matches.filter(m => m.sport === 'football');
}

function parseDateSpan(dateText) {
  const m = dateText.match(/(\d{2}):(\d{2})\s*-\s*(\d{2})\/(\d{2})/);
  if (!m) return null;
  const hh = parseInt(m[1]), mm = parseInt(m[2]), dd = parseInt(m[3]), mo = parseInt(m[4]);
  const now = new Date();
  const matchDate = new Date(now.getFullYear(), mo - 1, dd);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOffset = Math.round((matchDate - today) / 86400000);
  return { hh, mm, dd, mo, dayOffset, mins: dayOffset * 1440 + hh * 60 + mm };
}

function parseDayText(text) {
  const dayM = text.match(/^(Hôm nay|Ngày mai)/);
  const timeM = text.match(/(\d{2}):(\d{2})/);
  if (!timeM) return null;
  const hh = parseInt(timeM[1]), mm = parseInt(timeM[2]);
  const dayOffset = dayM && dayM[1] === 'Ngày mai' ? 1 : 0;
  return { hh, mm, dayOffset, mins: dayOffset * 1440 + hh * 60 + mm };
}

function detectSportFromUrl(src) {
  if (!src) return '';
  const m = src.match(/https:\/\/imgts\.sportpulseapiz\.com\/([^/]+)\/competition\//);
  return m ? m[1] : '';
}

function parseMatchCard($, el, href) {
  const $el = $(el);

  // Teams from .team-name-group > p (grid-match style)
  let homeTeam = $el.find('.gmd-home_team .team-name-group p').first().text().trim();
  let awayTeam = $el.find('.gmd-away_team .team-name-group p').first().text().trim();

  // Horizontal style: direct <p> children (skip time/date <p>)
  if (!homeTeam || !awayTeam) {
    const teams = [];
    $el.find('> p').each((i, p) => {
      const txt = $(p).text().trim();
      if (txt && !txt.match(/^(Hôm nay|Ngày mai|\d{2}:\d{2})/)) teams.push(txt);
    });
    if (teams.length >= 2) { homeTeam = teams[0]; awayTeam = teams[1]; }
  }

  // Fallback: slug
  if (!homeTeam || !awayTeam) {
    const slug = href.split('/truc-tiep/')[1]?.replace(/\/$/, '') || '';
    const parsed = parseTeamsFromSlug(slug);
    if (parsed) { homeTeam = parsed.team1; awayTeam = parsed.team2; }
  }

  if (!homeTeam || !awayTeam) return null;
  const displayTitle = `${homeTeam} vs ${awayTeam}`;

  // Time — grid date span first, then fallback to text
  let time = '', sortKey = 999999;
  const dateSpan = $el.find('.grid-match__date.gmd-match-date span').first().text().trim();
  if (dateSpan) {
    const parsed = parseDateSpan(dateSpan);
    if (parsed) {
      time = `${String(parsed.hh).padStart(2, '0')}:${String(parsed.mm).padStart(2, '0')}`;
      sortKey = parsed.mins;
    }
  }
  if (!time) {
    const text = $el.text().trim();
    const parsed = parseDayText(text);
    const raw = text.match(/(\d{2}:\d{2})/);
    if (raw) time = raw[1];
    if (parsed) sortKey = parsed.mins;
  }

  // Logos
  let homeLogo = '', awayLogo = '';
  const logos = $el.find('.team-logo-group img.lazy, .team-logo-group img');
  if (logos.length >= 2) {
    homeLogo = $(logos[0]).attr('src') || '';
    awayLogo = $(logos[1]).attr('src') || '';
  } else {
    const imgs = $el.find('> img');
    if (imgs.length >= 2) {
      homeLogo = $(imgs[0]).attr('src') || '';
      awayLogo = $(imgs[1]).attr('src') || '';
    }
  }

  // League + sport detection (from grid-match competition logo URL)
  let league = '', sport = 'football'; // default football for horizontal (upcoming) items
  const compLogo = $el.find('.gmd-comp_logo');
  if (compLogo.length) {
    const compSrc = compLogo.attr('src') || '';
    sport = detectSportFromUrl(compSrc);
    const span = compLogo.parent().find('span.text-ellipsis');
    if (span.length) league = span.text().trim();
    else league = compLogo.parent().text().trim();
  }

  // BLV
  let blv = '';
  const blvEl = $el.find('a.blv-item');
  if (blvEl.length) blv = blvEl.first().text().trim();

  // Detect live (aria-label="Đang đá" on grid-match)
  const isLive = $el.attr('aria-label') === 'Đang đá';

  const slug = href.split('/truc-tiep/')[1]?.replace(/\/$/, '') || '';

  return {
    url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
    title: displayTitle,
    displayTitle,
    isLive,
    sport,
    type: 'live',
    slug, time, sortKey, homeLogo, awayLogo, league,
    team1: homeTeam, team2: awayTeam, blv,
  };
}

async function scrapeHighlights() {
  const html = await fetchHTML(BASE_URL);
  const $ = cheerio.load(html);
  const highlights = [];
  $('a[href*="/highlight/"]').each((i, el) => {
    const href = $(el).attr('href');
    if (!href || highlights.find(h => h.url === href)) return;
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length < 5) return;
    highlights.push({
      url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
      title: text,
      type: 'highlight',
      slug: href.split('/highlight/')[1]?.replace(/\/$/, '') || '',
    });
  });
  return highlights;
}

async function extractStreamUrl(pageUrl) {
  try {
    const html = await fetchHTML(pageUrl);
    let homeLogo = '', awayLogo = '';
    try {
      const $ = cheerio.load(html);
      homeLogo = $('.team-logo-group-home-logo img.lazy').first().attr('src') || '';
      awayLogo = $('.team-logo-group-away-logo img.lazy').first().attr('src') || '';
    } catch(e) {}

    const m3u8Match = html.match(/file:\s*['"]([^'"]*index\.m3u8[^'"]*)['"]/);
    if (m3u8Match) return { streamUrl: m3u8Match[1], homeLogo, awayLogo };

    const hlsMatch = html.match(/source:\s*['"]([^'"]*\.m3u8[^'"]*)['"]/);
    if (hlsMatch) return { streamUrl: hlsMatch[1], homeLogo, awayLogo };

    const lsStart = html.indexOf('list_stream');
    if (lsStart >= 0) {
      const lsEnd = html.indexOf('];', lsStart) + 2;
      const lsSection = html.substring(lsStart, lsEnd);
      const qRe = /"([^"]+)"/g;
      let qm;
      const candidates = [];
      while ((qm = qRe.exec(lsSection)) !== null) {
        candidates.push(qm[1].replace(/\\\//g, '/'));
      }
      if (candidates.length > 0) {
        const embedUrl = candidates[0];
        // Always try to extract actual Stream URL from embed page
        try {
          const embedHtml = await fetchHTML(embedUrl);
          const streamMatch = embedHtml.match(/Stream\s*=\s*["']([^"']+)["']/);
          if (streamMatch) return { streamUrl: streamMatch[1], homeLogo, awayLogo };
        } catch (e) {}
        // Fallback: use embed + off-tvc URL
        return { streamUrl: embedUrl + '/off-tvc', homeLogo, awayLogo };
      }
    }

    const genericMatch = html.match(/['"]([^'"]*\.m3u8[^'"]*)['"]/);
    if (genericMatch) return { streamUrl: genericMatch[1], homeLogo, awayLogo };

    const iframeMatch = html.match(/iframe[^>]*src=["']([^"']*(?:embed|player|stream)[^"']*)['"]/i);
    if (iframeMatch) {
      const iframeSrc = iframeMatch[1];
      try {
        const iframeHtml = await fetchHTML(iframeSrc);
        const innerM3u8 = iframeHtml.match(/['"]([^'"]*\.m3u8[^'"]*)['"]/);
        if (innerM3u8) return { streamUrl: innerM3u8[1], homeLogo, awayLogo };
      } catch (e) {}
      return { streamUrl: iframeSrc, homeLogo, awayLogo };
    }

    return { streamUrl: null, homeLogo, awayLogo };
  } catch (err) {
    console.error(`Error extracting stream from ${pageUrl}:`, err.message);
    return { streamUrl: null, homeLogo: '', awayLogo: '' };
  }
}

async function extractMatchInfo(pageUrl) {
  const result = await extractStreamUrl(pageUrl);
  return { homeLogo: result.homeLogo, awayLogo: result.awayLogo, homeTeam: '', awayTeam: '' };
}

function cleanTitle(title) {
  let cleaned = title
    .replace(/^(Hôm nay|Ngày mai),?\s*/i, '')
    .replace(/\d{2}:\d{2}\s*[-–]\s*\d{2}\/\d{2}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned.includes(' vs ')) cleaned = cleaned.replace(/\s{2,}/g, ' vs ');
  return cleaned || title;
}

function getTeamLogo(teamName) {
  if (!teamName) return '';
  return TEAM_LOGOS[teamName.toLowerCase().trim()] || '';
}

function getMatchThumbnail(team1, team2) {
  const logo1 = getTeamLogo(team1);
  const logo2 = getTeamLogo(team2);
  if (logo1) return logo1;
  if (logo2) return logo2;
  return 'https://img.icons8.com/color/512/000000/football.png';
}

function generateTvgId(match) {
  const slug = match.slug || (match.title || '').replace(/\s+/g, '-').toLowerCase();
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `xoilac-${match.type}-${slug.slice(0, 20)}-${timestamp}`;
}

function parseTeamsFromSlug(slug) {
  if (!slug) return null;
  const vsMatch = slug.match(/^(.+?)-vs-(.+?)(?:-luc|-\d{4})/);
  if (vsMatch) {
    const team1 = vsMatch[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const team2 = vsMatch[2].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { team1, team2, display: `${team1} vs ${team2}` };
  }
  return null;
}

async function getMatches(type = 'all') {
  let matches = [];
  if (type === 'all' || type === 'live') matches = matches.concat(await scrapeHomepage());
  if (type === 'all' || type === 'highlight') matches = matches.concat(await scrapeHighlights());
  const seen = new Set();
  matches = matches.filter(m => { if (seen.has(m.url)) return false; seen.add(m.url); return true; });
  matches.forEach(m => {
    if (!m.displayTitle) {
      const teams = parseTeamsFromSlug(m.slug);
      if (teams) { m.displayTitle = teams.display; m.team1 = teams.team1; m.team2 = teams.team2; }
      else { m.displayTitle = cleanTitle(m.title); }
    }
  });
  return matches;
}

async function generatePlaylist(type = 'all', baseUrl = '') {
  const matches = await getMatches(type);
  let m3u = '#EXTM3U\n';
  m3u += '#PLAYLIST:Xoilac TV - Live Football\n';
  m3u += `# Generated: ${new Date().toISOString()}\n`;
  m3u += `# Total matches: ${matches.length}\n`;
  m3u += '# Supports: VLC, IPTV Smarters, TiviMate, MonPlayer, Plex, and more\n';
  m3u += '# NOTE: Live streams require Referer header. Highlights (m3u8) work best.\n\n';

  // Group header entries (sorted)
  const groups = [...new Set(matches.map(m => {
    if (m.isLive) return 'Live Now';
    return m.league || (m.type === 'highlight' ? 'Highlights' : 'Live Matches');
  }))];
  for (const g of groups) {
    m3u += `#EXTINF:0 tvg-id="group-${g.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)}" tvg-name="${g}" tvg-logo="https://img.icons8.com/color/512/000000/football2.png" group-title="${g}",${g}\n`;
    m3u += '#EXTVLCOPT:http-user-agent=Mozilla/5.0\n';
    m3u += `#EXTVLCOPT:http-referrer=${BASE_URL}\n`;
    m3u += `${BASE_URL}\n`;
  }
  m3u += '\n';

  const batchSize = 5;
  const results = [];
  for (let i = 0; i < matches.length; i += batchSize) {
    const batch = matches.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (match) => {
        const info = await extractStreamUrl(match.url);
        return { ...match, streamUrl: info.streamUrl, homeLogo: info.homeLogo || match.homeLogo, awayLogo: info.awayLogo || match.awayLogo };
      })
    );
    results.push(...batchResults);
  }

  // Sort by time ascending (sortKey)
  results.sort((a, b) => (a.sortKey || 999999) - (b.sortKey || 999999));

  for (const match of results) {
    if (!match.streamUrl) continue;
    const group = match.isLive
      ? 'Live Now'
      : (match.league
        ? match.league.replace(/^\s+|\s+$/g, '')
        : (match.type === 'highlight' ? 'Highlights' : 'Live Matches'));
    const blvInfo = match.blv ? ` [BLV: ${match.blv}]` : '';
    const timeInfo = match.time ? ` (${match.time})` : '';
    const duration = match.type === 'highlight' ? ' -1' : ' 0';
    const thumbnail = match.homeLogo || (match.team1 && match.team2 ? getMatchThumbnail(match.team1, match.team2) : getMatchThumbnail('', ''));
    const tvgId = generateTvgId(match);
    const title = match.displayTitle || match.title || 'Unknown Match';
    m3u += `#EXTINF:${duration} tvg-id="${tvgId}" tvg-name="${title}" tvg-logo="${thumbnail}" group-title="${group}",${title}${blvInfo}${timeInfo}\n`;
    m3u += `#EXTVLCOPT:http-user-agent=${USER_AGENT}\n`;
    m3u += `#EXTVLCOPT:http-referrer=${BASE_URL}\n`;
    // HLS (highlight): direct CDN URL (no anti-hotlink). FLV (live): proxy via CF Worker
    const proxyTarget = match.streamUrl || match.url;
    const isHls = proxyTarget.includes('.m3u8');
    const streamRef = isHls
      ? proxyTarget  // HLS: use CDN URL directly (segments resolve relative to this)
      : (baseUrl ? `${baseUrl}/proxy?url=${encodeURIComponent(proxyTarget)}` : match.streamUrl);
    match.goSlug = match.slug || title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
    m3u += `${streamRef}\n`;
  }

  if (results.filter(r => r.streamUrl).length === 0) {
    m3u += '# No streams currently available. Try again during match times.\n';
  }
  return m3u;
}

module.exports = { 
  generatePlaylist, 
  getMatches, 
  extractStreamUrl,
  extractMatchInfo,
  scrapeHomepage, 
  scrapeHighlights,
  getTeamLogo,
  getMatchThumbnail,
  generateTvgId,
  TEAM_LOGOS
};
