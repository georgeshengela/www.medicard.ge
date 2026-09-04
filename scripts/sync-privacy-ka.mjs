import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const md = await readFile(join(root, "scripts/privacy-source.md"), "utf8");
const lines = md.replace(/\r\n/g, "\n").split("\n");

const preamble = [];
const sections = [];
let current = null;
let i = 0;

function flushCurrent() {
  if (!current) return;
  if (current.intro || current.paragraphs.length || current.bullets.length) {
    const section = { title: current.title };
    if (current.intro) section.intro = current.intro;
    if (current.paragraphs.length) section.paragraphs = current.paragraphs;
    if (current.bullets.length) section.bullets = current.bullets;
    sections.push(section);
  }
  current = null;
}

function stripInline(s) {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").trim();
}

while (i < lines.length) {
  const line = lines[i];
  if (!line.trim()) {
    i += 1;
    continue;
  }
  if (i === 0 && line.startsWith("# ") && !/^\d+\./.test(line.slice(2))) {
    i += 1;
    continue;
  }
  if (/^\*\*ბოლო განახლება:\*\*/.test(line) || /^\*\*ძალაში შესვლის თარიღი:\*\*/.test(line)) {
    i += 1;
    continue;
  }
  const h1 = line.match(/^# (\d+)\.\s*(.+)$/);
  if (h1) {
    flushCurrent();
    current = { title: `${h1[1]}. ${h1[2]}`, intro: "", paragraphs: [], bullets: [] };
    i += 1;
    continue;
  }
  if (line.startsWith("## ") || line.startsWith("### ")) {
    const heading = line.replace(/^#+\s/, "");
    flushCurrent();
    current = { title: heading, intro: "", paragraphs: [], bullets: [] };
    i += 1;
    continue;
  }
  if (line.startsWith("* ")) {
    const items = [];
    while (i < lines.length && lines[i].startsWith("* ")) {
      items.push(stripInline(lines[i].slice(2)));
      i += 1;
    }
    if (current) current.bullets.push(...items);
    else preamble.push(...items);
    continue;
  }
  if (/^\d+\.\s/.test(line)) {
    const items = [];
    while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
      items.push(stripInline(lines[i].replace(/^\d+\.\s/, "")));
      i += 1;
    }
    if (current) current.bullets.push(...items);
    else preamble.push(...items);
    continue;
  }
  if (/^\*\*[^:]{2,40}:\*\*\s+\S/.test(line)) {
    while (i < lines.length && /^\*\*[^:]+:\*\*\s+\S/.test(lines[i])) {
      const m = lines[i].match(/^\*\*([^:]+):\*\*\s*(.+)$/);
      if (m) {
        const row = `${m[1]}: ${stripInline(m[2])}`;
        if (current) current.bullets.push(row);
        else preamble.push(row);
      }
      i += 1;
    }
    continue;
  }
  const para = [];
  while (
    i < lines.length &&
    lines[i].trim() &&
    !/^#{1,3} /.test(lines[i]) &&
    !lines[i].startsWith("* ") &&
    !/^\d+\.\s/.test(lines[i]) &&
    !/^\*\*ბოლო/.test(lines[i]) &&
    !/^\*\*ძალაში/.test(lines[i]) &&
    !/^\*\*[^:]{2,40}:\*\*\s+\S/.test(lines[i])
  ) {
    para.push(lines[i]);
    i += 1;
  }
  if (para.length) {
    const text = stripInline(para.join(" "));
    if (current) {
      if (!current.intro && !current.paragraphs.length && !current.bullets.length) current.intro = text;
      else current.paragraphs.push(text);
    } else {
      preamble.push(text);
    }
  }
}

flushCurrent();

const intro = preamble.join(" ");
const body = `export type LegalSection = {
  title: string;
  intro?: string;
  paragraphs?: string[];
  bullets?: string[];
};

/** Medicard.GE — კონფიდენციალურობის პოლიტიკა. Synced from scripts/privacy-source.md */
export const PRIVACY_POLICY_KA = ${JSON.stringify(
  {
    title: "კონფიდენციალურობის პოლიტიკა",
    effectiveDate: "4 სექტემბერი, 2026",
    intro,
    highlight: "MEDICARD არ ყიდის თქვენს ჯანმრთელობის მონაცემებს. სრული პოლიტიკა: medicard.ge/privacy.",
    sections,
  },
  null,
  2,
)} as const;

export type PrivacySection = LegalSection;
`;

const out = join(root, "mobile/src/constants/privacyPolicyKa.ts");
await writeFile(out, `${body}\n`, "utf8");
console.log(`wrote ${sections.length} sections to ${out}`);
