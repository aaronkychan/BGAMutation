<script lang="ts">
	import cytoscape from 'cytoscape';
	import { onDestroy, onMount } from 'svelte';
	import { buildElements, buildOrderingArrowElements, computeArmTangentBezierControls } from '$lib/graph/elements';
	import { registerCytoscapeExtensions } from '$lib/graph/extensions';
	import { anchorId, connectingEdgeId, orbifoldConnectingEdgeId, orbifoldEndId, vertexId } from '$lib/graph/ids';
	import { computeInitialVertexPositions } from '$lib/graph/positions';
	import { createStylesheet } from '$lib/graph/style';
	import type { RenderOptions } from '$lib/graph/types';
	import { ANIMATION_POST_MS, ANIMATION_POST_UPDATE_COLOR_MS, ORBIFOLD_EDGE_LENGTH } from '$lib/graph/constants';
	import { animateMutation } from '$lib/graph/animate';
	import { edgeOrbit, mutateGraph, type MutationDirection } from '$lib/math/kaur';
	import { graphState } from '$lib/state/graph.svelte';
	import type { BrauerGraph, NodePositions, SavedFile } from '$lib/math/types';

	export interface CanvasController {
		drawGraph: (graph: BrauerGraph, options: RenderOptions) => void;
		clearGraph: () => void;
		loadSavedFile: (savedFile: SavedFile, options: RenderOptions) => void;
	}

	let {
		options,
		onCanvasReady,
		onGraphMutated
	}: {
		options: RenderOptions;
		onCanvasReady?: (controller: CanvasController) => void;
		onGraphMutated?: (graph: BrauerGraph) => void;
	} = $props();

	let container: HTMLDivElement;
	let cy: cytoscape.Core | null = null;
	let themeObserver: MutationObserver | null = null;
	let tooltip = $state<{ x: number; y: number; text: string } | null>(null);
	let infoMessage = $state('');
	let canvasHasGraph = $state(false);
	let mutating = false;
	let adjustingHalfEdge: number | null = null;
	let adjustModeWasActive = false;
	let renderedGraph: BrauerGraph | null = null;
	let renderedOptions: RenderOptions | null = null;

	function renderGraph(nextGraph: BrauerGraph | null, renderOptions: RenderOptions = options) {
		if (!cy || !container) return;

		if (!nextGraph) {
			cy.elements().remove();
			tooltip = null;
			canvasHasGraph = false;
			renderedGraph = null;
			renderedOptions = null;
			return;
		}

		const rect = container.getBoundingClientRect();
		const positions = computeInitialVertexPositions(nextGraph.sigma0.length, renderOptions.layout, {
			x: rect.width / 2,
			y: rect.height / 2
		});

		cy.elements().remove();
		cy.add(buildElements(nextGraph, positions, renderOptions));
		cy.layout({ name: 'preset', fit: false }).run();
		cy.center();
		canvasHasGraph = true;
		renderedGraph = nextGraph;
		renderedOptions = { ...renderOptions };
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
		restoreVertexPositions(positions);
		renderedGraph = nextGraph;
		renderedOptions = { ...options };
	}

	function updateGraphInPlace(nextGraph: BrauerGraph, selected: Set<number>) {
		if (!cy) return;

		const positions = mutationNodePositions(nextGraph, selected);
		const vertexCount = Object.keys(currentVertexPositions()).length;
		if (vertexCount !== nextGraph.sigma0.length) {
			renderGraphWithCurrentVertexPositions(nextGraph, positions);
			return;
		}

		nextGraph.sigma0.forEach((_, vertexIndex) => {
			const vertex = cy?.getElementById(vertexId(vertexIndex));
			const multiplicity = nextGraph.multiplicity[vertexIndex] ?? 1;
			vertex?.data({
				vertexIndex,
				multiplicity,
				multiplicityLabel: options.showMultiplicityLabels ? String(multiplicity) : ''
			});
			vertex?.classes(`v-node ${multiplicity > 1 ? 'filled' : 'hollow'}`);
		});

		cy.elements().not('.v-node, .star-parent').remove();
		cy.add(
			buildElements(nextGraph, positions, options).filter(
				(element) =>
					!(
						element.group === 'nodes' &&
						String(element.classes)
							.split(/\s+/)
							.some((className) => className === 'v-node' || className === 'star-parent')
					)
			)
		);
		cy.layout({ name: 'preset', fit: false }).run();
		restoreVertexPositions(positions);
		renderedGraph = nextGraph;
		renderedOptions = { ...options };
	}

	function mutationNodePositions(nextGraph: BrauerGraph, selected: Set<number>): NodePositions {
		const positions: NodePositions = currentVertexPositions();
		const existing = currentNonVertexNodePositions();
		const orbifoldEdges = new Set(nextGraph.orbifoldEdges ?? []);

		nextGraph.sigma0.forEach((cycle) => {
			if (cycle.every((halfEdge) => selected.has(halfEdge))) {
				for (const halfEdge of cycle) {
					const existingAnchor = existing[anchorId(halfEdge)];
					if (existingAnchor) positions[anchorId(halfEdge)] = existingAnchor;
				}
				return;
			}

			for (const halfEdge of cycle) {
				const existingAnchor = existing[anchorId(halfEdge)];
				if (!selected.has(halfEdge) && existingAnchor) positions[anchorId(halfEdge)] = existingAnchor;
			}
		});

		nextGraph.sigma0.forEach((cycle, vertexIndex) => {
			const vertexPosition = positions[vertexId(vertexIndex)];
			if (!vertexPosition || cycle.length === 0) return;
			if (cycle.every((halfEdge) => selected.has(halfEdge))) return;

			for (let index = 0; index < cycle.length; index += 1) {
				const current = cycle[index];
				const previous = cycle[(index - 1 + cycle.length) % cycle.length];
				if (!selected.has(current) || selected.has(previous)) continue;

				const run: number[] = [];
				let cursor = index;
				while (selected.has(cycle[cursor])) {
					run.push(cycle[cursor]);
					cursor = (cursor + 1) % cycle.length;
				}

				const before = cycle[(index - 1 + cycle.length) % cycle.length];
				const after = cycle[cursor % cycle.length];
				const beforePosition = positions[anchorId(before)] ?? existing[anchorId(before)];
				const afterPosition = positions[anchorId(after)] ?? existing[anchorId(after)];
				if (!beforePosition || !afterPosition || selected.has(before) || selected.has(after)) continue;

				const inserted = interpolateSector(vertexPosition, beforePosition, afterPosition, run.length);
				run.forEach((halfEdge, runIndex) => {
					positions[anchorId(halfEdge)] = inserted[runIndex];
				});
			}
		});

		for (const edge of orbifoldEdges) {
			const halfEdge = edge;
			const oId = orbifoldEndId(halfEdge);
			const existingOrbifoldEnd = existing[oId];
			if (existingOrbifoldEnd && !selected.has(halfEdge)) {
				positions[oId] = existingOrbifoldEnd;
				continue;
			}

			const sourceInfo = anchorVertexInfo(halfEdge, nextGraph, positions);
			if (!sourceInfo) continue;
			positions[oId] = extendFromVertex(sourceInfo.vertex, sourceInfo.anchor, ORBIFOLD_EDGE_LENGTH);
		}

		return positions;
	}

	function currentNonVertexNodePositions(): NodePositions {
		const positions: NodePositions = {};
		if (!cy) return positions;

		cy.nodes('.u-node, .orbifold-node').forEach((node) => {
			positions[node.id()] = { ...node.position() };
		});

		return positions;
	}

	function interpolateSector(
		vertex: { x: number; y: number },
		before: { x: number; y: number },
		after: { x: number; y: number },
		count: number
	): Array<{ x: number; y: number }> {
		const start = angleFromNorth(vertex, before);
		const end = angleFromNorth(vertex, after);
		const delta = directedAngleDelta(start, end);
		const radius = (distance(vertex, before) + distance(vertex, after)) / 2;

		return Array.from({ length: count }, (_, index) => {
			const theta = start + (delta * (index + 1)) / (count + 1);
			return {
				x: vertex.x + radius * Math.sin(theta),
				y: vertex.y - radius * Math.cos(theta)
			};
		});
	}

	function angleFromNorth(origin: { x: number; y: number }, point: { x: number; y: number }) {
		const theta = Math.atan2(point.x - origin.x, origin.y - point.y);
		return theta < 0 ? theta + 2 * Math.PI : theta;
	}

	function directedAngleDelta(start: number, end: number) {
		const tau = 2 * Math.PI;
		const clockwise = (end - start + tau) % tau || tau;
		const counterclockwise = -((start - end + tau) % tau || tau);
		return options.direction === 'CW' ? clockwise : counterclockwise;
	}

	function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	function extendFromVertex(
		vertex: { x: number; y: number },
		anchor: { x: number; y: number },
		extraLength: number
	): { x: number; y: number } {
		const length = distance(vertex, anchor);
		if (length === 0) return { ...anchor };

		const scale = (length + extraLength) / length;
		return {
			x: vertex.x + (anchor.x - vertex.x) * scale,
			y: vertex.y + (anchor.y - vertex.y) * scale
		};
	}

	function anchorVertexInfo(halfEdge: number, graph: BrauerGraph, positions: NodePositions) {
		for (const [vertexIndex, cycle] of graph.sigma0.entries()) {
			if (!cycle.includes(halfEdge)) continue;
			const vertex = positions[vertexId(vertexIndex)];
			const anchor = positions[anchorId(halfEdge)];
			if (!vertex || !anchor) return null;
			return { vertex, anchor };
		}

		return null;
	}

	function restoreVertexPositions(positions: NodePositions) {
		if (!cy) return;

		for (const [id, position] of Object.entries(positions)) {
			cy.getElementById(id).position(position);
		}
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
		if (!cy || !renderedGraph) return;

		const orbifoldEdges = new Set(renderedGraph.orbifoldEdges ?? []);

		renderedGraph.sigma0.forEach((cycle, vertexIndex) => {
			const multiplicity = renderedGraph?.multiplicity[vertexIndex] ?? 1;
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

		for (let edge = 1; edge <= renderedGraph.n; edge += 1) {
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
					renderedGraph,
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
				renderedGraph &&
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
		if (!cy || !renderedGraph) return;

		const movedHalfEdges = cy
			.nodes(`[parent = "${parentId}"].u-node`)
			.map((node) => Number(node.data('h')))
			.filter((halfEdge) => Number.isInteger(halfEdge));

		for (const halfEdge of movedHalfEdges) {
			const edge = Math.abs(halfEdge);
			if (renderedGraph.orbifoldEdges?.includes(edge)) continue;

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

	function beginAdjustEmanatingAngle(target: cytoscape.SingularElementReturnValue) {
		if (!cy || !renderedGraph || !target.hasClass('he-edge')) return;

		const halfEdge = Number(target.data('h'));
		if (!Number.isInteger(halfEdge)) return;

		adjustingHalfEdge = halfEdge;
		infoMessage = 'Move pointer to adjust the emanating angle. Click blank canvas to finish.';
		highlightHalfEdgeArms(halfEdge);
	}

	function adjustSelectedAnchor(pointer: { x: number; y: number }) {
		if (!cy || !renderedGraph || adjustingHalfEdge === null) return;

		const anchor = cy.getElementById(anchorId(adjustingHalfEdge));
		if (!anchor.nonempty()) return;

		const vertexIndex = Number(anchor.data('vertexIndex'));
		const vertex = cy.getElementById(vertexId(vertexIndex));
		const cycle = renderedGraph.sigma0[vertexIndex];
		const cycleIndex = cycle?.indexOf(adjustingHalfEdge) ?? -1;
		if (!vertex.nonempty() || !cycle || cycleIndex === -1) return;

		const vertexPosition = vertex.position();
		const previous = cycle[(cycleIndex - 1 + cycle.length) % cycle.length];
		const next = cycle[(cycleIndex + 1) % cycle.length];
		const radius = distance(vertexPosition, anchor.position());
		const pointerAngle = angleFromNorth(vertexPosition, pointer);
		const nextPosition = constrainedAnchorPosition(vertexPosition, radius, pointerAngle, previous, next);
		if (!nextPosition) return;

		anchor.position(nextPosition);
		updateOrbifoldEndForAnchor(adjustingHalfEdge, vertexPosition, nextPosition);
		updateIncidentBezierControls(String(anchor.data('parent')));
	}

	function constrainedAnchorPosition(
		vertex: { x: number; y: number },
		radius: number,
		pointerAngle: number,
		previous: number,
		next: number
	): { x: number; y: number } | null {
		if (!cy || adjustingHalfEdge === null) return null;
		if (previous === adjustingHalfEdge || next === adjustingHalfEdge) {
			return pointFromAngle(vertex, radius, pointerAngle);
		}

		const previousAnchor = cy.getElementById(anchorId(previous));
		const nextAnchor = cy.getElementById(anchorId(next));
		if (!previousAnchor.nonempty() || !nextAnchor.nonempty()) return pointFromAngle(vertex, radius, pointerAngle);

		const start = angleFromNorth(vertex, previousAnchor.position());
		const end = angleFromNorth(vertex, nextAnchor.position());
		const total = directedAngleDelta(start, end);
		const fromStart = directedAngleDelta(start, pointerAngle);
		const margin = Math.PI / 180;
		const clamped = Math.min(Math.max(Math.abs(fromStart), margin), Math.max(margin, Math.abs(total) - margin));
		const signedClamped = total < 0 ? -clamped : clamped;

		return pointFromAngle(vertex, radius, normalizeAngle(start + signedClamped));
	}

	function updateOrbifoldEndForAnchor(
		halfEdge: number,
		vertex: { x: number; y: number },
		anchor: { x: number; y: number }
	) {
		if (!cy || !renderedGraph?.orbifoldEdges?.includes(Math.abs(halfEdge)) || halfEdge < 0) return;

		const orbifoldEnd = cy.getElementById(orbifoldEndId(halfEdge));
		if (!orbifoldEnd.nonempty()) return;

		orbifoldEnd.position(extendFromVertex(vertex, anchor, ORBIFOLD_EDGE_LENGTH));
	}

	function finishAdjustEmanatingAngle() {
		if (graphState.mode !== 'adjust-emanating-angle') return;

		adjustingHalfEdge = null;
		highlightHalfEdgeArms(null);
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function highlightHalfEdgeArms(activeHalfEdge: number | 'all' | null = 'all') {
		if (!cy) return;

		const styles = getComputedStyle(document.documentElement);
		const highlight = styles.getPropertyValue('--highlight-color').trim();
		cy.edges('.he-edge').forEach((edge) => {
			const isClearing = activeHalfEdge === null;
			const isActive = activeHalfEdge !== 'all' && Number(edge.data('h')) === activeHalfEdge;
			edge.style({
				width: isClearing ? '' : isActive ? 5 : 3,
				'line-color': isClearing ? '' : highlight,
				'target-arrow-color': isClearing ? '' : highlight,
				'line-opacity': isClearing ? '' : isActive ? 1 : 0.65
			});
		});
	}

	function pointFromAngle(origin: { x: number; y: number }, radius: number, angle: number) {
		return {
			x: origin.x + radius * Math.sin(angle),
			y: origin.y - radius * Math.cos(angle)
		};
	}

	function normalizeAngle(angle: number) {
		const tau = 2 * Math.PI;
		return ((angle % tau) + tau) % tau;
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
				if (graphState.mode === 'adjust-emanating-angle') return;
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
				if (graphState.mode === 'adjust-emanating-angle') {
					beginAdjustEmanatingAngle(event.target);
					return;
				}
				void handleMutationEdgeTap(event.target);
			});

			cy.on('tap', (event) => {
				if (event.target === cy) finishAdjustEmanatingAngle();
			});

			cy.on('mousemove', (event) => {
				if (graphState.mode === 'adjust-emanating-angle' && adjustingHalfEdge !== null) {
					adjustSelectedAnchor(event.position);
				}
			});

			cy.on('mouseover', '[edgeId]', () => {
				if (isSelectingMutationEdge()) container.style.cursor = 'pointer';
				if (graphState.mode === 'adjust-emanating-angle') container.style.cursor = 'crosshair';
			});

			cy.on('mouseout', '[edgeId]', () => {
				if (container.style.cursor === 'pointer') container.style.cursor = '';
				if (container.style.cursor === 'crosshair') container.style.cursor = '';
			});

			themeObserver = new MutationObserver(applyStylesheet);
			themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
			graphState.getCanvasSnapshot = canvasSnapshot;
			onCanvasReady?.({
				drawGraph: (graph, drawOptions) => renderGraph(graph, drawOptions),
				clearGraph: () => renderGraph(null),
				loadSavedFile: (savedFile, loadOptions) => {
					cy?.json(savedFile.cytoscapeJson);
					cy?.layout({ name: 'preset', fit: false }).run();
					applyStylesheet();
					canvasHasGraph = true;
					renderedGraph = savedFile.graph;
					renderedOptions = { ...loadOptions };
				}
			});
		}

		mountCytoscape();

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		options;
		if (!renderedGraph) return;

		if (canApplyRenderOptionsInPlace()) {
			applyRenderOptionsInPlace();
		} else {
			renderGraph(renderedGraph, options);
		}
	});

	$effect(() => {
		if (graphState.mode === 'adjust-emanating-angle') {
			adjustModeWasActive = true;
			if (canvasHasGraph) {
				infoMessage = adjustingHalfEdge === null
					? 'Click a half-edge arm to adjust its emanating angle.'
					: infoMessage;
				if (adjustingHalfEdge === null) highlightHalfEdgeArms('all');
			}
		} else if (adjustModeWasActive) {
			adjustModeWasActive = false;
			adjustingHalfEdge = null;
			highlightHalfEdgeArms(null);
			if (!mutating) infoMessage = '';
		}
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
		if (!cy || !renderedGraph || mutating) return;
		if (!isSelectingMutationEdge()) return;

		const edgeId = String(target.data('edgeId') ?? '');
		const selectedEdge = Number.parseInt(edgeId.replace(/^p/, ''), 10);
		if (!Number.isInteger(selectedEdge) || selectedEdge <= 0) return;

		const direction: MutationDirection = graphState.mode === 'select-left-mutation-edge' ? 'left' : 'right';
		mutating = true;
		infoMessage = 'Invovled edges highlighted';

		const animationResult = await animateMutation(cy, renderedGraph, selectedEdge, direction, (message) => {
			infoMessage = message;
		});

		const nextGraph = mutateGraph(renderedGraph, edgeOrbit(selectedEdge, renderedGraph.orbifoldEdges), direction);
		infoMessage = 'Graph updated';
		await delay(ANIMATION_POST_MS);
		updateGraphInPlace(nextGraph, edgeOrbit(selectedEdge, renderedGraph.orbifoldEdges));
		colorNeighborEdgesTemporarily(animationResult.neighborEdgeColors);
		onGraphMutated?.(nextGraph);
		graphState.mode = 'idle';
		await delay(ANIMATION_POST_UPDATE_COLOR_MS);
		clearNeighborEdgeColors(animationResult.neighborEdgeColors);
		mutating = false;
		infoMessage = '';
	}

	function colorNeighborEdgesTemporarily(neighborEdgeColors: Map<number, string>) {
		if (!cy) return;

		for (const [edgeNumber, color] of neighborEdgeColors.entries()) {
			cy.edges(`[edgeId = "p${edgeNumber}"]`).forEach((edge) => {
				edge.style({
					'line-fill': 'solid',
					'line-color': color,
					'target-arrow-color': color
				});
			});
		}
	}

	function clearNeighborEdgeColors(neighborEdgeColors: Map<number, string>) {
		if (!cy) return;

		for (const edgeNumber of neighborEdgeColors.keys()) {
			cy.edges(`[edgeId = "p${edgeNumber}"]`).forEach((edge) => {
				edge.style({
					'line-fill': 'solid',
					'line-color': '',
					'target-arrow-color': '',
					'line-gradient-stop-colors': '',
					'line-gradient-stop-positions': ''
				});
			});
		}
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
		{#if !canvasHasGraph}
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
