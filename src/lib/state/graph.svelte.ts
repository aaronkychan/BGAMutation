import type { BrauerGraph } from '$lib/math/types';

export type AppMode = 'idle' | 'select-mutation-edge' | 'canvas-edit';

export const graphState = $state<{
	graph: BrauerGraph | null;
	mode: AppMode;
}>({
	graph: null,
	mode: 'idle'
});
