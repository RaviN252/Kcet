const sharp = require('sharp');

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

// Given the text and a max pixel width to fit within, returns a font size (sans-serif,
// ~0.55 * fontSize per char) that keeps the rendered text within that width.
function fitFontSize(text, maxTextWidth, baseFontSize) {
  const estimatedWidth = text.length * baseFontSize * 0.55;
  return estimatedWidth > maxTextWidth
    ? Math.max(10, Math.floor(baseFontSize * (maxTextWidth / estimatedWidth)))
    : baseFontSize;
}

// Stamps a semi-transparent "name · phone · email" watermark as three clean, horizontal
// lines — header, vertical center, and footer — stacked one below the other so they never
// cross into each other or turn into an unreadable diagonal tangle with the page content.
async function applyWatermark(imagePath, text) {
  const image = sharp(imagePath);
  const { width, height } = await image.metadata();
  const label = escapeXml(text);

  const centerX = width / 2;
  const centerY = height / 2;
  const headerY = 30;
  const footerY = height - 20;

  const edgeFontSize = fitFontSize(text, width * 0.92, 18);
  const centerFontSize = fitFontSize(text, width * 0.92, 24);

  const marks = `
    <text x="${centerX}" y="${headerY}" text-anchor="middle"
      font-family="sans-serif" font-size="${edgeFontSize}" fill="rgba(120,120,120,0.4)">${label}</text>
    <text x="${centerX}" y="${centerY}" text-anchor="middle"
      font-family="sans-serif" font-size="${centerFontSize}" font-weight="bold"
      fill="rgba(120,120,120,0.35)">${label}</text>
    <text x="${centerX}" y="${footerY}" text-anchor="middle"
      font-family="sans-serif" font-size="${edgeFontSize}" fill="rgba(120,120,120,0.4)">${label}</text>`;

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${marks}</svg>`;

  return image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

module.exports = { applyWatermark };
