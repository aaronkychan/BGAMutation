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
	},
	{
		name: 'Line (4 edges)',
		graph: {
			n: 4,
			sigma0: [[-1], [1, -2], [2, -3], [3, -4], [4]],
			multiplicity: [1, 1, 1, 1, 1]
		},
		positions: {}
	},
	{
		name: 'Torus (3 edges)',
		graph: {
			n: 3,
			sigma0: [[1, 2, 3], [-1, -2, -3]],
			multiplicity: [1, 1]
		},
		positions: {}
	},
	{
		name: 'Pants (3 edges)',
		graph: {
			n: 3,
			sigma0: [[1, 2, 3], [-1, -3, -2]],
			multiplicity: [1, 1]
		},
		positions: {}
	},
	{
		name: 'One orbifold edge',
		graph: {
			n: 3,
			orbifoldEdges: [3],
			sigma0: [[1, 2, -1, 3], [-2]],
			multiplicity: [1, 1]
		},
		positions: {}
	},
	{
		name: 'Two orbifold edges',
		graph: {
			n: 2,
			orbifoldEdges: [1, 2],
			sigma0: [[1, 2]],
			multiplicity: [1]
		},
		positions: {}
	}
];
