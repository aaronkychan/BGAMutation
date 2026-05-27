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
    edgeAnchors: serializeAnchors(cy), // from cytoscape-edge-editing
    renderOptions: currentRenderOptions, // display toggles, direction, and initial layout metadata
};
```

`serializeAnchors` calls `edgeEditingInstance.getAnchorsAsArray(edge)` for every `ce-{h}` edge and stores results in a `Record<string, number[]>` keyed by edge ID.

**Load**: Restore `cy.json(cytoscapeJson)` then call `cy.layout({ name: 'preset' }).run()` to honour saved positions. Then restore anchor handles via `edgeEditingInstance.initAnchorPoints(edges, controlPositionsFunction)`.

**Export / Import**: `fileio.ts` wraps `SavedFile[]` in a JSON file download / `FileReader` upload. Import accepts either a single `SavedFile` object or an array of saved files.
