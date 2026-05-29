import type { BrauerGraph, CytoscapeJson } from '$lib/math/types';

export type AppMode =
	| 'idle'
	| 'select-left-mutation-edge'
	| 'select-right-mutation-edge'
	| 'add-vertex'
	| 'add-half-edge'
	| 'add-orbifold-edge'
	| 'reconnect-arc'
	| 'remove-arc'
	| 'adjust-emanating-angle'
	| 'adjust-arc-curvature'
	| 'rotate-vertex'
	| 'modify-multiplicity'
	| 'remove-vertex'
	| 'remove-half-edge'
	| 'canvas-edit';

export interface CanvasSnapshot {
	cytoscapeJson: CytoscapeJson;
	edgeAnchors: Record<string, number[]>;
}

export const graphState = $state<{
	graph: BrauerGraph | null;
	mode: AppMode;
	getCanvasSnapshot: (() => CanvasSnapshot | null) | null;
	armLength: number | null;
	requestedArmLength: number | null;
}>({
	graph: null,
	mode: 'idle',
	getCanvasSnapshot: null,
	armLength: null,
	requestedArmLength: null
});
