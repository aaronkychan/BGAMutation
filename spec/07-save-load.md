# Save and Load

The save/load behavior is specified inside Stage 1 Graph Presentation in the original spec. This focused file extracts that behavior for implementation.

Save/load is part of the same graph-editing state model used by rendering, Canvas Edit, and mutation:

- Save must preserve current Cytoscape node positions, including user-adjusted anchor and orbifold-end positions.
- Save must preserve ordinary-edge Bezier controls, including controls created by Arm-Tangent Bezier Construction and controls later changed by edge editing.
- Save must preserve enough display state to restore the visible graph without forcing a fresh initial layout.
- Load must restore saved/user-edited state as authoritative. It must not recompute generated star positions or Bezier controls unless the saved file lacks that data.
- Browser storage may keep a local list of saved files for the current browser. Export/import remains JSON file based and does not require a server.

### Save / Load (`src/lib/io/`)

**Save**: "Save current" → `Modal.svelte` prompts for a label → serialise:

```ts
const file: SavedFile = {
    label,
    savedAt: new Date().toISOString(),
    graph: currentGraph,
    cytoscapeJson: cy.json(), // includes node positions
    edgeAnchors: {}, // reserved for future curve-edit metadata
    renderOptions: currentRenderOptions, // display toggles, direction, and initial layout metadata
};
```

Bezier control data is stored directly on Cytoscape edge data and is preserved by the Cytoscape JSON snapshot. `edgeAnchors` is currently reserved for future curve-edit metadata.

**Load**: Restore `cy.json(cytoscapeJson)` then call `cy.layout({ name: 'preset' }).run()` to honour saved positions and saved edge-control data.

**Export / Import**: `fileio.ts` wraps `SavedFile[]` in a JSON file download / `FileReader` upload. Import accepts either a single `SavedFile` object or an array of saved files.
