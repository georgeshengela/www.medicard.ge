import fs from 'fs';
const xml = fs.readFileSync(new URL('./_live.xml', import.meta.url), 'utf8');
const texts = [...xml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]);
for (const t of texts) {
  if (/გულ|შეჯ|შეფ|აღრიცხ|ჟურ|მიმო|ორსულობის ჩან|ტალღ|ოფლ|ბოლო ჩან/.test(t)) {
    console.log(t);
  }
}
