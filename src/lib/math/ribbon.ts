import type { BrauerGraph, TopologyMetrics, ValidationError } from './types';

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

export function computeFaces(sigma0: number[][], orbifoldEdges: number[] = []): number[][] {
	const successor = buildSigma0Map(sigma0);
	const allHalfEdges = sigma0.flat();
	const unvisited = new Set(allHalfEdges);
	const faces: number[][] = [];

	for (const start of allHalfEdges) {
		if (!unvisited.has(start)) continue;

		const face: number[] = [];
		let cursor = start;

		while (unvisited.has(cursor)) {
			unvisited.delete(cursor);
			face.push(cursor);
			const next = successor.get(cursor);
			if (next === undefined) break;
			cursor = sigma1(next, orbifoldEdges);
		}

		faces.push(face);
	}

	return faces;
}

export function isConnected(sigma0: number[][], orbifoldEdges: number[] = []): boolean {
	const halfEdges = sigma0.flat();
	if (halfEdges.length === 0) return true;

	const successor = buildSigma0Map(sigma0);
	const predecessor = buildSigma0InverseMap(sigma0);
	const seen = new Set<number>();
	const queue = [halfEdges[0]];

	while (queue.length > 0) {
		const current = queue.shift();
		if (current === undefined || seen.has(current)) continue;
		seen.add(current);

		for (const next of [successor.get(current), predecessor.get(current), sigma1(current, orbifoldEdges)]) {
			if (next !== undefined && !seen.has(next)) queue.push(next);
		}
	}

	return seen.size === halfEdges.length;
}

export function validateBrauerGraph(graph: BrauerGraph): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!Number.isInteger(graph.n) || graph.n < 0) {
		errors.push({ field: 'edgeCount', message: 'Edge count must be a non-negative integer.' });
	}

	const orbifoldEdges = graph.orbifoldEdges ?? [];
	const seenOrbifoldEdges = new Set<number>();
	for (const edge of orbifoldEdges) {
		if (!Number.isInteger(edge) || edge <= 0 || edge > graph.n) {
			errors.push({
				field: 'orbifoldEdges',
				message: 'Orbifold edges must be positive integers no larger than n.'
			});
			break;
		}

		if (seenOrbifoldEdges.has(edge)) {
			errors.push({ field: 'orbifoldEdges', message: 'Orbifold edges must not repeat.' });
			break;
		}

		seenOrbifoldEdges.add(edge);
	}

	if (graph.multiplicity.length !== graph.sigma0.length) {
		errors.push({ field: 'sigma0', message: 'Each vertex cycle must have one multiplicity.' });
	}

	graph.multiplicity.forEach((multiplicity, index) => {
		if (!Number.isInteger(multiplicity) || multiplicity < 1) {
			errors.push({
				field: `multiplicity-${index}`,
				message: 'Multiplicity must be a positive integer.'
			});
		}
	});

	const validHalfEdges = new Set(computeH(graph.n, orbifoldEdges));
	const usedHalfEdges = new Map<number, number>();

	graph.sigma0.forEach((cycle, cycleIndex) => {
		if (cycle.length === 0 && validHalfEdges.size > 0) {
			errors.push({ field: `cycle-${cycleIndex}`, message: 'Cycle cannot be empty.' });
		}

		for (const halfEdge of cycle) {
			if (!Number.isInteger(halfEdge) || !validHalfEdges.has(halfEdge)) {
				errors.push({
					field: `cycle-${cycleIndex}`,
					message: 'Cycle entries must be integers in H.'
				});
				continue;
			}

			const previousCycle = usedHalfEdges.get(halfEdge);
			if (previousCycle !== undefined) {
				errors.push({
					field: `cycle-${cycleIndex}`,
					message: `Half-edge ${halfEdge} already appears in v${previousCycle + 1}.`
				});
			}
			usedHalfEdges.set(halfEdge, cycleIndex);
		}
	});

	const missing = [...validHalfEdges].filter((halfEdge) => !usedHalfEdges.has(halfEdge));
	if (missing.length > 0) {
		errors.push({
			field: 'sigma0',
			message: `σ₀ must include every element of H. Missing: ${missing.join(', ')}.`
		});
	}

	return errors;
}

export function computeTopologyMetrics(graph: BrauerGraph): TopologyMetrics {
	const orbifoldEdges = graph.orbifoldEdges ?? [];
	const faces = computeFaces(graph.sigma0, orbifoldEdges);
	const genus = (2 - graph.sigma0.length + graph.n - faces.length) / 2;

	return {
		vertices: graph.sigma0.length,
		edges: graph.n,
		faces: faces.length,
		genus,
		orbifoldEdges: orbifoldEdges.length,
		connected: isConnected(graph.sigma0, orbifoldEdges)
	};
}
