// Cached version of scraper using Upstash Redis (Vercel KV)
// Falls back to original scraper if Redis is unavailable
const { Redis } = require('@upstash/redis');
const orig = require('./scraper');

let redis = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch(e) { /* Redis unavailable, use fallback */ }

const CACHE_TTL = {
  MATCHES: 120,    // 2 min for match list
  STREAM: 30,      // 30s for stream URLs (tokens expire fast)
};

async function cachedGeneratePlaylist(type = 'all', baseUrl = '') {
  if (!redis) return orig.generatePlaylist(type, baseUrl);

  const cacheKey = `xoilac:playlist:${type || 'all'}`;
  
  // Try cache
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  // Generate fresh
  const playlist = await orig.generatePlaylist(type, baseUrl);
  
  // Cache (don't await - fire and forget)
  redis.setex(cacheKey, CACHE_TTL.MATCHES, playlist).catch(() => {});
  
  return playlist;
}

async function cachedGetMatches(type = 'all') {
  if (!redis) return orig.getMatches(type);
  
  const cacheKey = `xoilac:matches:${type || 'all'}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;
  
  const matches = await orig.getMatches(type);
  redis.setex(cacheKey, CACHE_TTL.MATCHES, matches).catch(() => {});
  return matches;
}

module.exports = {
  generatePlaylist: cachedGeneratePlaylist,
  getMatches: cachedGetMatches,
  extractStreamUrl: orig.extractStreamUrl,
  extractMatchInfo: orig.extractMatchInfo,
  scrapeHomepage: orig.scrapeHomepage,
  scrapeHighlights: orig.scrapeHighlights,
};
