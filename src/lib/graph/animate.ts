import type cytoscape from 'cytoscape';

export type AnimationArrangement = 'spread' | 'forward' | 'reverse';

export function animateEdge(
	_edge: cytoscape.EdgeSingular,
	_arrangement: AnimationArrangement,
	_edgeColor: string,
	_highlightColor: string,
	_durationMs: number
): Promise<void> {
	return Promise.resolve();
}
