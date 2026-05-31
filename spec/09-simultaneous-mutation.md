# Simultaneous Mutation Implementation Spec

This file is the implementation-oriented plan for Stage 3 simultaneous mutation. It
extends the irreducible mutation workflow from `02-mutation.md`, `04-ui.md`, and
`05-animation.md` from one selected full edge to a selected set of full edges.

The goal is not to perform a sequence of single-edge mutations. A simultaneous
mutation is one mathematical operation on the selected set.

## Scope

Simultaneous mutation allows the user to select multiple ordinary and/or orbifold
edges and then apply one left or right Kaur mutation to the whole selected set.

The operation must:

- mutate the selected set once, using the fan decomposition of the selected
  half-edges;
- preserve the current canvas state as far as the operation allows;
- update the Cytoscape graph imperatively after the mathematical mutation is
  confirmed;
- create exactly one undo snapshot for the whole simultaneous mutation;
- remain disabled when the current graph is not a valid ribbon or orbifold
  ribbon graph.

## Existing Implementation Shape

The current mathematical implementation is already close to the desired API:

- `src/lib/math/kaur.ts` accepts `selected: Set<number>`.
- `edgeOrbit(edge, orbifoldEdges)` expands a full edge into `{h, -h}` for an
  ordinary edge and `{h}` for an orbifold edge.
- `computeFans(sigma0, selected)` computes maximal selected runs in each
  `sigma0` cycle.
- `mutateGraph(graph, selected, direction)` applies the primed-edge insertion
  model to all selected fans.

The current UI and animation are still single-edge oriented:

- mutation controls enter a mode where the next clicked edge mutates
  immediately;
- `DisplayPanel.svelte` stores only the clicked edge for the operation;
- `animateMutation` accepts a single selected edge and derives the neighbouring
  edges from that edge.

Therefore the main implementation work is selection state, animation
generalisation, and verification of multi-fan combinatorics.

## Mathematical Validation Requirements

Before changing the UI, add focused tests for `mutateGraph` with selected sets
containing more than one full edge.

Required cases:

- disjoint selected edges whose incident vertices do not overlap;
- adjacent selected edges in the same `sigma0` cycle;
- two selected ordinary edges sharing a vertex;
- selected half-edges forming a full selected `sigma0` cycle;
- an orbifold edge selected together with an adjacent ordinary edge;
- multiple selected fans inserting into the same target cycle;
- a selected fan whose insertion target is affected by another selected fan;
- all full edges in a small connected component selected at once.

The tests should assert the final `sigma0`, `orbifoldEdges`, and multiplicities.
They should also check that left and right simultaneous mutation behave as
inverse operations on representative valid examples where the inverse is defined.

The highest-risk mathematical issue is order dependence. Processing fans
sequentially must not make the result depend on the order in which fans are
enumerated. If order dependence appears, compute all removals and all primed
insertions from one immutable pre-mutation snapshot, then assemble the new cycles
from that snapshot.

## Selection Model

Do not mutate on edge click in simultaneous mode. Split the workflow into:

1. Enter simultaneous mutation selection mode.
2. Toggle selected full edges on canvas.
3. Apply left or right mutation to the selected set.
4. Clear the selection after successful mutation or cancellation.

Selection state should store full-edge representatives, preferably positive edge
ids, and derive the selected half-edge set only when applying mutation:

```ts
const selectedHalfEdges = union(edgeOrbit(edge, graph.orbifoldEdges) for edge in selectedEdges);
```

Selection must clear when:

- the graph changes by mutation or canvas editing;
- the graph is redrawn from numerical input;
- the user presses Esc;
- the user exits simultaneous mutation mode.

Selected-edge styling must be visually distinct from:

- hover state;
- ordinary canvas-edit selection;
- mutation animation colors;
- temporary thickening/highlighting of involved edges.

## UI Requirements

The Stage 3 UI should avoid accidental mutation.

Recommended workflow:

- keep separate left and right directions explicit;
- provide an explicit apply action, such as `Apply left to selected` and
  `Apply right to selected`, or a direction selector plus `Mutate selected`;
- disable apply actions until at least one edge is selected;
- show an info box message while selecting, for example:
  `Select edges to mutate; click selected edge again to deselect`;
- show the selected count in the mutation controls.

The current single-edge irreducible mutation may remain available, but its click
to mutate behavior must not be reused for simultaneous mutation.

## Validity Rules

Mutation controls must remain disabled when the current canvas graph is not a
valid ribbon or orbifold ribbon graph.

Simultaneous mutation additionally requires:

- every selected edge id still exists in the current graph;
- ordinary selected edges contribute both half-edges `{h, -h}`;
- orbifold selected edges contribute the singleton `{h}`;
- stale selected ids are discarded when the graph changes;
- mutation is blocked if the selected set is empty.

No partial graph edit should bypass these guards.

## Canvas Update Requirements

The canvas update must follow the existing isolation rule:

1. Compute the new mathematical graph.
2. Confirm the computation succeeds.
3. Animate using the pre-mutation canvas state.
4. Imperatively update the existing Cytoscape graph.
5. Publish the confirmed graph to shared app state.

Do not re-run full initial layout after mutation.

The in-place update must preserve:

- vertex positions for unchanged vertices;
- manually adjusted half-edge arm angles where possible;
- current global arm length;
- orbifold-end positions where the orbifold edge survives;
- user-edited ordinary-edge Bezier controls for unaffected arcs.

Special care is required when several selected arms are removed and reinserted
around the same vertex. Inserted arms should be placed in the sectors determined
by the primed insertion rule, not evenly redistributed around the vertex.

## Animation Requirements

The existing animation is single-edge oriented and should be refactored before
being reused for simultaneous mutation.

A simultaneous animation should accept:

- `selectedEdges: Set<number>` or `number[]`;
- the derived selected half-edge set;
- mutation direction;
- precomputed involved boundary edges if useful.

Recommended first animation version:

1. Blink all involved selected and boundary edges in neutral/original color.
2. Flow all selected connecting edges simultaneously.
3. Color endpoint vertices of selected edges, preserving hollow/solid vertex
   style according to multiplicity.
4. Flow all neighbouring boundary edges.
5. Color the other endpoint vertices of those boundary edges.
6. Pause before graph update.
7. Carry neighbour colors through the graph update briefly, then return the
   whole graph to normal grey.

The difficult cases are:

- the same neighbouring edge appears from two selected fans;
- a neighbouring edge is also selected;
- more boundary edges exist than the current two-neighbour color scheme;
- an orbifold edge participates in selected or neighbouring flow;
- several animations target the same vertex or edge at the same time.

For the first implementation, prefer a conservative visual rule over a complex
one. For example, selected edges can share one selected-flow color, while all
boundary neighbours cycle through a small fixed palette. If an edge belongs to
multiple animation roles, selected-edge status should take precedence.

## Undo

Push exactly one undo snapshot immediately before the simultaneous mutation
becomes user-visible. Undo must restore the graph and canvas state from before
the whole operation, not step through selected edges one by one.

## Implementation Order

1. Add pure math tests for multi-edge selected sets.
2. Audit `mutateGraph` for fan order dependence and fix only if tests expose it.
3. Add mutation-selection state without changing the mathematical algorithm.
4. Add selected-edge canvas styling and Esc cancellation.
5. Add explicit apply-left/apply-right controls for the selected set.
6. Generalise or replace mutation animation for selected sets.
7. Wire the in-place graph update using the selected half-edge set.
8. Add browser/UI smoke tests for selecting, deselecting, applying, cancelling,
   invalid-graph disabling, and undo.

## Non-Goals

- Do not implement simultaneous mutation as repeated irreducible mutation.
- Do not redraw the whole canvas from numerical data after mutation.
- Do not introduce free-form Bezier-anchor editing as part of this feature.
- Do not allow mutation on invalid partial graphs.
- Do not make Delete or Backspace globally mutate/remove selected graph elements.

