# Xoilac IPTV + OPhim Movies — Technical Document

> Dynamic IPTV playlist generator + stream proxy for Xoilac TV + OPhim movie M3U

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel (Free)                        │
│                                                             │
│  Serverless (iad1-US, 10s timeout)                          │
│  ├─ /playlist.m3u       → scrape xoilackm.tv → M3U playlist  │
│  ├─ /movie.m3u          → fetch ophim1.com API → M3U playlist│
│  ├─ /api/matches        → JSON API for matches               │
│  ├─ /api/go/:slug       → short URL redirect                 │
│  ├─ /api/stream?url=    → 302 redirect to embed URL          │
│                                                             │
│  Edge (sin1-Singapore, 30s timeout)                         │
│  ├─ /proxy?url=         → fetch stream + correct headers     │
│  ├─ /playlist-edge.m3u  → M3U using /proxy URLs              │
│                                                             │
│  Storage (optional)                                         │
│  └─ Upstash Redis → cache playlist (TTL 2min)               │
├─────────────────────────────────────────────────────────────┤
│                     VPS (45.76.188.82, 20GB bw)              │
│  ├─ proxy-server.js → unlimited stream proxy (port 3000)    │
│  └─ movie-scraper.js → generates movie.m3u (run manually)   │
├─────────────────────────────────────────────────────────────┤
│                     External APIs                             │
│  ├─ ophim1.com → OPhim movie API (JSON)                     │
│  └─ img.ophim.live → movie poster images                    │
└─────────────────────────────────────────────────────────────┘

Clients:
  ⚽ VLC/MonPlayer → playlist.m3u → click match → proxy fetches stream
  🎬 VLC/IPTV app  → movie.m3u    → click movie → opstream CDN
```

---

## 2. Football — The CDN Block Problem

### Root Cause
Xoilac TV's live streams are served by CDNs (pro2cdnlive, procdnlive) that enforce **anti-hotlinking via Origin + Referer header validation**.

```
❌ Origin: https://xoilackt.tv       → 403 Forbidden
❌ Referer: https://xoilackt.tv/      → 403 Forbidden

✅ Origin: https://xoilac.realtimegamepushz.com  → 200 OK
✅ Referer: https://xoilac.realtimegamepushz.com/ → 200 OK
```

The CDN expects the **embed page's domain** (`realtimegamepushz.com`), not the main site.

### Solution: Edge Proxy with Header Override
```
M3U → /proxy?url=... → Vercel Edge fetches CDN with
                       Origin: realtimegamepushz.com  ✓
                       Referer: realtimegamepushz.com/ ✓
                       ↓
                       Pipes stream back to player ✓
```

---

## 3. API Endpoints

### 3.1 Football Playlist

| Endpoint | Runtime | Description |
|---|---|---|
| `/playlist.m3u` | Serverless (US) | Full playlist, URLs via `/proxy` |
| `/playlist.m3u?type=live` | Serverless | Live matches only |
| `/playlist.m3u?type=highlight` | Serverless | Highlights only (m3u8) |
| `/playlist-edge.m3u` | Edge (SG) | Same content, from Singapore |

**M3U Entry Format**:
```
#EXTINF:0 tvg-id="xoilac-live-{slug}-{date}"
         tvg-name="Team A vs Team B"
         tvg-logo="https://imgts.sportpulseapiz.com/football/team/{id}/image/small"
         group-title="🔴 Live Now",
         Team A vs Team B (HH:MM) [BLV: NAME]
#EXTVLCOPT:http-user-agent=Mozilla/5.0
#EXTVLCOPT:http-referrer=https://xoilackm.tv
https://xoilac-iptv.vercel.app/proxy?url=https%3A%2F%2Fxoilackm.tv%2F...
```

### 3.2 Movie Playlist

| Endpoint | Runtime | Description |
|---|---|---|
| `/movie.m3u` | Serverless (US) | Latest 20 movies from OPhim |
| `/movie.m3u?limit=30` | Serverless | Custom limit (max 30) |

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

**`/proxy?url={match-page-url}`** (Edge, 30s timeout)

Returns streaming FLV/HLS with correct CDN headers.

1. Fetches match page from xoilackm.tv
2. Extracts `list_stream` → embed URL → `Stream` variable
3. Fetches CDN with `Origin: realtimegamepushz.com`
4. Pipes stream to client

---

## 4. Data Flow

### 4.1 Football Playlist Generation

```
1. GET https://xoilackm.tv
   ↓ cheerio parse
2. Parse match-horizontals-item (upcoming) + grid-match[aria-label="Đang đá"] (live)
   ↓
3. For each match:
   - Extract teams from .team-name-group > p
   - Extract logos from .team-logo-group img.lazy
   - Extract league from .gmd-comp_logo alt + URL → detect sport
   - Extract time from .grid-match__date span
   - Detect isLive from aria-label="Đang đá"
   - Compute sortKey from date+time
   ↓
4. Filter: only data-sport="football" (via URL pattern /football/competition/)
   ↓
5. Sort by sortKey ascending
   ↓
6. Build M3U:
   #EXTINF with group-title = "🔴 Live Now" | league name | "Live Matches"
   /proxy?url={match-page-url}
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
4. Build M3U:
   #EXTINF with tvg-logo from img.ophim.live
   link_m3u8 as stream URL
```

---

## 5. Scraper Details

### `lib/scraper.js` — Football

| Function | Returns | Description |
|---|---|---|
| `scrapeHomepage()` | `Match[]` | Parse xoilackm.tv, detects both horizontal+grid items |
| `parseMatchCard($, el, href)` | `Match` | Extract teams, logos, league, time, BLV, isLive |
| `parseDateSpan(t)` | `{sortKey}` | Parse "21:00 - 08/05" → sortable minutes |
| `parseDayText(t)` | `{sortKey}` | Parse "Ngày mai, 01:00" → sortable minutes |
| `detectSportFromUrl(src)` | `string` | Extract sport from competition logo URL |
| `scrapeHighlights()` | `Match[]` | Parse xoilackm.tv for highlight links |
| `extractStreamUrl(url)` | `{streamUrl}` | Extract stream from match page |
| `getMatches(type)` | `Match[]` | Combined live + highlights |
| `generatePlaylist(type, baseUrl)` | `string` | Full M3U playlist, sorted by time |

### `lib/movie-scraper.js` — Movies

| Function | Returns | Description |
|---|---|---|
| `generateMoviePlaylist(limit)` | `string` | Fetch latest N movies from ophim1.com |
| `fetchJson(url)` | `object` | Generic JSON fetcher with timeout |

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

// League + sport
$('.gmd-comp_logo').attr('src')  // → /football/competition/{id}/...

// Date/time
$('.grid-match__date.gmd-match-date span').text()  // "21:00 - 08/05"
aria-label="Đang đá"                                // currently playing

// Stream
/list_stream = [["embed_url_1"], ["embed_url_2"]]
/Stream = "cdn_url"
```

### Sport Detection

Sport type is extracted from competition logo URL:
- `/football/competition/` → football
- `/basketball/competition/` → basketball
- `/tennis/competition/` → tennis
- `/volleyball/competition/` → volleyball
- `/csgo/competition/` → esports
- `/dota2/competition/` → esports
- `/lol/competition/` → esports

Only `football` matches are included in the playlist.

---

## 6. Deployment

### Vercel

```bash
vercel --prod --yes
```

### Environment Variables (optional)

| Variable | Source | Purpose |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Vercel Storage → Upstash Redis | Cache playlist (2min TTL) |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel Storage → Upstash Redis | Cache playlist |

### VPS Proxy (manual)

```bash
ssh root@45.76.188.82
cd /root/xoilac-proxy
npm install node-fetch@2 cheerio
# Start football proxy
nohup node proxy-server.js > proxy.log 2>&1 &
# Generate + serve movie playlist
nohup node movie-scraper.js 2>/tmp/scraper-err.log
nohup node -e "require('http').createServer((q,r)=>{
  if(q.url==='/movie.m3u') r.end(require('fs').readFileSync('/root/xoilac-proxy/movie.m3u','utf-8'));
  else {r.writeHead(404);r.end()}
}).listen(3001)" > movie-server.log 2>&1 &
```

---

## 7. Code Map

```
Vercel/
├── api/
│   ├── index.js          → Serverless: football+movies playlist, homepage
│   ├── proxy.js          → Edge: stream proxy with header override
│   ├── matches.js        → Serverless: JSON API
│   ├── qr.js             → Serverless: QR code generation
│   ├── go.js             → Serverless: short URL redirect
│   ├── edge-proxy.js     → Edge: alternative proxy
│   ├── edge-test.js      → Edge: test endpoint
│   ├── playlist-edge.js  → Edge: auto-generated M3U
│   └── stream.js         → Serverless: stream redirect
├── lib/
│   ├── scraper.js        → Core: football scrape + extract + playlist
│   ├── scraper-cached.js → Cached wrapper (Upstash Redis)
│   ├── movie-scraper.js  → Movie: OPhim API → M3U playlist
│   └── homepage.js       → HTML homepage template
├── proxy-server.js       → VPS proxy server
├── server.js             → Local development server
├── vercel.json           → Vercel routes config
├── package.json
└── TECHNICAL.md          ← This file
```

---

## 8. Performance

| Operation | Serverless (US) | Edge (SG) | VPS |
|---|---|---|---|
| Football playlist | 15-60s | — | — |
| Movie playlist | 3-8s | — | — |
| Cache hit | 2-5s (with Redis) | — | — |
| First byte (proxy) | 2-5s | 1-3s | 1-2s |
| Stream timeout | 10s ❌ | 30s ⚠️ | Unlimited ✅ |

---

## 9. Playlist Organization

### Football (`/playlist.m3u`)
```
🔴 Live Now       (Đang đá — sorted by time asc)
Live Matches      (upcoming — sorted by time asc)
Highlights        (if any)
```

### Movies (`/movie.m3u`)
```
#EXTINF per episode (all episodes of latest 20 movies)
Sorted by movie release order (from ophim1 API)
```

---

## 10. Common Issues & Fixes

### "Stream returns 403"
→ **Fix**: Edge proxy must set `Origin: https://xoilac.realtimegamepushz.com`

### "Auth_key expired"
→ **Fix**: Always fetch fresh stream URL before connecting to CDN

### "Movie playlist generation slow"
→ **Fix**: Reduce `limit` parameter. Parallel fetch via Promise.allSettled.

### "VPS proxy wrong format"
→ **Fix**: Check M3U content-type header is `application/x-mpegurl`

---

## 11. References

- [Vercel Edge Functions docs](https://vercel.com/docs/functions/edge-functions)
- [Upstash Redis integration](https://vercel.com/docs/storage/vercel-kv)
- [M3U specification](https://en.wikipedia.org/wiki/M3U)
- [FLV.js](https://github.com/bilibili/flv.js)
- [maphim/film — OPhim service](https://github.com/maphim/film/blob/main/src/services/ophim.service.ts)
