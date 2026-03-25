#!/usr/bin/env node
/**
 * Generate placeholder PWA icons from SVG.
 * Run: node scripts/generate-icons.js
 *
 * For production, replace these with properly designed PNG icons.
 * The SVG icon at public/icons/icon.svg works as a universal fallback
 * for modern browsers that support SVG icons in manifests.
 */

const fs = require("fs");
const path = require("path");

const ICONS_DIR = path.join(__dirname, "..", "public", "icons");

// Ensure directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// For now, copy SVG as the primary icon.
// PNG generation requires canvas/sharp — install if needed:
//   npm install sharp
//   Then uncomment the sharp-based generation below.

console.log("SVG icon exists at public/icons/icon.svg");
console.log("For PNG generation, install 'sharp' and uncomment the code below.");
console.log("");
console.log("The manifest.json now includes SVG as the primary icon format,");
console.log("which is supported by modern browsers (Chrome 96+, Edge 96+, Firefox).");

/*
// Uncomment after: npm install sharp
const sharp = require("sharp");
const sizes = [192, 512];
const svgPath = path.join(ICONS_DIR, "icon.svg");

async function generate() {
  for (const size of sizes) {
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon-${size}x${size}.png`));
    console.log(`Generated icon-${size}x${size}.png`);
  }
}
generate().catch(console.error);
*/
