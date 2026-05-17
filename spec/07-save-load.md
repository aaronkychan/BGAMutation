# Save and Load

The save/load behavior is specified inside Stage 1 Graph Presentation in the original spec. This focused file extracts that behavior for implementation.

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
