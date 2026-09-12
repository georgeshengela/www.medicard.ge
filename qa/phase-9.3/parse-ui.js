const fs = require('fs');
const path = process.argv[2] || 'c:/Users/User/Desktop/www.medicard/qa/phase-9.3/ui-now.xml';
const x = fs.readFileSync(path, 'utf8');
const texts = [...x.matchAll(/text="([^"]{2,})"/g)].map((a) => a[1]);
console.log(texts.slice(0, 60).join('\n'));
const bounds = [...x.matchAll(/text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)]
  .filter((a) => a[1].length > 1)
  .slice(0, 40)
  .map((a) => `${a[1]} @ ${a[2]},${a[3]}-${a[4]},${a[5]}`);
console.log('---BOUNDS---');
console.log(bounds.join('\n'));
