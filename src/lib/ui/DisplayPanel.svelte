<script lang="ts">
	import cytoscape from 'cytoscape';
	import { onDestroy, onMount } from 'svelte';
	import { buildElements, buildOrderingArrowElements, computeArmTangentBezierControls } from '$lib/graph/elements';
	import { registerCytoscapeExtensions } from '$lib/graph/extensions';
	import { anchorId, connectingEdgeId, orbifoldConnectingEdgeId, vertexId } from '$lib/graph/ids';
	import { computeInitialVertexPositions } from '$lib/graph/positions';
	import { createStylesheet } from '$lib/graph/style';
	import type { RenderOptions } from '$lib/graph/types';
	import { ANIMATION_POST_MS } from '$lib/graph/constants';
	import { animateMutation } from '$lib/graph/animate';
	import { edgeOrbit, mutateGraph, type MutationDirection } from '$lib/math/kaur';
	import { graphState } from '$lib/state/graph.svelte';
	import type { BrauerGraph, NodePositions } from '$lib/math/types';

	let { graph, options }: { graph: BrauerGraph | null; options: RenderOptions } = $props();

	let container: HTMLDivElement;
	let cy: cytoscape.Core | null = null;
	let themeObserver: MutationObserver | null = null;
	let tooltip = $state<{ x: number; y: number; text: string } | null>(null);
	let infoMessage = $state('');
	let mutating = false;
	let renderedGraph: BrauerGraph | null = null;
	let renderedOptions: RenderOptions | null = null;

	function renderGraph() {
		if (!cy || !container) return;

		if (!graph) {
			cy.elements().remove();
			tooltip = null;
			renderedGraph = null;
			renderedOptions = null;
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
		renderedGraph = graph;
		renderedOptions = { ...options };
	}

	function applyStylesheet() {
		if (!cy) return;
		cy.style(createStylesheet());
	}

	function canvasSnapshot() {
		if (!cy) return null;

		return {
			cytoscapeJson: cy.json(),
			edgeAnchors: {}
		};
	}

	function restorePendingSavedFile() {
		if (!cy || !graphState.pendingSavedFile) return;

		const savedFile = graphState.pendingSavedFile;
		cy.json(savedFile.cytoscapeJson);
		cy.layout({ name: 'preset', fit: false }).run();
		applyStylesheet();
		graphState.pendingSavedFile = null;
		renderedGraph = graph;
		renderedOptions = { ...options };
	}

	function currentVertexPositions(): NodePositions {
		const positions: NodePositions = {};
		if (!cy) return positions;

		cy.nodes('.v-node').forEach((node) => {
			positions[node.id()] = { ...node.position() };
		});

		return positions;
	}

	function renderGraphWithCurrentVertexPositions(nextGraph: BrauerGraph, savedPositions = currentVertexPositions()) {
		if (!cy) return;

		const positions: NodePositions = {};
		const fallback = fallbackVertexPosition();
		for (let index = 0; index < nextGraph.sigma0.length; index += 1) {
			const id = vertexId(index);
			positions[id] = savedPositions[id] ?? { x: fallback.x + index * 28, y: fallback.y + index * 28 };
		}

		cy.elements().remove();
		cy.add(buildElements(nextGraph, positions, options));
		cy.layout({ name: 'preset', fit: false }).run();
		renderedGraph = nextGraph;
		renderedOptions = { ...options };
	}

	function fallbackVertexPosition() {
		if (!cy || !container) return { x: 0, y: 0 };

		const vertices = cy.nodes('.v-node');
		if (vertices.length) {
			const total = vertices.reduce(
				(sum, node) => ({ x: sum.x + node.position('x'), y: sum.y + node.position('y') }),
				{ x: 0, y: 0 }
			);
			return { x: total.x / vertices.length, y: total.y / vertices.length };
		}

		const rect = container.getBoundingClientRect();
		return { x: rect.width / 2, y: rect.height / 2 };
	}

	function applyRenderOptionsInPlace() {
		if (!cy || !graph) return;

		const orbifoldEdges = new Set(graph.orbifoldEdges ?? []);

		graph.sigma0.forEach((cycle, vertexIndex) => {
			const multiplicity = graph.multiplicity[vertexIndex] ?? 1;
			cy?.getElementById(vertexId(vertexIndex)).data(
				'multiplicityLabel',
				options.showMultiplicityLabels ? String(multiplicity) : ''
			);

			cycle.forEach((halfEdge) => {
				const anchor = cy?.getElementById(anchorId(halfEdge));
				anchor?.data('label', options.showHalfEdgeLabels ? String(halfEdge) : '');
				anchor?.toggleClass('labeled', options.showHalfEdgeLabels);
			});
		});

		for (let edge = 1; edge <= graph.n; edge += 1) {
			const label = options.showEdgeLabels ? `[${edge}]` : '';
			const edgeElement = cy.getElementById(
				orbifoldEdges.has(edge) ? orbifoldConnectingEdgeId(edge) : connectingEdgeId(edge)
			);
			edgeElement.data('label', label);
		}

		cy.$('.ordering-arrow, .ordering-arrow-point').remove();
		if (options.showOrderArrows) {
			cy.add(
				buildOrderingArrowElements(
					graph,
					(vertexIndex) => cy?.getElementById(vertexId(vertexIndex)).position() ?? { x: 0, y: 0 },
					options
				)
			);
		}

		renderedOptions = { ...options };
	}

	function canApplyRenderOptionsInPlace() {
		return Boolean(
			cy &&
				graph &&
				renderedGraph === graph &&
				renderedOptions &&
				renderedOptions.layout === options.layout &&
				renderedOptions.direction === options.direction
		);
	}

	function translateStar(target: cytoscape.NodeSingular, dx: number, dy: number) {
		const parent = target.data('parent');
		if (!parent) return;

		cy
			?.nodes(`[parent = "${parent}"]`)
			.not(target)
			.positions((node) => ({
				x: node.position('x') + dx,
				y: node.position('y') + dy
			}));

		updateIncidentBezierControls(parent);
	}

	function updateIncidentBezierControls(parentId: string) {
		if (!cy || !graph) return;

		const movedHalfEdges = cy
			.nodes(`[parent = "${parentId}"].u-node`)
			.map((node) => Number(node.data('h')))
			.filter((halfEdge) => Number.isInteger(halfEdge));

		for (const halfEdge of movedHalfEdges) {
			const edge = Math.abs(halfEdge);
			if (graph.orbifoldEdges?.includes(edge)) continue;

			const sourceInfo = currentAnchorInfo(edge);
			const targetInfo = currentAnchorInfo(-edge);
			const connectingEdge = cy.getElementById(connectingEdgeId(edge));
			if (!sourceInfo || !targetInfo || !connectingEdge.nonempty()) continue;

			const controls = computeArmTangentBezierControls(sourceInfo, targetInfo);
			connectingEdge.data('controlPointDistances', controls.distances);
			connectingEdge.data('controlPointWeights', controls.weights);
		}
	}

	function currentAnchorInfo(halfEdge: number) {
		if (!cy) return null;

		const anchor = cy.getElementById(anchorId(halfEdge));
		const vertexIndex = anchor.data('vertexIndex');
		const vertex = cy.getElementById(vertexId(vertexIndex));
		if (!anchor.nonempty() || !vertex.nonempty()) return null;

		return {
			anchor: anchor.position(),
			vertex: vertex.position()
		};
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

			cy.on('grab', '.v-node, .u-node, .orbifold-node', (event) => {
				event.target.scratch('previousPosition', { ...event.target.position() });
			});

			cy.on('drag', '.v-node, .u-node, .orbifold-node', (event) => {
				tooltip = null;
				const target = event.target;
				const previous = target.scratch('previousPosition') as { x: number; y: number } | undefined;
				if (!previous) return;

				const current = target.position();
				const dx = current.x - previous.x;
				const dy = current.y - previous.y;
				if (dx === 0 && dy === 0) return;

				translateStar(target, dx, dy);
				target.scratch('previousPosition', { ...current });
			});

			cy.on('free', '.v-node, .u-node, .orbifold-node', (event) => {
				event.target.removeScratch('previousPosition');
			});

			cy.on('tap', '[edgeId]', (event) => {
				void handleMutationEdgeTap(event.target);
			});

			cy.on('mouseover', '[edgeId]', () => {
				if (isSelectingMutationEdge()) container.style.cursor = 'pointer';
			});

			cy.on('mouseout', '[edgeId]', () => {
				if (container.style.cursor === 'pointer') container.style.cursor = '';
			});

			themeObserver = new MutationObserver(applyStylesheet);
			themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
			graphState.getCanvasSnapshot = canvasSnapshot;
			renderGraph();
			restorePendingSavedFile();
		}

		mountCytoscape();

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		graph;
		options;
		if (canApplyRenderOptionsInPlace()) {
			applyRenderOptionsInPlace();
		} else {
			renderGraph();
		}
		restorePendingSavedFile();
	});

	$effect(() => {
		if (graphState.mode === 'select-left-mutation-edge' || graphState.mode === 'select-right-mutation-edge') {
			infoMessage = 'Click an edge to mutate it.';
		} else if (!mutating) {
			infoMessage = '';
			if (container) container.style.cursor = '';
		}
	});

	onDestroy(() => {
		themeObserver?.disconnect();
		if (graphState.getCanvasSnapshot === canvasSnapshot) {
			graphState.getCanvasSnapshot = null;
		}
		cy?.destroy();
	});

	async function handleMutationEdgeTap(target: cytoscape.SingularElementReturnValue) {
		if (!cy || !graph || mutating) return;
		if (!isSelectingMutationEdge()) return;

		const edgeId = String(target.data('edgeId') ?? '');
		const selectedEdge = Number.parseInt(edgeId.replace(/^p/, ''), 10);
		if (!Number.isInteger(selectedEdge) || selectedEdge <= 0) return;

		const direction: MutationDirection = graphState.mode === 'select-left-mutation-edge' ? 'left' : 'right';
		mutating = true;
		infoMessage = `${direction === 'left' ? 'Left' : 'Right'} mutation in progress.`;

		await animateMutation(cy, graph, selectedEdge, direction);
		applyStylesheet();

		const nextGraph = mutateGraph(graph, edgeOrbit(selectedEdge, graph.orbifoldEdges), direction);
		await delay(ANIMATION_POST_MS);
		const vertexPositions = currentVertexPositions();
		graphState.graph = nextGraph;
		graphState.mode = 'idle';
		renderGraphWithCurrentVertexPositions(nextGraph, vertexPositions);
		mutating = false;
		infoMessage = '';
	}

	function delay(ms: number) {
		return new Promise((resolve) => window.setTimeout(resolve, ms));
	}

	function isSelectingMutationEdge() {
		return graphState.mode === 'select-left-mutation-edge' || graphState.mode === 'select-right-mutation-edge';
	}
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
	{#if infoMessage}
		<div class="info-bar">{infoMessage}</div>
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

	.info-bar {
		position: absolute;
		z-index: 2;
		top: 12px;
		left: 50%;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-panel);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
		color: var(--text-primary);
		padding: 7px 10px;
		font-size: 13px;
		transform: translateX(-50%);
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
