# Canonical Implementation Decisions

This file records cross-cutting decisions extracted from the full specification. Keep this file small. If another spec file conflicts with it, this file wins until the conflict is resolved.

## Mathematical Model

- `n` is the total number of ordinary and orbifold edge labels, i.e. the positive edge-label range `1..n`.
- For each orbifold edge `i`, the negative half-edge `-i` is excluded from `H`; the positive half-edge `+i` remains.
- `sigma1` is derived from `n` and `orbifoldEdges`; it is never stored.
- `sigma0` must partition `H` exactly for a valid graph.
- Multiplicities are positive integers indexed by `sigma0` cycle position.
- Mutation changes the underlying ribbon/orbifold graph; vertex multiplicities stay unchanged.

## Derived Data

- Half-edge source data is derived from `BrauerGraph`, not stored on `BrauerGraph`.
- Use numeric vertex indices in math helpers. Convert to Cytoscape IDs only in graph/rendering code.
- `computeHalfedgeSourcePairs(graph)` returns one tuple per positive edge label. For orbifold edge `i`, return `[a, a]`, where `a` is the source vertex of `+i`.

## Canvas State Isolation

- The Cytoscape canvas is not a reactive rendering of `graphState.graph`.
- `graphState.graph` stores confirmed mathematical graph data for controls, validation, save/load, and topology display.
- The canvas owns live Cytoscape state: vertex positions, pan/zoom, anchor positions, temporary animation styles, and edge-control data.
- Graph-changing UI flows must use explicit canvas commands:
  - draw a validated initial graph,
  - clear the canvas,
  - load a saved Cytoscape snapshot,
  - apply a confirmed mutation to the existing Cytoscape instance.
- After an imperative canvas update succeeds, publish the new `BrauerGraph` to mathematical state. The publication must not trigger a Cytoscape redraw.
- Full initial layout may run only for explicit draw-from-input/redraw operations, not as a side effect of mutation or a graph-state assignment.

## Rendering IDs

- All Cytoscape IDs are constructed in `src/lib/graph/ids.ts`; no other file should concatenate IDs manually.
- The canonical orbifold end node ID is `orb-x{h}`.
- Ordinary connecting edges are keyed by positive edge label as `ce-{h}`.
- Orbifold connecting edges are keyed as `ce-orb-{h}`.

## Implementation Reference Policy

- For math utilities and validation, read `01-data-model.md` and this file.
- For Kaur mutation, read `02-mutation.md`, `01-data-model.md`, and this file.
- For Cytoscape rendering, read `03-rendering.md`, `01-data-model.md`, and this file.
- For UI work, read `04-ui.md` plus the focused spec for the behavior being wired.
- For animation, read `05-animation.md`, `02-mutation.md`, and this file.
- For canvas editing, read `06-canvas-editing.md`, `03-rendering.md`, and this file.
