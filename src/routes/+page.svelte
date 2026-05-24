<script lang="ts">
	import type { BrauerGraph } from '$lib/math/types';
	import { defaultRenderOptions, type RenderOptions } from '$lib/graph/types';
	import { validateBrauerGraph } from '$lib/math/ribbon';
	import { graphState } from '$lib/state/graph.svelte';
	import AppHeader from '$lib/ui/AppHeader.svelte';
	import ControlPanel from '$lib/ui/ControlPanel.svelte';
	import DisplayPanel from '$lib/ui/DisplayPanel.svelte';

	let drawerOpen = $state(false);
	let renderOptions = $state<RenderOptions>(defaultRenderOptions);
	let validationErrors = $state<{ field: string; message: string }[]>([]);

	function drawGraph(graph: BrauerGraph, options: RenderOptions): boolean {
		const errors = validateBrauerGraph(graph);
		validationErrors = errors;
		if (errors.length > 0) return false;

		graphState.graph = graph;
		graphState.mode = 'idle';
		renderOptions = options;
		drawerOpen = false;
		return true;
	}

	function clearGraph() {
		graphState.graph = null;
		graphState.mode = 'idle';
		validationErrors = [];
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
				onDraw={drawGraph}
				onClear={clearGraph}
				errors={validationErrors}
			/>
		</div>
		<DisplayPanel graph={graphState.graph} options={renderOptions} />
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
