"""
Convert the old skill-tree workbook (.xlsx) into the JSON database in src/data/tree/.

    pip install openpyxl
    python tools/xlsx_to_json.py Farwilds_Skill_Tree_DB_v4.xlsx            # writes to tools/out/
    python tools/xlsx_to_json.py Farwilds_Skill_Tree_DB_v4.xlsx --into src/data/tree

It never touches existing gem texts: with --into, gems/*.json files that already exist are kept
and only missing node entries are added to them.
"""
from __future__ import annotations

import argparse
import json
import re
import warnings
from pathlib import Path

import openpyxl

warnings.filterwarnings("ignore")  # openpyxl complains about data-validation extensions

# Node types that get an (empty) entry in gems/*.json so there is a slot to write into.
GEM_SCAFFOLD_TYPES = ("gem", "keystone")
NODE_KEY_ORDER = ["id", "name", "type", "parent", "requires", "class", "ring", "slot", "angle",
                  "depth", "cluster", "cost", "requirement", "wiki", "notes"]
NODE_COLUMNS = {  # workbook column → JSON key
    "node_id": "id", "name": "name", "type": "type", "parent_id": "parent", "parent2_id": "requires",
    "class": "class", "ring": "ring", "slot": "slot", "angle_override": "angle", "depth": "depth",
    "cluster_id": "cluster", "cost": "cost", "requirement": "requirement", "wiki_page": "wiki",
    "notes": "notes",
}


def clean(v):
    """Cell → plain value. Strings are trimmed (incl. non-breaking spaces); formulas and blanks → None."""
    if v is None:
        return None
    if isinstance(v, str):
        v = v.replace("\xa0", " ").strip()
        return None if v == "" or v.startswith("=") else v
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def as_id(v):
    v = clean(v)
    return None if v is None else str(v)


def rows(wb, sheet):
    if sheet not in wb.sheetnames:
        return []
    ws = wb[sheet]
    header = [clean(c.value) for c in ws[1]]
    out = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if clean(r[0]) is None:
            continue
        out.append({h: clean(v) for h, v in zip(header, r) if h})
    return out


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "misc"


def one_per_line(items: list[dict]) -> str:
    """A JSON array with one object per line — reads like a table, diffs cleanly."""
    lines = [json.dumps(i, ensure_ascii=False) for i in items]
    return "[\n  " + ",\n  ".join(lines) + "\n]\n"


def pretty(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"


def tables(obj: dict) -> str:
    """Top-level sections, one entry per line (dict entries keyed, list entries in order)."""
    dump = lambda v: json.dumps(v, ensure_ascii=False)
    parts = []
    for key, val in obj.items():
        if isinstance(val, dict) and val:
            body = ",\n".join(f"    {dump(k)}: {dump(v)}" for k, v in val.items())
            parts.append(f"  {dump(key)}: {{\n{body}\n  }}")
        elif isinstance(val, list) and val:
            body = ",\n".join(f"    {dump(v)}" for v in val)
            parts.append(f"  {dump(key)}: [\n{body}\n  ]")
        else:
            parts.append(f"  {dump(key)}: {dump(val)}")
    return "{\n" + ",\n".join(parts) + "\n}\n"


def keyed(obj: dict) -> str:
    """A flat {id: {...}} object, one entry per line."""
    dump = lambda v: json.dumps(v, ensure_ascii=False)
    return "{\n" + ",\n".join(f"  {dump(k)}: {dump(v)}" for k, v in obj.items()) + "\n}\n"


def convert(xlsx: Path, out: Path, keep_gems: bool) -> list[str]:
    wb = openpyxl.load_workbook(xlsx, data_only=False)
    report: list[str] = []

    # ── Nodes ──
    nodes = []
    for r in rows(wb, "Nodes"):
        n = {}
        for col, key in NODE_COLUMNS.items():
            v = r.get(col)
            v = as_id(v) if key in ("id", "parent", "requires") else clean(v)
            if v is not None:
                n[key] = v
        nodes.append({k: n[k] for k in NODE_KEY_ORDER if k in n})
    by_id = {n["id"]: n for n in nodes}

    def resolved_class(n, depth=0):
        if n.get("class"):
            return n["class"]
        p = by_id.get(n.get("parent", ""))
        return resolved_class(p, depth + 1) if p and depth < 60 else "misc"

    files: dict[str, list[dict]] = {}
    for n in nodes:
        name = "_core" if n.get("type") in ("centre", "center") else slug(resolved_class(n))
        files.setdefault(name, []).append(n)

    # ── Links: keep only what parent / requires don't already say ──
    parent_pairs = {frozenset((n["id"], n["parent"])) for n in nodes if n.get("parent")}
    links = []
    for r in rows(wb, "Links"):
        a, b, t = as_id(r.get("from_id")), as_id(r.get("to_id")), (r.get("link_type") or "normal")
        if not a or not b:
            continue
        if t == "requirement":
            continue  # already in the node's "requires"
        if a not in by_id or b not in by_id:
            report.append(f"dropped link {a} → {b}: node {b if a in by_id else a} doesn't exist")
            continue
        if frozenset((a, b)) in parent_pairs and t == "normal":
            continue  # already drawn from "parent"
        link = {"from": a, "to": b, "type": t}
        if r.get("notes") and not str(r["notes"]).startswith("from parent"):
            link["notes"] = r["notes"]
        links.append(link)

    # ── Clusters ──
    clusters = {}
    for r in rows(wb, "Clusters"):
        c = {"name": r.get("theme") or r["cluster_id"]}
        for col, key in (("class", "class"), ("ring", "ring"), ("template", "template"), ("notes", "notes")):
            if r.get(col) is not None:
                c[key] = r[col]
        clusters[r["cluster_id"]] = c

    # ── World (the static lookups) ──
    def pick(r, mapping):
        return {key: r[col] for col, key in mapping if r.get(col) is not None}

    world = {
        "classes": {r["class"]: pick(r, [("aptitude", "aptitude"), ("wedge_start", "wedgeStart"),
                                         ("wedge_width", "wedgeWidth"), ("start_node_id", "startNode"), ("notes", "notes")])
                    for r in rows(wb, "Classes")},
        "aptitudes": {r["aptitude"]: pick(r, [("order", "order"), ("angle_start", "angleStart"), ("angle_width", "angleWidth"),
                                              ("gate_node_id", "gateNode"), ("opposite", "opposite"), ("notes", "notes")])
                      for r in rows(wb, "Aptitudes")},
        "rings": [pick(r, [("ring", "ring"), ("name", "name"), ("radius", "radius"), ("role", "role")]) for r in rows(wb, "Rings")],
        "nodeTypes": {r["type"]: pick(r, [("shape", "shape"), ("size", "size"), ("default_cost", "cost"), ("description", "description")])
                      for r in rows(wb, "NodeTypes")},
        "ascendancies": {r["asc_id"]: {**pick(r, [("name", "name"), ("core_class", "coreClass"), ("notes", "notes")]),
                                       "forbidden": r.get("forbidden") == "yes"}
                         for r in rows(wb, "Ascendancies")},
        "effects": {r["effect_id"]: pick(r, [("name", "name"), ("category", "category"), ("unit", "unit"), ("description", "description")])
                    for r in rows(wb, "Effects")},
        "builds": [pick(r, [("build_id", "id"), ("start_class", "startClass"), ("first_ascendancy", "first"),
                            ("second_ascendancy", "second"), ("target_nodes", "targets"), ("notes", "notes")])
                   for r in rows(wb, "Builds")],
    }

    # Old NodeEffects rows become gem bonuses.
    old_bonuses: dict[str, list] = {}
    for r in rows(wb, "NodeEffects"):
        b = {"effect": r.get("effect_id")}
        if r.get("value") is not None:
            b["value"] = r["value"]
        old_bonuses.setdefault(as_id(r["node_id"]), []).append(b)

    # ── Write ──
    (out / "nodes").mkdir(parents=True, exist_ok=True)
    (out / "gems").mkdir(parents=True, exist_ok=True)
    for name, items in files.items():
        (out / "nodes" / f"{name}.json").write_text(one_per_line(items), encoding="utf-8")
        gem_path = out / "gems" / f"{name}.json"
        gems = json.loads(gem_path.read_text(encoding="utf-8")) if keep_gems and gem_path.exists() else {}
        for n in items:
            wants = any(t in n.get("type", "") for t in GEM_SCAFFOLD_TYPES) or n["id"] in old_bonuses
            if wants and n["id"] not in gems:
                gems[n["id"]] = {"_name": n.get("name", n["id"]), "description": "", "bonuses": old_bonuses.get(n["id"], [])}
        if gems:
            gem_path.write_text(pretty(gems), encoding="utf-8")
    (out / "links.json").write_text(one_per_line(links), encoding="utf-8")
    (out / "clusters.json").write_text(keyed(clusters), encoding="utf-8")
    (out / "world.json").write_text(tables(world), encoding="utf-8")
    report.append(f"{len(nodes)} nodes in {len(files)} files, {len(links)} extra links, {len(clusters)} clusters")
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("xlsx", type=Path)
    ap.add_argument("--into", type=Path, default=Path(__file__).parent / "out", help="output folder (default tools/out)")
    a = ap.parse_args()
    for line in convert(a.xlsx, a.into, keep_gems=True):
        print(line)
