import type cytoscape from 'cytoscape';
import type { BrauerGraph, SavedFile } from '$lib/math/types';

export function createSavedFile(
	label: string,
	graph: BrauerGraph,
	cytoscapeJson: cytoscape.CytoscapeOptions,
	edgeAnchors: Record<string, number[]>
): SavedFile {
	return {
		label,
		savedAt: new Date().toISOString(),
		graph,
		cytoscapeJson,
		edgeAnchors
	};
}
