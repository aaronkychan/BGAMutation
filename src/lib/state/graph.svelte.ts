import type { BrauerGraph, CytoscapeJson } from '$lib/math/types';
import type { SavedFile } from '$lib/math/types';

export type AppMode = 'idle' | 'select-left-mutation-edge' | 'select-right-mutation-edge' | 'canvas-edit';

export interface CanvasSnapshot {
	cytoscapeJson: CytoscapeJson;
	edgeAnchors: Record<string, number[]>;
}

export const graphState = $state<{
	graph: BrauerGraph | null;
	mode: AppMode;
	getCanvasSnapshot: (() => CanvasSnapshot | null) | null;
	pendingSavedFile: SavedFile | null;
}>({
	graph: null,
	mode: 'idle',
	getCanvasSnapshot: null,
	pendingSavedFile: null
});
