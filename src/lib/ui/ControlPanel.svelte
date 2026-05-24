<script lang="ts">
	import type { BrauerGraph } from '$lib/math/types';
	import type { RenderOptions } from '$lib/graph/types';
	import CanvasAccordion from './CanvasAccordion.svelte';
	import InfoBox from './InfoBox.svelte';
	import MutationControls from './MutationControls.svelte';
	import NumericalAccordion from './NumericalAccordion.svelte';
	import SaveLoad from './SaveLoad.svelte';

	let {
		graph,
		onDraw,
		onClear,
		errors = []
	}: {
		graph: BrauerGraph | null;
		onDraw: (graph: BrauerGraph, options: RenderOptions) => boolean;
		onClear: () => void;
		errors?: { field: string; message: string }[];
	} = $props();

	let openAccordion = $state<'numerical' | 'canvas'>('numerical');

	function drawAndSwitchToCanvas(nextGraph: BrauerGraph, options: RenderOptions) {
		if (onDraw(nextGraph, options)) {
			openAccordion = 'canvas';
		}
	}
</script>

<aside class="control-panel" aria-label="Controls">
	<NumericalAccordion
		open={openAccordion === 'numerical'}
		disabled={openAccordion === 'canvas'}
		onToggle={() => (openAccordion = 'numerical')}
		onDraw={drawAndSwitchToCanvas}
		{onClear}
		{errors}
	/>
	<CanvasAccordion
		open={openAccordion === 'canvas'}
		onToggle={() => (openAccordion = 'canvas')}
	/>
	<InfoBox {graph} />
	<MutationControls />
	<SaveLoad />
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
