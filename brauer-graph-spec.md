# BGAMutation Project Specification

The original full specification has been archived at `spec/original-full-spec.md`.

For implementation, use the focused files in `spec/` instead of loading the full specification every time:

- `spec/00-decisions.md` — canonical cross-cutting decisions
- `spec/01-data-model.md` — data model, validation, examples, and math helpers
- `spec/02-mutation.md` — Kaur mutation and graph updates
- `spec/03-rendering.md` — Cytoscape IDs, rendering, layout, styling, and visual constants
- `spec/04-ui.md` — UI layout, controls, accessibility, and non-functional requirements
- `spec/05-animation.md` — mutation animation details
- `spec/06-canvas-editing.md` — canvas editing operations
- `spec/07-save-load.md` — JSON save/load behavior
- `spec/08-deployment.md` — build, dependency, and GitHub Pages setup
- `spec/backlog.md` — Stage 3, TikZ, surface drawing, and open questions

If a focused spec conflicts with `spec/00-decisions.md`, `spec/00-decisions.md` is authoritative until the conflict is resolved.
