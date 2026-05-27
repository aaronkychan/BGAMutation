import type { BrauerGraph } from './types';

export interface Fan {
	elements: number[];
	isFullCycle: boolean;
	cycleIndex: number;
	startIndex: number;
	endIndex: number;
}

export type MutationDirection = 'left' | 'right';

export function edgeOrbit(edge: number, orbifoldEdges: number[] = []): Set<number> {
	const h = Math.abs(edge);
	return new Set(orbifoldEdges.includes(h) ? [h] : [h, -h]);
}

export function computeFans(sigma0: number[][], selected: Set<number>): Fan[] {
	const fans: Fan[] = [];

	sigma0.forEach((cycle, cycleIndex) => {
		if (!cycle.some((halfEdge) => selected.has(halfEdge))) return;

		if (cycle.every((halfEdge) => selected.has(halfEdge))) {
			fans.push({
				elements: [...cycle],
				isFullCycle: true,
				cycleIndex,
				startIndex: 0,
				endIndex: cycle.length - 1
			});
			return;
		}

		for (let index = 0; index < cycle.length; index += 1) {
			const previous = cycle[(index - 1 + cycle.length) % cycle.length];
			const current = cycle[index];
			if (!selected.has(current) || selected.has(previous)) continue;

			const elements: number[] = [];
			let cursor = index;
			while (selected.has(cycle[cursor])) {
				elements.push(cycle[cursor]);
				cursor = (cursor + 1) % cycle.length;
			}

			fans.push({
				elements,
				isFullCycle: false,
				cycleIndex,
				startIndex: index,
				endIndex: (cursor - 1 + cycle.length) % cycle.length
			});
		}
	});

	return fans;
}

export function mutateLeft(graph: BrauerGraph, selected: Set<number>): BrauerGraph {
	return mutateGraph(graph, selected, 'left');
}

export function mutateRight(graph: BrauerGraph, selected: Set<number>): BrauerGraph {
	return mutateGraph(graph, selected, 'right');
}

export function mutateGraph(graph: BrauerGraph, selected: Set<number>, direction: MutationDirection): BrauerGraph {
	const fans = computeFans(graph.sigma0, selected);
	const successor = buildSuccessorMap(graph.sigma0);
	const nextSuccessor = new Map(successor);

	for (const fan of fans) {
		if (fan.isFullCycle) continue;

		const cycle = graph.sigma0[fan.cycleIndex];
		const first = fan.elements[0];
		const last = fan.elements[fan.elements.length - 1];

		if (direction === 'left') {
			const e = cycle[(fan.startIndex - 1 + cycle.length) % cycle.length];
			if (selected.has(e)) continue;

			const afterFan = successor.get(last);
			const sigma1e = sigma1(e, graph.orbifoldEdges);
			const beforeSigma1e = predecessorOf(successor, sigma1e);
			if (afterFan === undefined || beforeSigma1e === undefined) continue;

			nextSuccessor.set(last, sigma1e);
			nextSuccessor.set(e, afterFan);
			nextSuccessor.set(beforeSigma1e, first);
		} else {
			const e = successor.get(last);
			const f = cycle[(fan.startIndex - 1 + cycle.length) % cycle.length];
			if (e === undefined || selected.has(e)) continue;

			const sigma1e = sigma1(e, graph.orbifoldEdges);
			const afterSigma1e = successor.get(sigma1e);
			if (afterSigma1e === undefined) continue;

			nextSuccessor.set(last, afterSigma1e);
			nextSuccessor.set(sigma1e, first);
			nextSuccessor.set(f, e);
		}
	}

	const sigma0 = sortCyclesStable(successorMapToCycles(nextSuccessor, graph.sigma0));

	return {
		...graph,
		sigma0,
		multiplicity: sigma0.map((_, index) => graph.multiplicity[index] ?? 1)
	};
}

export function changedVertices(oldSigma0: number[][], newSigma0: number[][]): number[] {
	const changed: number[] = [];
	const maxLength = Math.max(oldSigma0.length, newSigma0.length);

	for (let index = 0; index < maxLength; index += 1) {
		if ((oldSigma0[index] ?? []).join(',') !== (newSigma0[index] ?? []).join(',')) changed.push(index);
	}

	return changed;
}

function sigma1(halfEdge: number, orbifoldEdges: number[] = []): number {
	return orbifoldEdges.includes(Math.abs(halfEdge)) ? Math.abs(halfEdge) : -halfEdge;
}

function buildSuccessorMap(sigma0: number[][]): Map<number, number> {
	const successor = new Map<number, number>();

	for (const cycle of sigma0) {
		cycle.forEach((halfEdge, index) => {
			successor.set(halfEdge, cycle[(index + 1) % cycle.length]);
		});
	}

	return successor;
}

function predecessorOf(successor: Map<number, number>, target: number): number | undefined {
	for (const [source, next] of successor.entries()) {
		if (next === target) return source;
	}

	return undefined;
}

function successorMapToCycles(successor: Map<number, number>, originalCycles: number[][]): number[][] {
	const visited = new Set<number>();
	const cycles: number[][] = [];

	for (const originalCycle of originalCycles) {
		for (const start of originalCycle) {
			if (visited.has(start)) continue;

			const cycle: number[] = [];
			let current = start;

			while (!visited.has(current)) {
				visited.add(current);
				cycle.push(current);
				const next = successor.get(current);
				if (next === undefined) break;
				current = next;
			}

			if (cycle.length) cycles.push(cycle);
		}
	}

	return cycles;
}

function sortCyclesStable(cycles: number[][]): number[][] {
	return [...cycles].sort((left, right) => cycleSortKey(left) - cycleSortKey(right));
}

function cycleSortKey(cycle: number[]): number {
	return Math.min(...cycle.map((halfEdge) => Math.abs(halfEdge)));
}
