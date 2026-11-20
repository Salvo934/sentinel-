#!/usr/bin/env python3
"""
Builds a compact MITRE ATT&CK dataset (public/data/mitre-attack-enterprise.json)
from the official STIX bundle. The dataset is published with the app and
loaded into Supabase by public.load_attack_bundle() (see docs/ATTACK.md).

    curl -sSL -o /tmp/attack/enterprise-attack.json \
      https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json
    python3 -I scripts/attack/build-attack-dataset.py /tmp/attack/enterprise-attack.json

Only active objects are kept (revoked/deprecated ones are skipped).

© The MITRE Corporation. This work is reproduced and distributed with the
permission of The MITRE Corporation.
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_FILE = os.path.join(ROOT, "public", "data", "mitre-attack-enterprise.json")
ATTRIBUTION = (
    "© The MITRE Corporation. This work is reproduced and distributed with the permission "
    "of The MITRE Corporation. MITRE ATT&CK® is a registered trademark of The MITRE Corporation."
)


CITATION = re.compile(r"\s*\(Citation:[^)]*\)")
HTML_TAG = re.compile(r"</?(?:code|b|i|em|strong|br|p|span)[^>]*>", re.I)


def clean(text, limit=None):
    """Removes citations and inline HTML; keeps markdown links (rendered safely by the app)."""
    text = CITATION.sub("", text or "")
    text = HTML_TAG.sub("", text)
    text = re.sub(r"[ \t]+\n", "\n", text).strip()
    if limit and len(text) > limit:
        cut = text[:limit]
        text = cut[: cut.rfind(" ")] + " […]"
    return text


def main(path):
    bundle = json.load(open(path, encoding="utf-8"))
    objs = bundle["objects"]
    by_id = {o["id"]: o for o in objs}

    def live(o):
        return not o.get("revoked") and not o.get("x_mitre_deprecated")

    def ext(o):
        for r in o.get("external_references", []):
            if r.get("source_name") == "mitre-attack":
                return r.get("external_id"), r.get("url")
        return None, None

    collection = next(o for o in objs if o["type"] == "x-mitre-collection")
    matrix = next(o for o in objs if o["type"] == "x-mitre-matrix")

    out = {"meta": {"domain": "enterprise-attack", "version": collection.get("x_mitre_version"),
                    "modified": collection.get("modified"), "attribution": ATTRIBUTION},
           "tactics": [], "techniques": [], "mitigations": [], "groups": [],
           "technique_mitigations": [], "group_techniques": [], "detections": []}

    for order, ref in enumerate(matrix["tactic_refs"], start=1):
        t = by_id[ref]
        tid, url = ext(t)
        out["tactics"].append({"id": tid, "stix_id": t["id"], "name": t["name"], "shortname": t["x_mitre_shortname"],
                               "description": clean(t.get("description")), "sort_order": order, "url": url})

    techniques = [o for o in objs if o["type"] == "attack-pattern" and live(o) and ext(o)[0]]
    tech_ids = {t["id"]: ext(t)[0] for t in techniques}
    techniques.sort(key=lambda t: (t.get("x_mitre_is_subtechnique", False), ext(t)[0]))
    for t in techniques:
        tid, url = ext(t)
        is_sub = bool(t.get("x_mitre_is_subtechnique"))
        out["techniques"].append({
            "id": tid, "stix_id": t["id"], "name": t["name"], "description": clean(t.get("description")),
            "is_subtechnique": is_sub, "parent_id": tid.split(".")[0] if is_sub else None,
            "tactics": [p["phase_name"] for p in t.get("kill_chain_phases", []) if p.get("kill_chain_name") == "mitre-attack"],
            "platforms": t.get("x_mitre_platforms", []), "url": url,
            "version": t.get("x_mitre_version"), "modified": t.get("modified")})

    mitigations = [o for o in objs if o["type"] == "course-of-action" and live(o) and (ext(o)[0] or "").startswith("M")]
    mit_ids = {}
    for m in mitigations:
        mid, url = ext(m)
        mit_ids[m["id"]] = mid
        out["mitigations"].append({"id": mid, "stix_id": m["id"], "name": m["name"],
                                   "description": clean(m.get("description")), "url": url})

    groups = [o for o in objs if o["type"] == "intrusion-set" and live(o) and ext(o)[0]]
    group_ids = {}
    for g in groups:
        gid, url = ext(g)
        group_ids[g["id"]] = gid
        out["groups"].append({"id": gid, "stix_id": g["id"], "name": g["name"],
                              "aliases": [a for a in g.get("aliases", []) if a != g["name"]],
                              "description": clean(g.get("description"), 2500), "url": url})

    analytics = {o["id"]: o for o in objs if o["type"] == "x-mitre-analytic"}
    group_pairs = set()
    for r in (o for o in objs if o["type"] == "relationship" and live(o)):
        src, tgt, kind = r["source_ref"], r["target_ref"], r["relationship_type"]
        if kind == "mitigates" and src in mit_ids and tgt in tech_ids:
            out["technique_mitigations"].append({"technique_id": tech_ids[tgt], "mitigation_id": mit_ids[src],
                                                 "description": clean(r.get("description"), 800) or None})
        elif kind == "uses" and src in group_ids and tgt in tech_ids:
            group_pairs.add((group_ids[src], tech_ids[tgt]))
        elif kind == "detects" and tgt in tech_ids and src in by_id and live(by_id[src]):
            s = by_id[src]
            did, url = ext(s)
            items = []
            for aref in s.get("x_mitre_analytic_refs", []):
                a = analytics.get(aref)
                if not a or a.get("x_mitre_deprecated") or a.get("revoked"):
                    continue
                items.append({"id": ext(a)[0], "platforms": a.get("x_mitre_platforms", []),
                              "description": clean(a.get("description"), 700)})
            if did:
                out["detections"].append({"id": did, "technique_id": tech_ids[tgt], "name": s["name"],
                                          "analytics": items, "url": url})
    out["group_techniques"] = [{"group_id": g, "technique_id": t} for g, t in sorted(group_pairs)]

    with open(OUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"ATT&CK {out['meta']['version']}: " + ", ".join(f"{k}={len(v)}" for k, v in out.items() if isinstance(v, list))
          + f" -> {os.path.relpath(OUT_FILE, ROOT)} ({os.path.getsize(OUT_FILE)} bytes)")


if __name__ == "__main__":
    main(sys.argv[1])
