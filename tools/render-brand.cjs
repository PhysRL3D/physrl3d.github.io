// Vector-first identity: keep the favicon legible at 16px, independent of fonts.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const brand = path.join(root, 'static/brand');
const source = path.join(brand, 'physrl3d-mark.svg');
async function main() {
  const icons = new Map();
  for (const size of [16, 32, 48, 180, 192, 512]) {
    const png = await sharp(source, {density: 576}).resize(size, size).png().toBuffer();
    icons.set(size, png);
    fs.writeFileSync(path.join(brand, `favicon-${size}.png`), png);
  }
  const sizes = [16, 32, 48], header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const entry = 6 + i * 16, png = icons.get(size);
    header[entry] = size; header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  fs.writeFileSync(path.join(root, 'favicon.ico'), Buffer.concat([header, ...sizes.map(s => icons.get(s))]));
  const preview = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="430"><rect width="960" height="430" rx="30" fill="#f5f2f8"/><rect x="30" y="30" width="900" height="370" rx="22" fill="white"/><text x="352" y="97" font-family="Arial,sans-serif" font-size="14" letter-spacing="2" fill="#7752ad">PHYSRL3D · BROWSER IDENTITY</text><text x="354" y="340" font-family="Arial,sans-serif" font-size="16" fill="#68646e">A compact mark for tabs, bookmarks and mobile.</text></svg>`);
  await sharp(preview).composite([
    {input: await sharp(source, {density: 576}).resize(248, 248).png().toBuffer(), left:70, top:92},
    {input: await sharp(path.join(brand, 'physrl3d-wordmark.svg'), {density:144}).resize({width:490}).png().toBuffer(), left:352, top:141},
    ...[16, 32, 48].map((s, i) => ({input:icons.get(s), left:356 + i * 86, top:295 - s})),
  ]).png().toFile(path.join(brand, 'brand-preview.png'));
  console.log('SVG, six PNG sizes, multi-resolution ICO and brand preview ready.');
}
main().catch(e => {console.error(e);process.exitCode=1;});
