const fs = require('fs');
const xml = fs.readFileSync(process.argv[2] || 'qa/cycle-phase6/_ui-expo.xml', 'utf8');
const texts = [...xml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
const descs = [...xml.matchAll(/content-desc="([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
const bounds = [...xml.matchAll(/text="([^"]*)"[^>]*content-desc="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)]
  .map((m) => ({
    text: m[1],
    desc: m[2],
    x: Math.round((Number(m[3]) + Number(m[5])) / 2),
    y: Math.round((Number(m[4]) + Number(m[6])) / 2),
    bounds: [m[3], m[4], m[5], m[6]].map(Number),
  }))
  .filter((n) => n.text || n.desc);
console.log(JSON.stringify({ texts, descs, nodes: bounds.slice(0, 80) }, null, 2));
