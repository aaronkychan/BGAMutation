import type { BrauerGraph } from './types';

export function computeH(n: number, orbifoldEdges: number[] = []): number[] {
	const orbifold = new Set(orbifoldEdges);
	const negative = Array.from({ length: n }, (_, index) => -(n - index)).filter(
		(h) => !orbifold.has(Math.abs(h))
	);
	const positive = Array.from({ length: n }, (_, index) => index + 1);

	return [...negative, ...positive];
}

export function sigma1(h: number, orbifoldEdges: number[] = []): number {
	return orbifoldEdges.includes(Math.abs(h)) ? h : -h;
}

export function buildSigma0Map(sigma0: number[][]): Map<number, number> {
	const result = new Map<number, number>();

	for (const cycle of sigma0) {
		for (let index = 0; index < cycle.length; index += 1) {
			result.set(cycle[index], cycle[(index + 1) % cycle.length]);
		}
	}

	return result;
}

export function buildSigma0InverseMap(sigma0: number[][]): Map<number, number> {
	const result = new Map<number, number>();

	for (const cycle of sigma0) {
		for (let index = 0; index < cycle.length; index += 1) {
			result.set(cycle[index], cycle[(index - 1 + cycle.length) % cycle.length]);
		}
	}

	return result;
}

export function computeHalfedgeSourcePairs(
	graph: BrauerGraph
): Array<[positiveSource: number, negativeSource: number]> {
	const sourceByHalfEdge = new Map<number, number>();

	graph.sigma0.forEach((cycle, vertexIndex) => {
		for (const halfEdge of cycle) {
			sourceByHalfEdge.set(halfEdge, vertexIndex);
		}
	});

	return Array.from({ length: graph.n }, (_, index) => {
		const edge = index + 1;
		const positiveSource = sourceByHalfEdge.get(edge);
		const negativeSource = graph.orbifoldEdges?.includes(edge)
			? positiveSource
			: sourceByHalfEdge.get(-edge);

		if (positiveSource === undefined || negativeSource === undefined) {
			throw new Error(`Cannot compute source pair for edge ${edge}`);
		}

		return [positiveSource, negativeSource];
	});
}

export function isOrdinary(h: number, orbifoldEdges: number[] = []): boolean {
	return !orbifoldEdges.includes(Math.abs(h));
}
