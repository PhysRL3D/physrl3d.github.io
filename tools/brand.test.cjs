const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Every page declares the same SVG, PNG, ICO and touch identity',()=>{
  for(const file of ['index.html','film/index.html','examples/index.html']){
    const html=fs.readFileSync(path.join(root,file),'utf8'),head=html.split('</head>')[0];
    for(const asset of ['favicon.ico','static/brand/physrl3d-mark.svg','static/brand/favicon-32.png','static/brand/favicon-180.png']){
      assert.ok(head.includes('/'+asset+'?v=20261120loop1'),file+' -> '+asset);
      assert.ok(fs.statSync(path.join(root,asset)).size>0);
    }
  }
});
test('PNG icons are generated at all six intended pixel sizes',()=>{
  for(const size of [16,32,48,180,192,512]){
    const b=fs.readFileSync(path.join(root,`static/brand/favicon-${size}.png`));
    assert.equal(b.toString('hex',0,8),'89504e470d0a1a0a');
    assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size);
  }
});
test('Fallback ICO contains three complete PNG images',()=>{
  const b=fs.readFileSync(path.join(root,'favicon.ico'));
  assert.equal(b.readUInt16LE(0),0);assert.equal(b.readUInt16LE(2),1);assert.equal(b.readUInt16LE(4),3);
  [16,32,48].forEach((size,i)=>{const e=6+i*16,n=b.readUInt32LE(e+8),o=b.readUInt32LE(e+12);assert.equal(b[e],size);assert.equal(b[e+1],size);assert.equal(b.toString('hex',o,o+8),'89504e470d0a1a0a');assert.ok(o+n<=b.length);});
});
test('The mark explicitly encodes shape, reward feedback and physical balance',()=>{
  const svg=fs.readFileSync(path.join(root,'static/brand/physrl3d-mark.svg'),'utf8');
  for(const id of ['reward-feedback','three-dimensional-shape','physical-balance'])assert.ok(svg.includes(`id="${id}"`));
  assert.ok(fs.statSync(path.join(root,'static/brand/physrl3d-lockup.svg')).size>0);
  for(const file of ['release-20261120.js','film/index.html','examples/index.html'])assert.ok(fs.readFileSync(path.join(root,file),'utf8').includes('physrl3d-lockup.svg?v=20261120loop1'));
});
