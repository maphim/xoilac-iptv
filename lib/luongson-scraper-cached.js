/**
 * Cached LuongSonTV Playlist Scraper
 * Cache strategy: Upstash Redis → /tmp file → fresh generate
 * Config: CACHE_TTL=240 (4 min) via env LS_CACHE_TTL
 */
const fetch = require('node-fetch');
const fs = require('fs');
const orig = require('./luongson-scraper');

const CACHE_TTL = parseInt(process.env.LS_CACHE_TTL || '240');
const TMP_CACHE = '/tmp/luongson-m3u-cache.txt';

let redis = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = require('@upstash/redis');
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch(e) {}

async function generatePlaylistCached() {
  // 1. Try Redis
  if (redis) {
    try {
      const cached = await redis.get('luongson:playlist');
      if (cached) { console.log('Redis HIT'); return cached; }
    } catch(e) { console.log('Redis error:', e.message); }
  }

  // 2. Try /tmp cache
  try {
    const stat = fs.statSync(TMP_CACHE);
    const age = Date.now() - stat.mtimeMs;
    if (age < CACHE_TTL * 1000) {
      console.log(`TmpCache HIT (age=${Math.round(age/1000)}s)`);
      return fs.readFileSync(TMP_CACHE, 'utf8');
    }
  } catch(e) {}

  // 3. Fresh generate
  console.log('Cache MISS, generating...');
  const fresh = await orig.generatePlaylist();

  // 4. Store in Redis (fire & forget)
  if (redis) {
    redis.setex('luongson:playlist', CACHE_TTL, fresh).catch(() => {});
  }
  // 5. Store in /tmp
  fs.writeFileSync(TMP_CACHE, fresh, 'utf8');

  return fresh;
}

// Fast playlist (redirect mode) cache - shorter TTL since it's lightweight
async function generateFastPlaylistCached(baseUrl) {
  // 1. Try Redis
  if (redis) {
    try {
      const cached = await redis.get('luongson:fast:playlist');
      if (cached) { console.log('Fast Redis HIT'); return cached; }
    } catch(e) {}
  }
  // 2. Try /tmp cache
  try {
    const stat = fs.statSync('/tmp/luongson-fast-m3u.txt');
    const age = Date.now() - stat.mtimeMs;
    if (age < CACHE_TTL * 1000) {
      console.log('Fast TmpCache HIT');
      return fs.readFileSync('/tmp/luongson-fast-m3u.txt', 'utf8');
    }
  } catch(e) {}
  // 3. Fresh generate
  console.log('Fast cache MISS');
  const fresh = await orig.generateFastPlaylist(baseUrl || process.env.BASE_URL || 'https://xoilac-iptv.vercel.app');
  if (redis) redis.setex('luongson:fast:playlist', CACHE_TTL, fresh).catch(() => {});
  fs.writeFileSync('/tmp/luongson-fast-m3u.txt', fresh, 'utf8');
  return fresh;
}

module.exports = { generatePlaylist: generatePlaylistCached, generateFastPlaylist: generateFastPlaylistCached, resolveStreamUrl: orig.resolveStreamUrl };
