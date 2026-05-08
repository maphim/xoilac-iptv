const QRCode = require('qrcode');

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`).searchParams.get('url');
    const size = new URL(req.url, `http://${req.headers.host}`).searchParams.get('size') || '200';
    const format = new URL(req.url, `http://${req.headers.host}`).searchParams.get('format') || 'svg';
    
    if (!url) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'URL parameter required' }));
    }
    
    // Decode URL if it's encoded
    const decodedUrl = decodeURIComponent(url);
    const qrSize = Math.min(parseInt(size) || 200, 1000);
    
    if (format === 'png') {
      // Generate PNG
      const pngQR = await QRCode.toDataURL(decodedUrl, {
        width: qrSize,
        errorCorrectionLevel: 'H',
        margin: 1,
      });
      const buffer = Buffer.from(pngQR.split(',')[1], 'base64');
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      res.statusCode = 200;
      res.end(buffer);
    } else {
      // Generate SVG
      const svgQR = await QRCode.toString(decodedUrl, {
        type: 'svg',
        width: qrSize,
        errorCorrectionLevel: 'H',
        margin: 1,
      });
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      res.statusCode = 200;
      res.end(svgQR);
    }
  } catch (err) {
    console.error('QR generation error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
