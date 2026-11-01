# Farwilds Tree

The skill tree viewer for Farwilds, as a small web app: **Vite + React + TypeScript**.
It reads the tree database (JSON files in `src/data/tree/`) and draws the wheel, measures routes and costs builds.

## Run it

You need **Node.js 18+** (https://nodejs.org — the LTS installer is fine).

```bash
npm install        # once, downloads the libraries into node_modules/
npm run dev        # opens a live dev server at http://localhost:5173 — edits reload instantly
```

Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Type-checks, then builds a static site into `dist/` |
| `npm run preview` | Serves the built `dist/` locally to check it |
| `npm run typecheck` | Only the TypeScript check (like a C# compile with no output) |

`dist/` is plain HTML/CSS/JS: copy it to any web server (nginx/Caddy container on the homelab works) — no Node needed there.

## Your data

The database is **`src/data/tree/`**: nodes, gem texts, clusters, links and world setup as JSON files. Its own **README** there explains every field. While `npm run dev` runs, saving a JSON file redraws the tree at once.

- **Import .xlsx** (header button, or drag a file onto the map) still opens an old workbook for viewing. **Back to JSON database** returns. Nothing is written to either.
- `tools/xlsx_to_json.py` converts a workbook into the JSON files for good.

### Equipment

The item catalog is **`src/data/equipment.json`**, generated from the equipment workbook:

```
python tools/equipment_xlsx_to_json.py Farwilds_Equipment.xlsx                                # check only
python tools/equipment_xlsx_to_json.py Farwilds_Equipment.xlsx --into src/data/equipment.json  # write
```

Bad rows are listed by row number and skipped; ids with spaces or commas are slugged, and a grip written in
the slot column (two-handed, versatile) is read as `mainhand` + that property — both with a note to fix the workbook. A blank template comes from
`python tools/make_equipment_template.py src/data/gear.json Farwilds_Equipment_Template.xlsx`
(re-run it after changing slots or coins). Add `--from old.xlsx` to rebuild an existing list onto the current
template: rows are copied by column name, new columns appear empty and the dropdowns come back.

Ranged and thrown weapons carry `range_m` / `range_long_m`: within range a normal roll, up to long range with
disadvantage, beyond it no attack (proposed). D&D feet convert by grid squares: ft ÷ 5 × 2 m (20/60 ft → 8/24 m). Gear slots, coin values (placeholder 1 gp = 10 sp = 100 cp)
and bag size live in **`src/data/gear.json`**.

**Encumbrance:** capacity = Strength score × `CarryPerSTR` (rules param, 8 kg; editable in Dev mode); load = the
catalog `weight_kg` of everything worn and carried. The Equipment card's radial gauge turns red when over.

On the Character page, **Equipment → Add** opens the catalog in the left column: tick items, *Add to bag* (free).
**Purchase** opens the same list with prices: − / + moves a price by one unit of its coin, the cart and the
changed prices are forgotten when the drawer closes (lowered shows red, raised yellow), and *Pay* takes the total from the purse (with change).

## Character, Creator and Level up

**Creator** makes a level-1 character: 1 Origin (name, race, mark or power, dominant affinity) → 2 Class →
3 Attributes → 4 Review → Create. Every character starts with a Deep well. Choosing no mark or power gives 2 free attribute points.
In the README table below, "Change unlock / refund rules" still means the tree; character numbers are in `rules.json`.

**Character** is read-only: points are spent only through the Creator and Level up. Hover any score, modifier,
skill or stat to see where it comes from. Main attributes (race or class gives 2) have a gold outline, Side (gives 1) grey.
The page takes its colours from the core class (`CLASS_THEME` in `src/config/settings.ts`).

**Level 1**: the class start is unlocked automatically and takes the level-1 keystone point, so a new character
starts with one keystone on its tree and nothing left to spend.

**Level up**: the button sends you to the Tree with one new keystone point (tree points = level). Unlock a node, press
Continue, and the Level Up screen shows what the level gives: first ascendancy at ring 1, second at ring 2, the subdominant
affinity from Ascendancy III, +2 skill points per ascension, and AttributePointsPerLevel attribute points (0 until decided).
Cancel refunds the node.

- Quick = Hit Die (its maximum) + CON modifier, Purequick = Hit Die + WIS modifier; both +2 every 2 levels (`PoolPerStep`, `PoolStepLevels`).
- Defence is the DEX score: physical attacks (d20 + AP) roll against it. Armour reduces physical damage.
- Armour, weapon AP, Leech and "gear & passives" are filled automatically from gear and tree passives
  (`External` in `src/rules/compute.ts`). Until then they read 0.
- **Save character** downloads `<name>.farwilds.json`; **Load character** reads it back (older files are converted).

### Dev mode

Opens a left sidebar (Character, Creator and Level Up pages) with every rules table, and makes the Character page's identity fields editable (level, race, class, ascendancies…) for testing. Edits apply live and stay in this browser;
cells that differ from the defaults are highlighted.

- **From workbook (.xlsx)** reads the Data sheet of the Character Builder workbook — keep editing numbers in Excel if you prefer.
- **Export / Import rules** move a rules set as `farwilds-rules.json`. **Reset** returns to the defaults.
- **The rules file is `src/data/rules.json`** — edit it by hand like the tree JSON. When the file changes, browsers set their saved Dev-mode copy aside and use the file. To keep Dev-mode edits for good, Export rules and copy the tables into `rules.json`.
- Numbers live in the rules; **formulas** live in `src/rules/compute.ts`.

```
src/rules/types.ts          rules + character sheet shapes
src/data/rules.json         ★ THE RULES — every number (params, classes, ascendancies, races, marks…)
src/rules/defaults.ts       loads rules.json
src/rules/compute.ts        every formula
src/rules/fromWorkbook.ts   rules from the Builder workbook's Data sheet
src/hooks/useRules.ts       rules state, kept in the browser
src/hooks/useSheet.ts       character sheet state, kept in the browser
src/data/characterFile.ts   JSON save / load format
src/components/CharacterPage.tsx, CharacterCreator.tsx, LevelUp.tsx, DevPanel.tsx, ui.tsx
```

## Combat

**Combat** puts the current character against foes you set up, to test skills.

- **Left: foes.** Edit their numbers before the fight; add more with *+ Add a foe* at the bottom. During the fight, click a foe to target it.
- **Centre: the turn wheel and the log.** *Start fight* rolls initiative (d20) for everyone; the wheel shows the order clockwise from the top, and the dot marks whose turn it is. Foes act one at a time.
- **Right: the party** — you (pick weapon and armour before the fight) and, later, allies.
- **Bottom bar:** *End turn*, your HP and Rage, and the **Main / Side / Misc** drawers. On your turn play up to one Main and one Side card, then End turn. The button at the far right opens the **passives and reactions** tray: lit symbols are active right now; hover one to read it.
- **Dev mode → Dev tools:** skills in play (start from the tree, tick any others), the Past the Red option, autopilot, and the 1,000-fight simulator.

Data: **`src/data/combat.json`** — `rules` (Defence, initiative, Rage gains, surge DC…), `skills` (each tree node's numbers, keyed by node id), `weapons`, `foes`. Rules marked *Proposed* are placeholders to tune.
Engine: `src/combat/engine.ts` (pure TypeScript). A new skill needs its numbers in `combat.json` and its behaviour in the engine.

## Where things live

```
farwilds-tree/
├─ index.html                  page shell (title, fonts)
├─ tools/xlsx_to_json.py       workbook → JSON converter (Python)
└─ src/
   ├─ config/settings.ts       ★ the knobs: sizes, spacing, zoom levels, label rules, colours per aptitude
   ├─ styles/
   │  ├─ tokens.css            ★ every colour & font (light + dark theme)
   │  └─ app.css               layout and component styles
   ├─ data/
   │  ├─ tree/                 ★ THE DATABASE — nodes/, gems/, clusters, links, world (+ README, schema/)
   │  ├─ types.ts              data shapes (read this first — like C# classes)
   │  ├─ loadTree.ts           merges the JSON files into one object
   │  ├─ loadWorkbook.ts       legacy .xlsx import (SheetJS)
   │  └─ cells.ts              small helpers (text, number, angles)
   ├─ model/                   pure logic, no UI — safe to edit like Python modules
   │  ├─ buildModel.ts         layout: parents, slots, rings, spacing, links, warnings
   │  ├─ routing.ts            route cost (Dijkstra + parent-2 requirements)
   │  └─ character.ts          unlock / refund rules, points used, what glows next
   ├─ hooks/
   │  ├─ usePanZoom.ts         zoom & drag behaviour
   │  └─ useCharacter.ts       character state (name, class, unlocked nodes), saved in the browser
   ├─ components/              the UI (React)
   │  ├─ MapView.tsx           map panel, zoom buttons, view options, route banner, tooltip, drop zone
   │  ├─ Wheel.tsx             the SVG layers: background, links + nodes, labels
   │  ├─ Panels.tsx            sidebar cards: Character, Node (Unlock / Refund), Route
   │  ├─ Header.tsx            title bar, data-warnings badge, load / copy SVG / theme buttons
   │  └─ colors.ts             node → colour
   ├─ App.tsx                  app state (data, selection, route) and page layout
   └─ main.tsx                 entry point
```

## Common changes

| I want to… | Edit |
|---|---|
| Add or move a node | `src/data/tree/nodes/<class>.json` |
| Write a node's description / bonuses | `src/data/tree/gems/<class>.json` |
| Rename a pathway on the map | `src/data/tree/clusters.json` → `name` |
| Add a bonus type (e.g. Rage gain) | `src/data/tree/world.json` → `effects` |
| Pathway name size / distance | `PATHWAY_LABEL_SIZE`, `PATHWAY_LABEL_GAP` in `settings.ts` |
| Glow size / softness | `GLOW_GAP`, `GLOW_BLUR` in `settings.ts`; pulse speed in `app.css` (`glow-pulse`) |
| Change a colour or font | `src/styles/tokens.css` (fonts are bundled via `@fontsource` packages imported in `main.tsx`) |
| Make nodes bigger/smaller | `NODE_BASE`, `NODE_PER_SIZE` in `settings.ts` |
| More space between nodes on a ring | `MIN_NODE_SPACING` in `settings.ts` |
| Make the wheel bigger / smaller | `RADIUS_SCALE` in `settings.ts` (multiplies every ring radius) |
| Aptitude names on the rim | `APTITUDE_LABEL_SIZE`, `APTITUDE_LABEL_GAP` in `settings.ts` |
| Add a new aptitude colour | add it in `tokens.css`, then map it in `APTITUDE_COLOR` |
| Change the layout rules | `src/model/buildModel.ts` |
| Change how route cost works | `src/model/routing.ts` |
| Change unlock / refund rules | `src/model/character.ts` |
| Change creator points, HP, pools, Rage… | `src/data/rules.json` → `params` (or Dev mode) |
| Tree points | equal the character level (Level up adds one) |
| Add a sidebar card | a new function in `Panels.tsx`, then place it in `App.tsx` |

## Modes

- **Default — explore & unlock.** Nodes you can unlock right now **glow** in their colour. When a node next to your build is blocked only by its parent 2, that parent 2 glows **amber** and a dashed amber line joins the two. Turn this off with *Glow next steps* in the map options. Click a node to read it in the Node card. **Unlock** spends its cost if it touches something you own, its parent 2 is already unlocked, and you have points left. **Refund** works when nothing you own depends on it. Your class start is free and always owned. The build (name, class, unlocked nodes) is saved in the browser, and survives edits to the JSON files.
- **Route mode** (button at the bottom of the sidebar, Esc to leave). Click a start, then a target, to see the cheapest cost including parent-2 requirements.

Nodes are drawn outline-only until unlocked; unlocked nodes are filled. Locked nodes you can't reach yet are dimmed (`--locked-opacity`). Node names are not drawn on the map. Hover a node for its name, type, cost, id and whether it can be unlocked. Pathway names (from `clusters.json`) are written beside each pathway.

The **centre** (type `centre`) is always owned and can't be clicked.

### Cluster and pathway gems

Rules, field names and examples are in `src/data/tree/README.md`. Layout settings: `CLUSTER_GEM_TYPES`, `PATHWAY_GEM_TYPES`, `CLUSTER_RADIUS`, `CLUSTER_CLEARANCE`, `BAND_NODE_SPACE`, `PATHWAY_PADDING` in `settings.ts`. If a band can't fit its chain, the warnings badge says *Ring N band is crowded*; raise `RADIUS_SCALE`.

## Layout rules

- **Ring lines vs bands.** Only the centre, class starts and ascendancies (`ON_RING_TYPES` in `settings.ts`) sit *on* a ring line. Every other type sits in the **band after its ring**: a ring 1 passive goes between ring 1 and ring 2, a ring 2 passive between ring 2 and ring 3. A chain of band nodes (passive → passive) is spread evenly across the band; an optional node field **`depth`** (0 = inner edge, 1 = outer edge) places one by hand.
- Root nodes: `class` + `ring` + `slot` → a share of the class wedge.
- Derived nodes: `parent` → a share of the parent's slice. Class is inherited. Ring: an ascendancy goes one ring out from its parent; a band node stays in the band right after its parent's ring.
- `requires` (parent 2) is a **requirement**, never a path and never moves the node. Route costs include it.
- Your own start node is free; every other node costs its `cost` (or its type's `cost` in `world.json`).
- Nodes on the same ring are pushed apart until they are `MIN_NODE_SPACING` apart.

## A 2-minute React primer (for a C#/Python person)

- A **component** is a function that returns markup (JSX). `function NodePanel({ node })` ≈ a method that renders a view from its arguments.
- **`useState`** is a field that triggers a redraw when it changes: `const [selected, setSelected] = useState([])`.
- **`useMemo(() => expensive(), [deps])`** is a cached property: recomputed only when `deps` change (`model` is rebuilt only when the data changes).
- Everything in `src/model/` is plain TypeScript with no React — treat it like a Python module.
