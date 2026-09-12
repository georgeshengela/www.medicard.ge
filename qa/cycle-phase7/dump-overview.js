const fs = require('fs');
const x = fs.readFileSync(process.argv[2] || 'ui-overview.xml', 'utf8');
const nodes = [...x.matchAll(/text="([^"]*)"[^>]*content-desc="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)].map(
  (m) => ({
    t: m[1],
    d: m[2],
    x: Math.round((Number(m[3]) + Number(m[5])) / 2),
    y: Math.round((Number(m[4]) + Number(m[6])) / 2),
    b: [Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])],
  }),
);
const interesting = nodes.filter((n) => {
  const s = `${n.t} ${n.d}`;
  return /აღრიცხვა|ციკლ|ფოლიკ|დღეს|28|მიმოხილ|Cannot|Tools|ორ�იკ|დღეს|28|მიმოხილ|Cannot|Tools|ორშ|სამ|ოთხ|ხუთ|პარ|შაბ|კვი|გაზომ|სავარაუდო/.test(s);
});
console.log(JSON.stringify(interesting.slice(0, 80), null, 2));
