import type { BrauerGraph, CytoscapeJson, SavedFile } from '$lib/math/types';
import type { RenderOptions } from '$lib/graph/types';

export function createSavedFile(
	label: string,
	graph: BrauerGraph,
	cytoscapeJson: CytoscapeJson,
	edgeAnchors: Record<string, number[]>,
	renderOptions?: RenderOptions
): SavedFile {
	return {
		label,
		savedAt: new Date().toISOString(),
		graph,
		cytoscapeJson,
		edgeAnchors,
		renderOptions
	};
}
