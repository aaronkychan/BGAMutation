# Cytoscape Rendering, IDs, Layout, and Styling

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
| `ce-orb-{h}`            | `ce-orb-3`               | Connecting segment for orbifold edge (`u-p{h}` to `orb-x{h}`)                          |
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
export const BEZIER_CONTROL_LENGTH = ARM_LENGTH * 1.8; // px - default control length for Arm-Tangent Bezier Construction
```

At degree 10, gap between adjacent anchor nodes ≈ 11.7 px — distinguishable but tight. Increasing `ARM_LENGTH` is the primary tuning lever.

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

This equal-spacing formula is only the initial/default geometry. Once the graph is on the
canvas, anchor and orbifold-end positions are live canvas state. Canvas Edit angle
adjustments, vertex rotation, save/load, and mutation updates must preserve or explicitly
transform existing anchor positions instead of regenerating equal spacing around the
vertex.

### Drag Re-sync

Listen to drag events on vertex nodes, anchor nodes, and orbifold-end nodes. Outside dedicated angle-adjustment mode, compute the translation delta $(\Delta x, \Delta y)$ from the dragged node's old position and apply it rigidly to all other nodes in the same $S(v_i)$. Do not re-run any layout. After each rigid star translation, recompute Arm-Tangent Bezier Construction control data for ordinary connecting edges incident to the moved star, using the current vertex and anchor positions.

Compound nodes (`s-{i}`) group $v_i$ and its leaves logically. Apply compound structure **after** initial position assignment, not during it.

### Node Rendering

**Vertex nodes** (`v-{i}`):

- $m_i = 1$: hollow circle — background fill, solid border (`var(--vertex-hollow-border)`).
- $m_i > 1$: filled circle — `var(--vertex-filled)`.

**Multiplicity tooltip** (`Tooltip.svelte`): on `mouseover` / `tap` on any vertex node, show a floating `<div>` near the cursor with "Multiplicity: $m_i$". Visible regardless of the multiplicity-label toggle.

**Multiplicity labels** (display toggle "Multiplicity labels"): when on, show $m_i$ centred inside every vertex node, including vertices with $m_i = 1$. The label colour must contrast with the vertex fill: filled vertices use the canvas/background colour for text, and hollow vertices use the vertex fill/border colour.

**Anchor nodes** (`u-p{h}`, `u-m{h}`):

- Normal state: invisible. Selectable by Cytoscape for internal logic but not visible to the user.
- Debug state: dashed hollow circle, radius `ANCHOR_RADIUS`.
- Half-edge arms and connecting edges must visually meet at the anchor. Do not render an anchor-sized visible gap between `he-*` and `ce-*`; any debug anchor styling must be opt-in and disabled for normal use.
- Dragging an anchor node must never change the half-edge arm length by itself. Outside dedicated angle-adjustment mode, dragging any vertex, anchor, or orbifold end in a star-shaped subgraph $S(v_i)$ translates the whole star rigidly.

```ts
// DEBUG: change opacity to 0 before publishing
'.u-node': { opacity: 1, ... }
```

**Half-edge labels** (display toggle "Half-edge labels"): when on, the integer $h$ (with sign) is displayed as a text label adjacent to the anchor node `u-p{h}` or `u-m{h}`. Use Cytoscape's `label` property on the anchor node, rendered in monospace font, small size.

**Orbifold ends** (`orb-x{h}`): rendered as a cross (×) using an inline SVG set as `background-image` on the Cytoscape node. Coloured `var(--orbifold-color)`. Sized similarly to a vertex circle.

### Edge Rendering

**Half-edge arms** (`he-p{h}`, `he-m{h}`): straight Cytoscape edges from the vertex node to the anchor node. `curve-style: none` (straight). All share `edgeId` data attribute for the logical edge they belong to. In the cytoscape data, this have source `v-{i}` and target `u-p{h}` (or `u-m{h}`).

**Ordinary connecting edge** (`ce-{h}`): Bezier curve between `u-p{h}` and `u-m{h}` (i.e. between the two anchors of the paired half-edges). `curve-style: unbundled-bezier`. In Cytoscape data, we use the convention that source is `u-p{h}` and target is `u-m{h}`. User-edited curvature is stored directly on the edge with `controlPointDistances` and `controlPointWeights`.

#### Arm-Tangent Bezier Construction

Whenever an ordinary connecting edge `ce-{h}` is created automatically, use the **Arm-Tangent Bezier Construction**:

1. Let the source anchor be `u-p{h}` and the target anchor be `u-m{h}`.
2. At `u-p{h}`, choose the first Bezier control direction to agree with the outgoing direction of the half-edge arm `he-p{h}` from its vertex node to `u-p{h}`.
3. At `u-m{h}`, choose the second Bezier control direction to agree with the outgoing direction of the half-edge arm `he-m{h}` from its vertex node to `u-m{h}`.
4. Use `BEZIER_CONTROL_LENGTH` as the initial length of both Bezier controls. The default is longer than `ARM_LENGTH` so the connecting curve follows the half-edge arm direction before it begins turning.
5. If `h` and `-h` are attached to the same vertex and their half-edge arms point in opposite directions through the vertex centre, the two tangent controls are collinear with the source-target chord and the connecting curve can become visually hidden behind the arms. In this straight-through case, insert a third middle Bezier control at weight `0.5` with perpendicular distance `BEZIER_CONTROL_LENGTH`, so the ordinary connecting edge visibly bows to one side while preserving the endpoint tangent controls.
6. Store the resulting Cytoscape control-point data on the connecting edge so later editing and save/load can preserve or restore it.

This procedure applies when drawing a graph from numerical input and whenever Canvas Edit creates or replaces an ordinary connecting edge, including the `"Reconnect arc"` flow.

**Orbifold connecting edge** (`ce-orb-{h}`): straight segment from `u-p{h}` to `orb-x{h}`. Length being twice of `ARM_LENGTH`. No Bezier handles.

**Edge click detection**: clicking any Cytoscape element with a given `edgeId` selects the whole logical edge. Half-edge arms, anchor nodes (when visible), and connecting curves all carry the same `edgeId`.

**Edge labels** (display toggle "Edge labels"): when on, show `[i]` at the midpoint of each connecting edge (`ce-{h}` and `ce-orb-{h}`), where `i` is the positive half-edge index. Use Cytoscape's `label` property on the connecting edge element. Monospace font.

### Cyclic Ordering Arrows (display toggle "Cyclic ordering arrows")

For each consecutive pair $(a_j^i, a_{j+1}^i)$ in a cycle (including wrap-around $(a_{last}^i, a_1^i)$):

- Create invisible, non-selectable arrow-only points on the circle of radius `ARM_LENGTH` around the associated vertex centre. These points are separate from anchor nodes, whose radius from the vertex centre is `VERTEX_RADIUS + ARM_LENGTH`.
- Draw a directed Cytoscape edge `arr-{s1}{h1}-{s2}{h2}` between the arrow-only points for $a_j^i$ and $a_{j+1}^i$.
- The arrow should approximate the corresponding circular arc. If the vertex valency is $n$, each cyclic ordering arrow around it has arc length $2\pi \cdot \texttt{ARM_LENGTH}/n$.
- `curve-style: unbundled-bezier`, colour `var(--arrow-color)`, dashed stroke.
- Valency 2: each cyclic ordering arrow is a semicircle, so draw it as two quarter-arc segments with an invisible midpoint on the `ARM_LENGTH` circle. Put the arrowhead only on the second segment. Do not draw a single quadratic Bezier for this case, because it looks parabolic rather than circular.
- Singleton cycle: approximate the full circular ordering arrow by four quarter-arc segments on the same `ARM_LENGTH` radius circle, with the arrowhead only on the final segment.
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
    edgeAnchors: {}, // reserved for future curve-edit metadata
};
```

Bezier control data is stored directly on Cytoscape edge data and is therefore preserved by the Cytoscape JSON snapshot. `edgeAnchors` is currently reserved for future curve-edit metadata.

**Load**: Restore `cy.json(cytoscapeJson)` then call `cy.layout({ name: 'preset' }).run()` to honour saved positions and saved edge-control data.

**Export / Import**: `fileio.ts` wraps `SavedFile[]` in a JSON file download / `FileReader` upload.

---
