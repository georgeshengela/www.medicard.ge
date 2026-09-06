import fs from "node:fs";
import path from "node:path";

const dir = "server/public/icons";
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
  const raw = fs.readFileSync(path.join(dir, file), "utf8");
  const startTag = '<g id="Style=Regular">';
  const start = raw.indexOf(startTag);
  if (start < 0) {
    console.log("skip", file);
    continue;
  }
  let i = start + startTag.length;
  let depth = 1;
  let end = -1;
  while (i < raw.length && depth > 0) {
    const nextOpen = raw.indexOf("<g", i);
    const nextClose = raw.indexOf("</g>", i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 2;
    } else {
      depth -= 1;
      if (depth === 0) end = nextClose;
      i = nextClose + 4;
    }
  }
  if (end < 0) {
    console.log("skip", file);
    continue;
  }
  const inner = raw
    .slice(start + startTag.length, end)
    .replace(/fill="black"/g, 'fill="#000"')
    .replace(/fill="#000000"/gi, 'fill="#000"')
    .replace(/fill="currentColor"/g, 'fill="#000"')
    .replace(/\s+/g, " ")
    .trim();
  fs.writeFileSync(
    path.join(dir, file),
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>\n`,
  );
  console.log("ok", file);
}
