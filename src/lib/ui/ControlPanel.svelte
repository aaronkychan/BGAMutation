<script lang="ts">
	import type { BrauerGraph } from '$lib/math/types';
	import type { SavedFile } from '$lib/math/types';
	import type { RenderOptions } from '$lib/graph/types';
	import CanvasAccordion from './CanvasAccordion.svelte';
	import { graphState } from '$lib/state/graph.svelte';
	import InfoBox from './InfoBox.svelte';
	import MutationControls from './MutationControls.svelte';
	import NumericalAccordion from './NumericalAccordion.svelte';
	import SaveLoad from './SaveLoad.svelte';

	let {
		graph,
		renderOptions,
		onDraw,
		onClear,
		onRenderOptionsChange,
		onLoadSavedFile,
		errors = []
	}: {
		graph: BrauerGraph | null;
		renderOptions: RenderOptions;
		onDraw: (graph: BrauerGraph, options: RenderOptions) => boolean;
		onClear: () => void;
		onRenderOptionsChange: (options: RenderOptions) => void;
		onLoadSavedFile: (savedFile: SavedFile) => void;
		errors?: { field: string; message: string }[];
	} = $props();

	let openAccordion = $state<'numerical' | 'canvas' | null>('numerical');

	function drawAndSwitchToCanvas(nextGraph: BrauerGraph, options: RenderOptions) {
		if (onDraw(nextGraph, options)) {
			openAccordion = 'canvas';
		}
	}

	function handleCanvasAction(action: string) {
		if (action !== 'adjust-emanating-angle') return;
		graphState.mode = graphState.mode === 'adjust-emanating-angle' ? 'idle' : 'adjust-emanating-angle';
	}
</script>

<aside class="control-panel" aria-label="Controls">
	<NumericalAccordion
		currentGraph={graph}
		open={openAccordion === 'numerical'}
		disabled={openAccordion === 'canvas'}
		onToggle={() => (openAccordion = openAccordion === 'numerical' ? null : 'numerical')}
		onDraw={drawAndSwitchToCanvas}
		{onRenderOptionsChange}
		{onClear}
		{renderOptions}
		{errors}
	/>
	<CanvasAccordion
		open={openAccordion === 'canvas'}
		activeAction={graphState.mode === 'adjust-emanating-angle' ? 'adjust-emanating-angle' : ''}
		onToggle={() => (openAccordion = openAccordion === 'canvas' ? null : 'canvas')}
		onAction={handleCanvasAction}
	/>
	<InfoBox {graph} />
	<MutationControls />
	<SaveLoad {graph} {renderOptions} onLoad={onLoadSavedFile} />
</aside>

<style>
	.control-panel {
		box-sizing: border-box;
		width: 320px;
		height: 100%;
		max-height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		border-right: 1px solid var(--border);
		background: var(--bg-panel);
		padding: 0 18px 18px;
	}

	@media (max-width: 640px) {
		.control-panel {
			width: 100%;
			height: auto;
			max-height: none;
			border-top: 1px solid var(--border);
			border-right: 0;
		}
	}
</style>
