import type cytoscape from 'cytoscape';
import {
	ARM_LENGTH,
	BEZIER_CONTROL_LENGTH,
	ORDERING_ARROW_CURVE_DISTANCE,
	ORBIFOLD_EDGE_LENGTH,
	VERTEX_RADIUS
} from './constants';
import {
	anchorId,
	armId,
	connectingEdgeId,
	orderingArrowId,
	orderingArrowPointId,
	orderingArrowSegmentId,
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
				multiplicityLabel: options.showMultiplicityLabels ? String(multiplicity) : ''
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

	});

	if (options.showOrderArrows) {
		elements.push(...buildOrderingArrowElements(graph, (index) => positions[vertexId(index)] ?? { x: 0, y: 0 }, options));
	}

	for (let edge = 1; edge <= graph.n; edge += 1) {
		if (orbifoldEdges.has(edge)) continue;
		const sourceInfo = getAnchorInfo(graph, positions, edge, options);
		const targetInfo = getAnchorInfo(graph, positions, -edge, options);
		const controls = sourceInfo && targetInfo
			? computeArmTangentBezierControls(sourceInfo, targetInfo)
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

export function buildOrderingArrowElements(
	graph: BrauerGraph,
	vertexPositionFor: (vertexIndex: number) => { x: number; y: number },
	options: Pick<RenderOptions, 'direction'>
): cytoscape.ElementDefinition[] {
	const elements: cytoscape.ElementDefinition[] = [];

	graph.sigma0.forEach((cycle, vertexIndex) => {
		const parentId = starParentId(vertexIndex);
		const vertexPosition = vertexPositionFor(vertexIndex);

		if (cycle.length === 1) {
			addSingletonOrderingArrow(elements, vertexIndex, parentId, cycle[0], vertexPosition, options.direction);
			return;
		}

		if (cycle.length === 2) {
			addTwoValentOrderingArrows(elements, vertexIndex, parentId, cycle, vertexPosition, options.direction);
			return;
		}

		cycle.forEach((halfEdge, index) => {
			const arrowPointPosition = computeAnchorPosition(
				vertexPosition,
				cycle.length,
				index,
				options.direction,
				ARM_LENGTH
			);

			elements.push({
				group: 'nodes',
				data: {
					id: orderingArrowPointId(vertexIndex, halfEdge),
					parent: parentId,
					h: halfEdge,
					vertexIndex
				},
				position: arrowPointPosition,
				classes: 'ordering-arrow-point',
				selectable: false,
				grabbable: false
			});
		});

		cycle.forEach((halfEdge, index) => {
			const next = cycle[(index + 1) % cycle.length];
			const sourcePosition = computeAnchorPosition(vertexPosition, cycle.length, index, options.direction, ARM_LENGTH);
			const targetPosition = computeAnchorPosition(
				vertexPosition,
				cycle.length,
				(index + 1) % cycle.length,
				options.direction,
				ARM_LENGTH
			);
			elements.push({
				group: 'edges',
				data: {
					id: orderingArrowId(halfEdge, next),
					source: orderingArrowPointId(vertexIndex, halfEdge),
					target: orderingArrowPointId(vertexIndex, next),
					...computeOrderingArrowControls(vertexPosition, sourcePosition, targetPosition, cycle.length)
				},
				classes: 'ordering-arrow',
				selectable: false
			});
		});
	});

	return elements;
}

function addSingletonOrderingArrow(
	elements: cytoscape.ElementDefinition[],
	vertexIndex: number,
	parentId: string,
	halfEdge: number,
	vertexPosition: { x: number; y: number },
	direction: RenderOptions['direction']
): void {
	const segmentCount = 4;

	for (let index = 0; index < segmentCount; index += 1) {
		elements.push({
			group: 'nodes',
			data: {
				id: orderingArrowPointId(vertexIndex, halfEdge, index),
				parent: parentId,
				h: halfEdge,
				vertexIndex
			},
			position: computeAnchorPosition(vertexPosition, segmentCount, index, direction, ARM_LENGTH),
			classes: 'ordering-arrow-point',
			selectable: false,
			grabbable: false
		});
	}

	for (let index = 0; index < segmentCount; index += 1) {
		const nextIndex = (index + 1) % segmentCount;
		const sourcePosition = computeAnchorPosition(vertexPosition, segmentCount, index, direction, ARM_LENGTH);
		const targetPosition = computeAnchorPosition(vertexPosition, segmentCount, nextIndex, direction, ARM_LENGTH);

		elements.push({
			group: 'edges',
			data: {
				id: orderingArrowSegmentId(halfEdge, halfEdge, index),
				source: orderingArrowPointId(vertexIndex, halfEdge, index),
				target: orderingArrowPointId(vertexIndex, halfEdge, nextIndex),
				...computeOrderingArrowControls(vertexPosition, sourcePosition, targetPosition, segmentCount)
			},
			classes: index === segmentCount - 1 ? 'ordering-arrow singleton' : 'ordering-arrow singleton no-arrowhead',
			selectable: false
		});
	}
}

function addTwoValentOrderingArrows(
	elements: cytoscape.ElementDefinition[],
	vertexIndex: number,
	parentId: string,
	cycle: number[],
	vertexPosition: { x: number; y: number },
	direction: RenderOptions['direction']
): void {
	cycle.forEach((halfEdge, index) => {
		elements.push({
			group: 'nodes',
			data: {
				id: orderingArrowPointId(vertexIndex, halfEdge),
				parent: parentId,
				h: halfEdge,
				vertexIndex
			},
			position: computeAnchorPosition(vertexPosition, cycle.length, index, direction, ARM_LENGTH),
			classes: 'ordering-arrow-point',
			selectable: false,
			grabbable: false
		});

		elements.push({
			group: 'nodes',
			data: {
				id: orderingArrowPointId(vertexIndex, halfEdge, 'mid'),
				parent: parentId,
				h: halfEdge,
				vertexIndex
			},
			position: computeAnchorPosition(vertexPosition, cycle.length, index + 0.5, direction, ARM_LENGTH),
			classes: 'ordering-arrow-point',
			selectable: false,
			grabbable: false
		});
	});

	cycle.forEach((halfEdge, index) => {
		const next = cycle[(index + 1) % cycle.length];
		const sourcePosition = computeAnchorPosition(vertexPosition, cycle.length, index, direction, ARM_LENGTH);
		const midpointPosition = computeAnchorPosition(vertexPosition, cycle.length, index + 0.5, direction, ARM_LENGTH);
		const targetPosition = computeAnchorPosition(
			vertexPosition,
			cycle.length,
			(index + 1) % cycle.length,
			direction,
			ARM_LENGTH
		);

		elements.push({
			group: 'edges',
			data: {
				id: orderingArrowSegmentId(halfEdge, next, 0),
				source: orderingArrowPointId(vertexIndex, halfEdge),
				target: orderingArrowPointId(vertexIndex, halfEdge, 'mid'),
				...computeOrderingArrowControls(vertexPosition, sourcePosition, midpointPosition, 4)
			},
			classes: 'ordering-arrow two-valent no-arrowhead',
			selectable: false
		});

		elements.push({
			group: 'edges',
			data: {
				id: orderingArrowSegmentId(halfEdge, next, 1),
				source: orderingArrowPointId(vertexIndex, halfEdge, 'mid'),
				target: orderingArrowPointId(vertexIndex, next),
				...computeOrderingArrowControls(vertexPosition, midpointPosition, targetPosition, 4)
			},
			classes: 'ordering-arrow two-valent',
			selectable: false
		});
	});
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

export function computeArmTangentBezierControls(
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

	const sourceDirection = normalize({
		x: sourceInfo.anchor.x - sourceInfo.vertex.x,
		y: sourceInfo.anchor.y - sourceInfo.vertex.y
	});
	const targetDirection = normalize({
		x: targetInfo.anchor.x - targetInfo.vertex.x,
		y: targetInfo.anchor.y - targetInfo.vertex.y
	});
	const sourceControl = {
		x: source.x + sourceDirection.x * BEZIER_CONTROL_LENGTH,
		y: source.y + sourceDirection.y * BEZIER_CONTROL_LENGTH
	};
	const targetControl = {
		x: target.x + targetDirection.x * BEZIER_CONTROL_LENGTH,
		y: target.y + targetDirection.y * BEZIER_CONTROL_LENGTH
	};
	const sourceControlData = projectControlPoint(sourceControl, source, target);
	const targetControlData = projectControlPoint(targetControl, source, target);

	return {
		distances: `${sourceControlData.distance} ${targetControlData.distance}`,
		weights: `${sourceControlData.weight} ${targetControlData.weight}`
	};
}

function normalize(vector: { x: number; y: number }): { x: number; y: number } {
	const length = Math.hypot(vector.x, vector.y);
	return length === 0 ? { x: 0, y: 0 } : { x: vector.x / length, y: vector.y / length };
}

function projectControlPoint(
	point: { x: number; y: number },
	source: { x: number; y: number },
	target: { x: number; y: number }
): { distance: number; weight: number } {
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

function computeOrderingArrowControls(
	vertex: { x: number; y: number },
	source: { x: number; y: number },
	target: { x: number; y: number },
	degree: number
): { arrowControlDistance: number; arrowControlWeight: number } {
	const dx = target.x - source.x;
	const dy = target.y - source.y;
	const length = Math.hypot(dx, dy);

	if (length === 0) return { arrowControlDistance: ORDERING_ARROW_CURVE_DISTANCE, arrowControlWeight: 0.5 };

	const normal = { x: -dy / length, y: dx / length };
	const midpoint = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
	const awayFromVertex = normalize({ x: midpoint.x - vertex.x, y: midpoint.y - vertex.y });
	const sign = Math.sign(normal.x * awayFromVertex.x + normal.y * awayFromVertex.y) || 1;
	const arcControlDistance = 2 * ARM_LENGTH * (1 - Math.cos(Math.PI / Math.max(degree, 1)));

	return {
		arrowControlDistance: sign * arcControlDistance,
		arrowControlWeight: 0.5
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
