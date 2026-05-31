# (Skew) Brauer Graph Mutation Visualiser — Project Specification

## Overview

A web application for visualising Brauer graph algebras and their skew generalisations, and animating the Kaur mutation. The primary representation is a combinatorial ribbon (orbifold) graph with a multiplicity function, rendered as an interactive graph editor. Implemented in Svelte 5 / SvelteKit, hosted on GitHub Pages.

---

## Goals

### Primary Goals

- Visualise Brauer graphs (ribbon graph + multiplicity function) as interactive diagrams
- Visualise skew Brauer graphs (ribbon orbifold graph + multiplicity function)
- Animate the irreducible Kaur move on a single selected edge
- Support simultaneous mutation on multiple selected edges (Stage 3, later revision)
- (Stretch) Export diagrams to TikZ

### Future Extensions

- Support for marked/labelled ribbon graphs and fractional Brauer graphs
- Surface drawing (embedding format TBD)

---

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

## Mathematical Background

### Half-Edge Set H

Given the user-supplied integer $n \geq 0$ (total number of ordinary and orbifold edges) and an optional array `orbifoldEdges` of positive integers each $\leq n$:

$$H = \bigl(\{-n, \ldots, -1, 1, \ldots, n\} \setminus \{-i : i \in \mathtt{orbifoldEdges}\}\bigr)$$

That is, for each orbifold index $i \in \mathtt{orbifoldEdges}$, the **negative** half-edge $-i$ is excluded from $H$; the positive half-edge $+i$ remains.

### Cyclic Ordering σ₀

Stored as an array of cycles `number[][]`, where each cycle lists the half-edges around one vertex in cyclic order. $\sigma_0$ must partition $H$ exactly.
A vertex in a ribbon graph is a $\sigma_0$-orbit, that is, one single array in the cyclic order array. On canvas, we display this by a star-shaped graph consisting of "vertex node" in the center and "half-edge arms" connecting the vertex node to the "anchor nodes". We refer the star-shaped graph by $S(v)$ for a vertex $v$ of the ribbon graph. The "anchor nodes" are purely for cytoscape-drawing purpose and has no mathematical meaning.

### Edge Involution σ₁

$$\sigma_1(h) = \begin{cases} -h & \text{if } h \in H \text{ and } |h| \notin \mathtt{orbifoldEdges} \quad\text{(ordinary edge)}\\ h & \text{if } h \in H \text{ and } h \in \mathtt{orbifoldEdges} \quad\text{(orbifold edge, fixed point)} \end{cases}$$

$\sigma_1$ is **never stored** — it is always derived from $n$ and `orbifoldEdges`.

An edge, or an arc, in the ribbon graph is a $\sigma_1$-orbit. A $\sigma_1$-orbit of size 1 in a ribbon orbifold graph is called an orbifold edge.
On canvas, we display an edge refers to "the half-edge arms" and a "connecting edge/arc" that connects the two anchor nodes of the two half-edge arms; c.f. [###Edge-rendering] below
For orbifold edge, we display it on canvas with an half-edge and a straight connecting edge that connects the anchor node to a node that we will refer as "orbifold end".
The orbifold end will be drawn as a cross; this end does not count as a vertex in the ribbon orbifold graph.

### Multiplicity Function

Each vertex $v_i$ has a positive integer multiplicity $m_i$, stored as a flat array `number[]` indexed by position in $\sigma_0$. Default to all 1's.

### Brauer Graph and Skew Brauer Graph

- **Brauer graph**: `orbifoldEdges` is empty (or absent). All edges are ordinary.
- **Skew Brauer graph**: `orbifoldEdges` is non-empty.

The data model below handles both cases uniformly.

## Mutation Algorithm

Mutation of orbifold ribbon graph $\Gamma$ is a procedue that changes the local structure around a selected subset $\mathcal{X}$ of edges. There are two types of mutation which are inverse of each other, we call them left and right, denoted by $\mu_{\mathcal{X}}^-(\Gamma)$ and $\mu_{\mathcal{X}}^+(\Gamma)$ respectively.
By irreducible mutation we mean the special case when $|\mathcal{X}|=1$.
Stage 2 aims to implement left and right irreducible mutation, and Stage 3 implements the general case (it maybe possible to combine both stages if it does not complicate matter; in fact, irreducible case may require some more specific case check -- reconfirm with AI planner).
A mutation of a (skew) Brauer graph is just a mutation of the underlying (orbifold) ribbon graph, where the multiplicities of the vertices stay unchanged.

### Setup and Notation

Let $\Gamma = (H, \sigma_0, \sigma_1)$ be the current ribbon orbifold graph.

Let $\mathcal{X} = \{X_1, \ldots, X_s\}$ be the set of selected edges (each $X_i$ is a
$\sigma_1$-orbit: an ordinary edge $\{x, -x\}$ or an orbifold edge $\{x\}$).

Let $\widetilde{\mathcal{X}} = \bigcup_i X_i \subseteq H$ be the set of all half-edges
involved in $\mathcal{X}$.

### Fans

Partition $\widetilde{\mathcal{X}}$ into **fans** $\mathcal{X}_1, \ldots, \mathcal{X}_p$,
where each fan is a maximal consecutive run within a single $\sigma_0$-cycle that lies
entirely in $\widetilde{\mathcal{X}}$.

Formally, fan $\mathcal{X}_i$ is written as:

$$\mathcal{X}_i = \{ h_{i,1},\; h_{i,2}:=\sigma_0(h_{i,1}),\; \ldots,\; h_{i,k_i+1}:=\sigma_0^{k_i}(h_{i,1}) \}$$

where $h_{i,1}$ is called the **first half-edge** of the fan and $h_{i,k_i+1} :=
\sigma_0^{k_i}(h_{i,1})$ is the **last half-edge**, with $k_i \ge 0$. The integer
$k_i + 1$ is the size of the fan.

The **boundary conditions** that define $h_{i,1}$ uniquely (up to Rule 1 below):

- $\sigma_0^{-1}(h_{i,1}) \notin \widetilde{\mathcal{X}}$ — nothing in $\mathcal{X}$
  immediately precedes the fan.
- $\sigma_0(\sigma_0^{k_i}(h_{i,1})) \notin \widetilde{\mathcal{X}}$ — nothing in
  $\mathcal{X}$ immediately follows the fan.

**Implementation note** (`src/lib/math/kaur.ts`): to detect fans, for each
$\sigma_0$-cycle, scan for maximal consecutive subsequences of elements that all belong
to $\widetilde{\mathcal{X}}$. A full cycle (all elements in $\widetilde{\mathcal{X}}$)
is a single fan with no well-defined first element — handled by Rule 1 below.

In code, using the `sigma0` array of cycles and the `halfEdgeId` helper from `ids.ts`:

```ts
function computeFans(sigma0: number[][], selected: Set<number>): Fan[] {
    // For each cycle, find maximal consecutive runs in `selected`.
    // A Fan is { elements: number[], isFullCycle: boolean }
}
```

---

### Left Mutation $\mu^-_{\mathcal{X}}(\Gamma)$

For each fan $\mathcal{X}_i$ with first half-edge $h_{i,1}$ and last half-edge
$h_{i,k_i+1}$, define:

$$e_i := \sigma_0^{-1}(h_{i,1})$$

the half-edge **immediately before the fan** in the current $\sigma_0$-cycle.

The new cyclic ordering $\sigma_0'$ is defined as follows:

**Rule 1** — If $e_i \in \widetilde{\mathcal{X}}$ (equivalently, the fan $\mathcal{X}_i$
fills an entire $\sigma_0$-cycle):

$$\sigma_0'\big|_{\mathcal{X}_i} = \sigma_0\big|_{\mathcal{X}_i}$$

No change for this fan.

**Rule 2** — If $e_i \notin \widetilde{\mathcal{X}}$:

$$
\sigma_0'(h_{i,j}) = \sigma_0(h_{i,j}) \quad \text{for } 1 \le j < k_i + 1
\quad\text{(interior of fan unchanged)}
$$

$$
\sigma_0'(h_{i,k_i+1}) = \sigma_1(e_i)
$$

$$
\sigma_0'(e_i) = \sigma_0(h_{i,k_i+1})
\quad\text{(}e_i \text{ skips the fan, pointing to what used to follow it)}
$$

$$\sigma_0'(\sigma_0^{-1}(\sigma_1(e_i))) = h_{i,1}$$

**Rule 3** — Everything else is unchanged, i.e.

$$
\sigma_0'\big|_{H \setminus (\{h_{i,k_i+1}, e_i, \sigma_0^{-1}(\sigma_1(e_i))\})}
= \sigma_0\big|_{H \setminus (\{h_{i,k_i+1}, e_i, \sigma_0^{-1}(\sigma_1(e_i))\})} \quad \text{ for all } {1 \le i \le p}
$$

**Cycle-level description of Rule 2**: in the original $\sigma_0$-cycle, the segment
reads $\ldots \to e_i \to h_{i,1} \to \cdots \to h_{i,k_i+1} \to f_i \to \ldots$
(where $f_i = \sigma_0(h_{i,k_i+1})$). After left mutation:

- $e_i$ skips the fan: $e_i \to f_i$.
- The fan is reattached ending just before $\sigma_1(e_i)$:
  $h_{i,k_i+1} \to \sigma_1(e_i)$.

Note $\sigma_1(e_i) = -e_i$ if $e_i$ is an ordinary half-edge, or $\sigma_1(e_i) = e_i$
if $e_i$ is an orbifold half-edge.

---

### Right Mutation $\mu^+_{\mathcal{X}}(\Gamma)$

For each fan $\mathcal{X}_i$, define:

$$e_i := \sigma_0(h_{i,k_i+1})$$

the half-edge **immediately after the fan**. Let $f_i := \sigma_0^{-1}(h_{i,1})$
(immediately before the fan).

**Rule 1** — same as left mutation.

**Rule 2** — If $e_i \notin \widetilde{\mathcal{X}}$, the direct $\sigma_0'$ formulation
is:

$$
\sigma_0'(h_{i,j}) = h\_{i,j+1} \quad \text{for } 1 \le j < k_i + 1
\quad\text{(interior unchanged)}
$$

$$
\sigma_0'(h_{i,k_i+1}) = \sigma_0(\sigma_1(e_i))
\quad\text{(last fan element points to what used to follow } \sigma_1(e_i)\text{)}
$$

$$
\sigma_0'(\sigma_1(e_i)) = h_{i,1}
\quad\text{(}\sigma_1\text{-partner of }e_i\text{ now points into start of fan)}
$$

$$
\sigma_0'(f_i) = e_i
\quad\text{(}f_i\text{ skips the fan)}
$$

**Rule 3** Analgous to left mutation:

$$
\sigma_0'\big|_{H \setminus \{h_{i,k_i+1}, f_i, \sigma_1(e_i)\}}
= \sigma_0\big|_{H \setminus \{h_{i,k_i+1}, f_i, \sigma_1(e_i)\}} \quad \text{ for all } {1 \le i \le p}
$$

**Cycle-level description of Rule 2**: original reads
$\ldots \to f_i \to h_{i,1} \to \cdots \to h_{i,k_i+1} \to e_i \to \ldots$. After right
mutation:

- $f_i$ skips the fan: $f_i \to e_i$.
- The fan is reattached starting just after $\sigma_1(e_i)$:
  $\sigma_1(e_i) \to h_{i,1}$, and $h_{i,k_i+1} \to \sigma_0(\sigma_1(e_i))$.

### Remark in the case of irreducible mutation (mutate at a single edge)

In Stage 2, $\mathcal{X} = \{X\}$ is a single selected edge. Let $X = \{x, \sigma_1(x)\}$.

The fans are detected from $\widetilde{\mathcal{X}} = X$:

- If $x$ and $\sigma_1(x)$ are in **different** $\sigma_0$-cycles: two fans,
  $\{x\}$ and $\{\sigma_1(x)\}$, each of size 1.
- If they are in the **same** $\sigma_0$-cycle and adjacent ($\sigma_0(x) = \sigma_1(x)$
  or $\sigma_0(\sigma_1(x)) = x$): one fan of size 2.
- If same cycle but not adjacent: two fans $\{x\}$ and $\{\sigma_1(x)\}$ within one cycle.
- For orbifold $X = \{x\}$ ($\sigma_1(x) = x$): one fan $\{x\}$ of size 1.

For each fan, apply left mutation Rules 1–3 as above.

**Verification of Rule 1 (valency-1 vertex)**: if vertex $v_i$ has valency 1 with
cycle $[x]$, then $\sigma_0(x) = x$ and $e_i = \sigma_0^{-1}(x) = x \in \widetilde{\mathcal{X}}$.
Rule 1 applies: $\sigma_0'(x) = \sigma_0(x) = x$. The vertex $v_i$ survives unchanged
as a degree-1 vertex attached to $x$. No special-casing is needed.

---

## Data Structures (`src/lib/math/types.ts`)

```ts
interface BrauerGraph {
    n: number; // number of ordinary edges
    orbifoldEdges?: number[]; // positive integers ≤ n; each removes its negative from H
    sigma0: number[][]; // vertex cycles; must partition H
    multiplicity: number[]; // [m_1, ..., m_v], one entry per cycle in sigma0
}

// Positions keyed by Cytoscape node ID (vertex nodes only; anchor node positions derived)
type NodePositions = Record<string, { x: number; y: number }>;

// Full saved file (JSON download/upload)
interface SavedFile {
    label: string; // user-supplied name
    savedAt: string; // ISO timestamp
    graph: BrauerGraph;
    cytoscapeJson: cytoscape.CytoscapeOptions; // output of cy.json() — nodes carry position:{x,y}
    edgeAnchors: Record<string, number[]>; // keyed by 'ce-{h}'; flat [x0,y0,x1,y1,...]
}
```

---

## Node and Edge ID Scheme (`src/lib/graph/ids.ts`)

All IDs are constructed by functions in `ids.ts`. No other file constructs IDs by string concatenation.

| ID pattern              | Example                  | Description                                                                            |
| ----------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `v-{i}`                 | `v-0`, `v-2`             | Vertex node (i = index in σ₀ array)                                                    |
| `u-p{h}`                | `u-p1`, `u-p3`           | Anchor node for positive half-edge +h                                                  |
| `u-m{h}`                | `u-m2`, `u-m3`           | Anchor node for negative half-edge −h                                                  |
| `orb-x{h}`              | `orb-x3`                 | Orbifold end node for orbifold half-edge +h                                            |
| `s-{i}`                 | `s-0`                    | Star compound parent (invisible)                                                       |
| `he-p{h}`               | `he-p1`                  | Half-edge arm edge for +h (from v-{i} to u-p{h})                                       |
| `he-m{h}`               | `he-m2`                  | Half-edge arm edge for −h (from v-{i} to u-m{h})                                       |
| `ce-{h}`                | `ce-1`                   | Connecting edge (ordinary, connects `u-p{h}` to `u-m{h}`); keyed by positive half-edge |
| `ce-orb-{h}`            | `ce-orb-3`               | Connecting segment for orbifold edge (`u-p{h}` to `orb-{h}`)                           |
| `arr-{s1}{h1}-{s2}{h2}` | `arr-p1-m2`, `arr-m3-p1` | Cyclic ordering arrow from u-{s1}{h1} to u-{s2}{h2}; all four sign combinations valid  |

All elements belonging to the same logical edge share a data attribute `edgeId` (e.g., `'p1'` for the ordinary edge contributed by half-edge +1). This enables click-anywhere-on-edge selection.

---

## Visual Constants (`src/lib/graph/constants.ts`)

> **Note**: All pixel values below are starting points. Precise values require visual testing of the rendered prototype and should be tuned before publishing.

```ts
export const VERTEX_RADIUS = 10; // px — radius of vertex circle
export const ARM_LENGTH = 22; // px — length of each half-edge arm
export const ANCHOR_RADIUS = 4; // px — radius of anchor node (u-*)
export const STROKE_WIDTH = 2; // px — arms and connecting edges
export const CLUSTER_RADIUS = VERTEX_RADIUS + ARM_LENGTH + ANCHOR_RADIUS; // = 36px
export const FAR_ENOUGH_PX = Math.round(CLUSTER_RADIUS * 1.5); // = 54px
// FAR_ENOUGH_PX: minimum distance from a vertex centre for "blank canvas" click
// (used in Canvas Edit mode: Add Vertex)
export const CIRCULAR_LAYOUT_RADIUS = 80; // px - radius of the cricle for which vertices laid on when pressing "Draw graph"
export const GRID_LAYOUT_SPACE = 120; // px - space between vertices in grid layout
export const LINE_LAYOUT_SPACE = 120; // px - space between vertices in line layout
```

At degree 10, gap between adjacent anchor nodes ≈ 11.7 px — distinguishable but tight. Increasing `ARM_LENGTH` is the primary tuning lever.

---

## Test Data (`src/lib/math/examples.ts`)

Each example stores a `BrauerGraph` plus a `NodePositions` map with hardcoded vertex positions arranged in a circle. The positions are hand-tuned during prototyping; the initial values are computed by the circle-arrangement formula with a sensible radius (e.g., 200 px for most examples).

### Ordinary Brauer graphs

| Name            | σ₀                                       | n   |
| --------------- | ---------------------------------------- | --- |
| Star (5 edges)  | `[[1,2,3,4,5],[-1],[-2],[-3],[-4],[-5]]` | 5   |
| Line (4 edges)  | `[[-1],[1,-2],[2,-3],[3,-4],[4]]`        | 4   |
| Torus (3 edges) | `[[1,2,3],[-1,-2,-3]]`                   | 3   |
| Pants (3 edges) | `[[1,2,3],[-1,-3,-2]]`                   | 3   |

All multiplicities default to 1.

### Skew Brauer graphs

| Name               | σ₀                  | n   | orbifoldEdges |
| ------------------ | ------------------- | --- | ------------- |
| One orbifold edge  | `[[1,2,3],[-1,-2]]` | 3   | `[3]`         |
| Two orbifold edges | `[[1,2]]`           | 2   | `[1,2]`       |

---

## Stage 0: UI Layout

### Two-Panel Root Layout

```
┌──────────────────────────────────────────────────┐
│  AppHeader: title                  ThemeToggle   │
├─────────────────────┬────────────────────────────┤
│  Panel 1            │  Panel 2                   │
│  ControlPanel       │  DisplayPanel              │
│  (320px, scroll)    │  (fills remaining width)   │
└─────────────────────┴────────────────────────────┘
```

**Breakpoints**:

| Viewport    | Layout                                                 |
| ----------- | ------------------------------------------------------ |
| ≥ 1025 px   | Side-by-side; Panel 1 fixed 320 px                     |
| 641–1024 px | Panel 1 as slide-in drawer; toggle button in AppHeader |
| ≤ 640 px    | Stacked: canvas first, Panel 1 below (scrollable)      |

### Panel 1 — ControlPanel structure

Panel 1 is a scrollable sidebar. Its contents, top to bottom:

**[A] Accordion: "Numerical input"** (`NumericalAccordion.svelte`)

Mutually exclusive with accordion B — opening one closes the other. When accordion B is open, all inputs in A are functionally and visually disabled (greyed, `pointer-events: none`).

Contains, in order:

1. **Graph type selector** — segmented control: "Brauer" / "Skew Brauer". Switching resets all inputs below.

2. **Edge count** — single numeric input for $n$. For Skew Brauer mode, an additional text input for `orbifoldEdges` (comma-separated positive integers ≤ n, e.g. `"3, 4"`). On change: $H$ is recomputed and shown as a read-only display line (e.g. `H = {±1, ±2, …, ±5}`); σ₀ rows and multiplicity inputs are reset.

3. **Cyclic ordering σ₀** — one `CycleRow.svelte` per vertex cycle. Each row contains:
    - Vertex badge `v₁`, `v₂`, … (read-only label)
    - Cycle text input (comma-separated integers from H; monospace font)
    - Multiplicity input (small integer input, default 1, min 1; placed inline before the remove button)
    - Remove button (×)
    - An **"Add vertex"** link below all rows appends a new empty row.

4. **Display toggles** — four toggle switches:
    - "Cyclic order arrows" (default off)
    - "Half-edge labels" (default off) — shows integer $h$ overlaid on anchor node `u-*`
    - "Multiplicity labels" (default off) — shows $m_i$ adjacent to vertex if $m_i > 1$
    - "Edge labels" (default off) — shows `[i]` at midpoint of each connecting edge (ordinary and orbifold); $i$ = the positive half-edge index of the edge

5. **Ordering direction** — segmented control: CW / CCW (default CW)

6. **Initial vertices layout** — radio group with three options for vertex placement on first draw:
    - Circle (default)
    - Grid
    - Line

7. **Predefined examples** — dropdown grouped by type; selecting loads all inputs and positions.

8. **Action buttons** — "Draw graph" (primary) and "Clear".

**[B] Accordion: "Edit graph on canvas"** (`CanvasAccordion.svelte`)

Toggling this open disables all content in accordion A. Contains:

- "Add vertex" button
- "(Re)connect arc" button
- "Add orbifold edge" button
- "Edit curve" button
- "Remove vertex" button
- "Remove arc/half-edge" button
- "Modify multiplicity" button

Button behaviours are specified in the Canvas Edit section below.

**[C] Info box** (`InfoBox.svelte`) — always visible; updated after each successful draw or edit.

Displays: Type of ribbon graph (ordinary/orbifold), number of vertices $v$, number of edges $e$, number of faces $f$, genus $g = (2 - v + e - f)/2$ (ordinary ribbon graph only), orbifold edges count (orbifold ribbon graph only).

**[D] Mutation controls** (`MutationControls.svelte`) — always visible.

If the current graph on canvas does not define a proper (orbifold) ribbon graph, then info box will show a warning and procedure will stop. There will be 2 buttons, one for left mutation and one for right mutation.

Irreducible mutation (Stage 2):

- "Mutate edge" buttons (one for left and one for right) — single click enters edge-selection mode; clicking an edge on the canvas triggers the animation immediately.

Simultaneous mutation (Stage 3):

- "Select edges to mutate" toggle button — enters multi-edge selection mode.
- "Mutate selected" button — disabled until ≥ 1 edge is selected; triggers animation.

**[E] Save / Load** (`SaveLoad.svelte`) — always visible.

- "Save current" button — opens `Modal.svelte` to enter a label; saves `SavedFile` JSON to a downloadable file.
- "Export all" / "Import" buttons.

### Panel 2 — DisplayPanel

Contains only:

- The Cytoscape `<div>` (fills 100% of panel, `overflow: hidden`).
- An `<svg>` overlay (`position: absolute`, same bounds, `pointer-events: none`) for animation.
- A floating info bar at the bottom of the canvas (appears during selection modes): e.g. "Click an edge to mutate" or "Click edges to select; press Mutate to animate".

### Custom Modal (`Modal.svelte`)

A Svelte modal component (not `window.prompt()`). Props: `title: string`, `placeholder: string[]`, `onConfirm: (value: string[]) => void`, `onCancel: () => void`. Rendered as a centred card with backdrop overlay; keyboard accessible (Enter = confirm, Escape = cancel); traps focus while open. There can be multiple placeholders (for input) that's why we use `string[]`.

---

## Stage 1: Graph Presentation

### Initial Layout Computation (`src/lib/graph/positions.ts`)

When "Draw graph" is pressed with no saved positions, vertex node positions are computed according to the selected layout option:

**Circle**: $v$ vertices placed evenly on a circle of radius $R$:

$$v_i = \text{centre} + R \cdot (\sin(2\pi i / v),\; -\cos(2\pi i / v))$$

Use $R = 180\text{ px}$ as default; centre at canvas centre at draw time.
This may need further adjustment, stored as one of the visual constants `CIRCULAR_LAYOUT_RADIUS`.

**Grid**: vertices placed in a grid with column count $c = \lceil\sqrt{v}\rceil$, spacing 120 px; spacing value stored as visual constant `GRID_LAYOUT_SPACE`.

**Line**: vertices placed in a single horizontal row, spacing 120 px, centred; spacing value stored as visual constant `LINE_LAYOUT_SPACE`.

After positions are assigned, anchor node positions are derived analytically — see Anchor Position section below.

### Anchor Position Formula

For vertex $v_i$ at $(x_0, y_0)$ with $k$ half-edges in CW order, the $j$-th anchor $u(a_j^i)$ (id `u-{a_j^i}`) is at position:

$$(x_0, y_0) + (r_v + r_{arm}) \cdot (\sin\theta_j,\; -\cos\theta_j), \qquad \theta_j = \frac{2\pi(j-1)}{k}$$

where $r_v = \texttt{VERTEX\_RADIUS}$ and $r_{arm} = \texttt{ARM\_LENGTH}$.

For CW ordering, $j$ increments clockwise starting from north ($a_1^i$ points north). For CCW, reverse the sign on $\theta_j$.

Orbifold ends (`orb-x{h}`) use the same formula with the arm length $r_{arm}$ doubled that of the arm length to the anchor node `u-p{h}`.

### Drag Re-sync

Listen `dragfreeon` on vertex nodes. On drag-end, compute the translation delta $(\Delta x, \Delta y)$ from the vertex's old position and apply it rigidly to all anchor and orbifold-end nodes in $S(v_i)$. Do not re-run any layout.

Compound nodes (`s-{i}`) group $v_i$ and its leaves logically. Apply compound structure **after** initial position assignment, not during it.

### Node Rendering

**Vertex nodes** (`v-{i}`):

- $m_i = 1$: hollow circle — background fill, solid border (`var(--vertex-hollow-border)`).
- $m_i > 1$: filled circle — `var(--vertex-filled)`.

**Multiplicity tooltip** (`Tooltip.svelte`): on `mouseover` / `tap` on any vertex node, show a floating `<div>` near the cursor with "Multiplicity: $m_i$". Visible regardless of the multiplicity-label toggle.

**Multiplicity labels** (display toggle "Multiplicity labels"): when on, show $m_i$ as text adjacent to the vertex node, only if $m_i > 1$.

**Anchor nodes** (`u-p{h}`, `u-m{h}`):

- Normal state: invisible (`opacity: 0`). Selectable by Cytoscape for internal logic but not visible to the user.
- Debug state: dashed hollow circle, radius `ANCHOR_RADIUS`.

```ts
// DEBUG: change opacity to 0 before publishing
'.u-node': { opacity: 1, ... }
```

**Half-edge labels** (display toggle "Half-edge labels"): when on, the integer $h$ (with sign) is displayed as a text label adjacent to the anchor node `u-p{h}` or `u-m{h}`. Use Cytoscape's `label` property on the anchor node, rendered in monospace font, small size.

**Orbifold ends** (`orb-x{h}`): rendered as a cross (×) using an inline SVG set as `background-image` on the Cytoscape node. Coloured `var(--orbifold-color)`. Sized similarly to a vertex circle.

### Edge Rendering

**Half-edge arms** (`he-p{h}`, `he-m{h}`): straight Cytoscape edges from the vertex node to the anchor node. `curve-style: none` (straight). All share `edgeId` data attribute for the logical edge they belong to. In the cytoscape data, this have source `v-{i}` and target `u-p{h}` (or `u-m{h}`).

**Ordinary connecting edge** (`ce-{h}`): Bezier curve between `u-p{h}` and `u-m{h}` (i.e. between the two anchors of the paired half-edges). Managed by `cytoscape-edge-editing` for draggable anchor handles. `curve-style: unbundled-bezier`. In cytoscape data, we use the convetion that source is `u-p{h}` and target is `u-m{h}`. When auto-generating cytoscape graph from numerical data, we take the Bezier curve so that is starts in the same direction of the half-edge arm it connects to in each of its ends.

**Orbifold connecting edge** (`ce-orb-{h}`): straight segment from `u-p{h}` to `orb-x{h}`. Length being twice of `ARM_LENGTH`. No Bezier handles.

**Edge click detection**: clicking any Cytoscape element with a given `edgeId` selects the whole logical edge. Half-edge arms, anchor nodes (when visible), and connecting curves all carry the same `edgeId`.

**Edge labels** (display toggle "Edge labels"): when on, show `[i]` at the midpoint of each connecting edge (`ce-{h}` and `ce-orb-{h}`), where `i` is the positive half-edge index. Use Cytoscape's `label` property on the connecting edge element. Monospace font.

### Cyclic Ordering Arrows (display toggle "Cyclic order arrows")

For each consecutive pair $(a_j^i, a_{j+1}^i)$ in a cycle (including wrap-around $(a_{last}^i, a_1^i)$):

- Draw a directed Cytoscape edge `arr-{s1}{h1}-{s2}{h2}` from the anchor of $a_j^i$ to the anchor of $a_{j+1}^i$.
- `curve-style: bezier`, colour `var(--arrow-color)`, dashed stroke.
- Singleton cycle: `curve-style: loop` self-loop on the anchor node.
- All arrow edges: `selectable: false` — they must never be clickable for mutation or editing purposes.
- Arrow edges carry **no** `edgeId` attribute.

The four sign-pattern variants (`arr-p{h}-p{h2}`, `arr-p{h}-m{h2}`, `arr-m{h}-p{h2}`, `arr-m{h}-m{h2}`) all follow the same style rules; the pattern depends on the actual signs of consecutive elements in each $\sigma_0$ cycle.

### Validation (`src/lib/math/ribbon.ts`)

On "Draw graph":

- Every element of $H$ appears in exactly one $\sigma_0$ cycle (no gaps, no duplicates).
- All cycle elements are integers in $H$ (correct sign, correct range).
- Each $m_i \geq 1$.
- Each value in `orbifoldEdges` is a positive integer $\leq n$.
- `orbifoldEdges` contains no duplicates.

Emit inline error messages beneath the offending input in Panel 1. Do not draw.

### Styling & Theming

**Design language**: clean, typographically grounded academic aesthetic. Monospace font (`var(--font-mono)`) for all half-edge integers, σ₀ inputs, and edge labels. Neutral sans-serif for all UI chrome.

**CSS custom properties** (`src/app.css`):

```css
:root[data-theme="light"] {
    --bg-primary: #ffffff;
    --bg-secondary: #f5f5f0;
    --bg-panel: #fafaf7;
    --border: #d0cfc8;
    --text-primary: #1a1a1a;
    --text-secondary: #555550;
    --accent: #2a5caa;
    --vertex-filled: #1a1a1a;
    --vertex-hollow-border: #1a1a1a;
    --edge-color: #444440;
    --arrow-color: rgba(42, 92, 170, 0.5);
    --orbifold-color: #cc4400;
    --highlight-color: #1ca3c4; /* cerulean blue — used for mutation animation */
}

:root[data-theme="dark"] {
    --bg-primary: #1a1a1e;
    --bg-secondary: #22222a;
    --bg-panel: #1e1e26;
    --border: #38384a;
    --text-primary: #e8e8e0;
    --text-secondary: #aaaaaa;
    --accent: #7aaef8;
    --vertex-filled: #e8e8e0;
    --vertex-hollow-border: #e8e8e0;
    --edge-color: #bbbbbb;
    --arrow-color: rgba(122, 174, 248, 0.5);
    --orbifold-color: #ff8855;
    --highlight-color: #4dd4f0;
}
```

In dark mode all colours invert: filled vertex becomes `#e8e8e0` (light circle on dark background). The Cytoscape stylesheet (`style.ts`) reads these values at mount time via `getComputedStyle(document.documentElement)` and **re-applies** on theme change (observe `data-theme` attribute mutation on `<html>`).

**Theme toggle** (`ThemeToggle.svelte`): sun/moon icon in `AppHeader`. Sets `data-theme` on `<html>`. Persists choice to `localStorage` under key `bgv_theme`. No consent banner required (functional preference, no personal data).

### Save / Load (`src/lib/io/`)

**Save**: "Save current" → `Modal.svelte` prompts for a label → serialise:

```ts
const file: SavedFile = {
    label,
    savedAt: new Date().toISOString(),
    graph: currentGraph,
    cytoscapeJson: cy.json(), // includes node positions
    edgeAnchors: serializeAnchors(cy), // from cytoscape-edge-editing
};
```

`serializeAnchors` calls `edgeEditingInstance.getAnchorsAsArray(edge)` for every `ce-{h}` edge and stores results in a `Record<string, number[]>` keyed by edge ID.

**Load**: Restore `cy.json(cytoscapeJson)` then call `cy.layout({ name: 'preset' }).run()` to honour saved positions. Then restore anchor handles via `edgeEditingInstance.initAnchorPoints(edges, controlPositionsFunction)`.

**Export / Import**: `fileio.ts` wraps `SavedFile[]` in a JSON file download / `FileReader` upload.

---

## Stage 2: Irreducible Mutation (Kaur Move)

### User Flow

1. User clicks "Mutate edge" (in Mutation controls, Panel 1).
2. Canvas enters single-edge selection mode. The floating info bar in Panel 2 shows: _"Click an edge to mutate it."_
3. User clicks any component (half-edge arm, anchor, or connecting arc) of an edge $X$ — identified by `edgeId`.
4. All components of edge $X$ are highlighted in `var(--highlight-color)` (cerulean blue).
5. Animation plays automatically (Phase 1-3 below).
6. On completion, the graph is redrawn with the updated $\sigma_0$ (Step 1-4 below). The description of the new $\sigma_0$ is described in the "Mutation algorithm" section.

### ID helpers required (`src/lib/graph/ids.ts`)

```ts
// Convert signed half-edge integer to p/m ID fragment
function halfEdgeTag(h: number): string {
    return h > 0 ? `p${h}` : `m${-h}`;
}
// Anchor node ID
function anchorId(h: number): string {
    return `u-${halfEdgeTag(h)}`;
}
// Half-edge arm ID
function armId(h: number): string {
    return `he-${halfEdgeTag(h)}`;
}
// Connecting edge ID (always keyed by positive half-edge)
function connectingEdgeId(h: number): string {
    return `ce-${Math.abs(h)}`;
}
// Orbifold end ID
function orbifoldEndId(h: number): string {
    return `orb-x${h}`;
} // h always positive
```

### Animation Mechanism

Cytoscape.js is canvas-based: edges are drawn onto an `<canvas>` element by Cytoscape's
renderer on every frame. CSS `@keyframes` and the Web Animations API cannot be used, as
they target DOM elements. All animation is driven by **`requestAnimationFrame`**, which is
the current standard for canvas animation (60 fps, synced to display refresh, pauses
automatically when the browser tab is hidden).

The visual effect is a cerulean-blue highlight colour flowing into each edge from one end
toward the other, implemented via Cytoscape's `line-fill: linear-gradient` style property
with three gradient stops. The stop colours are fixed per edge per phase; only the stop
positions change on each animation frame. After animation completes, all affected edges are
restored to `line-fill: solid`.

**Important**: while `line-fill: linear-gradient` is active on an element, Cytoscape's
built-in `ele.animate()` cannot be used simultaneously on that element. All animation
uses `requestAnimationFrame` + `ele.style({...})` exclusively.

#### Gradient stop arrangements

`H` = `var(--highlight-color)` (cerulean blue); `E` = `var(--edge-color)`.

**`'spread'`** — highlight expands from midpoint outward (Phase 1 only):

| t   | stop 1 | stop 2 | stop 3 | colors  |
| --- | ------ | ------ | ------ | ------- |
| 0   | 49%    | 50%    | 51%    | E, H, E |
| 1   | 0%     | 50%    | 100%   | E, H, E |

Stop positions: `[round(49*(1-t))+'%', '50%', round(51+49*t)+'%']`

**`'forward'`** — highlight fills from Cytoscape-source end toward target:

| t   | stop 1 | stop 2 | stop 3 | colors  |
| --- | ------ | ------ | ------ | ------- |
| 0   | 0%     | 1%     | 100%   | H, E, E |
| 1   | 0%     | 99%    | 100%   | H, E, E |

Stop positions: `['0%', round(99*t)+'%', '100%']`

**`'reverse'`** — highlight fills from Cytoscape-target end toward source:

| t   | stop 1 | stop 2 | stop 3 | colors  |
| --- | ------ | ------ | ------ | ------- |
| 0   | 0%     | 99%    | 100%   | E, E, H |
| 1   | 0%     | 1%     | 100%   | E, E, H |

Stop positions: `['0%', round(99*(1-t))+'%', '100%']`

The choice of `'forward'` vs `'reverse'` for each arm in Phases 2–3 is determined by
the **mathematical flow direction** (which end the highlight enters from), not by
Cytoscape's source/target assignment. For arm `he-{tag}` (Cytoscape: source = vertex
node, target = anchor node):

- Flow from anchor toward vertex → `'reverse'` (enters from target end).
- Flow from vertex toward anchor → `'forward'` (enters from source end).

For connecting edge `ce-{|h|}`, determine arrangement at runtime:

```ts
const arrangement =
    ceEdge.source().id() === anchorId(entryHalf) ? "forward" : "reverse";
```

where `entryHalf` is the half-edge whose anchor the flow enters from.

#### Core animation primitives (`src/lib/graph/animate.ts`)

```ts
// Animate a single Cytoscape edge with the 3-stop gradient trick.
// arrangement: 'spread' | 'forward' | 'reverse'
// Returns a Promise that resolves when the phase duration elapses.
function animateEdge(
    edge: cytoscape.EdgeSingular,
    arrangement: "spread" | "forward" | "reverse",
    edgeColor: string,
    highlightColor: string,
    durationMs: number,
): Promise<void> {
    return new Promise((resolve) => {
        const start = performance.now();
        const colors = buildColors(arrangement, edgeColor, highlightColor);
        const frame = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            edge.style({
                "line-fill": "linear-gradient",
                "line-gradient-stop-colors": colors,
                "line-gradient-stop-positions": buildPositions(arrangement, t),
            });
            if (t < 1) requestAnimationFrame(frame);
            else resolve();
        };
        requestAnimationFrame(frame);
    });
}

// Run a group of edge animations simultaneously; resolves when all finish.
function animateGroup(animations: Promise<void>[]): Promise<void> {
    return Promise.all(animations).then(() => undefined);
}

// Run a sequence of edge animations one after another.
async function animateSequence(steps: (() => Promise<void>)[]): Promise<void> {
    for (const step of steps) await step();
}

// Restore all affected edges to solid line-fill after animation.
function restoreEdges(edges: cytoscape.EdgeSingular[]): void {
    for (const e of edges) e.style({ "line-fill": "solid" });
}

// Read CSS custom properties at call time (after theme may have changed).
function getAnimationColors(cy: cytoscape.Core): {
    edgeColor: string;
    highlightColor: string;
} {
    const root = getComputedStyle(document.documentElement);
    return {
        edgeColor: root.getPropertyValue("--edge-color").trim(),
        highlightColor: root.getPropertyValue("--highlight-color").trim(),
    };
}
```

### Animation constants (`src/lib/graph/constants.ts`)

```ts
export const ANIMATION_TOTAL_MS = 1000; // total; tune during development
export const ANIMATION_POST_MS = 500; // pause after animation before graph update
// Phase durations (adjust ratios as needed):
export const ANIMATION_PHASE1_MS = Math.round(ANIMATION_TOTAL_MS * 0.25);
export const ANIMATION_PHASE2_MS = Math.round(ANIMATION_TOTAL_MS * 0.25);
export const ANIMATION_PHASE3_MS = Math.round(ANIMATION_TOTAL_MS * 0.5);
// Phase 3 sub-flow: 3 sequential edges each get 1/3 of ANIMATION_PHASE3_MS
```

---

### Animation Sequence

### Phase 1 — Highlight spreads from midpoint of each selected connecting edge

For each selected edge $X_i \in \mathcal{X}$, retrieve the connecting edge element and
animate with `'spread'`. All selected edges animate simultaneously.

For an **ordinary edge** $X_i = \{x, -x\}$: element `ce-{x}` (= `ce-${Math.abs(x)}`).

For an **orbifold edge** $X_i = \{x\}$: element `ce-orb-{x}`.
The spread still starts from the midpoint of the segment toward both ends; the vertex
end reaches `u-p{x}` and the cross end reaches `orb-x{x}`.

```ts
await Promise.all(
    selectedEdges.map((Xi) =>
        animateEdge(
            getConnectingElement(Xi),
            "spread",
            edgeColor,
            highlightColor,
            ANIMATION_PHASE1_MS,
        ),
    ),
);
```

### Phase 2 — Highlight travels inward along half-edge arms toward vertex nodes

Triggered when Phase 1 completes.

For each selected ordinary edge $X_i = \{x, -x\}$, two arms animate simultaneously:

- `he-p{x}`: flow from `u-p{x}` end toward its vertex. Cytoscape source = vertex,
  target = anchor → `'reverse'`.
- `he-m{x}`: flow from `u-m{x}` end toward its vertex. → `'reverse'`.

For each selected orbifold edge $X_i = \{x\}$, one arm:

- `he-p{x}`: flow from `u-p{x}` toward its vertex. → `'reverse'`.
  (No arm on the orbifold end; the cross `orb-x{x}` has no vertex to flow into.)

Note: the vertex nodes themselves are **not** highlighted; the flow stops upon reaching
the vertex node end of the arm.

```ts
await Promise.all(
    selectedEdges.flatMap((Xi) =>
        armsOf(Xi).map((arm) =>
            animateEdge(
                arm,
                "reverse",
                edgeColor,
                highlightColor,
                ANIMATION_PHASE2_MS,
            ),
        ),
    ),
);
```

### Phase 3 — Highlight spreads outward through $e_i$ for each fan

Triggered when Phase 2 completes.

For each fan $\mathcal{X}_i$ where Rule 2 applies (i.e. $e_i \notin \widetilde{\mathcal{X}}$,
meaning left mutation actually modifies the cyclic ordering for this fan):

Let $e_i = \sigma_0^{-1}(h_{i,1})$ for left mutation, and $e_i=\sigma_0(h_{i,k+1})$ for right mutation; these are the half-edges immediately before and after the fan $\mathcal{X}_i$ respectively.
Let $V(e_i)$ denote the vertex node of the vertex whose $\sigma_0$-cycle contains $e_i$.

Retrieve elements:

```ts
const heEi = cy.getElementById(armId(ei)); // arm of e_i
const ceEi = cy.getElementById(connectingEdgeId(ei)); // connecting edge |e_i|
const heNEi = isOrdinary(ei, graph.orbifoldEdges)
    ? cy.getElementById(armId(-ei))
    : null; // Step 3c skipped for orbifold e_i; σ₁(e_i) = e_i, no return arm
```

The three-edge sequential sub-flow for this fan:

**Step 3a** — `he-{tag(e_i)}`: flow from $V(e_i)$ end toward anchor `u-{tag(e_i)}`.
Cytoscape source = $V(e_i)$, target = anchor → `'forward'`.

**Step 3b** — If $e_i$ is an **ordinary half-edge**: animate `ce-{|e_i|}` from the
`u-{tag(e_i)}` end toward the `u-{tag(-e_i)}` end. Determine `'forward'` or `'reverse'`
at runtime from `ceEi.source().id()`.

If $e_i$ is an **orbifold half-edge** ($e_i \in$ `orbifoldEdges`, so $\sigma_1(e_i) = e_i$):
animate `ce-orb-{e_i}` from the `u-p{e_i}` end outward toward `orb-x{e_i}`. Then
animate the same element back `'reverse'` (returning from cross toward anchor) to
represent the wrap-around. These two mini-steps count together as Step 3b.

**Step 3c** (ordinary case only) — `he-{tag(-e_i)}`: flow from anchor `u-{tag(-e_i)}`
end toward vertex $V(-e_i)$. Cytoscape source = $V(-e_i)$, target = anchor → `'reverse'`.

All fans whose Rule 2 applies run their sub-flows **simultaneously**. Disjointness of
the edge sets is guaranteed: since $\sigma_0$ partitions $H$, each half-edge belongs to
exactly one $\sigma_0$-cycle, so the $e_i$ values for distinct fans are distinct elements of $H$, and their associated arms are therefore disjoint.

```ts
const fanFlows = rule2Fans.map(
    (fan) => () =>
        animateSequence([
            () =>
                animateEdge(
                    heEi,
                    "forward",
                    edgeColor,
                    highlightColor,
                    ANIMATION_PHASE3_MS / 3,
                ),
            () =>
                animateStep3b(
                    fan,
                    edgeColor,
                    highlightColor,
                    ANIMATION_PHASE3_MS / 3,
                ),
            () =>
                isOrdinary(ei, graph.orbifoldEdges) && heNEi
                    ? animateEdge(
                          heNEi,
                          "reverse",
                          edgeColor,
                          highlightColor,
                          ANIMATION_PHASE3_MS / 3,
                      )
                    : Promise.resolve(), // orbifold: no return arm
        ]),
);
await Promise.all(fanFlows.map((f) => f()));
```

Fans covered by Rule 1 (full-cycle fans) produce **no animation** in Phase 3, since
the mutation leaves their $\sigma_0$-orbit unchanged.

### Cleanup

```ts
// Restore all animated edges to solid line-fill
restoreEdges([...connectingElements, ...armElements, ...fanElements]);
```

---

## Graph Update After Animation

After all three phases complete, pause for `ANIMATION_POST_MS` (default 500 ms), then:

### Step 1 — Update $\sigma_0$ in graph store

Apply left/right mutation Rules 1–3 to the in-memory `sigma0` array. The update touches only
the half-edges and $e_i$ values identified during fan computation. No other entries change.

### Step 2 — Identify changed vertices

Determine the set of vertices $V_\Delta$ whose $\sigma_0$-cycle has changed. A vertex
$v$ is in $V_\Delta$ if any of the following are in its new (post-mutation) cycle or its
old cycle:

- Any half-edge in $\widetilde{\mathcal{X}}$ that moved to a different cycle.
- Any $e_i$ whose successor changed.

### Step 3 — Rebuild star-shaped subgraphs for changed vertices

For each vertex $v \in V_\Delta$:

1. **Remove** from Cytoscape all existing arm edges (`he-*`) and anchor nodes (`u-*`,
   `orb-x*`) belonging to $v$'s old star subgraph $S(v)$.
2. **Recompute** anchor positions using the star geometry formula with the new cycle
   ordering (CW or CCW as per current display setting), keeping $v$'s position fixed.
3. **Add** new arm edges and anchor/orbifold-end nodes to Cytoscape with the updated
   positions and IDs.
4. **Update** connecting edges (`ce-*`, `ce-orb-*`) whose endpoints have moved:
   rebind source/target to the newly created anchor nodes, but preserve the existing Bezier control point data (`edgeAnchors` entry for that edge). Only the endpoint binding changes; the curve shape is kept.

> **Note**: The vertex node `v-{i}` itself does not move. Only the arms and anchors
> are rebuilt. The compound parent `s-{i}` is updated to include the new anchor nodes.

### Step 4 — Update Panel 1 and Info Box

Reflect the new `sigma0` in the `NumericalAccordion` cycle inputs (read-only display
while canvas accordion is open). Recompute and display updated topology metrics in
`InfoBox` (v, e, f, g, orbifold edge count).

---

## Stage 3: Simultaneous Mutation (Generalised Kaur Move)

### User Flow

1. "Select edges to mutate" toggle in Mutation controls enters multi-edge selection mode.
2. User clicks edges to toggle selection; each highlighted in `var(--highlight-color)`.
3. "Mutate selected" button becomes enabled once ≥ 1 edge is selected.
4. Animation generalises Stage 2 to the selected edge set.

---

## Canvas Edit Mode (Accordion B)

When accordion B ("Edit graph on canvas") is open:

- All content in accordion A (Numerical input) is disabled.
- Info box and Mutation controls remain active.
- Draw / Clear buttons are disabled (they live inside accordion A).
- There will be a Brauer graph data sotred in the background that keep track of the data shown on the canvas (it may not be a proper valid Brauer graph).
- Many of the actions to follow require a common last step in their procedure. We call this "tidy up of Brauer graph data". This means going through the entries of the $\sigma_0$, and flag any missing positive integer, and decrease the value of each positive entry $k$ from $k$ to $k-r$, where $r$ is the number of flagged positive integers smaller than $k$, and update $-k$ (if exists in $\sigma_0$) to $-(k-r)$. This will keep all the numbers appeared in $\sigma_0$ being in $\{\pm 1,\pm 2,\ldots, \pm n\}$ for some $n$. Now we renew the number `n` in the stored Brauer graph data to $n$. (During development phase, console log the resulting Brauer graph data.)

### Edit Buttons

**"Edit curve"**: enters curve-editing mode for `cytoscape-edge-editing`. User can drag anchor handles on connecting curves. Click background to exit.

**"Modify multiplicity"**:

- If a vertex node is already selected: open prompt and show current multiplicity assigned on the vertex, ask for a new multiplicity and default the input text to be the current multiplicity. Validate user input and change multiplicity on the vertex.
- If not: info bar shows _"Click on a vertex to change its multiplicity."_ → user clicks → carry out the same procedure as described in the previous point.

**"Remove arc/half-edge"**:

- If a connecting edge or a half-edge arm or an orbifold edge is already selected: remove the full edge (i.e. two half-edges, two anchors, one connecting edge for an ordinary Brauer graph edge, and half-edge + anchor + connecting edge + orbifold end for an orbifold edge) associated to it.
- If not: info bar shows _"Click an arc, or orbifold edge, or half-edge arm to remove it."_ → user clicks → remove.
- Record the removed edge(s):
  a. if these include `ce-orb-{h}`, then remove `h` from $\sigma_0$.
  b. if it includes `ce-{h}`, then remove `h` and `-h` from $\sigma_0$.
- Tidy up the Brauer graph data.
- Keyboard: if a connecting edge is selected, `Delete` or `Backspace` also triggers this.

**"Add vertex"**:

- Info bar shows _"Click an empty area to place a new vertex."_
- User clicks canvas. If click position is within `FAR_ENOUGH_PX` of any existing vertex centre: do nothing (show brief info bar message _"Too close to an existing vertex."_).
- Otherwise: open `Modal.svelte` prompting _"Number of half-edges for new vertex:"_ (positive integer input); the prompt includes an optional additional input of multiplicity of the vertex.
- On confirm: increment `n` by (the number of new half-edges), assign new half-edge integers, append a new cycle to `σ₀`, add a new entry to `multiplicity`, and draw the new star-shaped subgraph at the clicked position.
  For example, if before adding a vertex `n` is 5, and user input 4 to the prompt, then set `n=n+4=9`, and push `[k+1,k+2,k+3,k+4]` to $\sigma_0$, where `k` is the maximal positive integer appearing in $\sigma_0$ (before the addition of new vertex).

**"Remove vertex"**:

- Info bar shows _"Click a vertex to remove it."_
- User clicks vertex node `v-{i}`: remove `v-{i}`, all its anchor nodes (`u-*`), all half-edge arms (`he-*`), all connecting edges incident to those anchors.
- We take out the corresponding cycle (the $i$-th array) from `σ₀`, and check through its entries.
    - If there is an entry $h$ in this cycle and $-h$ is an entry in another cycle of $\sigma_0$, then we replace $-h$ by $m+1$, where $m$ is the maximal positive integer appearing in $\sigma_0$ (note $m$ may not be `n`). The corresponding `he-{s}{|h|}` and `u-{s}{h}` needs to be updated to `he-p{m+1}` and `u-p{m+1}` respectively (here `s` is the sign of $-h$). The connecting edge `ce-{h}` needs to be removed.
    - If both $h,-h$ are in the same cycle, then remove all their associated half-edge arms, anchor nodes, and connecting edge.
- Remove also the corresponding ($i$-th) entry from `multiplicity`.
- Perform tidy up of Brauer graph data.
- Keyboard: if a vertex node is selected, `Delete` or `Backspace` triggers this.

**"Reconnect arc"**:

- Info bar shows _"Click a source anchor node."_
- User clicks anchor `u-{s}{h}` (here `h` is a positive number and `s` is `p` or `m`) → it is highlighted.
- Info bar shows _"Click a target anchor node."_
- User clicks anchor `u-{s'}{h'}` (here `h'` is a positive number and `s'` is `p` or `m`).
- If `s=p` and `s'=p`. Let $x=\max\{h,h'\}$ and $y=\min\{h,h'\}$ (in JS: `let [x,y]=h>h'?[h,h']:[h',h];`). Then we replace $x$ in $\sigma_0$ by $-y$, rename `he-p{y}` and `u-p{y}` by `he-m{x}` and `u-m{x}`. Now remove any connecting edge `ce-{h}` and `ce-{h'}` (if they exist) and create a new connecting edge `ce-{x}`.
- If `s=p` and `s'=m`, then replace the number `h'` in $\sigma_0$ by `-h`, rename `he-m{h'}` and `u-m{h'}` by `he-m{h}` and `u-m{h}` respectively, and then remove the connecting edge `ce-{h'}` and create a new connecting edge `ce-{h}`.
- If `s=m` and `s'=p`, then replace the number `h` in $\sigma_0$ by `-h'`, rename `he-m{h}` and `u-m{h}` by `he-m{h'}` and `u-m{h'}` respecitvely, and then remove the connecint edge `ce-{h}` and create a new connecting edge `ce-{h'}`.
- If `s=m` and `s'=m`, then replace the number `h` and `h'` in $\sigma_0$ by `n+1` and `-(n+1)` respectively, rename `he-m{h}`, `u-m{h}`, `he-m{h'}`, `u-m{h'}` by `he-p{n+1}`, `u-p{n+1}`, `he-m{n+1}`, `u-m{n+1}` respecitvely, create new connecting edge `ce-{n+1}`.
- Perform tidy up of Brauer graph data.
- Keyboard (tablet/mobile): selecting an anchor node is understood as initiating this flow.

**"Add orbifold edge"**:

- Info bar shows _"Select half-edge to be orbifold"_
- User click on the body of a half-edge arm `he-{h}` or corresponding anchor `u-{h}`, then check if it is connected to any connecting arc. If it is, then show a warning telling the user to select a half-edge that is not connected to anywhere. If it is dangling, which also means that `h>0`, then create an orbifold end node `orb-x{h}` (for position, see graph geneartion in the numerical input part) and connects `u-p{h}` to `orb-x{h}`. Update the `orbifoldEdges` array by inserting `{e}`.

### Ordering of half-edges within a new star

New anchor nodes in a freshly added star are placed in clockwise order starting from north, evenly spaced. The clockwise order around the canvas defines the initial σ₀ cycle ordering. (The user can edit the cycle text in accordion A after exiting accordion B to reorder.)

---

## Stretch Goal: TikZ Export

- "Export to TikZ" button in Panel 1 (below Save/Load).
- Generates a `tikzpicture` environment: vertex positions (scaled), half-edge arms, Bezier control points, cyclic ordering arrows (if toggled on), orbifold crosses, edge labels and multiplicity labels (if toggled on).
- Output in a `<textarea>` with copy button; also offered as `.tex` file download.

---

## Non-Functional Requirements

| Concern         | Requirement                                                           |
| --------------- | --------------------------------------------------------------------- |
| Hosting         | GitHub Pages via `@sveltejs/adapter-static`; `base` path = repo name  |
| Responsiveness  | Side-by-side desktop; slide-in drawer tablet; stacked mobile          |
| Styling         | Academic; light and dark mode; CSS custom properties throughout       |
| Accessibility   | Tooltip tap equivalent; keyboard triggers for Remove arc/vertex       |
| Performance     | Smooth canvas interaction; animation up to ~20 edges                  |
| Browser support | Modern evergreen browsers (Chrome, Firefox, Safari, Edge)             |
| Persistence     | Theme to `localStorage`; graph data to JSON file download/upload only |

---

## Open Questions

1. **Surface drawing** — long-term; format TBD.
2. **Animation speed** — default ~1 s total; expose `ANIMATION_TOTAL_MS` and `ANIMATION_PAUSE_MS` in `constants.ts` for tuning during development.

---

## Function List for `ribbon.ts` and `kaur.ts`

The lists below are inferred from all spec sections. Functions marked _(implied)_ are not
explicitly named but are clearly required by the described behaviour.

---

### `src/lib/math/ribbon.ts`

Responsibility: σ₀/σ₁ utilities, H computation, topology metrics, validation.

```ts
// Compute the full half-edge set H from n and orbifoldEdges.
function computeH(n: number, orbifoldEdges?: number[]): number[];

// σ₁ for a single half-edge (derived, never stored).
function sigma1(h: number, orbifoldEdges: number[]): number;

// Build a Map<h, successor> from σ₀ cycles (forward direction).
function buildSigma0Map(sigma0: number[][]): Map<number, number>; // (implied)

// Build a Map<h, predecessor> from σ₀ cycles (inverse direction).
function buildSigma0InverseMap(sigma0: number[][]): Map<number, number>; // (implied)

// Compute σ₀ orbit (face) as σ₁ ∘ σ₀ — returns all face cycles.
function computeFaces(sigma0: number[][], orbifoldEdges: number[]): number[][]; // (implied)

// For each ordinary edge index i, return the source vertices of +i and -i.
// For orbifold edge i, returns [a, a] where a is the source vertex of +i.
function computeHalfedgeSourcePairs(
    graph: BrauerGraph,
): Array<[positiveSource: number, negativeSource: number]>;

// Returns true if the half-edge h belongs to an ordinary (non-orbifold) edge,
// i.e. σ₁(h) = -h.  Equivalently, |h| is not in orbifoldEdges.
// h must be a non-zero integer in H; orbifoldEdges must contain only positive integers.
function isOrdinary(h: number, orbifoldEdges: number[]): boolean;

// Validate a BrauerGraph; returns per-field error messages or an empty array.
function validateBrauerGraph(graph: BrauerGraph): ValidationError[];

// Compute topology metrics for the InfoBox: v, e, f, g, orbifold count, connected flag.
function computeTopologyMetrics(graph: BrauerGraph): TopologyMetrics;

// Check whether the ribbon graph is connected (σ₀ and σ₁ generate a transitive action on H).
function isConnected(sigma0: number[][], orbifoldEdges: number[]): boolean; // (implied)
```

---

### `src/lib/math/kaur.ts`

Responsibility: Kaur move combinatorial logic — fan decomposition, left/right σ₀ mutation.

```ts
// A fan: a maximal consecutive run of selected half-edges within one σ₀ cycle.
interface Fan {
    elements: number[]; // ordered h_{i,1} … h_{i,k+1}
    isFullCycle: boolean; // true when the entire σ₀ cycle is selected (Rule 1)
    cycleIndex: number;
    startIndex: number; // if isFullCycle, then startIndex is 0, endIndex=cycle.length-1
    endIndex: number; // possible that this is less than startIndex, since each array in sigma_0 encodes a cycle, not a linear list
}

// Decompose the selected half-edges into fans.
// `selected` is the union of all half-edges in the chosen σ₁-orbits (X̃).
function computeFans(sigma0: number[][], selected: Set<number>): Fan[];

// Apply left mutation μ⁻ to sigma0 given the fan decomposition.
// Returns a new sigma0 array; does not mutate the input.
function applyLeftMutation(
    sigma0: number[][],
    fans: Fan[],
    orbifoldEdges: number[],
): number[][];

// Apply right mutation μ⁺ to sigma0 given the fan decomposition.
// Returns a new sigma0 array; does not mutate the input.
function applyRightMutation(
    sigma0: number[][],
    fans: Fan[],
    orbifoldEdges: number[],
): number[][];

// Convenience wrapper: run left mutation on a BrauerGraph for a set of selected edges.
// selectedEdgeHalfEdges: the Set of all half-edges h such that the σ₁-orbit of h is selected.
function mutateLeft(
    graph: BrauerGraph,
    selectedEdgeHalfEdges: Set<number>,
): BrauerGraph; // (implied)

// Convenience wrapper for right mutation.
function mutateRight(
    graph: BrauerGraph,
    selectedEdgeHalfEdges: Set<number>,
): BrauerGraph; // (implied)

// Identify which vertices (by σ₀ cycle index) have changed between oldSigma0 and newSigma0.
// Used by "Graph Update After Animation" Step 2.
function changedVertices(
    oldSigma0: number[][],
    newSigma0: number[][],
): number[]; // (implied)
```

---
