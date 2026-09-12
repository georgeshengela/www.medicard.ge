import { readFileSync } from 'node:fs';
const x = readFileSync(process.argv[2], 'utf8');
for (const re of [
  /text="([^"]{4,120})"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g,
  /content-desc="([^"]{4,120})"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g,
  /clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g,
]) {
  console.log('---');
  let m;
  let n = 0;
  while ((m = re.exec(x)) && n < 40) {
    n += 1;
    if (m.length >= 6) {
      const cx = (Number(m[2]) + Number(m[4])) / 2;
      const cy = (Number(m[3]) + Number(m[5])) / 2;
      console.log(`${cx},${cy}\t${m[1]}`);
    } else {
      const cx = (Number(m[1]) + Number(m[3])) / 2;
      const cy = (Number(m[2]) + Number(m[4])) / 2;
      console.log(`${cx},${cy}\tclickable`);
    }
  }
}
