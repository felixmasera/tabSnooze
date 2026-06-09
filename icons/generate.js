// Run: node generate.js
// Requires: npm install canvas
// Or just use generate_icons.html in a browser to download the PNGs manually.

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#7c6cf0';
  const r = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // Moon
  const cx = size / 2, cy = size / 2 - size * 0.04;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7c6cf0';
  ctx.beginPath();
  ctx.arc(cx + size * 0.1, cy - size * 0.06, size * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Dots (zzz)
  ctx.fillStyle = '#ffffff';
  const dotR = Math.max(1, size * 0.05);
  [[0.62, 0.62], [0.72, 0.72], [0.62, 0.82]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x * size, y * size, dotR, 0, Math.PI * 2);
    ctx.fill();
  });

  return canvas.toBuffer('image/png');
}

[16, 48, 128].forEach((size) => {
  const buf = drawIcon(size);
  const outPath = path.join(__dirname, `icon${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`✓ icon${size}.png`);
});
