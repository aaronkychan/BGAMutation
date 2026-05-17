import type cytoscape from 'cytoscape';
import type { BrauerGraph, NodePositions } from '$lib/math/types';

export function buildElements(
	_graph: BrauerGraph,
	_positions: NodePositions
): cytoscape.ElementDefinition[] {
	return [];
}
