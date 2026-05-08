Ran terminal command:  cd /home/anhnc/.gemini/antigravity/scratch/Vercel && cat > /tmp/test-extract.js << 'EOF'
const fetch = require('node-fetch');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchHTML(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': 'https://xoilackt.tv',
    },
    timeout: 15000,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function extractStreamUrl(pageUrl) {
  const html = await fetchHTML(pageUrl);
  const listStreamMatch = html.match(/list_stream\s*=\s*\[\["([^"]+)"\]\]/);
  if (listStreamMatch) {
    const embedUrl = listStreamMatch[1].replace(/\\//g, '/');
    console.log('Found list_stream:', embedUrl);
    const embedHtml = await fetchHTML(embedUrl);
    const streamMatch = embedHtml.match(/Stream\s*=\s*["']([^"']+)["']/);
    if (streamMatch) {
      console.log('Found Stream:', streamMatch[1]);
      return streamMatch[1];
    }
  }
  return null;
}

extractStreamUrl('https://xoilackt.tv/truc-tiep/manly-united-vs-university-nsw-luc-1630-ngay-08-05-2026/')
  .then(url => console.log('Result:', url))
  .catch(err => console.error('Error:', err.message));
EOF
node /tmp/test-extract.js
Completed with input:  cd /home/anhnc/.gemini/antigravity/scratch/Vercel && cat > /tmp/test-extract.js << 'EOF'
const fetch = require('node-fetch');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchHTML(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': 'https://xoilackt.tv',
    },
    timeout: 15000,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function extractStreamUrl(pageUrl) {
  const html = await fetchHTML(pageUrl);
  const listStreamMatch = html.match(/list_stream\s*=\s*\[\["([^"]+)"\]\]/);
  if (listStreamMatch) {
    const embedUrl = listStreamMatch[1].replace(/\\//g, '/');
    console.log('Found list_stream:', embedUrl);
    const embedHtml = await fetchHTML(embedUrl);
    const streamMatch = embedHtml.match(/Stream\s*=\s*["']([^"']+)["']/);
    if (streamMatch) {
      console.log('Found Stream:', streamMatch[1]);
      return streamMatch[1];
    }
  }
  return null;
}

extractStreamUrl('https://xoilackt.tv/truc-tiep/manly-united-vs-university-nsw-luc-1630-ngay-08-05-2026/')
  .then(url => console.log('Result:', url))
  .catch(err => console.error('Error:', err.message));
EOF
node /tmp/test-extract.js
