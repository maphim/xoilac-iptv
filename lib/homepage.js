/**
 * Render the beautiful homepage
 */
function renderHomepage(hostOrUrl) {
  // Support both full URL and just host
  const baseUrl = hostOrUrl.startsWith('http') ? hostOrUrl : `http://${hostOrUrl}`;
  
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xoilac IPTV — Dynamic Playlist Generator</title>
  <meta name="description" content="Dynamic IPTV playlist generator for Xoilac TV live football streams">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    :root {
      --bg-primary: #0a0e17;
      --bg-secondary: #111827;
      --bg-card: #1a2235;
      --bg-card-hover: #1f2b42;
      --text-primary: #f0f4fc;
      --text-secondary: #8899b4;
      --text-muted: #5a6a84;
      --accent-green: #22c55e;
      --accent-green-glow: rgba(34, 197, 94, 0.3);
      --accent-blue: #3b82f6;
      --accent-purple: #8b5cf6;
      --accent-orange: #f97316;
      --accent-red: #ef4444;
      --accent-cyan: #06b6d4;
      --border-color: rgba(255, 255, 255, 0.06);
      --gradient-hero: linear-gradient(135deg, #0a0e17 0%, #111827 50%, #0f172a 100%);
      --gradient-accent: linear-gradient(135deg, #22c55e, #06b6d4);
      --gradient-card: linear-gradient(145deg, rgba(26, 34, 53, 0.8), rgba(15, 23, 42, 0.9));
      --shadow-glow: 0 0 40px rgba(34, 197, 94, 0.15);
      --radius: 16px;
      --radius-sm: 10px;
      --radius-xs: 6px;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      overflow-x: hidden;
      line-height: 1.6;
    }

    /* Animated background */
    .bg-animation {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;
    }
    .bg-animation .orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.15;
      animation: float 20s ease-in-out infinite;
    }
    .bg-animation .orb:nth-child(1) {
      width: 600px; height: 600px;
      background: var(--accent-green);
      top: -200px; left: -100px;
      animation-delay: 0s;
    }
    .bg-animation .orb:nth-child(2) {
      width: 500px; height: 500px;
      background: var(--accent-blue);
      bottom: -200px; right: -100px;
      animation-delay: -7s;
    }
    .bg-animation .orb:nth-child(3) {
      width: 400px; height: 400px;
      background: var(--accent-purple);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      animation-delay: -14s;
    }

    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(50px, -30px) scale(1.1); }
      50% { transform: translate(-30px, 50px) scale(0.95); }
      75% { transform: translate(40px, 30px) scale(1.05); }
    }

    .container {
      position: relative;
      z-index: 1;
      max-width: 1100px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* Header */
    header {
      padding: 32px 0;
      border-bottom: 1px solid var(--border-color);
    }
    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .logo-icon {
      width: 48px; height: 48px;
      background: var(--gradient-accent);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: var(--shadow-glow);
      animation: pulse 3s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { box-shadow: var(--shadow-glow); }
      50% { box-shadow: 0 0 60px rgba(34, 197, 94, 0.3); }
    }
    .logo-text {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .logo-text span {
      background: var(--gradient-accent);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      padding: 8px 16px;
      border-radius: 50px;
      font-size: 13px;
      font-weight: 500;
      color: var(--accent-green);
    }
    .status-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--accent-green);
      animation: blink 2s ease-in-out infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* Hero */
    .hero {
      padding: 80px 0 60px;
      text-align: center;
    }
    .hero h1 {
      font-size: clamp(36px, 5vw, 56px);
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: -1.5px;
      margin-bottom: 20px;
    }
    .hero h1 .gradient {
      background: var(--gradient-accent);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero p {
      font-size: 18px;
      color: var(--text-secondary);
      max-width: 600px;
      margin: 0 auto 40px;
      line-height: 1.7;
    }

    /* URL Cards */
    .endpoints {
      display: grid;
      gap: 20px;
      margin-bottom: 60px;
    }
    .endpoint-card {
      background: var(--gradient-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 28px 32px;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
    }
    .endpoint-card:hover {
      border-color: rgba(34, 197, 94, 0.3);
      box-shadow: var(--shadow-glow);
      transform: translateY(-2px);
    }
    .endpoint-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
    }
    .endpoint-icon {
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    .endpoint-icon.playlist { background: rgba(34, 197, 94, 0.15); }
    .endpoint-icon.api { background: rgba(59, 130, 246, 0.15); }
    .endpoint-icon.filter { background: rgba(249, 115, 22, 0.15); }
    .endpoint-title {
      font-size: 17px;
      font-weight: 700;
    }
    .endpoint-desc {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 16px;
      line-height: 1.6;
    }
    .url-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 14px 18px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--accent-green);
      overflow-x: auto;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .url-box:hover {
      border-color: var(--accent-green);
    }
    .url-box .url-text {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .copy-btn {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: var(--accent-green);
      padding: 6px 14px;
      border-radius: var(--radius-xs);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .copy-btn:hover {
      background: rgba(34, 197, 94, 0.25);
    }
    .copy-btn.copied {
      background: var(--accent-green);
      color: #000;
    }

    /* QR Code styles */
    .qr-container {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
    }
    .qr-box {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 8px;
      width: 100px;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .qr-box img, .qr-box svg {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .qr-info {
      flex: 1;
      font-size: 13px;
    }
    .qr-info h4 {
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--accent-cyan);
    }
    .qr-info p {
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.5;
    }
    .qr-btn {
      background: rgba(6, 182, 212, 0.15);
      border: 1px solid rgba(6, 182, 212, 0.3);
      color: var(--accent-cyan);
      padding: 6px 12px;
      border-radius: var(--radius-xs);
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .qr-btn:hover {
      background: rgba(6, 182, 212, 0.25);
    }

    /* Features grid */
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 60px;
    }
    .feature {
      background: var(--gradient-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 28px;
      transition: all 0.3s ease;
    }
    .feature:hover {
      border-color: rgba(255, 255, 255, 0.1);
      transform: translateY(-2px);
    }
    .feature-icon {
      font-size: 28px;
      margin-bottom: 16px;
    }
    .feature h3 {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .feature p {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    /* Instructions */
    .instructions {
      background: var(--gradient-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 40px;
      margin-bottom: 60px;
    }
    .instructions h2 {
      font-size: 24px;
      font-weight: 800;
      margin-bottom: 28px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .step {
      display: flex;
      gap: 20px;
      margin-bottom: 24px;
      align-items: flex-start;
    }
    .step:last-child { margin-bottom: 0; }
    .step-num {
      width: 36px; height: 36px;
      min-width: 36px;
      background: var(--gradient-accent);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      color: #000;
    }
    .step-content h4 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .step-content p {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.6;
    }
    .step-content code {
      background: rgba(0,0,0,0.3);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--accent-cyan);
    }

    /* Live Preview */
    .live-preview {
      margin-bottom: 60px;
    }
    .live-preview h2 {
      font-size: 24px;
      font-weight: 800;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .matches-grid {
      display: grid;
      gap: 12px;
    }
    .match-item {
      background: var(--gradient-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.3s ease;
    }
    .match-item:hover {
      border-color: rgba(34, 197, 94, 0.3);
      background: var(--bg-card-hover);
    }
    .match-info {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .match-type {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .match-type.live {
      background: rgba(239, 68, 68, 0.15);
      color: var(--accent-red);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .match-type.highlight {
      background: rgba(139, 92, 246, 0.15);
      color: var(--accent-purple);
      border: 1px solid rgba(139, 92, 246, 0.2);
    }
    .match-title {
      font-weight: 600;
      font-size: 14px;
    }
    .match-stream {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-muted);
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .match-loading {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 40px;
      justify-content: center;
      color: var(--text-secondary);
    }
    .spinner {
      width: 24px; height: 24px;
      border: 3px solid var(--border-color);
      border-top: 3px solid var(--accent-green);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Footer */
    footer {
      border-top: 1px solid var(--border-color);
      padding: 32px 0;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
    footer a {
      color: var(--accent-green);
      text-decoration: none;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .header-content { flex-direction: column; gap: 16px; }
      .hero { padding: 50px 0 40px; }
      .endpoint-card { padding: 20px; }
      .instructions { padding: 24px; }
      .match-item { flex-direction: column; align-items: flex-start; gap: 8px; }
      .match-stream { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="bg-animation">
    <div class="orb"></div>
    <div class="orb"></div>
    <div class="orb"></div>
  </div>

  <header>
    <div class="container header-content">
      <div class="logo">
        <div class="logo-icon">📺</div>
        <div class="logo-text"><span>Xoilac</span> IPTV</div>
      </div>
      <div class="status-badge">
        <div class="status-dot"></div>
        Service Online
      </div>
    </div>
  </header>

  <section class="hero">
    <div class="container">
      <h1>Dynamic <span class="gradient">IPTV Playlist</span><br>Generator</h1>
      <p>Auto-scrapes live football matches from Xoilac TV and generates real-time M3U/M3U8 playlists compatible with any IPTV player.</p>
    </div>
  </section>

  <section class="container endpoints">
    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-icon playlist">📋</div>
        <div class="endpoint-title">M3U Playlist (Full)</div>
      </div>
      <div class="endpoint-desc">Complete IPTV playlist with all live matches and highlights. Use this URL directly in VLC, IPTV Smarters, TiviMate, or any M3U-compatible player.</div>
      <div class="url-box" onclick="copyUrl(this)">
        <span class="url-text">${baseUrl}/playlist.m3u</span>
        <button class="copy-btn">Copy</button>
      </div>
      <div class="qr-container">
        <div class="qr-box">
          <img src="${baseUrl}/api/qr?url=${encodeURIComponent(`${baseUrl}/playlist.m3u`)}&size=200&format=svg" alt="QR Code" loading="lazy">
        </div>
        <div class="qr-info">
          <h4>📱 Scan with MonPlayer</h4>
          <p>Point your camera or MonPlayer app at the QR code to instantly open the playlist.</p>
        </div>
      </div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-icon filter">🔴</div>
        <div class="endpoint-title">Live Matches Only</div>
      </div>
      <div class="endpoint-desc">Playlist filtered to show only live and upcoming matches. Best for catching today's games.</div>
      <div class="url-box" onclick="copyUrl(this)">
        <span class="url-text">${baseUrl}/playlist.m3u?type=live</span>
        <button class="copy-btn">Copy</button>
      </div>
      <div class="qr-container">
        <div class="qr-box">
          <img src="${baseUrl}/api/qr?url=${encodeURIComponent(`${baseUrl}/playlist.m3u?type=live`)}&size=200&format=svg" alt="QR Code" loading="lazy">
        </div>
        <div class="qr-info">
          <h4>📱 Quick Access</h4>
          <p>Scan to load only live matches for today.</p>
        </div>
      </div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-icon api">⚡</div>
        <div class="endpoint-title">JSON API</div>
      </div>
      <div class="endpoint-desc">Programmatic access to match data in JSON format. Use this for integrations and custom applications.</div>
      <div class="url-box" onclick="copyUrl(this)">
        <span class="url-text">${baseUrl}/api/matches</span>
        <button class="copy-btn">Copy</button>
      </div>
      <div class="qr-container">
        <div class="qr-box">
          <img src="${baseUrl}/api/qr?url=${encodeURIComponent(`${baseUrl}/api/matches`)}&size=200&format=svg" alt="QR Code" loading="lazy">
        </div>
        <div class="qr-info">
          <h4>👨‍💻 Developer Access</h4>
          <p>Scan for programmatic API endpoint.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="container features">
    <div class="feature">
      <div class="feature-icon">🔄</div>
      <h3>Real-Time Updates</h3>
      <p>Playlist refreshes automatically every 5 minutes to capture new matches and updated stream URLs.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">📡</div>
      <h3>HLS Streams</h3>
      <p>Extracts direct M3U8/HLS stream links for smooth, buffer-free playback on any device.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">🌐</div>
      <h3>Universal Compatibility</h3>
      <p>Works with VLC, IPTV Smarters Pro, TiviMate, Kodi, GSE IPTV, and more.</p>
    </div>
  </section>

  <section class="container instructions">
    <h2>📖 How to Use</h2>
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-content">
        <h4>Copy the Playlist URL</h4>
        <p>Click the copy button next to the playlist URL above.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-content">
        <h4>Open Your IPTV Player</h4>
        <p>Launch VLC, IPTV Smarters, TiviMate, or any compatible player on your device.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-content">
        <h4>Add M3U Playlist</h4>
        <p>Go to Settings → Add Playlist → Enter the URL: <code>${baseUrl}/playlist.m3u</code></p>
      </div>
    </div>
    <div class="step">
      <div class="step-num">4</div>
      <div class="step-content">
        <h4>Enjoy Live Football!</h4>
        <p>Browse channels and select a match to start watching. The playlist auto-updates with new streams.</p>
      </div>
    </div>
  </section>

  <section class="container live-preview">
    <h2>⚽ Live Matches Preview</h2>
    <div class="matches-grid" id="matches-container">
      <div class="match-loading">
        <div class="spinner"></div>
        <span>Loading matches...</span>
      </div>
    </div>
  </section>

  <footer>
    <div class="container">
      <p>Built with ❤️ for football fans • Powered by <a href="https://xoilackt.tv" target="_blank">Xoilac TV</a></p>
    </div>
  </footer>

  <script>
    // Copy URL functionality
    function copyUrl(box) {
      const text = box.querySelector('.url-text').textContent;
      const btn = box.querySelector('.copy-btn');
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✓ Copied';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    }

    // Load live matches preview
    async function loadMatches() {
      try {
        const res = await fetch('/api/matches?type=all');
        const data = await res.json();
        const container = document.getElementById('matches-container');
        
        if (!data.matches || data.matches.length === 0) {
          container.innerHTML = '<div class="match-loading"><span>No matches currently available</span></div>';
          return;
        }

        const limitedMatches = data.matches.slice(0, 20);
        container.innerHTML = limitedMatches.map(m => \`
          <div class="match-item">
            <div class="match-info">
              <span class="match-type \${m.type}">\${m.type === 'highlight' ? '📹 Highlight' : '🔴 Live'}</span>
              <span class="match-title">\${m.displayTitle || m.title}</span>
            </div>
            <span class="match-stream">\${m.time ? '⏰ ' + m.time : ''}</span>
          </div>
        \`).join('');
      } catch (err) {
        document.getElementById('matches-container').innerHTML = 
          '<div class="match-loading"><span>Failed to load matches</span></div>';
      }
    }

    loadMatches();
  </script>
</body>
</html>`;
}

module.exports = { renderHomepage };
