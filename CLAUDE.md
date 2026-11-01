# Farwilds App — working rules

## Branches

- `dev` is the working branch. All development happens on `dev`: every commit, fix and feature.
- `master` is the stable branch. **Only Engin merges into `master`.** Never push to, merge into, rebase or open automatic merges against `master`.
- Do not create extra feature branches. If a session starts on another branch, move the work onto `dev`.
- When a piece of work is finished and pushed to `dev`, say so; Engin merges `dev` into `master` himself.

## Code structure

Feature folders; the README's "Where things live" is the map. Keep to it:

- `src/features/<feature>/` holds everything about one part of the app: `model/` or `engine/` (pure logic, no React),
  hooks (state), `components/` (UI). Logic never lives in a component.
- `src/ui/` is the shared UI kit (import from `@/ui`); `src/core/` holds plain helpers; `src/hooks/` generic hooks.
  A piece of UI or a helper used twice belongs there, not copied.
- Combat skills are behaviours (`src/features/combat/mechanics/`). The engine (`engine/`) and the combat UI never
  mention a skill id. Generic cards (heal, extra actions, limits, upgrades) are data only, in `src/data/combat.json`.
- Data is read through its feature's model (`catalogItem()`, `SKILLS`, `rule()`, `param()`), never straight from JSON in a page.
- One CSS file per feature in `src/styles/`, imported in order by `index.css`. Prefix class names with the feature
  (`cb-…` for combat) so two features never share a class name.
- Split a component into its own files once it passes ~150 lines.

## Checks before pushing

- `npm run build` (type-check + build) and `npm test` must pass.
- `npm test` compares all game logic against a snapshot. If a change is meant to alter results, run
  `npm run test:update` and say in the commit message which results changed and why.
