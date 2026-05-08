# Upstash Redis + Vercel cho Xoilac IPTV

## Vấn đề
Playlist generation mất ~30-60s do phải fetch tất cả match pages để lấy stream URLs. Mỗi request đều scrape lại từ đầu.

## Giải pháp với Upstash Redis (free tier: 256MB, 10k requests/day)

### 1. Cài Upstash Redis
```bash
# Vercel Dashboard → Storage → Create Database → Upstash Redis
# Hoặc CLI:
npm install @upstash/redis
```

### 2. Add env vars to Vercel
```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

### 3. Cache match list (TTL 2 phút)
```js
import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

async function getCachedMatches(type) {
  const key = `xoilac:matches:${type}`;
  const cached = await redis.get(key);
  if (cached) return cached;
  
  const fresh = await fetchAndParseMatches(type);
  await redis.setex(key, 120, fresh); // TTL 120s
  return fresh;
}
```

### 4. Cache stream URLs cho từng match (TTL 30s)
```js
async function getCachedStream(matchUrl) {
  const key = `xoilac:stream:${hash(matchUrl)}`;
  const cached = await redis.get(key);
  if (cached) return cached;
  
  const stream = await extractStreamUrl(matchUrl);
  await redis.setex(key, 30, stream); // TTL 30s
  return stream;
}
```

## Kết quả
- **Trước**: 30-60s mỗi request playlist
- **Sau**: ~2-5s (cache hit) / ~30-60s (cache miss, mỗi 2 phút)

## Lưu ý
- Streaming vẫn không qua Vercel được (timeout 10s)
- Redis chỉ cache metadata, không cache video stream
- Free tier: 10k req/day, đủ cho ~2k lượt playlist load
