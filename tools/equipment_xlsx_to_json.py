"""
Convert the equipment list workbook (.xlsx) into src/data/equipment.json, which the app's
Add and Purchase drawers read.

    pip install openpyxl
    python tools/equipment_xlsx_to_json.py Farwilds_Equipment.xlsx                 # check only, prints a summary
    python tools/equipment_xlsx_to_json.py Farwilds_Equipment.xlsx --into src/data/equipment.json

Sheets read: "Equipment" (one row per item) and "Lists" (category ids and labels in columns G–I).
Rows with problems are reported by row number and skipped; the rest are written.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import warnings
from pathlib import Path

import openpyxl

warnings.filterwarnings("ignore")  # openpyxl complains about data-validation extensions

GEAR = Path(__file__).resolve().parent.parent / "src" / "data" / "gear.json"
NUMBER_KEYS = ("weight_kg", "armour", "attack_power", "reach_m", "range_m", "range_long_m", "str_need")
TEXT_KEYS = ("damage", "damage_type", "armor_type", "description")
BOOL_KEYS = ("stealth_disadvantage",)
GRIPS = {"two-handed": "Two-handed", "versatile": "Versatile"}  # written in the slot column by mistake → property


def slugify(v: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", v.lower().replace("'", "").replace("’", "")).strip("-")


def yes(v) -> bool:
    return text(v).lower() in ("yes", "y", "true", "1")
LIST_KEYS = ("properties", "bonuses")


def text(v) -> str:
    return "" if v is None else str(v).strip()


def number(v):
    if v is None or text(v) == "":
        return None
    f = float(v)
    return int(f) if f.is_integer() else f


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("workbook")
    ap.add_argument("--into", help="output JSON path (omit to only check)")
    a = ap.parse_args()

    gear = json.loads(GEAR.read_text(encoding="utf-8"))
    slots = {s["id"] for s in gear["slots"]}
    coins = {c["short"] for c in gear["coins"]}

    wb = openpyxl.load_workbook(a.workbook, data_only=True)
    ws = wb["Equipment"]
    rows = list(ws.iter_rows(values_only=True))
    head = [text(h).lower() for h in rows[0]]
    col = {h: i for i, h in enumerate(head) if h}

    categories = []
    if "Lists" in wb.sheetnames:
        for r in wb["Lists"].iter_rows(min_row=2, min_col=7, max_col=9, values_only=True):
            if text(r[0]):
                categories.append({"id": text(r[0]).lower(), "label": text(r[1]) or text(r[0]).title()})
    cat_ids = {c["id"] for c in categories}

    items, problems, seen = [], [], set()
    for n, r in enumerate(rows[1:], start=2):
        get = lambda k: r[col[k]] if k in col and col[k] < len(r) else None
        if not any(text(v) for v in r):
            continue
        iid, name = text(get("id")).lower(), text(get("name"))
        why, extra_props = [], []
        if iid and not re.fullmatch(r"[a-z0-9][a-z0-9-]*", iid):
            problems.append(f"row {n}: id '{iid}' used as '{slugify(iid)}' (fix it in the workbook)"); iid = slugify(iid)
        if not iid: why.append("id is empty")
        if iid in seen: why.append(f"duplicate id '{iid}'")
        if not name: why.append("name is empty")
        cat = text(get("category")).lower()
        if cat_ids and cat not in cat_ids: why.append(f"unknown category '{cat}'")
        slot = text(get("slot")).lower()
        if slot in GRIPS:
            problems.append(f"row {n}: slot '{slot}' read as mainhand + property {GRIPS[slot]}")
            extra_props.append(GRIPS[slot]); slot = "mainhand"
        if slot and slot not in slots: why.append(f"unknown slot '{slot}'")
        coin = text(get("coin")).lower()
        if coin not in coins: why.append(f"coin must be one of {sorted(coins)}")
        try:
            price = number(get("price"))
            if price is None or price < 0 or not float(price).is_integer(): raise ValueError
        except (TypeError, ValueError):
            why.append("price must be a whole number"); price = 0
        if why:
            problems.append(f"row {n}: " + "; ".join(why)); continue
        seen.add(iid)

        item = {"id": iid, "name": name, "category": cat}
        if slot: item["slot"] = slot
        item["price"] = {"amount": int(price), "coin": coin}
        if yes(get("stackable")): item["stackable"] = True
        for k in BOOL_KEYS:
            if yes(get(k)): item[k] = True
        for k in NUMBER_KEYS:
            try:
                v = number(get(k))
            except (TypeError, ValueError):
                problems.append(f"row {n}: {k} is not a number (ignored)"); v = None
            if v is not None: item[k] = v
        for k in TEXT_KEYS:
            if text(get(k)): item[k] = text(get(k))
        for k in LIST_KEYS:
            parts = [p.strip() for p in text(get(k)).split(",") if p.strip()]
            if k == "properties": parts = [p for p in extra_props if p not in parts] + parts
            if parts: item[k] = parts
        items.append(item)

    print(f"{len(items)} items, {len(categories)} categories, {len(problems)} notes")
    for p in problems:
        print("  " + p)
    if a.into:
        out = {"$comment": "Generated by tools/equipment_xlsx_to_json.py from the equipment workbook. Edit the workbook, then re-run.",
               "categories": categories, "items": items}
        Path(a.into).write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"wrote {a.into}")
    return 1 if problems and not items else 0


if __name__ == "__main__":
    sys.exit(main())
