// Vector-first identity: keep the favicon legible at 16px, independent of fonts.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const brand = path.join(root, 'static/brand');
const source = path.join(brand, 'physrl3d-mark.svg');
async function main() {
  const mark=fs.readFileSync(source,'utf8').replace(/<\?xml[^>]*>/g,'');
  const wordmark=fs.readFileSync(path.join(brand,'physrl3d-wordmark.svg'),'utf8');
  const lockup=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1512 220" role="img" aria-label="PhysRL3D">${mark.replace('<svg ','<svg x="0" y="0" width="220" height="220" ')}${wordmark.replace('<svg ','<svg x="252" y="0" width="1260" height="220" ')}</svg>`;
  fs.writeFileSync(path.join(brand,'physrl3d-lockup.svg'),lockup);
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
  const preview = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="570"><rect width="1100" height="570" rx="28" fill="#f4f1f8"/><rect x="18" y="18" width="1064" height="534" rx="20" fill="white"/><g font-family="Arial,sans-serif"><text x="410" y="110" font-size="14" letter-spacing="2" fill="#7752ad">A GROUNDED LEARNING LOOP</text><text x="410" y="330" font-size="16" fill="#68646e">A physical object. A feedback loop. A stable foundation.</text><path d="M70 397H1030" stroke="#e8e2ee"/><g font-size="20" font-weight="700" fill="#202024"><text x="70" y="444">3D</text><text x="420" y="444">RL</text><text x="770" y="444">Phys</text></g><g font-size="16" fill="#68646e"><text x="70" y="477">A three-dimensional shape.</text><text x="420" y="477">Reward-guided feedback.</text><text x="770" y="477">Centre of mass and support.</text></g></g></svg>`);
  await sharp(preview).composite([
    {input: await sharp(source, {density: 576}).resize(280, 280).png().toBuffer(), left:70, top:78},
    {input: await sharp(path.join(brand, 'physrl3d-wordmark.svg'), {density:144}).resize({width:590}).png().toBuffer(), left:410, top:146},
    ...[16, 32, 48].map((s, i) => ({input:icons.get(s), left:414 + i * 90, top:294 - s})),
  ]).png().toFile(path.join(brand, 'brand-preview.png'));
  console.log('SVG, six PNG sizes, multi-resolution ICO and brand preview ready.');
}
main().catch(e => {console.error(e);process.exitCode=1;});
