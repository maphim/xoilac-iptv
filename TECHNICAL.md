# Xoilac IPTV + OPhim Movies — Technical Document

> Dynamic IPTV playlist generator + stream proxy for Xoilac TV + OPhim movie M3U
> **Architecture: Vercel (scrape + playlist) + Cloudflare Workers (FLV proxy)**

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      Vercel (Free) — Serverless (iad1-US)                │
│                                                                          │
│  server.js (root entrypoint)                                             │
│  ├─ /playlist.m3u       → scrape xoilackm.tv → extract CDN URLs → M3U   │
│  │                        HLS → direct CDN URL (no proxy needed)        │
│  │                        FLV → CF Worker proxy URL                      │
│  ├─ /movie.m3u          → fetch ophim1.com API → M3U playlist            │
│  ├─ /proxy?url=         → Vercel proxy (fallback, 10s timeout)           │
│  └─ /api/matches        → JSON API for matches                           │
│                                                                          │
│  Env: CF_WORKER_URL=https://xoilac-proxy.maphim.workers.dev              │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│              Cloudflare Workers (Free) — Global Edge Network              │
│                                                                          │
│  xoilac-proxy.maphim.workers.dev                                         │
│  └─ /proxy?url=<cdn-url> → fetch CDN with correct headers → pipe stream  │
│     CPU ~1-2ms (under 10ms free limit)                                   │
│     No timeout (long-lived HTTP connections)                             │
│     Only FLV streams need proxy (HLS bypasses)                           │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                          External APIs                                     │
│  ├─ ophim1.com          → OPhim movie API (JSON)                         │
│  ├─ xoilackm.tv         → Match page scraper source                       │
│  ├─ pro2cdnlive.com     → FLV live stream CDN (needs Origin/Referer)     │
│  └─ highlight.thuckhuya1.net → HLS highlight CDN (open access)           │
└──────────────────────────────────────────────────────────────────────────┘

Clients:
  ⚽ VLC/MonPlayer → playlist.m3u → click match
       ├── HLS: direct CDN → player segments (ok)
       └── FLV: CF Worker → CDN with headers → pipe video
  🎬 VLC/IPTV app  → movie.m3u    → click movie → opstream CDN
```

---

## 2. The CDN Block Problem

### Root Cause
Xoilac TV's live streams (FLV) are served by CDNs (pro2cdnlive, procdnlive) that enforce **anti-hotlinking via Origin + Referer header validation**.

```
❌ Origin: https://xoilackt.tv       → 403 Forbidden
❌ Referer: https://xoilackt.tv/      → 403 Forbidden

✅ Origin: https://xoilac.realtimegamepushz.com  → 200 OK
✅ Referer: https://xoilac.realtimegamepushz.com/ → 200 OK
```

The CDN expects the **embed page's domain** (`realtimegamepushz.com`), not the main site.

### Why Not Vercel Proxy?
Vercel Serverless Functions have **10s timeout**, Edge Functions have **30s timeout**.  
Streaming FLV 24/7 requires **unlimited connection** → Cloudflare Workers.

### Solution: Vercel + Cloudflare Workers Dual
```
Vercel scrapes match page → extracts actual Stream CDN URL
  ├── HLS (.m3u8):  direct CDN → player fetches segments (no anti-hotlink)
  └── FLV (.flv):   CF Worker adds Origin: realtimegamepushz.com → pipes stream
```

---

## 3. API Endpoints

### 3.1 Football Playlist

| Endpoint | Backend | Description |
|---|---|---|
| `/playlist.m3u` | Vercel server.js | Full playlist, HLS direct / FLV via CF Worker |
| `/playlist.m3u?type=live` | Vercel | Live matches only |
| `/playlist.m3u?type=highlight` | Vercel | Highlights only (m3u8) |

**M3U Entry Format — HLS (highlight)**:
```
#EXTINF:-1 tvg-id="xoilac-highlight-{slug}-{date}"
         tvg-name="Team A vs Team B"
         group-title="Highlights",
         Team A vs Team B
#EXTVLCOPT:http-user-agent=Mozilla/5.0
https://highlight.thuckhuya1.net/2026/05/08/{id}/index.m3u8
```

**M3U Entry Format — FLV (live)**:
```
#EXTINF:0 tvg-id="xoilac-live-{slug}-{date}"
         tvg-name="Team A vs Team B"
         tvg-logo="https://imgts.sportpulseapiz.com/football/team/{id}/image/small"
         group-title="🔴 Live Now",
         Team A vs Team B (HH:MM) [BLV: NAME]
#EXTVLCOPT:http-user-agent=Mozilla/5.0
#EXTVLCOPT:http-referrer=https://xoilackm.tv
https://xoilac-proxy.maphim.workers.dev/proxy?url=https%3A%2F%2Flive1.pro2cdnlive.com%2Flive%2Fchannel1.flv
```

### 3.2 Movie Playlist

| Endpoint | Backend | Description |
|---|---|---|
| `/movie.m3u` | Vercel | Latest 20 movies from OPhim |
| `/movie.m3u?limit=30` | Vercel | Custom limit (max 30) |

**M3U Entry Format**:
```
#EXTINF:-1 tvg-logo="https://img.ophim.live/uploads/movies/{slug}-poster.jpg"
         tvg-id="{slug}-tap-{n}",
         Movie Name - Tập {n}
#EXTVLCOPT:http-user-agent=Mozilla/5.0
#EXTVLCOPT:http-referrer=https://ophim1.com
https://vip.opstream{id}.com/{date}/{code}/index.m3u8
```

### 3.3 Proxy

**Vercel proxy** (fallback, 10s timeout):  
`/proxy?url={match-page-url}` — scrapes match page + extracts stream + pipes

**Cloudflare Worker proxy** (no timeout):  
`https://xoilac-proxy.maphim.workers.dev/proxy?url={cdn-stream-url}` — pure pipe

---

## 4. Data Flow

### 4.1 Football Playlist Generation

```
1. GET https://xoilackm.tv
   ↓ cheerio parse
2. Parse match-horizontals-item (upcoming) + grid-match[aria-label="Đang đá"] (live)
   ↓
3. For each match:
   - Extract teams, logos, league, BLV, isLive, time
   - Filter: only football
   ↓
4. For each match → extractStreamUrl(match.url):
   a. Fetch match page → parse list_stream → get embed URLs
   b. Fetch first embed URL → regex /Stream = "(.+)"/ → get CDN stream URL
   c. Returns actual CDN URL (pro2cdnlive.com/...flv or highlight...m3u8)
   ↓
5. Build M3U:
   HLS streams → direct CDN URL (no proxy)
   FLV streams → CF Worker proxy URL
```

### 4.2 Movie Playlist Generation

```
1. GET https://ophim1.com/danh-sach/phim-moi-cap-nhat?page=1
   ↓ JSON response
2. Extract items[] → [{slug, name, poster_url, ...}]
   ↓
3. For each movie (parallel Promise.allSettled):
   GET https://ophim1.com/phim/{slug}
   ↓ JSON response
   Extract episodes[0].server_data[] → [{name, link_m3u8, link_embed}]
   ↓
4. Build M3U with tvg-logo + stream URL
```

---

## 5. Scraper Details

### `lib/scraper.js` — Football

| Function | Returns | Description |
|---|---|---|
| `scrapeHomepage()` | `Match[]` | Parse xoilackm.tv, detects both horizontal+grid items |
| `parseMatchCard($, el, href)` | `Match` | Extract teams, logos, league, time, BLV, isLive |
| `scrapeHighlights()` | `Match[]` | Parse xoilackm.tv for highlight links |
| `extractStreamUrl(url)` | `{streamUrl}` | Extract CDN stream URL from match page |
| `getMatches(type)` | `Match[]` | Combined live + highlights |
| `generatePlaylist(type, baseUrl)` | `string` | Full M3U playlist (HLS direct / FLV via proxy) |

**extractStreamUrl flow**:
```javascript
// 1. Check for HLS direct (file: "..." or source: "...")
html.match(/file:\s*['"]([^'"]*index\.m3u8[^'"]*)['"]/)  → streamUrl
html.match(/source:\s*['"]([^'"]*\.m3u8[^'"]*)['"]/)     → streamUrl

// 2. Parse list_stream → embed URLs → fetch embed → extract Stream=
html.indexOf('list_stream')
  → embedUrls = [...urls from array]
  → fetch(embedUrl) → /Stream\s*=\s*["']([^"']+)["']/  → actual CDN URL
  → fallback: embedUrl + '/off-tvc'
```

### `lib/movie-scraper.js` — Movies

| Function | Returns | Description |
|---|---|---|
| `generateMoviePlaylist(limit)` | `string` | Fetch latest N movies from ophim1.com |

### Key Selectors (Football)

```javascript
// Match cards
$('a.match-horizontals-item[href*="/truc-tiep/"]')  // upcoming
$('div.grid-match[href*="/truc-tiep/"]')             // live

// Teams
$('.gmd-home_team .team-name-group p').text()
$('.gmd-away_team .team-name-group p').text()

// Logos
$('.team-logo-group img.lazy').attr('src')

// League + sport detection
$('.gmd-comp_logo').attr('src')  // → /football/competition/{id}/...

// Date/time
$('.grid-match__date.gmd-match-date span').text()  // "21:00 - 08/05"
aria-label="Đang đá"                                // currently playing

// Stream extraction
/list_stream = [["embed_url_1"], ["embed_url_2"]]
/Stream = "cdn_url"
```

---

## 6. Code Map

```
xoilac-iptv/
├── server.js              → Vercel entry point: proxy + playlist + movie + API
├── cloudflare-worker.js   → CF Worker script (deploy via Cloudflare Dashboard)
├── vercel.json            → Vercel routes config
├── package.json
├── render.yaml            → Render.com Blueprint (alternative deploy)
├── TECHNICAL.md           ← This file
├── api/
│   ├── index.js           → Vercel Serverless (used if server.js removed)
│   ├── proxy.js           → Edge proxy (original Vercel-only version)
│   ├── matches.js         → JSON API
│   ├── qr.js, go.js, stream.js, edge-proxy.js, edge-test.js, playlist-edge.js
├── lib/
│   ├── scraper.js         → Core: football scrape + extractStreamUrl + playlist
│   ├── scraper-cached.js  → Wrapper with Upstash Redis cache
│   ├── movie-scraper.js   → OPhim API → M3U playlist
│   └── homepage.js        → HTML homepage template
└── proxy-server.js        → VPS proxy (legacy)
```

---

## 7. Performance

| Operation | Vercel (iad1) | CF Worker | Notes |
|---|---|---|---|
| Football playlist gen | 15-60s | — | Vercel scrapes + extracts all streams |
| Movie playlist gen | 3-8s | — | Vercel fetches OPhim API |
| HLS first byte | 100-500ms | — | Direct CDN, no proxy |
| FLV first byte | 2-5s | 1-3s | CF Worker adds headers + pipes |
| Stream timeout | 10s ⛔ | **Unlimited** ✅ | CF Worker keeps connection alive |
| CPU usage per req | — | ~1-2ms | Well under 10ms free limit |

---

## 8. Deployment

### 8.1 Vercel (Git-based)

GitHub repo auto-deploys to Vercel. Push to main → Vercel deploys.

```bash
git push origin main
```

**Environment Variables** (set in Vercel Dashboard → Project Settings):

| Variable | Value | Purpose |
|---|---|---|
| `CF_WORKER_URL` | `https://xoilac-proxy.maphim.workers.dev` | Proxy FLV streams through CF Worker |
| `UPSTASH_REDIS_REST_URL` | (optional) | Cache playlist (2min TTL) |
| `UPSTASH_REDIS_REST_TOKEN` | (optional) | Cache playlist |

### 8.2 Cloudflare Worker (Dashboard)

1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
2. Name: `xoilac-proxy`
3. Paste code from `cloudflare-worker.js` → Save and Deploy

### 8.3 Local Dev

```bash
npm install
node server.js
# → http://localhost:3000
```

### 8.4 Render.com (alternative)

`render.yaml` provided for Render deployment (singapore, free plan).

```bash
# Set CF_WORKER_URL env var in Render Dashboard too:
render env set CF_WORKER_URL https://xoilac-proxy.maphim.workers.dev
```

---

## 9. Playlist Organization

### Football (`/playlist.m3u`)
```
🔴 Live Now       (Đang đá — sorted by time asc)
Live Matches      (upcoming — sorted by time asc)
Highlights        (HLS, direct CDN URL)
```

### Movies (`/movie.m3u`)
```
#EXTINF per episode (all episodes of latest 20 movies)
Sorted by movie release order (from ophim1 API)
```

---

## 10. Common Issues & Fixes

### "Stream returns 403/404"
→ **Fix**: For FLV, CF Worker must set `Origin: https://xoilac.realtimegamepushz.com`  
→ For HLS, use direct CDN URL (no proxy needed)

### "CF Worker returns 502 CDN error"
→ **Fix**: CDN stream may be offline (no live match). Verify during match time.  
→ Check if stream URL has valid `wsSecret`/`wsABSTime` params

### "TS segments not loading (HLS)"
→ **Fix**: HLS streams use direct CDN URLs in M3U, not proxy.  
→ Relative `.ts` paths resolve against the M3U8 CDN host automatically.

### "Auth_key expired"
→ **Fix**: Always regenerate playlist (fetch fresh stream URL).  
→ Vercel scrapes fresh on every `/playlist.m3u` request.

### "Movie playlist generation slow"
→ **Fix**: Reduce `limit` parameter. Parallel fetch via Promise.allSettled.

### "Vercel cold start"
→ **Fix**: Vercel Serverless has minimal cold start (<1s).  
→ CF Worker has no cold start.

---

## 11. CF Worker Code

```javascript
// Deployed at: https://xoilac-proxy.maphim.workers.dev
// Pure proxy: fetch CDN with correct headers → pipe stream to client
// CPU ~1-2ms. No timeout. Free tier.

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const streamUrl = url.searchParams.get('url') || url.searchParams.get('stream');
    if (!streamUrl) return new Response('Missing ?url=', {status: 400});

    const decoded = decodeURIComponent(streamUrl);
    const isM3u8 = decoded.includes('.m3u8');
    const headers = isM3u8
      ? {'User-Agent':'Mozilla/5.0','Referer':'https://xoilackt.tv','Origin':'https://xoilackt.tv'}
      : {'User-Agent':'Mozilla/5.0','Accept':'*/*',
         'Origin':'https://xoilac.realtimegamepushz.com',
         'Referer':'https://xoilac.realtimegamepushz.com/',
         'Sec-Fetch-Dest':'empty','Sec-Fetch-Mode':'cors','Sec-Fetch-Site':'cross-site'};

    try {
      const res = await fetch(decoded, {headers, cf:{cacheEverything:false,cacheTtl:0}});
      if (!res.ok) return new Response('CDN error: '+res.status, {status:502});
      return new Response(res.body, {
        headers:{'Content-Type':isM3u8?'application/x-mpegurl':'video/x-flv',
                 'Cache-Control':'no-cache','Access-Control-Allow-Origin':'*'}
      });
    } catch(e) { return new Response(e.message, {status:502}); }
  },
};
```

---

## 12. References

- [Cloudflare Workers docs](https://developers.cloudflare.com/workers/)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [M3U specification](https://en.wikipedia.org/wiki/M3U)
- [FLV.js](https://github.com/bilibili/flv.js)
- [maphim/film — OPhim service](https://github.com/maphim/film/blob/main/src/services/ophim.service.ts)
