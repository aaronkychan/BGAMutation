# Mutation Animation

This file contains the animation-specific parts of Stage 2. For the combinatorial mutation rules, see `02-mutation.md`.

## Stage 2: Irreducible Mutation (Kaur Move)

### Stage Dependencies

Animation is visual only. It must not discard current graph-editing state:

- Use current Cytoscape elements and positions as the animation source of truth.
- Do not re-run initial layout before or after animation.
- After animation, apply the graph update rules in `02-mutation.md`, including preservation of user-positioned vertices, adjusted arm angles, and existing ordinary-edge Bezier controls where applicable.
- Any ordinary connecting edge created by the post-animation update must use Arm-Tangent Bezier Construction from `03-rendering.md` unless restoring a saved/user-edited control.
- Restore temporary animation styles without overwriting display-toggle labels/classes, stored Bezier control data, or Canvas Edit mode selection state.

### User Flow

1. User clicks "Mutate edge" (in Mutation controls, Panel 1).
2. Canvas enters single-edge selection mode. The floating info bar in Panel 2 shows: _"Click an edge to mutate it."_
3. While in this selection mode, hovering over any edge component with an `edgeId` shows a pointer cursor.
4. User clicks any component (half-edge arm, anchor, or connecting arc) of an edge $X$ — identified by `edgeId`.
5. Before colour-flow animation starts, thicken all full edges involved in the local move: the selected edge $X$, plus the previous full edge(s) in the cyclic ordering at the endpoint vertices for left mutation, or the next full edge(s) for right mutation. For ordinary selected edges this normally means two or three full edges total. Do not leave neighbouring edges colour-filled at this stage.
6. Show a temporary canvas info message: _"Invovled edges highlighted"_.
7. Blink the involved full edges twice in the normal edge colour by toggling opacity, then restore normal visibility while keeping the thickened widths.
8. Show _"Concatenating arcs"_ while the colour-flow animation plays automatically (Phase 1-3 below).
9. On animation completion, show a temporary canvas info message: _"Graph updated"_.
10. Pause for `ANIMATION_POST_MS`; during this pause, keep the neighbouring full edges in their orange/green neighbour colours instead of restoring the whole graph to grey.
11. The existing Cytoscape canvas is updated imperatively with the updated $\sigma_0$ (Step 1-4 in `02-mutation.md`). Do not redraw from initial layout or use reactive mathematical state assignment to drive the canvas.
12. Immediately apply the same neighbouring full-edge colours to the updated Cytoscape elements, keep them colour-filled for `ANIMATION_POST_UPDATE_COLOR_MS`, then clear them back to the normal stylesheet colour.

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

Mutation animation uses three flow colours:

- `--highlight-color` for the selected full edge and its endpoint arms.
- `--mutation-neighbor-a-color` for the neighbour flow from one endpoint side.
- `--mutation-neighbor-b-color` for the neighbour flow from the other endpoint side.

The selected edge endpoint vertex nodes are temporarily coloured with `--highlight-color`
after Phase 2 finishes, so the two endpoint vertices of the edge being mutated are visible
during the neighbouring-edge flow. After the neighbouring-edge flow finishes, temporarily
colour the vertex nodes at the other endpoints of those neighbouring edges with their
neighbour-side colours. These temporary vertex colours must preserve multiplicity
rendering: colour only the vertex border, leaving the background fill unchanged. Thus
hollow vertices remain hollow and filled higher-multiplicity vertices remain filled.

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
export const ANIMATION_POST_MS = 1000; // pause after animation before graph update
export const ANIMATION_INVOLVED_EDGE_PAUSE_MS = 450; // pause after thickening involved edges
export const ANIMATION_SELECTED_EDGE_PAUSE_MS = 550; // pause after the selected full edge has changed colour
export const ANIMATION_INVOLVED_EDGE_BLINK_MS = 420; // half-period for two involved-edge opacity blinks
export const ANIMATION_FINAL_VERTEX_PAUSE_MS = 1800; // pause after final endpoint vertices are coloured
export const ANIMATION_POST_UPDATE_COLOR_MS = 2000; // keep neighbour colours after graph update
// Phase durations (adjust ratios as needed):
export const ANIMATION_PHASE1_MS = Math.round(ANIMATION_TOTAL_MS * 0.25);
export const ANIMATION_PHASE2_MS = Math.round(ANIMATION_TOTAL_MS * 0.25);
export const ANIMATION_PHASE3_MS = Math.round(ANIMATION_TOTAL_MS * 0.5);
export const ANIMATION_NEIGHBOR_PHASE_MS = ANIMATION_PHASE3_MS * 2;
// Phase 3 neighbour sub-flow: 3 sequential edges each get 1/3 of ANIMATION_NEIGHBOR_PHASE_MS
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

Note: the flow on the half-edge arms stops upon reaching the vertex node end of the arm.
After Phase 2 finishes, the endpoint vertex node borders are temporarily coloured as
described above, preserving whether each vertex is hollow or filled.

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
neighbouring edges begin changing. At this point, also temporarily colour the endpoint
vertex nodes of the selected edge with the selected-edge flow colour.

### Phase 3 — Highlight spreads outward through neighbouring edge(s) for each fan

Triggered when Phase 2 completes.

For each fan $\mathcal{X}_i$ where Rule 2 applies (i.e. $e_i \notin \widetilde{\mathcal{X}}$,
meaning left mutation actually modifies the cyclic ordering for this fan):

For animation, determine neighbouring flow sides from the selected endpoint half-edges,
not from the fan list. For each selected half-edge $x \in X$, scan in the mutation
direction to the first non-selected half-edge: use repeated $\sigma_0^{-1}$ for left
mutation and repeated $\sigma_0$ for right mutation.
This preserves two coloured neighbouring-side flows for an ordinary selected edge even
when fan decomposition merges adjacent selected half-edges or when the immediate
neighbour of one endpoint is the other selected endpoint.
For the corresponding fan-rule notation, this agrees with $e_i=\sigma_0^{-1}(h_{i,1})$
for left mutation and $e_i=\sigma_0(h_{i,k+1})$ for right mutation whenever that fan side
is non-degenerate.
Let $V(e_x)$ denote the vertex node of the vertex whose $\sigma_0$-cycle contains $e_x$.

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

If the two neighbouring full edges identified from the two sides of an ordinary selected
edge are the same full edge, the neighbouring flow stops in that shared edge. In that
case, do not continue the flow through the opposite half-edge arm after animating the
shared connecting edge.

If $e_i$ is an **orbifold half-edge** ($e_i \in$ `orbifoldEdges`, so $\sigma_1(e_i) = e_i$):
animate `ce-orb-{e_i}` from the `u-p{e_i}` end outward toward `orb-x{e_i}` in the
neighbour-side colour. Then pulse the orbifold cross `orb-x{e_i}`. Finally animate the
same element back `'reverse'` (returning from cross toward anchor) in the selected-edge
colour to distinguish the wrap-around pass from a plain bounce. After the backward pass,
hold the orbifold connecting edge in the neighbour-side colour for the post-update colour
hold. These three mini-steps count together as Step 3b.

**Step 3c** (ordinary case only) — `he-{tag(-e_i)}`: flow from anchor `u-{tag(-e_i)}`
end toward vertex $V(-e_i)$. Cytoscape source = $V(-e_i)$, target = anchor → `'reverse'`.

The neighbouring side sub-flows run simultaneously, one for each endpoint side.

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
                    ANIMATION_NEIGHBOR_PHASE_MS / 3,
                ),
            () =>
                animateStep3b(
                    fan,
                    edgeColor,
                    highlightColor,
                    ANIMATION_NEIGHBOR_PHASE_MS / 3,
                ),
            () =>
                isOrdinary(ei, graph.orbifoldEdges) && heNEi
                    ? animateEdge(
                          heNEi,
                          "reverse",
                          edgeColor,
                          highlightColor,
                          ANIMATION_NEIGHBOR_PHASE_MS / 3,
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
