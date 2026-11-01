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
| Change total skill points | `TOTAL_SKILL_POINTS` in `settings.ts` |
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
