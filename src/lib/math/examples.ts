import type { BrauerGraph, NodePositions } from './types';

export interface GraphExample {
	name: string;
	graph: BrauerGraph;
	positions: NodePositions;
}

export const examples: GraphExample[] = [
	{
		name: 'Star (5 edges)',
		graph: {
			n: 5,
			sigma0: [[1, 2, 3, 4, 5], [-1], [-2], [-3], [-4], [-5]],
			multiplicity: [1, 1, 1, 1, 1, 1]
		},
		positions: {}
	}
];
