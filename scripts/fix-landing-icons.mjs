import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../server/public/icons/", import.meta.url);
for (const file of readdirSync(dir).filter((name) => name.endsWith(".svg"))) {
  let svg = readFileSync(new URL(file, dir), "utf8");
  const open = (svg.match(/<g[\s>]/g) || []).length;
  const close = (svg.match(/<\/g>/g) || []).length;
  if (open > close) svg = svg.replace("</svg>", `${"</g>".repeat(open - close)}</svg>`);
  svg = svg.replace(/fill="currentColor"/g, 'fill="#000"');
  writeFileSync(new URL(file, dir), svg);
  console.log(file, "g", open, close);
}
