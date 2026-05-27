<script lang="ts">
	import type { BrauerGraph } from '$lib/math/types';
	import type { SavedFile } from '$lib/math/types';
	import { defaultRenderOptions, type RenderOptions } from '$lib/graph/types';
	import { validateBrauerGraph } from '$lib/math/ribbon';
	import { graphState } from '$lib/state/graph.svelte';
	import AppHeader from '$lib/ui/AppHeader.svelte';
	import ControlPanel from '$lib/ui/ControlPanel.svelte';
	import DisplayPanel from '$lib/ui/DisplayPanel.svelte';
	import type { CanvasController } from '$lib/ui/DisplayPanel.svelte';

	let drawerOpen = $state(false);
	let renderOptions = $state<RenderOptions>(defaultRenderOptions);
	let validationErrors = $state<{ field: string; message: string }[]>([]);
	let canvasController: CanvasController | null = null;

	function drawGraph(graph: BrauerGraph, options: RenderOptions): boolean {
		const errors = validateBrauerGraph(graph);
		validationErrors = errors;
		if (errors.length > 0) return false;

		graphState.graph = graph;
		graphState.mode = 'idle';
		renderOptions = options;
		canvasController?.drawGraph(graph, options);
		drawerOpen = false;
		return true;
	}

	function clearGraph() {
		graphState.graph = null;
		graphState.mode = 'idle';
		renderOptions = defaultRenderOptions;
		validationErrors = [];
		canvasController?.clearGraph();
	}

	function loadSavedFile(savedFile: SavedFile) {
		graphState.graph = savedFile.graph;
		graphState.mode = 'idle';
		renderOptions = savedFile.renderOptions ?? renderOptions;
		validationErrors = [];
		canvasController?.loadSavedFile(savedFile, renderOptions);
		drawerOpen = false;
	}
</script>

<svelte:head>
	<title>Brauer Graph Mutation Visualiser</title>
	<meta
		name="description"
		content="Interactive visualiser for Brauer and skew Brauer graph mutation."
	/>
</svelte:head>

<main class="app-shell" class:drawer-open={drawerOpen}>
	<AppHeader {drawerOpen} onToggleDrawer={() => (drawerOpen = !drawerOpen)} />

	<div class="workspace">
		<div class="control-region">
			<ControlPanel
				graph={graphState.graph}
				{renderOptions}
				onDraw={drawGraph}
				onClear={clearGraph}
				onRenderOptionsChange={(options) => (renderOptions = options)}
				onLoadSavedFile={loadSavedFile}
				errors={validationErrors}
			/>
		</div>
		<DisplayPanel
			options={renderOptions}
			onCanvasReady={(controller) => (canvasController = controller)}
			onGraphMutated={(graph) => (graphState.graph = graph)}
		/>
	</div>
</main>

<style>
	.app-shell {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.workspace {
		display: grid;
		grid-template-columns: 320px minmax(0, 1fr);
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.control-region {
		width: 320px;
		min-height: 0;
		overflow: hidden;
	}

	@media (max-width: 1024px) and (min-width: 641px) {
		.workspace {
			position: relative;
			grid-template-columns: minmax(0, 1fr);
		}

		.control-region {
			position: absolute;
			z-index: 10;
			top: 0;
			bottom: 0;
			left: 0;
			transform: translateX(-100%);
			transition: transform 160ms ease;
		}

		.drawer-open .control-region {
			transform: translateX(0);
		}
	}

	@media (max-width: 640px) {
		.workspace {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(55vh, 1fr) auto;
			overflow: auto;
		}

		.control-region {
			order: 2;
			width: 100%;
			overflow: visible;
		}
	}
</style>
