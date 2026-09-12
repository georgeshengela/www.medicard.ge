# -*- coding: utf-8 -*-
"""Extract added ka.ts dotted keys vs HEAD and trace consumers. No git writes."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(r"c:\Users\User\Desktop\www.medicard")
OUT_DIR = ROOT / "qa" / "georgian-l10n-phase3"
KA = ROOT / "mobile" / "src" / "i18n" / "ka.ts"
MOBILE = ROOT / "mobile"
GEO = re.compile(r"[\u10A0-\u10FF]")
PH = re.compile(r"(\{[A-Za-z0-9_]+\}|\$\{[^}]+\}|%[sdif])")

SEARCH_EXTS = {".ts", ".tsx", ".js", ".jsx"}
SKIP_PARTS = {"node_modules", "dist"}

DIRECT_RE = re.compile(r"(შენ |შენი |შენთვის|გინდა|სცადე[^თ]|შეამოწმე[^თ]|აღრიცხე[^თ]|დაამატე[^თწ]|ჰკითხე)")
FORMAL_RE = re.compile(r"(თქვენ|თქვენი|გსურთ|სცადეთ|შეამოწმეთ|აირჩიეთ|მიუთითეთ|დაამატეთ|შეინახეთ|დალიეთ)")


def extract_keys(src: str) -> dict[str, str]:
    """Walk object literals after `export const ka = {` for string/template values."""
    start = src.find("export const ka")
    if start < 0:
        start = 0
    i = src.find("{", start)
    keys: dict[str, str] = {}
    path: list[str] = []
    n = len(src)

    def skip_ws(p):
        while p < n and src[p] in " \t\r\n":
            p += 1
        return p

    def read_ident(p):
        m = re.match(r"[A-Za-z_][A-Za-z0-9_]*", src[p:])
        if not m:
            return None, p
        return m.group(0), p + m.end()

    def read_string(p):
        q = src[p]
        if q not in "'\"`":
            return None, p
        p += 1
        out = []
        while p < n:
            ch = src[p]
            if ch == "\\" and p + 1 < n:
                out.append(src[p : p + 2])
                p += 2
                continue
            if ch == q:
                return "".join(out), p + 1
            out.append(ch)
            p += 1
        return "".join(out), p

    p = i + 1
    expecting_key = True
    while p < n:
        p = skip_ws(p)
        if p >= n:
            break
        if src.startswith("//", p):
            p = src.find("\n", p)
            if p < 0:
                break
            p += 1
            continue
        if src.startswith("/*", p):
            end = src.find("*/", p + 2)
            p = n if end < 0 else end + 2
            continue
        if src[p] == "}":
            if path:
                path.pop()
            p += 1
            p = skip_ws(p)
            if p < n and src[p] == ",":
                p += 1
            expecting_key = True
            if not path and p > i + 1:
                # closed root
                break
            continue
        if not expecting_key:
            # skip until comma or brace handled
            if src[p] == ",":
                p += 1
                expecting_key = True
                continue
            p += 1
            continue

        ident, np = read_ident(p)
        if ident is None:
            if src[p] in "'\"":
                ident, np = read_string(p)
            elif src[p] == "[":
                # skip computed
                p += 1
                continue
            else:
                p += 1
                continue
        p = skip_ws(np)
        if p < n and src[p] == "?":
            p += 1
            p = skip_ws(p)
        if p >= n or src[p] != ":":
            p = np
            continue
        p = skip_ws(p + 1)

        # function
        if src.startswith("(", p) or src.startswith("async", p):
            # find => then value
            arrow = src.find("=>", p)
            if arrow < 0:
                p += 1
                continue
            p = skip_ws(arrow + 2)
            if src[p] == "{":
                # block function — skip balanced
                depth = 0
                q = p
                while q < n:
                    if src[q] == "{":
                        depth += 1
                    elif src[q] == "}":
                        depth -= 1
                        if depth == 0:
                            q += 1
                            break
                    q += 1
                dotted = ".".join(path + [ident])
                snippet = src[p:q]
                if GEO.search(snippet):
                    keys[dotted] = snippet[:240].replace("\n", " ")
                p = skip_ws(q)
                if p < n and src[p] == ",":
                    p += 1
                expecting_key = True
                continue
            val, p = read_string(p) if src[p] in "'\"`" else (None, p)
            dotted = ".".join(path + [ident])
            if val is not None:
                keys[dotted] = val
            p = skip_ws(p)
            if p < n and src[p] == ",":
                p += 1
            expecting_key = True
            continue

        if src[p] == "{":
            path.append(ident)
            p += 1
            expecting_key = True
            continue

        if src[p] in "'\"`":
            val, p = read_string(p)
            dotted = ".".join(path + [ident])
            keys[dotted] = val or ""
            p = skip_ws(p)
            # type assertions `as const`
            if src.startswith("as ", p):
                semi = src.find("\n", p)
                p = skip_ws(semi if semi > 0 else p)
            if p < n and src[p] == ",":
                p += 1
            expecting_key = True
            continue

        if src[p] == "[":
            # array — capture if Georgian
            depth = 0
            q = p
            while q < n:
                if src[q] == "[":
                    depth += 1
                elif src[q] == "]":
                    depth -= 1
                    if depth == 0:
                        q += 1
                        break
                q += 1
            snippet = src[p:q]
            dotted = ".".join(path + [ident])
            if GEO.search(snippet):
                keys[dotted] = snippet[:240].replace("\n", " ")
            p = skip_ws(q)
            if src.startswith("as ", p):
                nl = src.find("\n", p)
                p = skip_ws(nl if nl > 0 else p)
            if p < n and src[p] == ",":
                p += 1
            expecting_key = True
            continue

        # unknown value (spread, identifier)
        dotted = ".".join(path + [ident])
        if src.startswith("...", p):
            keys[dotted] = "(spread)"
        p += 1
        expecting_key = False

    return keys


def voice_of(text: str, dotted: str) -> str:
    if any(
        x in dotted
        for x in (
            ".title",
            "Title",
            "hubTitle",
            "label",
            "Label",
            "unit",
            "placeholder",
            "Placeholder",
        )
    ) and not FORMAL_RE.search(text) and not DIRECT_RE.search(text):
        kind = "label"
    else:
        kind = "neutral"
    if FORMAL_RE.search(text) and DIRECT_RE.search(text):
        return "mixed"
    if FORMAL_RE.search(text):
        return "formal"
    if DIRECT_RE.search(text):
        return "direct"
    return kind


def collect_source_files() -> list[Path]:
    files = []
    for p in MOBILE.rglob("*"):
        if p.suffix.lower() not in SEARCH_EXTS:
            continue
        if any(part in SKIP_PARTS for part in p.parts):
            continue
        files.append(p)
    return files


SCREEN_HINTS = [
    ("app/(auth)/sign-in", "Authentication / login"),
    ("app/(auth)/sign-up", "Authentication / registration"),
    ("app/(auth)/phone", "Authentication / phone OTP"),
    ("app/(auth)/forgot-password", "Authentication / password recovery"),
    ("app/(auth)/assessment", "Onboarding / assessment"),
    ("app/(auth)/profile-setup", "Onboarding / profile setup"),
    ("app/(tabs)/index", "Home"),
    ("app/chat/", "Medi chat"),
    ("app/cycle/pregnancy", "Pregnancy"),
    ("app/cycle/", "Cycle"),
    ("components/cycle/", "Cycle"),
    ("app/health-metrics/hydration", "Hydration"),
    ("components/hydration", "Hydration"),
    ("components/medications", "Medications"),
    ("app/medications", "Medications"),
    ("medi-quest", "Quest"),
    ("components/quest", "Quest"),
    ("notification", "Notifications"),
    ("pushCopy", "Push / notifications"),
    ("app/(tabs)/profile", "Profile"),
    ("app/profile", "Profile / settings"),
    ("i18n/ka.ts", "catalog definition"),
]


def screen_for(paths: list[str]) -> str:
    joined = " ".join(paths)
    for needle, label in SCREEN_HINTS:
        if needle.replace("\\", "/") in joined.replace("\\", "/"):
            return label
    if not paths:
        return "—"
    return "unresolved reference"


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    now = KA.read_text(encoding="utf-8")
    old = subprocess.check_output(
        ["git", "show", "HEAD:mobile/src/i18n/ka.ts"],
        cwd=ROOT,
        encoding="utf-8",
        errors="replace",
    )
    old_keys = extract_keys(old)
    new_keys = extract_keys(now)
    added = sorted(set(new_keys) - set(old_keys))
    changed = sorted(k for k in (set(old_keys) & set(new_keys)) if old_keys[k] != new_keys[k])

    sources = collect_source_files()
    blobs: list[tuple[str, str]] = []
    for p in sources:
        rel = p.relative_to(MOBILE).as_posix()
        if rel == "src/i18n/ka.ts":
            continue
        try:
            blobs.append((rel, p.read_text(encoding="utf-8", errors="replace")))
        except Exception:
            continue

    rows = []
    for dotted in added:
        leaf = dotted.split(".")[-1]
        consumers = []
        for rel, text in blobs:
            if f"ka.{dotted}" in text:
                consumers.append(rel)
                continue
            # ka.cycle.foo
            if dotted in text and ("ka." + dotted.split(".")[0]) in text:
                # tighter: ka.section.leaf
                section = dotted.split(".")[0]
                if f"ka.{section}.{leaf}" in text or f"ka.{section}?.{leaf}" in text:
                    consumers.append(rel)
                    continue
            if f"titleKey: '{leaf}'" in text or f'titleKey: "{leaf}"' in text:
                consumers.append(rel)
                continue
            if f"bodyKey: '{leaf}'" in text or f'bodyKey: "{leaf}"' in text:
                consumers.append(rel)
                continue
            if f"copy.{leaf}" in text or f"ka.cycle.{leaf}" in text:
                consumers.append(rel)

        consumers = sorted(set(consumers))
        text = new_keys.get(dotted, "")
        phs = ",".join(PH.findall(text))
        if not consumers:
            status = "unused"
        elif any("push" in c.lower() or "notification" in c.lower() for c in consumers):
            status = "verified in push/backend usage"
        else:
            status = "verified in component"
        # generated: functions
        if "(" in text[:20] and "=>" in text:
            if status == "unused":
                status = "generated dynamically"
        rows.append(
            {
                "key": dotted,
                "consumers": consumers,
                "screen": screen_for(consumers),
                "voice": voice_of(text, dotted),
                "placeholders": phs,
                "status": status,
                "preview": text[:160],
            }
        )

    md = []
    md.append("# Phase 3 — added `ka.ts` key traceability")
    md.append("")
    md.append(f"HEAD keys parsed: **{len(old_keys)}**")
    md.append(f"Worktree keys parsed: **{len(new_keys)}**")
    md.append(f"Added keys: **{len(added)}**")
    md.append(f"Changed existing keys (value differs): **{len(changed)}**")
    md.append("")
    counts = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    md.append("## Status counts")
    for k, v in sorted(counts.items()):
        md.append(f"- {k}: **{v}**")
    md.append("")
    md.append("| Key | Consumer file(s) | Screen/state | Voice | Placeholder(s) | Status |")
    md.append("| --- | ---------------- | ------------ | ----- | -------------- | ------ |")
    for r in rows:
        cons = "<br>".join(r["consumers"]) if r["consumers"] else "—"
        md.append(
            f"| `{r['key']}` | {cons} | {r['screen']} | {r['voice']} | `{r['placeholders'] or '—'}` | {r['status']} |"
        )

    unused = [r for r in rows if r["status"] == "unused"]
    md.append("")
    md.append("## Unused added keys")
    md.append(f"Count: **{len(unused)}**. Not deleted.")
    for r in unused:
        md.append(f"- `{r['key']}` — {r['preview'][:80]}")

    (OUT_DIR / "ka-added-keys.md").write_text("\n".join(md), encoding="utf-8")
    (OUT_DIR / "ka-added-keys.json").write_text(
        json.dumps(
            {
                "head_key_count": len(old_keys),
                "worktree_key_count": len(new_keys),
                "added_count": len(added),
                "changed_existing_count": len(changed),
                "status_counts": counts,
                "rows": rows,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print("added", len(added), "changed_existing", len(changed))
    print("status", counts)
    print("wrote", OUT_DIR / "ka-added-keys.md")


if __name__ == "__main__":
    main()
