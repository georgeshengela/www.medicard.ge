from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent
MOBILE = ROOT.parents[2] / "mobile" / "src" / "constants"


def extract_const(path: Path, name: str) -> dict:
    text = path.read_text(encoding="utf-8")
    start = text.index(f"export const {name}")
    chunk = text[start:]
    end = chunk.index("] satisfies")
    body = chunk[: end + 1]

    def grab(key: str) -> str:
        m = re.search(rf"{key}:\s*'((?:\\'|[^'])*)'", body)
        return m.group(1).replace("\\'", "'") if m else ""

    sections = []
    for block in re.split(r"\n\s*\{\s*\n", body):
        title = re.search(r"title:\s*'((?:\\'|[^'])*)'", block)
        if not title or title.group(1) in (grab("title"),):
            if "sections:" in block:
                continue
            if title and title.group(1) == grab("title"):
                continue
        intro_m = re.search(r"intro:\s*'((?:\\'|[^'])*)'", block)
        paras = re.findall(r"paragraphs:\s*\[(.*?)\]", block, re.S)
        bullets = re.findall(r"bullets:\s*\[(.*?)\]", block, re.S)

        def list_from(blob: str) -> list[str]:
            return [s.replace("\\'", "'") for s in re.findall(r"'((?:\\'|[^'])*)'", blob)]

        if not title:
            continue
        if title.group(1) == grab("title") and "sections" not in block:
            continue
        section = {"title": title.group(1).replace("\\'", "'")}
        if intro_m:
            section["intro"] = intro_m.group(1).replace("\\'", "'")
        if paras:
            section["paragraphs"] = list_from(paras[0])
        if bullets:
            section["bullets"] = list_from(bullets[0])
        if section["title"] != grab("title"):
            sections.append(section)

    return {
        "title": grab("title"),
        "effectiveDate": grab("effectiveDate"),
        "intro": grab("intro"),
        "highlight": grab("highlight"),
        "sections": sections,
    }


def html_page(doc: dict) -> str:
    def esc(s: str) -> str:
        return (
            s.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
        )

    parts = [
        "<!doctype html><html lang='ka'><head><meta charset='utf-8'/>",
        "<meta name='viewport' content='width=device-width, initial-scale=1'/>",
        f"<title>{esc(doc['title'])} · Medicard.GE</title>",
        "<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#111827;background:#f8fafc}h1{font-size:28px}h2{margin-top:28px;font-size:18px}.meta{color:#6b7280}.hi{background:#ecfdf5;border:1px solid #99f6e4;padding:14px 16px;border-radius:12px}a{color:#0d9488}</style>",
        "</head><body>",
        f"<h1>{esc(doc['title'])}</h1>",
        f"<p class='meta'>{esc(doc['effectiveDate'])}</p>",
        f"<p>{esc(doc['intro'])}</p>",
    ]
    if doc.get("highlight"):
        parts.append(f"<p class='hi'>{esc(doc['highlight'])}</p>")
    for section in doc["sections"]:
        parts.append(f"<h2>{esc(section['title'])}</h2>")
        if section.get("intro"):
            parts.append(f"<p>{esc(section['intro'])}</p>")
        for p in section.get("paragraphs") or []:
            parts.append(f"<p>{esc(p)}</p>")
        if section.get("bullets"):
            parts.append("<ul>")
            for item in section["bullets"]:
                parts.append(f"<li>{esc(item)}</li>")
            parts.append("</ul>")
    parts.append("<p><a href='mailto:support@medicard.ge'>support@medicard.ge</a></p>")
    parts.append("</body></html>")
    return "".join(parts)


privacy = extract_const(MOBILE / "privacyPolicyKa.ts", "PRIVACY_POLICY_KA")
terms = extract_const(MOBILE / "termsOfUseKa.ts", "TERMS_OF_USE_KA")

out = ROOT / "legalPages.js"
out.write_text(
    "/** Public legal HTML for App Store / web. Generated from mobile constants. */\n"
    f"export const PRIVACY_HTML = {json.dumps(html_page(privacy), ensure_ascii=False)};\n"
    f"export const TERMS_HTML = {json.dumps(html_page(terms), ensure_ascii=False)};\n",
    encoding="utf-8",
    newline="\n",
)
print("privacy sections", len(privacy["sections"]), "terms sections", len(terms["sections"]))
print("wrote", out)
