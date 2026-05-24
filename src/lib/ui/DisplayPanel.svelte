<script lang="ts">
	import cytoscape from 'cytoscape';
	import { onDestroy, onMount } from 'svelte';
	import { buildElements } from '$lib/graph/elements';
	import { registerCytoscapeExtensions } from '$lib/graph/extensions';
	import { computeInitialVertexPositions } from '$lib/graph/positions';
	import { createStylesheet } from '$lib/graph/style';
	import type { RenderOptions } from '$lib/graph/types';
	import type { BrauerGraph } from '$lib/math/types';

	let { graph, options }: { graph: BrauerGraph | null; options: RenderOptions } = $props();

	let container: HTMLDivElement;
	let cy: cytoscape.Core | null = null;
	let themeObserver: MutationObserver | null = null;
	let tooltip = $state<{ x: number; y: number; text: string } | null>(null);

	function renderGraph() {
		if (!cy || !container) return;

		if (!graph) {
			cy.elements().remove();
			tooltip = null;
			return;
		}

		const rect = container.getBoundingClientRect();
		const positions = computeInitialVertexPositions(graph.sigma0.length, options.layout, {
			x: rect.width / 2,
			y: rect.height / 2
		});

		cy.elements().remove();
		cy.add(buildElements(graph, positions, options));
		cy.layout({ name: 'preset', fit: false }).run();
		cy.center();
	}

	function applyStylesheet() {
		if (!cy) return;
		cy.style(createStylesheet());
	}

	onMount(() => {
		let cancelled = false;

		async function mountCytoscape() {
			await registerCytoscapeExtensions();
			if (cancelled) return;

		cy = cytoscape({
			container,
			elements: [],
			style: createStylesheet(),
			layout: { name: 'preset' },
			minZoom: 0.2,
			maxZoom: 3,
			wheelSensitivity: 0.2
		});

		cy.on('mouseover tap', '.v-node', (event) => {
			const node = event.target;
			const multiplicity = node.data('multiplicity');
			const rendered = node.renderedPosition();
			tooltip = {
				x: rendered.x + 12,
				y: rendered.y + 12,
				text: `Multiplicity: ${multiplicity}`
			};
		});

		cy.on('mouseout', '.v-node', () => {
			tooltip = null;
		});

		cy.on('drag', '.v-node', () => {
			tooltip = null;
		});

		cy.on('grab', '.v-node', (event) => {
			event.target.scratch('previousPosition', { ...event.target.position() });
		});

		cy.on('dragfreeon', '.v-node', (event) => {
			const vertex = event.target;
			const previous = vertex.scratch('previousPosition') as { x: number; y: number } | undefined;
			if (!previous) return;

			const current = vertex.position();
			const dx = current.x - previous.x;
			const dy = current.y - previous.y;
			const parent = vertex.data('parent');

			cy
				?.nodes(`[parent = "${parent}"]`)
				.not(vertex)
				.positions((node) => ({
					x: node.position('x') + dx,
					y: node.position('y') + dy
				}));
		});

		themeObserver = new MutationObserver(applyStylesheet);
		themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		renderGraph();
		}

		mountCytoscape();

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		graph;
		options;
		renderGraph();
	});

	onDestroy(() => {
		themeObserver?.disconnect();
		cy?.destroy();
	});
</script>

<section class="display-panel" aria-label="Graph display">
	<div class="cytoscape-surface" bind:this={container} aria-label="Cytoscape graph canvas">
		{#if !graph}
			<div class="placeholder">
				<strong>Cytoscape display panel</strong>
				<span>Draw a graph from the controls to populate this canvas.</span>
			</div>
		{/if}
	</div>
	<svg class="animation-overlay" aria-hidden="true"></svg>
	{#if tooltip}
		<div class="tooltip" style={`left: ${tooltip.x}px; top: ${tooltip.y}px;`}>
			{tooltip.text}
		</div>
	{/if}
</section>

<style>
	.display-panel {
		position: relative;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--bg-secondary);
	}

	.cytoscape-surface {
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.animation-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.tooltip {
		position: absolute;
		z-index: 2;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-panel);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
		color: var(--text-primary);
		padding: 6px 8px;
		font-size: 12px;
		pointer-events: none;
	}

	.placeholder {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 8px;
		width: 100%;
		height: 100%;
		border: 1px dashed var(--border);
		background:
			linear-gradient(var(--canvas-grid) 1px, transparent 1px),
			linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px),
			var(--bg-primary);
		background-size: 28px 28px;
		color: var(--text-secondary);
		text-align: center;
	}

	.placeholder strong {
		color: var(--text-primary);
		font-size: 18px;
	}

	.placeholder span {
		max-width: 28ch;
		font-size: 14px;
		line-height: 1.4;
	}
</style>
