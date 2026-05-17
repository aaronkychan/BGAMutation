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
- Later work and unresolved topics: `backlog.md`
- Exact archived source document: `original-full-spec.md`

If a focused spec conflicts with `00-decisions.md`, `00-decisions.md` is authoritative until the conflict is explicitly resolved.

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
