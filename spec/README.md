# BGAMutation Specification Index

This directory splits the original project specification into task-scoped reference files. Use the smallest relevant file set for implementation work.

- Canonical cross-cutting decisions: `00-decisions.md`
- Data model, validation, examples, and math helpers: `01-data-model.md`
- Kaur mutation and graph-update logic: `02-mutation.md`
- Cytoscape IDs, rendering, layout, styling, and visual constants: `03-rendering.md`
- UI layout, controls, accessibility, and non-functional requirements: `04-ui.md`
- Mutation animation details: `05-animation.md`
- Canvas editing operations: `06-canvas-editing.md`
- Save/load JSON behavior: `07-save-load.md`
- Build, dependency, and GitHub Pages setup: `08-deployment.md`
- Simultaneous mutation implementation plan: `09-simultaneous-mutation.md`
- Later work and unresolved topics: `backlog.md`
- Exact archived source document: `original-full-spec.md`

If a focused spec conflicts with `00-decisions.md`, `00-decisions.md` is authoritative until the conflict is explicitly resolved.

## Cross-Stage Implementation Dependencies

Before starting Stage 2 mutation, animation, save/load, or later canvas-editing work, implementers must account for the rendering and edit-state invariants introduced in `03-rendering.md`, `04-ui.md`, and `06-canvas-editing.md`:

- Existing Cytoscape positions, manually adjusted arm angles, and ordinary-edge Bezier controls are user state. Later stages must preserve them unless the operation explicitly changes them.
- Anchor nodes are internal controls. They remain invisible in normal rendering, and half-edge arms must visually meet ordinary or orbifold connecting edges at the anchor with no visible anchor-sized gap.
- Outside the dedicated Half-edge angle procedure, dragging a vertex, anchor, or orbifold endpoint translates the whole star-shaped subgraph rigidly.
- Any operation that creates, reconnects, rebuilds, or retargets an ordinary connecting edge must apply Arm-Tangent Bezier Construction from `03-rendering.md`, unless it is explicitly restoring a saved/user-edited Bezier control.
- Display toggles update the existing Cytoscape graph in place. They must not recompute initial layout or discard manually edited positions and edge controls.
- Canvas Edit mutations must snapshot undo state before making user-visible changes.

These dependencies are not optional polish; they are part of the state model that later stages build on.

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
