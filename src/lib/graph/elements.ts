import type cytoscape from 'cytoscape';
import {
	ARM_LENGTH,
	BEZIER_CONTROL_LENGTH,
	ORDERING_ARROW_CURVE_DISTANCE,
	ORDERING_ARROW_LOOP_SWEEP,
	ORBIFOLD_EDGE_LENGTH,
	VERTEX_RADIUS
} from './constants';
import {
	anchorId,
	armId,
	connectingEdgeId,
	orderingArrowId,
	orbifoldConnectingEdgeId,
	orbifoldEndId,
	starParentId,
	vertexId
} from './ids';
import type { RenderOptions } from './types';
import type { BrauerGraph, NodePositions } from '$lib/math/types';

export function buildElements(
	graph: BrauerGraph,
	positions: NodePositions,
	options: RenderOptions
): cytoscape.ElementDefinition[] {
	const elements: cytoscape.ElementDefinition[] = [];
	const orbifoldEdges = new Set(graph.orbifoldEdges ?? []);

	graph.sigma0.forEach((cycle, vertexIndex) => {
		const parentId = starParentId(vertexIndex);
		const vId = vertexId(vertexIndex);
		const vertexPosition = positions[vId] ?? { x: 0, y: 0 };
		const multiplicity = graph.multiplicity[vertexIndex] ?? 1;

		elements.push({
			group: 'nodes',
			data: { id: parentId },
			classes: 'star-parent',
			selectable: false,
			grabbable: false
		});

		elements.push({
			group: 'nodes',
			data: {
				id: vId,
				parent: parentId,
				vertexIndex,
				multiplicity,
				multiplicityLabel: options.showMultiplicityLabels && multiplicity > 1 ? String(multiplicity) : ''
			},
			position: vertexPosition,
			classes: `v-node ${multiplicity > 1 ? 'filled' : 'hollow'}`
		});

		cycle.forEach((halfEdge, halfEdgeIndex) => {
			const anchorPosition = computeAnchorPosition(vertexPosition, cycle.length, halfEdgeIndex, options.direction);
			const edgeId = `p${Math.abs(halfEdge)}`;
			const uId = anchorId(halfEdge);

			elements.push({
				group: 'nodes',
				data: {
					id: uId,
					parent: parentId,
					h: halfEdge,
					vertexIndex,
					edgeId,
					label: options.showHalfEdgeLabels ? String(halfEdge) : ''
				},
				position: anchorPosition,
				classes: `u-node ${options.showHalfEdgeLabels ? 'labeled' : ''}`,
				grabbable: true
			});

			elements.push({
				group: 'edges',
				data: {
					id: armId(halfEdge),
					source: vId,
					target: uId,
					h: halfEdge,
					edgeId
				},
				classes: 'he-edge'
			});

			if (orbifoldEdges.has(halfEdge)) {
				const orbifoldPosition = computeAnchorPosition(
					vertexPosition,
					cycle.length,
					halfEdgeIndex,
					options.direction,
					VERTEX_RADIUS + ARM_LENGTH + ORBIFOLD_EDGE_LENGTH
				);
				const oId = orbifoldEndId(halfEdge);

				elements.push({
					group: 'nodes',
					data: { id: oId, parent: parentId, h: halfEdge, vertexIndex, edgeId },
					position: orbifoldPosition,
					classes: 'orbifold-node',
					grabbable: true
				});

				elements.push({
					group: 'edges',
					data: {
						id: orbifoldConnectingEdgeId(halfEdge),
						source: uId,
						target: oId,
						h: halfEdge,
						edgeId,
						label: options.showEdgeLabels ? `[${halfEdge}]` : ''
					},
					classes: 'ce-edge orbifold-edge'
				});
			}
		});

		if (options.showOrderArrows) {
			cycle.forEach((halfEdge, index) => {
				const next = cycle[(index + 1) % cycle.length];
				const sourcePosition = computeAnchorPosition(vertexPosition, cycle.length, index, options.direction);
				const targetPosition = computeAnchorPosition(
					vertexPosition,
					cycle.length,
					(index + 1) % cycle.length,
					options.direction
				);
				const arrowControls =
					cycle.length === 1
						? computeSingletonArrowControls(vertexPosition, sourcePosition)
						: computeOrderingArrowControls(vertexPosition, sourcePosition, targetPosition);
				elements.push({
					group: 'edges',
					data: {
						id: orderingArrowId(halfEdge, next),
						source: anchorId(halfEdge),
						target: anchorId(next),
						...arrowControls
					},
					classes: cycle.length === 1 ? 'ordering-arrow singleton' : 'ordering-arrow',
					selectable: false
				});
			});
		}
	});

	for (let edge = 1; edge <= graph.n; edge += 1) {
		if (orbifoldEdges.has(edge)) continue;
		const sourceInfo = getAnchorInfo(graph, positions, edge, options);
		const targetInfo = getAnchorInfo(graph, positions, -edge, options);
		const controls = sourceInfo && targetInfo
			? computeBezierControls(sourceInfo, targetInfo)
			: { distances: `${BEZIER_CONTROL_LENGTH} ${-BEZIER_CONTROL_LENGTH}`, weights: '0.25 0.75' };

		elements.push({
			group: 'edges',
			data: {
				id: connectingEdgeId(edge),
				source: anchorId(edge),
				target: anchorId(-edge),
				h: edge,
				edgeId: `p${edge}`,
				label: options.showEdgeLabels ? `[${edge}]` : '',
				controlPointDistances: controls.distances,
				controlPointWeights: controls.weights
			},
			classes: 'ce-edge ordinary-edge'
		});
	}

	return elements;
}

function getAnchorInfo(
	graph: BrauerGraph,
	positions: NodePositions,
	halfEdge: number,
	options: RenderOptions
): { anchor: { x: number; y: number }; vertex: { x: number; y: number } } | null {
	for (const [vertexIndex, cycle] of graph.sigma0.entries()) {
		const halfEdgeIndex = cycle.indexOf(halfEdge);
		if (halfEdgeIndex === -1) continue;

		const vertexPosition = positions[vertexId(vertexIndex)];
		if (!vertexPosition) return null;

		return {
			anchor: computeAnchorPosition(vertexPosition, cycle.length, halfEdgeIndex, options.direction),
			vertex: vertexPosition
		};
	}

	return null;
}

function computeBezierControls(
	sourceInfo: { anchor: { x: number; y: number }; vertex: { x: number; y: number } },
	targetInfo: { anchor: { x: number; y: number }; vertex: { x: number; y: number } }
): { distances: string; weights: string } {
	const source = sourceInfo.anchor;
	const target = targetInfo.anchor;
	const dx = target.x - source.x;
	const dy = target.y - source.y;
	const length = Math.hypot(dx, dy);

	if (length === 0) {
		return { distances: `${BEZIER_CONTROL_LENGTH} ${-BEZIER_CONTROL_LENGTH}`, weights: '0.25 0.75' };
	}

	const normalX = -dy / length;
	const normalY = dx / length;
	const sourceDirection = normalize({
		x: sourceInfo.anchor.x - sourceInfo.vertex.x,
		y: sourceInfo.anchor.y - sourceInfo.vertex.y
	});
	const targetDirection = normalize({
		x: targetInfo.anchor.x - targetInfo.vertex.x,
		y: targetInfo.anchor.y - targetInfo.vertex.y
	});
	const sourceDistance =
		BEZIER_CONTROL_LENGTH * Math.sign(sourceDirection.x * normalX + sourceDirection.y * normalY || 1);
	const targetDistance =
		BEZIER_CONTROL_LENGTH * Math.sign(targetDirection.x * normalX + targetDirection.y * normalY || -1);

	return {
		distances: `${sourceDistance} ${targetDistance}`,
		weights: '0.18 0.82'
	};
}

function normalize(vector: { x: number; y: number }): { x: number; y: number } {
	const length = Math.hypot(vector.x, vector.y);
	return length === 0 ? { x: 0, y: 0 } : { x: vector.x / length, y: vector.y / length };
}

function computeOrderingArrowControls(
	vertex: { x: number; y: number },
	source: { x: number; y: number },
	target: { x: number; y: number }
): { arrowControlDistance: number; arrowControlWeight: number } {
	const dx = target.x - source.x;
	const dy = target.y - source.y;
	const length = Math.hypot(dx, dy);

	if (length === 0) return { arrowControlDistance: ORDERING_ARROW_CURVE_DISTANCE, arrowControlWeight: 0.5 };

	const normal = { x: -dy / length, y: dx / length };
	const midpoint = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
	const awayFromVertex = normalize({ x: midpoint.x - vertex.x, y: midpoint.y - vertex.y });
	const sign = Math.sign(normal.x * awayFromVertex.x + normal.y * awayFromVertex.y) || 1;

	return {
		arrowControlDistance: sign * ORDERING_ARROW_CURVE_DISTANCE,
		arrowControlWeight: 0.5
	};
}

function computeSingletonArrowControls(
	vertex: { x: number; y: number },
	anchor: { x: number; y: number }
): { loopDirection: string; loopSweep: string } {
	const angleRadians = Math.atan2(anchor.y - vertex.y, anchor.x - vertex.x);
	const angleDegrees = Math.round((angleRadians * 180) / Math.PI);

	return {
		loopDirection: `${angleDegrees}deg`,
		loopSweep: `${ORDERING_ARROW_LOOP_SWEEP}deg`
	};
}

function computeAnchorPosition(
	vertexPosition: { x: number; y: number },
	degree: number,
	index: number,
	direction: RenderOptions['direction'],
	distance = VERTEX_RADIUS + ARM_LENGTH
): { x: number; y: number } {
	const sign = direction === 'CW' ? 1 : -1;
	const theta = (sign * 2 * Math.PI * index) / Math.max(degree, 1);

	return {
		x: vertexPosition.x + distance * Math.sin(theta),
		y: vertexPosition.y - distance * Math.cos(theta)
	};
}
