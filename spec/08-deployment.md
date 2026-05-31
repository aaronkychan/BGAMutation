# Build, Dependencies, and Deployment

## Tech Stack

| Concern                   | Choice                                   | Notes                                                                   |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| Runtime / package manager | **Bun**                                  | All scripts use `bun`; scaffolded with `bunx sv create`                 |
| Framework                 | **SvelteKit** (Svelte 5)                 | Single static page; runes-based reactivity                              |
| Adapter                   | **`@sveltejs/adapter-static`**           | Outputs to `docs/` for GitHub Pages; configure `base` path to repo name |
| Language                  | **TypeScript** (strict mode)             |                                                                         |
| Graph rendering           | **Cytoscape.js** (`cytoscape`)           | DOM-based graph canvas                                                  |
| Edge curve editing        | **`cytoscape-edge-editing`**             | Draggable Bezier control handles; requires Konva v8                     |
| Konva                     | **`konva@8`**                            | Peer dependency of `cytoscape-edge-editing`; pin to v8                  |
| Context menus             | **`cytoscape-context-menus`**            | Companion for `cytoscape-edge-editing` (right-click add/remove anchors) |
| Icons                     | **`lucide-svelte`**                      | Lightweight SVG icon set                                                |
| Styling                   | **Plain CSS** with CSS custom properties | One stylesheet per component; no CSS framework                          |
| Persistence               | **`localStorage`**                       | Theme preference only                                                   |
| Save/load                 | **Browser File API**                     | JSON download / upload; no server                                       |

### Scaffold command

```bash
bunx sv create BGAMutation
# Choose: SvelteKit minimal, TypeScript, no extra features
cd BGAMutation
bun add cytoscape cytoscape-edge-editing cytoscape-context-menus konva@8 lucide-svelte
bun add -d @types/cytoscape
```

### SvelteKit / GitHub Pages config

`svelte.config.js`:

```js
import adapter from "@sveltejs/adapter-static";
export default {
    kit: { adapter: adapter({ pages: "docs", assets: "docs" }) },
};
```

`vite.config.ts`:

```ts
import { sveltekit } from "@sveltejs/kit/vite";
export default {
    plugins: [sveltekit()],
    base: "/BGAMutation/", // replace with actual repo name
};
```

Add `docs/` to the repository and configure GitHub Pages to serve from the `docs/` folder of the `main` branch.

### Cytoscape extension registration

Register once in `src/lib/graph/extensions.ts`, imported at app startup:

```ts
import cytoscape from "cytoscape";
import edgeEditing from "cytoscape-edge-editing";
import contextMenus from "cytoscape-context-menus";
import Konva from "konva";

cytoscape.use(contextMenus);
edgeEditing(cytoscape, Konva); // note: different signature from standard use()
```

### Cytoscape mounting in Svelte 5

```svelte
<script lang="ts">
  import cytoscape from 'cytoscape';
  let container: HTMLDivElement;
  let cy: cytoscape.Core;

  $effect(() => {
    cy = cytoscape({ container, elements: [], style: [] });
    return () => cy.destroy();
  });
</script>
<div bind:this={container} class="cy-canvas" />
```

---

## Project Structure

```
BGAMutation/
├── src/
│   ├── lib/
│   │   ├── math/
│   │   │   ├── types.ts          # All TypeScript interfaces
│   │   │   ├── ribbon.ts         # σ₀/σ₁ utilities, H computation, validation
│   │   │   ├── kaur.ts           # Kaur move combinatorial logic (Stage 2)
│   │   │   └── examples.ts       # Predefined graphs with hardcoded positions
│   │   ├── graph/
│   │   │   ├── constants.ts      # VERTEX_RADIUS, ARM_LENGTH, etc. (tunable)
│   │   │   ├── ids.ts            # ID construction helpers
│   │   │   ├── elements.ts       # Cytoscape element builders from BrauerGraph
│   │   │   ├── positions.ts      # Circle / grid / line initial layout computation
│   │   │   ├── extensions.ts     # Register Cytoscape extensions (import once)
│   │   │   ├── style.ts          # Cytoscape stylesheet factory (reads CSS vars)
│   │   │   ├── edgeEdit.ts       # cytoscape-edge-editing init & anchor serialisation
│   │   │   └── animate.ts        # SVG overlay path animation (Stage 2)
│   │   ├── io/
│   │   │   ├── serialize.ts      # Graph + canvas state → SavedFile JSON
│   │   │   └── fileio.ts         # File download & upload (browser File API)
│   │   └── state/
│   │       └── graph.svelte.ts   # Svelte 5 $state runes: graph, mode, UI flags
│   ├── components/
│   │   ├── AppHeader.svelte      # Title bar + theme toggle
│   │   ├── ControlPanel.svelte   # Panel 1: accordion + bottom sections
│   │   ├── NumericalAccordion.svelte  # Accordion section 1
│   │   ├── CanvasAccordion.svelte     # Accordion section 2
│   │   ├── CycleRow.svelte       # One σ₀ cycle row (input + multiplicity + ×)
│   │   ├── InfoBox.svelte        # Graph topology metrics
│   │   ├── MutationControls.svelte
│   │   ├── SaveLoad.svelte
│   │   ├── DisplayPanel.svelte   # Panel 2: Cytoscape div + SVG overlay
│   │   ├── Tooltip.svelte        # Multiplicity tooltip (floating div)
│   │   ├── Modal.svelte          # Reusable custom modal (replaces browser prompt)
│   │   └── ThemeToggle.svelte
│   ├── routes/
│   │   └── +page.svelte          # Single SvelteKit route; mounts full layout
│   ├── app.css                   # CSS custom properties (light/dark tokens)
│   └── app.html
├── docs/                         # Build output (GitHub Pages)
├── static/
├── svelte.config.js
└── vite.config.ts
```

---
