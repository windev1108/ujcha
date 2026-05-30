#!/usr/bin/env node
// Generates all required icon assets from vertical-logo.png and logo.png
'use strict';

const sharp = require('E:/startup/ujcha/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');
const path = require('path');
const fs = require('fs');

const IMG = path.join(__dirname, '../assets/images');
const vertical = path.join(IMG, 'vertical-logo.png');
const horizontal = path.join(IMG, 'logo.png');

async function pad(src, size, bg = { r: 255, g: 255, b: 255, alpha: 1 }) {
  const img = sharp(src).resize(size, size, {
    fit: 'contain',
    background: bg,
  });
  return img;
}

async function padTransparent(src, size, paddingFraction = 0.15) {
  const inner = Math.round(size * (1 - paddingFraction * 2));
  const buf = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
  })
    .composite([{ input: buf, gravity: 'centre' }]);
}

async function makeMonochrome(src, size) {
  const inner = Math.round(size * 0.7);
  const buf = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .greyscale()
    .threshold(128)
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: buf, gravity: 'centre' }]);
}

async function main() {
  console.log('Generating app icons from UjCha logos...\n');

  // 1. icon.png — 1024×1024, white bg, vertical logo centered with padding
  //    Used by iOS and as the general app icon
  await (await pad(vertical, 1024)).png().toFile(path.join(IMG, 'icon.png'));
  console.log('✓ icon.png           1024x1024');

  // 2. android-icon-foreground.png — 1024×1024, white bg, 10% padding each side
  //    Android adaptive icon foreground layer (background is #1a3c34 solid per app.json)
  await (await padTransparent(vertical, 1024, 0.10)).png().toFile(path.join(IMG, 'android-icon-foreground.png'));
  console.log('✓ android-icon-foreground.png  1024x1024');

  // 3. android-icon-monochrome.png — 1024×1024, monochrome, for Android 13+
  await (await makeMonochrome(vertical, 1024)).png().toFile(path.join(IMG, 'android-icon-monochrome.png'));
  console.log('✓ android-icon-monochrome.png  1024x1024');

  // 4. android-icon-background.png — solid #1a3c34 tile (keeps existing green bg)
  await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: { r: 0x1a, g: 0x3c, b: 0x34 } },
  }).png().toFile(path.join(IMG, 'android-icon-background.png'));
  console.log('✓ android-icon-background.png  1024x1024  (#1a3c34 solid)');

  // 5. splash-icon.png — 200×200, vertical logo on white, centered
  await (await pad(vertical, 200)).png().toFile(path.join(IMG, 'splash-icon.png'));
  console.log('✓ splash-icon.png    200x200');

  // 6. favicon.png — keep as-is (user imported 500×500 version); just ensure it's there
  if (fs.existsSync(path.join(IMG, 'favicon.png'))) {
    console.log('✓ favicon.png        (user-provided, kept as-is)');
  }

  console.log('\nAll icons generated successfully.');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
