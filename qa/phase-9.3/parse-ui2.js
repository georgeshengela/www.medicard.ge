const fs = require('fs');
const path = process.argv[2];
const x = fs.readFileSync(path, 'utf8');
const cds = [...x.matchAll(/content-desc="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)].map(
  (a) => `${a[1] || '(empty)'} @ ${a[2]},${a[3]}-${a[4]},${a[5]}`,
);
console.log('CONTENT-DESC');
console.log(cds.join('\n') || 'none');
const clicks = [...x.matchAll(/clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)].map(
  (a) => `${a[1]},${a[2]}-${a[3]},${a[4]}`,
);
console.log('CLICKS_TAIL');
console.log(clicks.slice(-30).join('\n'));
// also search for home/companion a11y
const all = [...x.matchAll(/content-desc="([^"]+)"/g)].map((a) => a[1]);
console.log('ALL_DESC', all.filter((t) => /home|Home|მედი|Medi|companion|Companion|ჩანაწერ|პროფილ|tab/i.test(t)).join(' | '));
