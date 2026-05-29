<script lang="ts">
	import type { BrauerGraph } from '$lib/math/types';
	import type { SavedFile } from '$lib/math/types';
	import type { RenderOptions } from '$lib/graph/types';
	import { onMount } from 'svelte';
	import CanvasAccordion from './CanvasAccordion.svelte';
	import DisplayToggles from './DisplayToggles.svelte';
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
	let selectedCanvasGroup = $state<'add-edit' | 'remove' | 'display-edit' | ''>('');

	const groupTriggers: Record<string, typeof selectedCanvasGroup> = {
		a: 'add-edit',
		d: 'remove',
		e: 'display-edit'
	};

	const groupActions: Record<string, Record<string, string>> = {
		'add-edit': {
			v: 'add-vertex',
			o: 'add-orbifold-edge',
			c: 'reconnect-arc',
			m: 'modify-multiplicity'
		},
		remove: {
			v: 'remove-vertex',
			a: 'remove-arc',
			h: 'remove-half-edge'
		},
		'display-edit': {
			a: 'adjust-emanating-angle',
			r: 'rotate-vertex',
			c: 'adjust-arc-curvature'
		}
	};

	function drawAndSwitchToCanvas(nextGraph: BrauerGraph, options: RenderOptions) {
		if (onDraw(nextGraph, options)) {
			openAccordion = 'canvas';
		}
	}

	function handleCanvasAction(action: string) {
		if (action === 'adjust-arc-curvature') {
			graphState.mode = graphState.mode === 'adjust-arc-curvature' ? 'idle' : 'adjust-arc-curvature';
			selectedCanvasGroup = 'display-edit';
			return;
		}

		if (action === 'reconnect-arc') {
			graphState.mode = graphState.mode === 'reconnect-arc' ? 'idle' : 'reconnect-arc';
			selectedCanvasGroup = 'add-edit';
			return;
		}

		if (action === 'remove-half-edge') {
			graphState.mode = graphState.mode === 'remove-half-edge' ? 'idle' : 'remove-half-edge';
			selectedCanvasGroup = 'remove';
			return;
		}

		if (action === 'remove-arc') {
			graphState.mode = graphState.mode === 'remove-arc' ? 'idle' : 'remove-arc';
			selectedCanvasGroup = 'remove';
			return;
		}

		if (action === 'remove-vertex') {
			graphState.mode = graphState.mode === 'remove-vertex' ? 'idle' : 'remove-vertex';
			selectedCanvasGroup = 'remove';
			return;
		}

		if (action === 'add-half-edge') {
			graphState.mode = graphState.mode === 'add-half-edge' ? 'idle' : 'add-half-edge';
			selectedCanvasGroup = 'add-edit';
			return;
		}

		if (action === 'add-orbifold-edge') {
			graphState.mode = graphState.mode === 'add-orbifold-edge' ? 'idle' : 'add-orbifold-edge';
			selectedCanvasGroup = 'add-edit';
			return;
		}

		if (action === 'add-vertex') {
			graphState.mode = graphState.mode === 'add-vertex' ? 'idle' : 'add-vertex';
			selectedCanvasGroup = 'add-edit';
			return;
		}

		if (action === 'modify-multiplicity') {
			graphState.mode = graphState.mode === 'modify-multiplicity' ? 'idle' : 'modify-multiplicity';
			selectedCanvasGroup = 'add-edit';
			return;
		}

		if (action === 'adjust-emanating-angle') {
			graphState.mode = graphState.mode === 'adjust-emanating-angle' ? 'idle' : 'adjust-emanating-angle';
			selectedCanvasGroup = 'display-edit';
			return;
		}

		if (action === 'rotate-vertex') {
			graphState.mode = graphState.mode === 'rotate-vertex' ? 'idle' : 'rotate-vertex';
			selectedCanvasGroup = 'display-edit';
		}
	}

	function isTypingTarget(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return false;
		return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
	}

	function adjustArmLength(delta: number) {
		const current = graphState.armLength ?? 40;
		graphState.requestedArmLength = Math.max(14, Math.round(current + delta));
	}

	function handleHotkey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			selectedCanvasGroup = '';
			graphState.mode = 'idle';
			return;
		}

		if (isTypingTarget(event.target)) return;

		const key = event.key.toLowerCase();

		if (key === 'z') {
			openAccordion = 'canvas';
			selectedCanvasGroup = '';
			handleCanvasAction('undo');
			event.preventDefault();
			return;
		}

		if (selectedCanvasGroup === 'display-edit' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
			openAccordion = 'canvas';
			adjustArmLength(event.key === 'ArrowUp' ? 1 : -1);
			event.preventDefault();
			return;
		}

		if (selectedCanvasGroup) {
			const action = groupActions[selectedCanvasGroup]?.[key];
			if (action) {
				openAccordion = 'canvas';
				handleCanvasAction(action);
				event.preventDefault();
				return;
			}
		}

		const group = groupTriggers[key];
		if (group) {
			openAccordion = 'canvas';
			selectedCanvasGroup = selectedCanvasGroup === group ? '' : group;
			event.preventDefault();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleHotkey);
		return () => document.removeEventListener('keydown', handleHotkey);
	});
</script>

<aside class="control-panel" aria-label="Controls">
	<NumericalAccordion
		currentGraph={graph}
		open={openAccordion === 'numerical'}
		disabled={openAccordion === 'canvas'}
		onToggle={() => (openAccordion = openAccordion === 'numerical' ? null : 'numerical')}
		onDraw={drawAndSwitchToCanvas}
		{onClear}
		{renderOptions}
		{errors}
	/>
	<CanvasAccordion
		open={openAccordion === 'canvas'}
		activeAction={graphState.mode === 'adjust-emanating-angle' || graphState.mode === 'adjust-arc-curvature' || graphState.mode === 'rotate-vertex' || graphState.mode === 'modify-multiplicity' || graphState.mode === 'add-vertex' || graphState.mode === 'add-half-edge' || graphState.mode === 'add-orbifold-edge' || graphState.mode === 'reconnect-arc' || graphState.mode === 'remove-vertex' || graphState.mode === 'remove-arc' || graphState.mode === 'remove-half-edge' ? graphState.mode : ''}
		activeGroup={selectedCanvasGroup}
		armLength={graphState.armLength}
		onToggle={() => (openAccordion = openAccordion === 'canvas' ? null : 'canvas')}
		onAction={handleCanvasAction}
		onArmLengthChange={(length) => (graphState.requestedArmLength = length)}
	/>
	<DisplayToggles {renderOptions} {onRenderOptionsChange} />
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
