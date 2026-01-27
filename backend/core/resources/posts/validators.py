from __future__ import annotations


def normalize_tags(tags: list[str]) -> list[str]:
    cleaned: list[str] = []
    for t in tags:
        v = t.strip()
        if not v:
            continue
        if not v.startswith("#"):
            v = f"#{v}"
        if len(v) > 40:
            continue
        cleaned.append(v)
    # de-dupe, keep order
    seen: set[str] = set()
    out: list[str] = []
    for v in cleaned:
        if v in seen:
            continue
        seen.add(v)
        out.append(v)
    return out[:20]

