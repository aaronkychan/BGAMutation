<script lang="ts">
	import cytoscape from 'cytoscape';
	import { onDestroy, onMount } from 'svelte';
	import {
		buildElements,
		buildOrderingArrowElements,
		computeArmTangentBezierControls
	} from '$lib/graph/elements';
	import { registerCytoscapeExtensions } from '$lib/graph/extensions';
	import { anchorId, connectingEdgeId, orbifoldConnectingEdgeId, orbifoldEndId, starParentId, vertexId } from '$lib/graph/ids';
	import { computeInitialVertexPositions } from '$lib/graph/positions';
	import { createStylesheet } from '$lib/graph/style';
	import type { RenderOptions } from '$lib/graph/types';
	import { ANIMATION_POST_MS, ANIMATION_POST_UPDATE_COLOR_MS, ORBIFOLD_EDGE_LENGTH } from '$lib/graph/constants';
	import { animateMutation } from '$lib/graph/animate';
	import { edgeOrbit, mutateGraph, type MutationDirection } from '$lib/math/kaur';
	import { graphState } from '$lib/state/graph.svelte';
	import type { BrauerGraph, NodePositions, SavedFile } from '$lib/math/types';
	import Modal from './Modal.svelte';

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
	let adjustArcCurvatureWasActive = false;
	let selectedArcId: string | null = null;
	let rotatingVertexIndex: number | null = null;
	let rotationStartAngle = 0;
	let rotationStartPositions = new Map<string, { x: number; y: number }>();
	let rotateModeWasActive = false;
	let modifyMultiplicityWasActive = false;
	let addVertexWasActive = false;
	let addHalfEdgeWasActive = false;
	let addOrbifoldWasActive = false;
	let reconnectArcWasActive = false;
	let removeVertexWasActive = false;
	let removeArcWasActive = false;
	let removeHalfEdgeWasActive = false;
	let multiplicityModalVertexIndex = $state<number | null>(null);
	let addVertexPosition = $state<{ x: number; y: number } | null>(null);
	let addHalfEdgeAfter = $state<number | null>(null);
	let reconnectSourceHalfEdge = $state<number | null>(null);
	let renderedGraph = $state<BrauerGraph | null>(null);
	let renderedOptions: RenderOptions | null = null;
	const MIN_ARM_RADIUS = 14;
	const FAR_ENOUGH_PX = 48;

	function renderGraph(nextGraph: BrauerGraph | null, renderOptions: RenderOptions = options) {
		if (!cy || !container) return;

		if (!nextGraph) {
			cy.elements().remove();
			tooltip = null;
			canvasHasGraph = false;
			renderedGraph = null;
			renderedOptions = null;
			graphState.armLength = null;
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
		publishCurrentArmLength();
	}

	function applyStylesheet() {
		if (!cy) return;
		cy.style(createStylesheet()).update();
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
		publishCurrentArmLength();
	}

	function rebuildGraphWithPositions(nextGraph: BrauerGraph, positions: NodePositions) {
		if (!cy) return;

		cy.elements().remove();
		cy.add(buildElements(nextGraph, positions, options));
		cy.layout({ name: 'preset', fit: false }).run();
		restoreVertexPositions(positions);
		renderedGraph = nextGraph;
		renderedOptions = { ...options };
		canvasHasGraph = nextGraph.sigma0.length > 0;
		publishCurrentArmLength();
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
			vertex?.data('vertexIndex', vertexIndex);
			updateVertexMultiplicityDisplay(vertexIndex, nextGraph.multiplicity[vertexIndex] ?? 1);
		});

		cy.elements().not('.v-node').remove();
		cy.add(
			buildElements(nextGraph, positions, options).filter(
				(element) =>
					!(
						element.group === 'nodes' &&
						String(element.classes)
							.split(/\s+/)
							.some((className) => className === 'v-node')
					)
			)
		);
		cy.layout({ name: 'preset', fit: false }).run();
		restoreVertexPositions(positions);
		renderedGraph = nextGraph;
		renderedOptions = { ...options };
		publishCurrentArmLength();
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
			updateVertexMultiplicityDisplay(vertexIndex, renderedGraph?.multiplicity[vertexIndex] ?? 1);

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

	function shouldShowMultiplicityLabels() {
		return options.showMultiplicityLabels || graphState.mode === 'modify-multiplicity';
	}

	function updateVertexMultiplicityDisplay(vertexIndex: number, multiplicity: number) {
		if (!cy) return;

		const vertex = cy.getElementById(vertexId(vertexIndex));
		if (!vertex.nonempty()) return;

		vertex.data({
			multiplicity,
			multiplicityLabel: shouldShowMultiplicityLabels() ? String(multiplicity) : ''
		});
		vertex.classes(`v-node ${multiplicity > 1 ? 'filled' : 'hollow'}`);
	}

	function refreshMultiplicityLabels() {
		if (!cy || !renderedGraph) return;

		renderedGraph.multiplicity.forEach((multiplicity, vertexIndex) => {
			updateVertexMultiplicityDisplay(vertexIndex, multiplicity ?? 1);
		});
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
		const starId = target.data('starId');
		if (!starId) return;

		cy
			?.nodes(`[starId = "${starId}"]`)
			.not(target)
			.positions((node) => ({
				x: node.position('x') + dx,
				y: node.position('y') + dy
			}));

		updateIncidentBezierControls(starId);
	}

	function updateIncidentBezierControls(starId: string) {
		if (!cy || !renderedGraph) return;

		const movedHalfEdges = cy
			.nodes(`[starId = "${starId}"].u-node`)
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

	function beginAdjustEmanatingAngle(event: cytoscape.EventObject) {
		if (!cy || !renderedGraph) return;

		const halfEdge = halfEdgeForAdjustTarget(event.target, event.position);
		if (!Number.isInteger(halfEdge)) return;

		adjustingHalfEdge = halfEdge;
		infoMessage = 'Move pointer to adjust the emanating angle. Click blank canvas to finish.';
		highlightHalfEdgeArms(halfEdge);
	}

	function halfEdgeForAdjustTarget(target: cytoscape.SingularElementReturnValue, position: { x: number; y: number }): number {
		if (!cy) return Number.NaN;
		const core = cy;
		if (target.hasClass('he-edge') || target.hasClass('u-node')) {
			return Number(target.data('h'));
		}

		const edgeId = String(target.data('edgeId') ?? '');
		const edgeNumber = Number.parseInt(edgeId.replace(/^p/, ''), 10);
		if (!Number.isInteger(edgeNumber)) return Number.NaN;

		const candidates = renderedGraph?.orbifoldEdges?.includes(edgeNumber) ? [edgeNumber] : [edgeNumber, -edgeNumber];
		return candidates.reduce((closest, halfEdge) => {
			const anchor = core.getElementById(anchorId(halfEdge));
			if (!anchor.nonempty()) return closest;

			const candidateDistance = distance(position, anchor.position());
			return candidateDistance < closest.distance ? { halfEdge, distance: candidateDistance } : closest;
		}, { halfEdge: Number.NaN, distance: Number.POSITIVE_INFINITY }).halfEdge;
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
		updateIncidentBezierControls(String(anchor.data('starId')));
	}

	function beginAdjustArcCurvature(target: cytoscape.SingularElementReturnValue) {
		if (!cy || !target.hasClass('ordinary-edge')) return;

		clearArcCurvatureHandles();
		selectedArcId = target.id();
		highlightSelectedArc(target);
		showArcCurvatureHandles(target);
		infoMessage = 'Drag Bezier control points to adjust the arc.';
	}

	function showArcCurvatureHandles(edge: cytoscape.SingularElementReturnValue) {
		if (!cy) return;

		const controls = controlPositionsForEdge(edge);
		if (!controls.length) return;
		const sourceId = edge.source().id();
		const targetId = edge.target().id();

		cy.add(
			controls.map((position, index) => ({
				group: 'nodes',
				data: {
					id: arcControlId(edge.id(), index),
					edgeId: edge.id(),
					controlIndex: index
				},
				position,
				classes: 'curve-control-node',
				grabbable: true
			}))
		);
		cy.add(
			controls.flatMap((_, index) => {
				const controlId = arcControlId(edge.id(), index);
				if (controls.length === 1) {
					return [
						curveControlGuide(edge.id(), index, 'source', sourceId, controlId),
						curveControlGuide(edge.id(), index, 'target', targetId, controlId)
					];
				}

				const endpointId = index < controls.length / 2 ? sourceId : targetId;
				const side = endpointId === sourceId ? 'source' : 'target';
				return [curveControlGuide(edge.id(), index, side, endpointId, controlId)];
			})
		);
	}

	function curveControlGuide(
		edgeId: string,
		index: number,
		side: 'source' | 'target',
		endpointId: string,
		controlId: string
	) {
		return {
			group: 'edges' as const,
			data: {
				id: `${arcControlId(edgeId, index)}-guide-${side}`,
				source: endpointId,
				target: controlId
			},
			classes: 'curve-control-guide'
		};
	}

	function updateArcCurvatureFromHandles(edgeId: string) {
		if (!cy) return;

		const edge = cy.getElementById(edgeId);
		if (!edge.nonempty()) return;

		const source = edge.source().position();
		const target = edge.target().position();
		const handles = cy
			.nodes('.curve-control-node')
			.filter((node) => node.data('edgeId') === edgeId)
			.sort((a, b) => Number(a.data('controlIndex')) - Number(b.data('controlIndex')));
		const projected = handles.map((handle) =>
			projectControlPoint((handle as cytoscape.NodeSingular).position(), source, target)
		);
		edge.data('controlPointDistances', projected.map((control) => control.distance).join(' '));
		edge.data('controlPointWeights', projected.map((control) => control.weight).join(' '));
	}

	function controlPositionsForEdge(edge: cytoscape.SingularElementReturnValue) {
		const source = edge.source().position();
		const target = edge.target().position();
		const distances = parseNumberList(String(edge.data('controlPointDistances') ?? ''));
		const weights = parseNumberList(String(edge.data('controlPointWeights') ?? ''));

		return distances.map((controlDistance, index) =>
			controlPointPosition(source, target, controlDistance, weights[index] ?? 0.5)
		);
	}

	function controlPointPosition(
		source: { x: number; y: number },
		target: { x: number; y: number },
		controlDistance: number,
		weight: number
	) {
		const dx = target.x - source.x;
		const dy = target.y - source.y;
		const length = Math.hypot(dx, dy);
		if (length === 0) return { ...source };

		const chordX = dx / length;
		const chordY = dy / length;
		const normalX = -chordY;
		const normalY = chordX;
		return {
			x: source.x + chordX * weight * length + normalX * controlDistance,
			y: source.y + chordY * weight * length + normalY * controlDistance
		};
	}

	function projectControlPoint(
		point: { x: number; y: number },
		source: { x: number; y: number },
		target: { x: number; y: number }
	) {
		const dx = target.x - source.x;
		const dy = target.y - source.y;
		const length = Math.hypot(dx, dy);
		if (length === 0) return { distance: 0, weight: 0.5 };

		const chordX = dx / length;
		const chordY = dy / length;
		const normalX = -chordY;
		const normalY = chordX;
		const pointDx = point.x - source.x;
		const pointDy = point.y - source.y;
		return {
			distance: pointDx * normalX + pointDy * normalY,
			weight: (pointDx * chordX + pointDy * chordY) / length
		};
	}

	function parseNumberList(value: string) {
		return value
			.trim()
			.split(/\s+/)
			.map(Number)
			.filter(Number.isFinite);
	}

	function highlightSelectedArc(edge: cytoscape.SingularElementReturnValue | null) {
		if (!cy) return;

		const styles = getComputedStyle(document.documentElement);
		const highlight = styles.getPropertyValue('--accent').trim();
		cy.edges('.ordinary-edge').forEach((ordinaryEdge) => {
			const active = edge !== null && ordinaryEdge.id() === edge.id();
			ordinaryEdge.style({
				width: active ? 5 : '',
				'line-color': active ? highlight : '',
				'target-arrow-color': active ? highlight : '',
				'line-opacity': active ? 1 : ''
			});
		});
	}

	function clearArcCurvatureHandles() {
		cy?.edges('.curve-control-guide').remove();
		cy?.nodes('.curve-control-node').remove();
		highlightSelectedArc(null);
		selectedArcId = null;
	}

	function exitAdjustArcCurvature() {
		if (graphState.mode !== 'adjust-arc-curvature') return;

		clearArcCurvatureHandles();
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function arcControlId(edgeId: string, index: number) {
		return `curve-control-${edgeId}-${index}`;
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

	function setAllArmLengths(nextLength: number) {
		if (!cy || !renderedGraph) return;
		const targetRadius = Math.max(MIN_ARM_RADIUS, nextLength);

		for (const [vertexIndex, cycle] of renderedGraph.sigma0.entries()) {
			const vertex = cy.getElementById(vertexId(vertexIndex));
			if (!vertex.nonempty()) continue;

			const vertexPosition = vertex.position();
			for (const halfEdge of cycle) {
				const anchor = cy.getElementById(anchorId(halfEdge));
				if (!anchor.nonempty()) continue;

				const current = anchor.position();
				const currentRadius = distance(vertexPosition, current);
				if (currentRadius === 0) continue;

				const scale = targetRadius / currentRadius;
				const nextAnchor = {
					x: vertexPosition.x + (current.x - vertexPosition.x) * scale,
					y: vertexPosition.y + (current.y - vertexPosition.y) * scale
				};
				anchor.position(nextAnchor);
				updateOrbifoldEndForAnchor(halfEdge, vertexPosition, nextAnchor);
			}

			updateIncidentBezierControls(String(vertex.data('starId')));
		}

		publishCurrentArmLength();
		infoMessage = `Half-edge arm length set to ${Math.round(targetRadius)}.`;
		window.setTimeout(() => {
			if (!mutating && graphState.mode !== 'adjust-emanating-angle') infoMessage = '';
		}, 900);
	}

	function confirmAdjustSelection(position?: { x: number; y: number }) {
		if (graphState.mode !== 'adjust-emanating-angle') return;

		if (position && adjustingHalfEdge !== null) {
			adjustSelectedAnchor(position);
		}

		adjustingHalfEdge = null;
		highlightHalfEdgeArms('all');
		infoMessage = 'Click a half-edge arm to adjust its emanating angle.';
	}

	function exitAdjustEmanatingAngle() {
		if (graphState.mode !== 'adjust-emanating-angle') return;

		adjustingHalfEdge = null;
		highlightHalfEdgeArms(null);
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function beginRotateVertex(event: cytoscape.EventObject) {
		if (!cy || !renderedGraph || !event.target.hasClass('v-node')) return;

		const vertexIndex = Number(event.target.data('vertexIndex'));
		if (!Number.isInteger(vertexIndex)) return;

		rotatingVertexIndex = vertexIndex;
		const vertexPosition = event.target.position();
		rotationStartAngle = angleFromNorth(vertexPosition, event.position);
		rotationStartPositions = snapshotStarPositions(vertexIndex);
		infoMessage = 'Move pointer to rotate the vertex. Click anywhere to confirm.';
		highlightVertexNodes(vertexIndex);
		highlightVertexArms(vertexIndex);
	}

	function rotateSelectedVertex(pointer: { x: number; y: number }) {
		if (!cy || !renderedGraph || rotatingVertexIndex === null) return;

		const vertex = cy.getElementById(vertexId(rotatingVertexIndex));
		const cycle = renderedGraph.sigma0[rotatingVertexIndex];
		if (!vertex.nonempty() || !cycle) return;

		const vertexPosition = vertex.position();
		const delta = signedAngleDelta(rotationStartAngle, angleFromNorth(vertexPosition, pointer));
		const starId = String(vertex.data('starId'));

		for (const halfEdge of cycle) {
			const anchor = cy.getElementById(anchorId(halfEdge));
			const start = rotationStartPositions.get(anchor.id());
			if (!anchor.nonempty() || !start) continue;

			const nextAnchor = rotatePoint(vertexPosition, start, delta);
			anchor.position(nextAnchor);
			updateOrbifoldEndForAnchor(halfEdge, vertexPosition, nextAnchor);
		}

		updateIncidentBezierControls(starId);
	}

	function confirmRotateSelection(position?: { x: number; y: number }) {
		if (graphState.mode !== 'rotate-vertex') return;

		if (position && rotatingVertexIndex !== null) {
			rotateSelectedVertex(position);
		}

		rotatingVertexIndex = null;
		rotationStartPositions = new Map();
		highlightVertexNodes('all');
		highlightVertexArms(null);
		infoMessage = 'Click a vertex to rotate its half-edge arms.';
	}

	function exitRotateVertex() {
		if (graphState.mode !== 'rotate-vertex') return;

		rotatingVertexIndex = null;
		rotationStartPositions = new Map();
		highlightVertexNodes(null);
		highlightVertexArms(null);
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function beginModifyMultiplicity(target: cytoscape.SingularElementReturnValue) {
		if (!cy || !renderedGraph || !target.hasClass('v-node')) return;

		const vertexIndex = Number(target.data('vertexIndex'));
		if (!Number.isInteger(vertexIndex)) return;

		multiplicityModalVertexIndex = vertexIndex;
		highlightVertexNodes(vertexIndex);
		infoMessage = `Changing multiplicity of v${vertexIndex + 1}.`;
	}

	function confirmMultiplicityEdit(values: string[]) {
		if (!renderedGraph || multiplicityModalVertexIndex === null) return;

		const value = Number(values[0]);
		if (!Number.isInteger(value) || value < 1) {
			infoMessage = 'Multiplicity must be a positive integer.';
			return;
		}

		const vertexIndex = multiplicityModalVertexIndex;
		const nextGraph: BrauerGraph = {
			...renderedGraph,
			multiplicity: renderedGraph.multiplicity.map((multiplicity, index) =>
				index === vertexIndex ? value : multiplicity
			)
		};

		renderedGraph = nextGraph;
		updateVertexMultiplicityDisplay(vertexIndex, value);
		onGraphMutated?.(nextGraph);
		multiplicityModalVertexIndex = null;
		highlightVertexNodes('all');
		infoMessage = 'Click a vertex to change its multiplicity.';
	}

	function cancelMultiplicityEdit() {
		multiplicityModalVertexIndex = null;
		if (graphState.mode === 'modify-multiplicity') {
			highlightVertexNodes('all');
			infoMessage = 'Click a vertex to change its multiplicity.';
		}
	}

	function exitModifyMultiplicity() {
		if (graphState.mode !== 'modify-multiplicity') return;

		multiplicityModalVertexIndex = null;
		highlightVertexNodes(null);
		graphState.mode = 'idle';
		refreshMultiplicityLabels();
		infoMessage = '';
	}

	function beginAddVertex(position: { x: number; y: number }) {
		if (!cy) return;

		const tooClose = cy.nodes('.v-node').some((node) => {
			const vertex = node as cytoscape.NodeSingular;
			return distance(vertex.position(), position) < FAR_ENOUGH_PX;
		});
		if (tooClose) {
			infoMessage = 'Too close to an existing vertex.';
			window.setTimeout(() => {
				if (!mutating && graphState.mode === 'add-vertex' && addVertexPosition === null) {
					infoMessage = 'Click an empty area to place a new vertex.';
				}
			}, 900);
			return;
		}

		addVertexPosition = { ...position };
		infoMessage = 'Enter the number of half-edges for the new vertex.';
	}

	function confirmAddVertex(values: string[]) {
		if (!cy || !addVertexPosition) return;

		const halfEdgeCount = Number(values[0]);
		const multiplicity = Number(values[1] || 1);
		if (!Number.isInteger(halfEdgeCount) || halfEdgeCount < 1) {
			infoMessage = 'Number of half-edges must be a positive integer.';
			return;
		}
		if (!Number.isInteger(multiplicity) || multiplicity < 1) {
			infoMessage = 'Multiplicity must be a positive integer.';
			return;
		}

		const currentGraph = renderedGraph ?? { n: 0, orbifoldEdges: [], sigma0: [], multiplicity: [] };
		const vertexIndex = currentGraph.sigma0.length;
		const cycle = Array.from({ length: halfEdgeCount }, (_, index) => currentGraph.n + index + 1);
		const nextGraph: BrauerGraph = {
			n: currentGraph.n + halfEdgeCount,
			orbifoldEdges: [...(currentGraph.orbifoldEdges ?? [])],
			sigma0: [...currentGraph.sigma0.map((existingCycle) => [...existingCycle]), cycle],
			multiplicity: [...currentGraph.multiplicity, multiplicity]
		};

		addVertexStar(nextGraph, vertexIndex, addVertexPosition);
		renderedGraph = nextGraph;
		canvasHasGraph = true;
		onGraphMutated?.(nextGraph);
		publishCurrentArmLength();
		addVertexPosition = null;
		infoMessage = 'Click an empty area to place a new vertex.';
	}

	function cancelAddVertex() {
		addVertexPosition = null;
		if (graphState.mode === 'add-vertex') {
			infoMessage = renderedGraph ? 'Click an empty area to place a new vertex.' : '';
		}
	}

	function exitAddVertex() {
		if (graphState.mode !== 'add-vertex') return;

		addVertexPosition = null;
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function beginAddHalfEdge(event: cytoscape.EventObject) {
		if (!cy || !renderedGraph) return;

		const halfEdge = halfEdgeForAdjustTarget(event.target, event.position);
		if (!Number.isInteger(halfEdge)) return;

		addHalfEdgeAfter = halfEdge;
		highlightHalfEdgeArms(halfEdge);
		infoMessage = `Adding half-edge arms after ${halfEdge}.`;
	}

	function confirmAddHalfEdges(values: string[]) {
		if (!cy || !renderedGraph || addHalfEdgeAfter === null) return;

		const count = Number(values[0]);
		if (!Number.isInteger(count) || count < 1) {
			infoMessage = 'Number of half-edge arms must be a positive integer.';
			return;
		}

		const location = findHalfEdgeLocation(addHalfEdgeAfter);
		if (!location) return;

		const newHalfEdges = Array.from({ length: count }, (_, index) => renderedGraph!.n + index + 1);
		const nextSigma0 = renderedGraph.sigma0.map((cycle, vertexIndex) => {
			if (vertexIndex !== location.vertexIndex) return [...cycle];
			return [
				...cycle.slice(0, location.cycleIndex + 1),
				...newHalfEdges,
				...cycle.slice(location.cycleIndex + 1)
			];
		});
		const nextGraph: BrauerGraph = {
			...renderedGraph,
			n: renderedGraph.n + count,
			sigma0: nextSigma0
		};

		insertHalfEdgeElements(nextGraph, location.vertexIndex, addHalfEdgeAfter, newHalfEdges);
		renderedGraph = nextGraph;
		onGraphMutated?.(nextGraph);
		publishCurrentArmLength();
		addHalfEdgeAfter = null;
		highlightHalfEdgeArms('all');
		infoMessage = 'Select a half-edge to insert after.';
	}

	function cancelAddHalfEdges() {
		addHalfEdgeAfter = null;
		if (graphState.mode === 'add-half-edge') {
			highlightHalfEdgeArms('all');
			infoMessage = 'Select a half-edge to insert after.';
		}
	}

	function exitAddHalfEdge() {
		if (graphState.mode !== 'add-half-edge') return;

		addHalfEdgeAfter = null;
		highlightHalfEdgeArms(null);
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function beginAddOrbifoldEdge(target: cytoscape.SingularElementReturnValue, position: { x: number; y: number }) {
		if (!renderedGraph) return;

		const halfEdge = halfEdgeForAdjustTarget(target, position);
		if (!isDanglingPositiveHalfEdge(halfEdge)) {
			infoMessage = 'Select a dangling half-edge.';
			return;
		}

		connectOrbifoldEdge(halfEdge);
	}

	function connectOrbifoldEdge(halfEdge: number) {
		if (!cy || !renderedGraph) return;

		const anchor = cy.getElementById(anchorId(halfEdge));
		const vertexIndex = Number(anchor.data('vertexIndex'));
		const vertex = cy.getElementById(vertexId(vertexIndex));
		if (!anchor.nonempty() || !vertex.nonempty()) return;

		const nextGraph: BrauerGraph = {
			...renderedGraph,
			orbifoldEdges: [...new Set([...(renderedGraph.orbifoldEdges ?? []), halfEdge])].sort((a, b) => a - b)
		};
		renderedGraph = nextGraph;
		cy.add(buildOrbifoldElements(nextGraph, halfEdge));
		onGraphMutated?.(nextGraph);
		highlightHalfEdgeArms(null);
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function createNewOrbifoldEdge(position = nextOpenVertexPosition()) {
		if (!cy) return;

		const currentGraph = renderedGraph ?? { n: 0, orbifoldEdges: [], sigma0: [], multiplicity: [] };
		const edge = currentGraph.n + 1;
		const vertexIndex = currentGraph.sigma0.length;
		const nextGraph: BrauerGraph = {
			n: edge,
			orbifoldEdges: [...(currentGraph.orbifoldEdges ?? []), edge],
			sigma0: [...currentGraph.sigma0.map((cycle) => [...cycle]), [edge]],
			multiplicity: [...currentGraph.multiplicity, 1]
		};

		addVertexStar(nextGraph, vertexIndex, position);
		renderedGraph = nextGraph;
		canvasHasGraph = true;
		onGraphMutated?.(nextGraph);
		publishCurrentArmLength();
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function buildOrbifoldElements(graph: BrauerGraph, halfEdge: number): cytoscape.ElementDefinition[] {
		if (!cy) return [];

		const positions = currentNodePositions();
		const anchor = cy.getElementById(anchorId(halfEdge));
		const vertexIndex = Number(anchor.data('vertexIndex'));
		const vertex = cy.getElementById(vertexId(vertexIndex));
		if (!anchor.nonempty() || !vertex.nonempty()) return [];

		positions[orbifoldEndId(halfEdge)] = extendFromVertex(vertex.position(), anchor.position(), ORBIFOLD_EDGE_LENGTH);

		return buildElements(graph, positions, options).filter((element) => {
			const id = String(element.data?.id ?? '');
			return id === orbifoldEndId(halfEdge) || id === orbifoldConnectingEdgeId(halfEdge);
		});
	}

	function insertHalfEdgeElements(
		graph: BrauerGraph,
		vertexIndex: number,
		afterHalfEdge: number,
		newHalfEdges: number[]
	) {
		if (!cy || !renderedGraph) return;

		const positions = currentNodePositions();
		const vertex = cy.getElementById(vertexId(vertexIndex));
		const oldCycle = renderedGraph.sigma0[vertexIndex];
		const cycleIndex = oldCycle.indexOf(afterHalfEdge);
		const nextHalfEdge = oldCycle[(cycleIndex + 1) % oldCycle.length] ?? afterHalfEdge;
		const beforeAnchor = cy.getElementById(anchorId(afterHalfEdge));
		const afterAnchor = cy.getElementById(anchorId(nextHalfEdge));
		if (!vertex.nonempty() || !beforeAnchor.nonempty() || !afterAnchor.nonempty()) return;

		const insertedPositions = interpolateSector(
			vertex.position(),
			beforeAnchor.position(),
			afterAnchor.position(),
			newHalfEdges.length
		);
		newHalfEdges.forEach((halfEdge, index) => {
			positions[anchorId(halfEdge)] = insertedPositions[index];
		});

		removeOrderingArrowsForVertex(vertexIndex);
		const newHalfEdgeIds = new Set(newHalfEdges);
		const elements = buildElements(graph, positions, options).filter((element) => {
			const id = String(element.data?.id ?? '');
			const source = String(element.data?.source ?? '');
			const target = String(element.data?.target ?? '');
			const halfEdge = Number(element.data?.h);

			if (id.startsWith(`arrpt-${vertexIndex}-`)) return true;
			if (source.startsWith(`arrpt-${vertexIndex}-`) || target.startsWith(`arrpt-${vertexIndex}-`)) return true;
			if (element.group === 'nodes') return newHalfEdgeIds.has(halfEdge);
			return source === vertexId(vertexIndex) && newHalfEdgeIds.has(halfEdge);
		});

		cy.add(elements);
		cy.layout({ name: 'preset', fit: false }).run();
	}

	function removeOrderingArrowsForVertex(vertexIndex: number) {
		if (!cy) return;

		const pointPrefix = `arrpt-${vertexIndex}-`;
		const points = cy.nodes().filter((node) => node.id().startsWith(pointPrefix));
		const pointIds = new Set(points.map((node) => node.id()));
		cy.edges()
			.filter((edge) => pointIds.has(edge.source().id()) || pointIds.has(edge.target().id()))
			.remove();
		points.remove();
	}

	function exitAddOrbifoldEdge() {
		if (graphState.mode !== 'add-orbifold-edge') return;

		highlightHalfEdgeArms(null);
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function removeVertex(vertexIndex: number) {
		if (!cy || !renderedGraph) return;

		const graph = renderedGraph;
		const removedCycle = graph.sigma0[vertexIndex];
		if (!removedCycle) return;

		const currentPositions = currentNodePositions();
		const removed = new Set(removedCycle);
		const replacements = new Map<number, number>();
		let nextLabel = maxPositiveLabel(graph.sigma0);

		const nextSigma0 = graph.sigma0
			.filter((_, index) => index !== vertexIndex)
			.map((cycle) =>
				cycle.map((halfEdge) => {
					if (!removed.has(-halfEdge)) return halfEdge;
					nextLabel += 1;
					replacements.set(halfEdge, nextLabel);
					return nextLabel;
				})
			);

		const nextOrbifoldEdges = (graph.orbifoldEdges ?? []).filter(
			(edge) => !removed.has(edge)
		);
		const compact = compactHalfEdgeLabels(nextSigma0, nextOrbifoldEdges);

		const nextPositions: NodePositions = {};
		graph.sigma0.forEach((cycle, oldVertexIndex) => {
			if (oldVertexIndex === vertexIndex) return;

			const newVertexIndex = oldVertexIndex > vertexIndex ? oldVertexIndex - 1 : oldVertexIndex;
			const oldVertexPosition = currentPositions[vertexId(oldVertexIndex)];
			if (oldVertexPosition) nextPositions[vertexId(newVertexIndex)] = oldVertexPosition;

			for (const halfEdge of cycle) {
				if (removed.has(halfEdge)) continue;

				const replacement = replacements.get(halfEdge);
				const nextHalfEdge = replacement ?? halfEdge;
				const compactHalfEdge = remapHalfEdge(nextHalfEdge, compact.labelMap);
				const oldAnchorPosition = currentPositions[anchorId(halfEdge)];
				if (oldAnchorPosition) nextPositions[anchorId(compactHalfEdge)] = oldAnchorPosition;

				if ((graph.orbifoldEdges ?? []).includes(Math.abs(halfEdge))) {
					const oldOrbifoldPosition = currentPositions[orbifoldEndId(Math.abs(halfEdge))];
					if (oldOrbifoldPosition) nextPositions[orbifoldEndId(Math.abs(compactHalfEdge))] = oldOrbifoldPosition;
				}
			}
		});

		const nextGraph: BrauerGraph = {
			n: compact.n,
			orbifoldEdges: compact.orbifoldEdges,
			sigma0: compact.sigma0,
			multiplicity: graph.multiplicity.filter((_, index) => index !== vertexIndex)
		};

		rebuildGraphWithPositions(nextGraph, nextPositions);
		onGraphMutated?.(nextGraph);
		if (graphState.mode === 'remove-vertex') {
			infoMessage = nextGraph.sigma0.length > 0 ? 'Click a vertex to remove it.' : '';
			highlightVertexNodes(nextGraph.sigma0.length > 0 ? 'all' : null);
		}
	}

	function removeArc(target: cytoscape.SingularElementReturnValue) {
		if (!cy || !renderedGraph || !target.hasClass('ce-edge')) return;

		const edge = Math.abs(Number(target.data('h')));
		if (!Number.isInteger(edge) || edge <= 0) return;

		if (target.hasClass('orbifold-edge')) {
			removeOrbifoldArc(edge);
			return;
		}

		if (target.hasClass('ordinary-edge')) {
			removeOrdinaryArc(edge);
		}
	}

	function removeOrdinaryArc(edge: number) {
		if (!renderedGraph) return;
		if (!findHalfEdgeLocation(edge) || !findHalfEdgeLocation(-edge)) return;

		const graph = renderedGraph;
		const currentPositions = currentNodePositions();
		const replacement = maxPositiveLabel(graph.sigma0) + 1;
		const rawSigma0 = graph.sigma0.map((cycle) =>
			cycle.map((halfEdge) => halfEdge === -edge ? replacement : halfEdge)
		);
		const compact = compactHalfEdgeLabels(rawSigma0, graph.orbifoldEdges ?? []);
		const nextGraph: BrauerGraph = {
			n: compact.n,
			orbifoldEdges: compact.orbifoldEdges,
			sigma0: compact.sigma0,
			multiplicity: [...graph.multiplicity]
		};
		const nextPositions = positionsAfterHalfEdgeRewrite(graph, currentPositions, (halfEdge) =>
			halfEdge === -edge ? replacement : halfEdge,
			compact.labelMap
		);

		rebuildGraphWithPositions(nextGraph, nextPositions);
		onGraphMutated?.(nextGraph);
		if (graphState.mode === 'remove-arc') {
			infoMessage = 'Click an arc to remove it.';
			highlightRemovableArcs();
		}
	}

	function removeOrbifoldArc(edge: number) {
		if (!renderedGraph) return;
		if (!renderedGraph.orbifoldEdges?.includes(edge)) return;

		const graph = renderedGraph;
		const currentPositions = currentNodePositions();
		const nextOrbifoldEdges = (graph.orbifoldEdges ?? []).filter((orbifoldEdge) => orbifoldEdge !== edge);
		const compact = compactHalfEdgeLabels(graph.sigma0, nextOrbifoldEdges);
		const nextGraph: BrauerGraph = {
			n: compact.n,
			orbifoldEdges: compact.orbifoldEdges,
			sigma0: compact.sigma0,
			multiplicity: [...graph.multiplicity]
		};
		const nextPositions = positionsAfterHalfEdgeRewrite(
			graph,
			currentPositions,
			(halfEdge) => halfEdge,
			compact.labelMap,
			new Set([edge])
		);

		rebuildGraphWithPositions(nextGraph, nextPositions);
		onGraphMutated?.(nextGraph);
		if (graphState.mode === 'remove-arc') {
			infoMessage = 'Click an arc to remove it.';
			highlightRemovableArcs();
		}
	}

	function positionsAfterHalfEdgeRewrite(
		graph: BrauerGraph,
		currentPositions: NodePositions,
		rewrite: (halfEdge: number) => number,
		labelMap: Map<number, number>,
		removedOrbifoldEnds = new Set<number>()
	) {
		const nextPositions: NodePositions = {};
		graph.sigma0.forEach((cycle, vertexIndex) => {
			const vertexPosition = currentPositions[vertexId(vertexIndex)];
			if (vertexPosition) nextPositions[vertexId(vertexIndex)] = vertexPosition;

			for (const halfEdge of cycle) {
				const nextHalfEdge = remapHalfEdge(rewrite(halfEdge), labelMap);
				const anchorPosition = currentPositions[anchorId(halfEdge)];
				if (anchorPosition) nextPositions[anchorId(nextHalfEdge)] = anchorPosition;

				const orbifoldEdge = Math.abs(halfEdge);
				if ((graph.orbifoldEdges ?? []).includes(orbifoldEdge) && !removedOrbifoldEnds.has(orbifoldEdge)) {
					const orbifoldPosition = currentPositions[orbifoldEndId(orbifoldEdge)];
					if (orbifoldPosition) nextPositions[orbifoldEndId(Math.abs(nextHalfEdge))] = orbifoldPosition;
				}
			}
		});

		return nextPositions;
	}

	function removeHalfEdge(target: cytoscape.SingularElementReturnValue, position: { x: number; y: number }) {
		if (!cy || !renderedGraph) return;

		const halfEdge = halfEdgeForAdjustTarget(target, position);
		const location = findHalfEdgeLocation(halfEdge);
		if (!location) return;

		const graph = renderedGraph;
		const currentPositions = currentNodePositions();
		const removedAbs = Math.abs(halfEdge);
		const filteredCycles = graph.sigma0.map((cycle, index) => ({
			cycle: cycle.filter((entry) => entry !== halfEdge),
			multiplicity: graph.multiplicity[index] ?? 1
		}));
		const nextSigma0 = filteredCycles.filter((entry) => entry.cycle.length > 0).map((entry) => entry.cycle);
		const nextMultiplicity = filteredCycles
			.filter((entry) => entry.cycle.length > 0)
			.map((entry) => entry.multiplicity);
		const nextOrbifoldEdges = (graph.orbifoldEdges ?? []).filter((edge) => edge !== removedAbs);
		const compact = compactHalfEdgeLabels(nextSigma0, nextOrbifoldEdges);
		const nextGraph: BrauerGraph = {
			n: compact.n,
			orbifoldEdges: compact.orbifoldEdges,
			sigma0: compact.sigma0,
			multiplicity: nextMultiplicity
		};

		const nextPositions: NodePositions = {};
		let nextVertexIndex = 0;
		graph.sigma0.forEach((cycle, oldVertexIndex) => {
			if (oldVertexIndex === location.vertexIndex && cycle.length === 1) return;

			const oldVertexPosition = currentPositions[vertexId(oldVertexIndex)];
			if (oldVertexPosition) nextPositions[vertexId(nextVertexIndex)] = oldVertexPosition;

			for (const entry of cycle) {
				if (entry === halfEdge) continue;
				const compactHalfEdge = remapHalfEdge(entry, compact.labelMap);
				const oldAnchorPosition = currentPositions[anchorId(entry)];
				if (oldAnchorPosition) nextPositions[anchorId(compactHalfEdge)] = oldAnchorPosition;

				if ((graph.orbifoldEdges ?? []).includes(Math.abs(entry))) {
					const oldOrbifoldPosition = currentPositions[orbifoldEndId(Math.abs(entry))];
					if (oldOrbifoldPosition) nextPositions[orbifoldEndId(Math.abs(compactHalfEdge))] = oldOrbifoldPosition;
				}
			}

			nextVertexIndex += 1;
		});

		rebuildGraphWithPositions(nextGraph, nextPositions);
		onGraphMutated?.(nextGraph);
		if (graphState.mode === 'remove-half-edge') {
			infoMessage = nextGraph.sigma0.length > 0 ? 'Click a half-edge to remove it.' : '';
			highlightHalfEdgeArms(nextGraph.sigma0.length > 0 ? 'all' : null);
		}
	}

	function beginReconnectArc(event: cytoscape.EventObject) {
		if (!cy || !renderedGraph) return;

		const halfEdge = halfEdgeForAdjustTarget(event.target, event.position);
		if (!Number.isInteger(halfEdge)) return;

		if (reconnectSourceHalfEdge === null) {
			reconnectSourceHalfEdge = halfEdge;
			highlightHalfEdgeArms(halfEdge);
			infoMessage = 'Click a target half-edge.';
			return;
		}

		reconnectArcs(reconnectSourceHalfEdge, halfEdge);
	}

	function reconnectArcs(sourceHalfEdge: number, targetHalfEdge: number) {
		if (!cy || !renderedGraph || sourceHalfEdge === targetHalfEdge) return;
		if (!findHalfEdgeLocation(sourceHalfEdge) || !findHalfEdgeLocation(targetHalfEdge)) return;

		const graph = renderedGraph;
		const currentPositions = currentNodePositions();
		const replacements = reconnectReplacements(sourceHalfEdge, targetHalfEdge);
		if (!replacements) return;

		const rawSigma0 = graph.sigma0.map((cycle) =>
			cycle.map((halfEdge) => replacements.get(halfEdge) ?? halfEdge)
		);
		const involved = new Set([Math.abs(sourceHalfEdge), Math.abs(targetHalfEdge)]);
		const rawOrbifoldEdges = (graph.orbifoldEdges ?? []).filter((edge) => !involved.has(edge));
		const compact = compactHalfEdgeLabels(rawSigma0, rawOrbifoldEdges);
		const nextGraph: BrauerGraph = {
			n: compact.n,
			orbifoldEdges: compact.orbifoldEdges,
			sigma0: compact.sigma0,
			multiplicity: [...graph.multiplicity]
		};

		const nextPositions: NodePositions = {};
		graph.sigma0.forEach((cycle, vertexIndex) => {
			const vertexPosition = currentPositions[vertexId(vertexIndex)];
			if (vertexPosition) nextPositions[vertexId(vertexIndex)] = vertexPosition;

			for (const halfEdge of cycle) {
				const rawHalfEdge = replacements.get(halfEdge) ?? halfEdge;
				const compactHalfEdge = remapHalfEdge(rawHalfEdge, compact.labelMap);
				const oldAnchorPosition = currentPositions[anchorId(halfEdge)];
				if (oldAnchorPosition) nextPositions[anchorId(compactHalfEdge)] = oldAnchorPosition;
			}
		});

		rebuildGraphWithPositions(nextGraph, nextPositions);
		onGraphMutated?.(nextGraph);
		reconnectSourceHalfEdge = null;
		if (graphState.mode === 'reconnect-arc') {
			highlightHalfEdgeArms('all');
			infoMessage = 'Click a source half-edge.';
		}
	}

	function reconnectReplacements(sourceHalfEdge: number, targetHalfEdge: number) {
		const sourcePositive = sourceHalfEdge > 0;
		const targetPositive = targetHalfEdge > 0;
		const source = Math.abs(sourceHalfEdge);
		const target = Math.abs(targetHalfEdge);
		const replacements = new Map<number, number>();

		if (sourcePositive && targetPositive) {
			const x = Math.max(source, target);
			const y = Math.min(source, target);
			replacements.set(y, -x);
			return replacements;
		}

		if (sourcePositive && !targetPositive) {
			replacements.set(targetHalfEdge, -source);
			return replacements;
		}

		if (!sourcePositive && targetPositive) {
			replacements.set(sourceHalfEdge, -target);
			return replacements;
		}

		const next = (renderedGraph?.n ?? 0) + 1;
		replacements.set(sourceHalfEdge, next);
		replacements.set(targetHalfEdge, -next);
		return replacements;
	}

	function maxPositiveLabel(sigma0: number[][]) {
		return Math.max(0, ...sigma0.flat().map((halfEdge) => Math.abs(halfEdge)));
	}

	function compactHalfEdgeLabels(sigma0: number[][], orbifoldEdges: number[]) {
		const positives = Array.from(
			new Set([...sigma0.flat().map((halfEdge) => Math.abs(halfEdge)), ...orbifoldEdges])
		).sort((a, b) => a - b);
		const labelMap = new Map<number, number>();
		positives.forEach((label, index) => labelMap.set(label, index + 1));

		return {
			labelMap,
			n: positives.length,
			orbifoldEdges: orbifoldEdges.map((edge) => labelMap.get(edge) ?? edge).sort((a, b) => a - b),
			sigma0: sigma0.map((cycle) => cycle.map((halfEdge) => remapHalfEdge(halfEdge, labelMap)))
		};
	}

	function remapHalfEdge(halfEdge: number, labelMap: Map<number, number>) {
		const next = labelMap.get(Math.abs(halfEdge)) ?? Math.abs(halfEdge);
		return halfEdge < 0 ? -next : next;
	}

	function exitRemoveVertex() {
		if (graphState.mode !== 'remove-vertex') return;

		highlightVertexNodes(null);
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function exitRemoveArc() {
		if (graphState.mode !== 'remove-arc') return;

		highlightRemovableArcs(false);
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function exitRemoveHalfEdge() {
		if (graphState.mode !== 'remove-half-edge') return;

		highlightHalfEdgeArms(null);
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function exitReconnectArc() {
		if (graphState.mode !== 'reconnect-arc') return;

		reconnectSourceHalfEdge = null;
		highlightHalfEdgeArms(null);
		graphState.mode = 'idle';
		infoMessage = '';
	}

	function addVertexStar(
		graph: BrauerGraph,
		vertexIndex: number,
		vertexPosition: { x: number; y: number }
	) {
		if (!cy) return;

		const starId = starParentId(vertexIndex);
		const positions = currentNodePositions();
		positions[vertexId(vertexIndex)] = vertexPosition;
		const elements = buildElements(graph, positions, options).filter((element) => {
			if (element.group === 'nodes') return element.data?.starId === starId;
			const source = String(element.data?.source ?? '');
			const target = String(element.data?.target ?? '');
			return source.startsWith(`arrpt-${vertexIndex}-`) || target.startsWith(`arrpt-${vertexIndex}-`) ||
				graph.sigma0[vertexIndex].some((halfEdge) =>
					(source === vertexId(vertexIndex) && target === anchorId(halfEdge)) ||
					(source === anchorId(halfEdge) && target === orbifoldEndId(halfEdge))
				);
		});

		cy.add(elements);
		cy.layout({ name: 'preset', fit: false }).run();
	}

	function currentNodePositions(): NodePositions {
		const positions: NodePositions = {};
		if (!cy) return positions;

		cy.nodes().forEach((node) => {
			positions[node.id()] = { ...node.position() };
		});

		return positions;
	}

	function findHalfEdgeLocation(halfEdge: number) {
		if (!renderedGraph) return null;

		for (const [vertexIndex, cycle] of renderedGraph.sigma0.entries()) {
			const cycleIndex = cycle.indexOf(halfEdge);
			if (cycleIndex !== -1) return { vertexIndex, cycleIndex };
		}

		return null;
	}

	function danglingPositiveHalfEdges() {
		if (!renderedGraph) return [];

		const present = new Set(renderedGraph.sigma0.flat());
		const orbifoldEdges = new Set(renderedGraph.orbifoldEdges ?? []);
		return renderedGraph.sigma0
			.flat()
			.filter((halfEdge) => halfEdge > 0 && !present.has(-halfEdge) && !orbifoldEdges.has(halfEdge));
	}

	function hasDanglingPositiveHalfEdges() {
		return danglingPositiveHalfEdges().length > 0;
	}

	function isDanglingPositiveHalfEdge(halfEdge: number) {
		return danglingPositiveHalfEdges().includes(halfEdge);
	}

	function highlightHalfEdgeSet(halfEdges: number[]) {
		if (!cy) return;

		const active = new Set(halfEdges);
		const styles = getComputedStyle(document.documentElement);
		const highlight = styles.getPropertyValue('--highlight-color').trim();
		cy.edges('.he-edge').forEach((edge) => {
			const isActive = active.has(Number(edge.data('h')));
			edge.style({
				width: isActive ? 4 : '',
				'line-color': isActive ? highlight : '',
				'target-arrow-color': isActive ? highlight : '',
				'line-opacity': isActive ? 1 : ''
			});
		});
	}

	function highlightRemovableArcs(active = true) {
		if (!cy) return;

		const styles = getComputedStyle(document.documentElement);
		const highlight = styles.getPropertyValue('--highlight-color').trim();
		cy.edges('.ce-edge').forEach((edge) => {
			edge.style({
				width: active ? 5 : '',
				'line-color': active ? highlight : '',
				'target-arrow-color': active ? highlight : '',
				'line-opacity': active ? 1 : ''
			});
		});
	}

	function canvasCenterPosition() {
		if (!container) return { x: 0, y: 0 };

		const rect = container.getBoundingClientRect();
		return {
			x: rect.width / 2,
			y: rect.height / 2
		};
	}

	function nextOpenVertexPosition() {
		if (!cy) return canvasCenterPosition();

		const center = canvasCenterPosition();
		const offsets = [
			{ x: 0, y: 0 },
			{ x: FAR_ENOUGH_PX, y: 0 },
			{ x: -FAR_ENOUGH_PX, y: 0 },
			{ x: 0, y: FAR_ENOUGH_PX },
			{ x: 0, y: -FAR_ENOUGH_PX },
			{ x: FAR_ENOUGH_PX, y: FAR_ENOUGH_PX },
			{ x: -FAR_ENOUGH_PX, y: FAR_ENOUGH_PX },
			{ x: FAR_ENOUGH_PX, y: -FAR_ENOUGH_PX },
			{ x: -FAR_ENOUGH_PX, y: -FAR_ENOUGH_PX }
		];
		const vertices = cy.nodes('.v-node').map((node) => (node as cytoscape.NodeSingular).position());

		for (const offset of offsets) {
			const candidate = { x: center.x + offset.x, y: center.y + offset.y };
			if (vertices.every((vertex) => distance(vertex, candidate) >= FAR_ENOUGH_PX)) return candidate;
		}

		return { x: center.x + FAR_ENOUGH_PX * 1.5, y: center.y + FAR_ENOUGH_PX * 1.5 };
	}

	function snapshotStarPositions(vertexIndex: number): Map<string, { x: number; y: number }> {
		const snapshot = new Map<string, { x: number; y: number }>();
		if (!cy || !renderedGraph) return snapshot;

		for (const halfEdge of renderedGraph.sigma0[vertexIndex] ?? []) {
			const anchor = cy.getElementById(anchorId(halfEdge));
			if (anchor.nonempty()) snapshot.set(anchor.id(), { ...anchor.position() });
		}

		return snapshot;
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

	function highlightVertexNodes(activeVertex: number | 'all' | null = 'all') {
		if (!cy) return;

		const styles = getComputedStyle(document.documentElement);
		const highlight = styles.getPropertyValue('--highlight-color').trim();
		cy.nodes('.v-node').forEach((node) => {
			const isClearing = activeVertex === null;
			const isActive = activeVertex !== 'all' && Number(node.data('vertexIndex')) === activeVertex;
			node.style({
				'border-color': isClearing ? '' : highlight,
				'border-width': isClearing ? '' : isActive ? 4 : 3,
				'border-opacity': isClearing ? '' : isActive ? 1 : 0.65
			});
		});
	}

	function highlightVertexArms(vertexIndex: number | null) {
		if (!cy) return;

		const styles = getComputedStyle(document.documentElement);
		const highlight = styles.getPropertyValue('--highlight-color').trim();
		cy.edges('.he-edge').forEach((edge) => {
			const isActive = Number(edge.source().data('vertexIndex')) === vertexIndex;
			edge.style({
				width: vertexIndex === null ? '' : isActive ? 5 : '',
				'line-color': vertexIndex === null ? '' : isActive ? highlight : '',
				'target-arrow-color': vertexIndex === null ? '' : isActive ? highlight : '',
				'line-opacity': vertexIndex === null ? '' : isActive ? 1 : ''
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

	function signedAngleDelta(start: number, end: number) {
		const tau = 2 * Math.PI;
		return ((end - start + Math.PI + tau) % tau) - Math.PI;
	}

	function rotatePoint(origin: { x: number; y: number }, point: { x: number; y: number }, angle: number) {
		const dx = point.x - origin.x;
		const dy = point.y - origin.y;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);

		return {
			x: origin.x + dx * cos - dy * sin,
			y: origin.y + dx * sin + dy * cos
		};
	}

	function publishCurrentArmLength() {
		if (!cy || !renderedGraph) {
			graphState.armLength = null;
			return;
		}

		let total = 0;
		let count = 0;
		for (const [vertexIndex, cycle] of renderedGraph.sigma0.entries()) {
			const vertex = cy.getElementById(vertexId(vertexIndex));
			if (!vertex.nonempty()) continue;

			const vertexPosition = vertex.position();
			for (const halfEdge of cycle) {
				const anchor = cy.getElementById(anchorId(halfEdge));
				if (!anchor.nonempty()) continue;

				total += distance(vertexPosition, anchor.position());
				count += 1;
			}
		}

		graphState.armLength = count > 0 ? total / count : null;
	}

	onMount(() => {
		let cancelled = false;
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			exitAdjustEmanatingAngle();
			exitAdjustArcCurvature();
			exitRotateVertex();
			exitModifyMultiplicity();
			exitAddVertex();
			exitAddHalfEdge();
			exitAddOrbifoldEdge();
			exitReconnectArc();
			exitRemoveVertex();
			exitRemoveArc();
			exitRemoveHalfEdge();
		};

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
				if (graphState.mode === 'remove-vertex') {
					if (event.type === 'tap') {
						const vertexIndex = Number(event.target.data('vertexIndex'));
						if (Number.isInteger(vertexIndex)) removeVertex(vertexIndex);
					}
					return;
				}

				if (graphState.mode === 'modify-multiplicity') {
					if (event.type === 'tap') {
						beginModifyMultiplicity(event.target);
					}
					return;
				}

				if (graphState.mode === 'rotate-vertex') {
					if (event.type === 'tap') {
						if (rotatingVertexIndex !== null) {
							confirmRotateSelection(event.position);
						} else {
							beginRotateVertex(event);
						}
					}
					return;
				}

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
				const target = event.target;
				const previous = target.scratch('previousPosition') as { x: number; y: number } | undefined;
				if (
					graphState.mode === 'adjust-emanating-angle' ||
					graphState.mode === 'rotate-vertex' ||
					graphState.mode === 'modify-multiplicity' ||
					graphState.mode === 'add-vertex' ||
					graphState.mode === 'add-half-edge' ||
					graphState.mode === 'add-orbifold-edge' ||
					graphState.mode === 'reconnect-arc' ||
					graphState.mode === 'remove-vertex' ||
					graphState.mode === 'remove-arc' ||
					graphState.mode === 'remove-half-edge'
				) {
					if (previous) target.position(previous);
					return;
				}
				tooltip = null;
				if (!previous) return;

				const current = target.position();
				const dx = current.x - previous.x;
				const dy = current.y - previous.y;
				if (dx === 0 && dy === 0) return;

				translateStar(target, dx, dy);
				target.scratch('previousPosition', { ...current });
			});

			cy.on('drag', '.curve-control-node', (event) => {
				updateArcCurvatureFromHandles(String(event.target.data('edgeId')));
			});

			cy.on('free', '.v-node, .u-node, .orbifold-node', (event) => {
				event.target.removeScratch('previousPosition');
			});

			cy.on('tap', '[edgeId]', (event) => {
				if (graphState.mode === 'adjust-arc-curvature') {
					beginAdjustArcCurvature(event.target);
					return;
				}

				if (graphState.mode === 'reconnect-arc') {
					beginReconnectArc(event);
					return;
				}

				if (graphState.mode === 'remove-arc') {
					removeArc(event.target);
					return;
				}

				if (graphState.mode === 'remove-half-edge') {
					removeHalfEdge(event.target, event.position);
					return;
				}

				if (graphState.mode === 'add-half-edge') {
					if (addHalfEdgeAfter === null) beginAddHalfEdge(event);
					return;
				}

				if (graphState.mode === 'add-orbifold-edge') {
					beginAddOrbifoldEdge(event.target, event.position);
					return;
				}

				if (graphState.mode === 'rotate-vertex' && rotatingVertexIndex !== null) {
					confirmRotateSelection(event.position);
					return;
				}

				if (graphState.mode === 'adjust-emanating-angle') {
					if (adjustingHalfEdge !== null) {
						confirmAdjustSelection(event.position);
					} else {
						beginAdjustEmanatingAngle(event);
					}
					return;
				}
				void handleMutationEdgeTap(event.target);
			});

			cy.on('tap', (event) => {
				if (String(event.target.data?.('edgeId') ?? '')) return;
				if (event.target.hasClass?.('v-node')) return;

				if (graphState.mode === 'rotate-vertex' && rotatingVertexIndex !== null) {
					confirmRotateSelection(event.position);
					return;
				}

				if (event.target === cy && graphState.mode === 'rotate-vertex') {
					confirmRotateSelection();
					return;
				}

				if (graphState.mode === 'adjust-emanating-angle' && adjustingHalfEdge !== null) {
					confirmAdjustSelection(event.position);
					return;
				}

				if (event.target === cy && graphState.mode === 'adjust-emanating-angle') {
					confirmAdjustSelection();
					return;
				}

				if (event.target === cy && graphState.mode === 'add-vertex') {
					beginAddVertex(event.position);
					return;
				}

				if (event.target === cy && graphState.mode === 'add-orbifold-edge') {
					createNewOrbifoldEdge(event.position);
				}
			});

			cy.on('mousemove', (event) => {
				if (graphState.mode === 'adjust-emanating-angle' && adjustingHalfEdge !== null) {
					adjustSelectedAnchor(event.position);
				}
				if (graphState.mode === 'rotate-vertex' && rotatingVertexIndex !== null) {
					rotateSelectedVertex(event.position);
				}
			});

			cy.on('mouseover', '[edgeId], .v-node', () => {
				if (isSelectingMutationEdge()) container.style.cursor = 'pointer';
				if (graphState.mode === 'adjust-emanating-angle') container.style.cursor = 'crosshair';
				if (graphState.mode === 'adjust-arc-curvature') container.style.cursor = 'crosshair';
				if (graphState.mode === 'rotate-vertex') container.style.cursor = 'crosshair';
				if (graphState.mode === 'modify-multiplicity') container.style.cursor = 'crosshair';
				if (graphState.mode === 'add-vertex') container.style.cursor = 'crosshair';
				if (graphState.mode === 'add-half-edge') container.style.cursor = 'crosshair';
				if (graphState.mode === 'add-orbifold-edge') container.style.cursor = 'crosshair';
				if (graphState.mode === 'reconnect-arc') container.style.cursor = 'crosshair';
				if (graphState.mode === 'remove-vertex') container.style.cursor = 'crosshair';
				if (graphState.mode === 'remove-arc') container.style.cursor = 'crosshair';
				if (graphState.mode === 'remove-half-edge') container.style.cursor = 'crosshair';
			});

			cy.on('mouseout', '[edgeId], .v-node', () => {
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
					publishCurrentArmLength();
				}
			});
		}

		mountCytoscape();
		document.addEventListener('keydown', handleKeydown);

		return () => {
			cancelled = true;
			document.removeEventListener('keydown', handleKeydown);
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
		if (graphState.mode === 'adjust-arc-curvature') {
			adjustArcCurvatureWasActive = true;
			if (canvasHasGraph && selectedArcId === null) {
				infoMessage = 'Click an arc to adjust its curvature.';
			}
			if (container) container.style.cursor = 'crosshair';
		} else if (adjustArcCurvatureWasActive) {
			adjustArcCurvatureWasActive = false;
			clearArcCurvatureHandles();
			if (container && container.style.cursor === 'crosshair') container.style.cursor = '';
			if (!mutating) infoMessage = '';
		}
	});

	$effect(() => {
		if (graphState.mode === 'rotate-vertex') {
			rotateModeWasActive = true;
			if (canvasHasGraph) {
				infoMessage = rotatingVertexIndex === null ? 'Click a vertex to rotate its half-edge arms.' : infoMessage;
				if (rotatingVertexIndex === null) {
					highlightVertexNodes('all');
					highlightVertexArms(null);
				}
			}
		} else if (rotateModeWasActive) {
			rotateModeWasActive = false;
			rotatingVertexIndex = null;
			rotationStartPositions = new Map();
			highlightVertexNodes(null);
			highlightVertexArms(null);
			if (!mutating) infoMessage = '';
		}
	});

	$effect(() => {
		if (graphState.mode === 'modify-multiplicity') {
			modifyMultiplicityWasActive = true;
			if (canvasHasGraph) {
				infoMessage = multiplicityModalVertexIndex === null
					? 'Click a vertex to change its multiplicity.'
					: infoMessage;
				refreshMultiplicityLabels();
				if (multiplicityModalVertexIndex === null) highlightVertexNodes('all');
			}
		} else if (modifyMultiplicityWasActive) {
			modifyMultiplicityWasActive = false;
			multiplicityModalVertexIndex = null;
			highlightVertexNodes(null);
			refreshMultiplicityLabels();
			if (!mutating) infoMessage = '';
		}
	});

	$effect(() => {
		if (graphState.mode === 'add-vertex') {
			addVertexWasActive = true;
			if (container) container.style.cursor = 'crosshair';
			if (!canvasHasGraph && addVertexPosition === null) {
				addVertexPosition = canvasCenterPosition();
				infoMessage = 'Enter the number of half-edge arms for the new vertex.';
			} else if (canvasHasGraph && addVertexPosition === null) {
				infoMessage = 'Click an empty area to place a new vertex.';
			}
		} else if (addVertexWasActive) {
			addVertexWasActive = false;
			addVertexPosition = null;
			if (container && container.style.cursor === 'crosshair') container.style.cursor = '';
			if (!mutating) infoMessage = '';
		}
	});

	$effect(() => {
		if (graphState.mode === 'add-half-edge') {
			addHalfEdgeWasActive = true;
			if (canvasHasGraph) {
				infoMessage = addHalfEdgeAfter === null
					? 'Select a half-edge to insert after.'
					: infoMessage;
				if (addHalfEdgeAfter === null) highlightHalfEdgeArms('all');
			}
			if (container) container.style.cursor = 'crosshair';
		} else if (addHalfEdgeWasActive) {
			addHalfEdgeWasActive = false;
			addHalfEdgeAfter = null;
			highlightHalfEdgeArms(null);
			if (container && container.style.cursor === 'crosshair') container.style.cursor = '';
			if (!mutating) infoMessage = '';
		}
	});

	$effect(() => {
		if (graphState.mode === 'add-orbifold-edge') {
			addOrbifoldWasActive = true;
			infoMessage = 'Select half-edge to connect, or click blank space to connect to new vertex.';
			if (hasDanglingPositiveHalfEdges()) {
				highlightHalfEdgeSet(danglingPositiveHalfEdges());
			} else {
				highlightHalfEdgeArms(null);
			}
			if (container) container.style.cursor = 'crosshair';
		} else if (addOrbifoldWasActive) {
			addOrbifoldWasActive = false;
			highlightHalfEdgeArms(null);
			if (container && container.style.cursor === 'crosshair') container.style.cursor = '';
			if (!mutating) infoMessage = '';
		}
	});

	$effect(() => {
		if (graphState.mode === 'reconnect-arc') {
			reconnectArcWasActive = true;
			if (canvasHasGraph) {
				infoMessage = reconnectSourceHalfEdge === null ? 'Click a source half-edge.' : infoMessage;
				if (reconnectSourceHalfEdge === null) highlightHalfEdgeArms('all');
			}
			if (container) container.style.cursor = 'crosshair';
		} else if (reconnectArcWasActive) {
			reconnectArcWasActive = false;
			reconnectSourceHalfEdge = null;
			highlightHalfEdgeArms(null);
			if (container && container.style.cursor === 'crosshair') container.style.cursor = '';
			if (!mutating) infoMessage = '';
		}
	});

	$effect(() => {
		if (graphState.mode === 'remove-vertex') {
			removeVertexWasActive = true;
			if (canvasHasGraph) {
				infoMessage = 'Click a vertex to remove it.';
				highlightVertexNodes('all');
			}
			if (container) container.style.cursor = 'crosshair';
		} else if (removeVertexWasActive) {
			removeVertexWasActive = false;
			highlightVertexNodes(null);
			if (container && container.style.cursor === 'crosshair') container.style.cursor = '';
			if (!mutating) infoMessage = '';
		}
	});

	$effect(() => {
		if (graphState.mode === 'remove-arc') {
			removeArcWasActive = true;
			if (canvasHasGraph) {
				infoMessage = 'Click an arc to remove it.';
				highlightRemovableArcs();
			}
			if (container) container.style.cursor = 'crosshair';
		} else if (removeArcWasActive) {
			removeArcWasActive = false;
			highlightRemovableArcs(false);
			if (container && container.style.cursor === 'crosshair') container.style.cursor = '';
			if (!mutating) infoMessage = '';
		}
	});

	$effect(() => {
		if (graphState.mode === 'remove-half-edge') {
			removeHalfEdgeWasActive = true;
			if (canvasHasGraph) {
				infoMessage = 'Click a half-edge to remove it.';
				highlightHalfEdgeArms('all');
			}
			if (container) container.style.cursor = 'crosshair';
		} else if (removeHalfEdgeWasActive) {
			removeHalfEdgeWasActive = false;
			highlightHalfEdgeArms(null);
			if (container && container.style.cursor === 'crosshair') container.style.cursor = '';
			if (!mutating) infoMessage = '';
		}
	});

	$effect(() => {
		const requested = graphState.requestedArmLength;
		if (requested === null) return;

		graphState.requestedArmLength = null;
		if (Number.isFinite(requested)) {
			setAllArmLengths(requested);
		}
	});

	$effect(() => {
		if (graphState.mode === 'select-left-mutation-edge' || graphState.mode === 'select-right-mutation-edge') {
			infoMessage = 'Click an edge to mutate it.';
		} else if (
			graphState.mode !== 'adjust-emanating-angle' &&
			graphState.mode !== 'adjust-arc-curvature' &&
			graphState.mode !== 'rotate-vertex' &&
			graphState.mode !== 'modify-multiplicity' &&
			graphState.mode !== 'add-vertex' &&
			graphState.mode !== 'add-half-edge' &&
			graphState.mode !== 'add-orbifold-edge' &&
			graphState.mode !== 'reconnect-arc' &&
			graphState.mode !== 'remove-vertex' &&
			graphState.mode !== 'remove-arc' &&
			graphState.mode !== 'remove-half-edge' &&
			!mutating
		) {
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
	{#if multiplicityModalVertexIndex !== null && renderedGraph}
		<Modal
			title={`Multiplicity of v${multiplicityModalVertexIndex + 1}`}
			placeholder={['Multiplicity']}
			labels={['Multiplicity']}
			initialValues={[String(renderedGraph.multiplicity[multiplicityModalVertexIndex] ?? 1)]}
			inputTypes={['number']}
			minValues={['1']}
			onConfirm={confirmMultiplicityEdit}
			onCancel={cancelMultiplicityEdit}
		/>
	{/if}
	{#if addVertexPosition !== null}
		<Modal
			title="Add vertex"
			placeholder={['1', '1']}
			labels={['Number of half-edge arms', 'Multiplicity']}
			initialValues={['1', '1']}
			inputTypes={['number', 'number']}
			minValues={['1', '1']}
			onConfirm={confirmAddVertex}
			onCancel={cancelAddVertex}
		/>
	{/if}
	{#if addHalfEdgeAfter !== null}
		<Modal
			title={`Add half-edge after ${addHalfEdgeAfter}`}
			placeholder={['1']}
			labels={['Number of half-edge arms']}
			initialValues={['1']}
			inputTypes={['number']}
			minValues={['1']}
			onConfirm={confirmAddHalfEdges}
			onCancel={cancelAddHalfEdges}
		/>
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
