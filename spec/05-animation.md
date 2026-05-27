# Mutation Animation

This file contains the animation-specific parts of Stage 2. For the combinatorial mutation rules, see `02-mutation.md`.

## Stage 2: Irreducible Mutation (Kaur Move)

### Stage Dependencies

Animation is visual only. It must not discard current graph-editing state:

- Use current Cytoscape elements and positions as the animation source of truth.
- Do not re-run initial layout before or after animation.
- After animation, apply the graph update rules in `02-mutation.md`, including preservation of user-positioned vertices, adjusted arm angles, and existing ordinary-edge Bezier controls where applicable.
- Any ordinary connecting edge created by the post-animation update must use Arm-Tangent Bezier Construction from `03-rendering.md` unless restoring a saved/user-edited control.
- Restore temporary animation styles without overwriting display-toggle labels/classes, edge-editing control data, or Canvas Edit mode selection state.

### User Flow

1. User clicks "Mutate edge" (in Mutation controls, Panel 1).
2. Canvas enters single-edge selection mode. The floating info bar in Panel 2 shows: _"Click an edge to mutate it."_
3. While in this selection mode, hovering over any edge component with an `edgeId` shows a pointer cursor.
4. User clicks any component (half-edge arm, anchor, or connecting arc) of an edge $X$ — identified by `edgeId`.
5. Before colour-flow animation starts, thicken all full edges involved in the local move: the selected edge $X$, plus the next full edge(s) in the cyclic ordering at the endpoint vertices for left mutation, or the previous full edge(s) for right mutation. For ordinary selected edges this normally means two or three full edges total.
6. Pause briefly with those involved edges thickened.
7. Animation plays automatically (Phase 1-3 below).
8. On completion, the graph is redrawn with the updated $\sigma_0$ (Step 1-4 below). The description of the new $\sigma_0$ is described in the "Mutation algorithm" section.

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
export const ANIMATION_TOTAL_MS = 2400; // total; tune during development
export const ANIMATION_POST_MS = 500; // pause after animation before graph update
export const ANIMATION_INVOLVED_EDGE_PAUSE_MS = 450; // pause after thickening involved edges
export const ANIMATION_SELECTED_EDGE_PAUSE_MS = 550; // pause after the selected full edge has changed colour
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

Pause for `ANIMATION_SELECTED_EDGE_PAUSE_MS` after Phase 2, so the whole selected edge
(connecting arc plus half-edge arms) visibly reaches the highlight colour before
neighbouring edges begin changing.

### Phase 3 — Highlight spreads outward through neighbouring edge(s) for each fan

Triggered when Phase 2 completes.

For each fan $\mathcal{X}_i$ where Rule 2 applies (i.e. $e_i \notin \widetilde{\mathcal{X}}$,
meaning left mutation actually modifies the cyclic ordering for this fan):

For animation, let $e_i = \sigma_0(h_{i,k+1})$ for left mutation, and $e_i=\sigma_0^{-1}(h_{i,1})$ for right mutation; these are the next and previous half-edges adjacent to the fan in the direction the user expects to inspect visually.
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
