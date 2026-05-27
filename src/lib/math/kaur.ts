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
	const workingSigma0: WorkingCycle[] = graph.sigma0.map((cycle) => [...cycle]);
	const movedHalfEdges = new Set<number>();

	for (const fan of fans) {
		if (fan.isFullCycle) continue;

		const cycle = graph.sigma0[fan.cycleIndex];

		if (direction === 'left') {
			// Think of the fan as a temporary primed copy. For left mutation, insert
			// that copy immediately before sigma1(e), where e is the predecessor of
			// the original fan. The old fan entries are removed after every insertion,
			// so different fans cannot overwrite each other's splice data.
			const e = cycle[(fan.startIndex - 1 + cycle.length) % cycle.length];
			if (selected.has(e)) continue;

			const sigma1e = sigma1(e, graph.orbifoldEdges);
			for (const halfEdge of fan.elements) movedHalfEdges.add(halfEdge);
			insertPrimedFan(workingSigma0, sigma1e, fan.elements, 'before');
		} else {
			// Right mutation is the inverse local operation: insert the temporary copy
			// immediately after sigma1(e), where e is the successor of the original fan.
			const e = cycle[(fan.endIndex + 1) % cycle.length];
			if (selected.has(e)) continue;

			const sigma1e = sigma1(e, graph.orbifoldEdges);
			for (const halfEdge of fan.elements) movedHalfEdges.add(halfEdge);
			insertPrimedFan(workingSigma0, sigma1e, fan.elements, 'after');
		}
	}

	const sigma0 = rotateToOriginalStarts(unprimeAndRemoveMoved(workingSigma0, movedHalfEdges), graph.sigma0);

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

interface PrimedHalfEdge {
	halfEdge: number;
}

type WorkingHalfEdge = number | PrimedHalfEdge;
type WorkingCycle = WorkingHalfEdge[];

function insertPrimedFan(
	sigma0: WorkingCycle[],
	target: number,
	fan: number[],
	position: 'before' | 'after'
): void {
	const primedFan = fan.map((halfEdge) => ({ halfEdge }));

	for (const cycle of sigma0) {
		const targetIndex = cycle.findIndex((halfEdge) => halfEdge === target);
		if (targetIndex === -1) continue;

		const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
		cycle.splice(insertIndex, 0, ...primedFan);
		return;
	}
}

function unprimeAndRemoveMoved(sigma0: WorkingCycle[], movedHalfEdges: Set<number>): number[][] {
	return sigma0.map((cycle) => {
		const nextCycle: number[] = [];
		for (const halfEdge of cycle) {
			if (typeof halfEdge === 'number') {
				if (!movedHalfEdges.has(halfEdge)) nextCycle.push(halfEdge);
			} else {
				nextCycle.push(halfEdge.halfEdge);
			}
		}
		return nextCycle;
	});
}

function rotateToOriginalStarts(sigma0: number[][], originalSigma0: number[][]): number[][] {
	return sigma0.map((cycle, cycleIndex) => {
		const originalStart = originalSigma0[cycleIndex]?.find((halfEdge) => cycle.includes(halfEdge));
		if (originalStart === undefined) return cycle;

		const startIndex = cycle.indexOf(originalStart);
		return [...cycle.slice(startIndex), ...cycle.slice(0, startIndex)];
	});
}
