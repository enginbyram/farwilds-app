# The tree database

Everything the app draws comes from the JSON files in this folder. While `npm run dev` runs, **saving a file redraws the tree instantly** and keeps your build. Mistakes show up in the **data warnings** badge in the app header.

Open the project folder in VS Code: the schemas in `schema/` give you autocomplete (type `"` inside a node and the field names appear) and underline typos like `"parnet"`.

| File | What's in it | How often you touch it |
|---|---|---|
| `nodes/*.json` | Every point on the tree, one per line. One file per class; `_core.json` holds the centre. | All the time |
| `gems/*.json` | The text of a node: description, flavor, bonuses. Same file names as `nodes/`. | All the time |
| `clusters.json` | Cluster / pathway names (the name drawn beside a pathway). | When you add a cluster |
| `links.json` | Extra connections that `parent` doesn't already draw (centre spokes, gates). | Rarely |
| `world.json` | Classes, aptitudes, rings, node types, ascendancies, bonus effects. | Rarely |

Every file in `nodes/` and `gems/` is read, so you can split a class into more files (`nodes/fighter-barbarian.json`) whenever one grows too long. Order within a file matters only as the tie-break when two siblings share a slot.

## nodes/*.json

```json
{"id": "bbr.headlong1", "name": "Headlong", "type": "gem socket", "parent": "bbr.start", "ring": 2, "slot": 1, "cluster": "bar.car1"},
```

| Field | Meaning |
|---|---|
| `id` | Permanent. Rename `name` freely, never the id: parents, links and gems point at it. |
| `type` | A key of `world.json → nodeTypes`. Sets shape, size and default cost. Gem types set cluster rules (below). |
| `parent` | The node it hangs from. Draws the connection and decides the position. |
| `requires` | Parent 2: must be owned first. Never a path and never moves the node. |
| `class` | Root nodes only. Everything else inherits it. |
| `ring`, `slot` | Ring number; order among siblings, counted clockwise. |
| `angle`, `depth` | Hand placement: degrees from the top / 0–1 inside the band. Leave out normally. |
| `cluster` | A key of `clusters.json`. |
| `cost` | Overrides the type's default cost. |
| `requirement`, `wiki`, `notes` | Free text. |

Leave out any field you don't need. JSON doesn't allow comments, but any field starting with `_` is ignored, so `"_todo": "check cost"` is fine.

## gems/*.json — descriptions and bonuses

Keyed by node id. Works for **any** node, not only gems. The converter pre-filled an empty entry for every gem and keystone; `_name` is only there so you can see which node it is.

```json
"bbr.headlong1": {
  "_name": "Headlong",
  "description": "Charge up to your speed toward a foe and strike at the end of it.",
  "flavor": "Nobody remembers the second step.",
  "bonuses": [
    { "effect": "rage_gain", "value": 2, "when": "while charging" },
    { "effect": "str", "value": 1 },
    "Ignore difficult terrain on your first move each turn"
  ]
}
```

That entry shows in the node card as:

> **Bonuses**
> +2 Rage gain while charging
> +1 Strength
> Ignore difficult terrain on your first move each turn

- A bonus is either **plain text**, or `{ "effect", "value", "when" }`. `effect` is a key of `world.json → effects`; the name comes from there, and a unit of `%` adds the percent sign. Negative values are written as-is (`-1 Strength`).
- **What counts in the calculation:** a bonus *without* `when` is always on — it is added to the Character page and Combat as soon as the node is unlocked (`src/rules/bonuses.ts`). A bonus *with* `when` is situational: it shows on the node card but is not added. Plain text is shown only (use it for rule changes such as "one extra Side action").
- `effect` can also be `skill:<Skill name>` (`{"effect": "skill:Endurance", "value": 1}`). Where each effect lands is its `target` in `world.json → effects` (`attr:STR`, `armour`, `hp`, `ap`, `damage:cold`…).
- A new **action** a node opens (a card in Combat) lives in `src/data/combat.json → skills`, keyed by the node id. `grantActive` / `grantSide` give extra actions that turn (Action Surge), `perFight` limits uses.
- Add a new effect to `world.json → effects` first, then use its key. An unknown key is listed in the data warnings badge.
- A gem entry whose id has no node is also flagged, so a renamed id never fails silently.

## clusters.json

```json
"bar.car1": {"name": "Carnage", "class": "Fighter", "ring": 2, "template": "Barbarian Pathway"},
```

`name` is written beside a pathway's outline on the map (turn it off with *Pathway names* in the map options). Two pathways with the same name show the same label, so call the second one `"Carnage II"` if you want them told apart.

## links.json

Only what `parent` doesn't already say: the centre-to-start spokes, and `gate` / `locked` styling on a parent connection. `type`: `normal` (solid), `gate` (dotted), `locked` (dashed). Parent 2 never goes here; use the node's `requires`.

## Cluster and pathway rules (set by the gem's type)

| Gem type | Members are… | Gem unlocks after |
|---|---|---|
| `cluster gem` | arranged in a ring around it | every member |
| `choice cluster gem` | arranged in a ring around it | exactly one member (the others lock) |
| `open cluster gem` | arranged in a ring around it | at least one member |
| `pathway gem` | an ordinary chain (`parent` → `parent` → gem), drawn inside an outline | the chain itself forces the order |

Give the gem and all its members the same `cluster`. Owning the gem's parent opens a cluster.

## Moving an Excel workbook into JSON

`tools/xlsx_to_json.py` does the conversion (needs `pip install openpyxl`):

```bash
python tools/xlsx_to_json.py MyWorkbook.xlsx                          # writes to tools/out/ to compare
python tools/xlsx_to_json.py MyWorkbook.xlsx --into src/data/tree      # overwrites nodes, links, clusters, world
```

Gem texts you've already written are kept; only missing entries are added. The app's **Import .xlsx** button still opens a workbook for viewing, without changing these files.
