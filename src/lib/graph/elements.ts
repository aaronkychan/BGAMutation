import type cytoscape from 'cytoscape';
import { ARM_LENGTH, VERTEX_RADIUS } from './constants';
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
				classes: 'u-node'
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
					VERTEX_RADIUS + ARM_LENGTH * 2
				);
				const oId = orbifoldEndId(halfEdge);

				elements.push({
					group: 'nodes',
					data: { id: oId, parent: parentId, h: halfEdge, vertexIndex, edgeId },
					position: orbifoldPosition,
					classes: 'orbifold-node'
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
				elements.push({
					group: 'edges',
					data: {
						id: orderingArrowId(halfEdge, next),
						source: anchorId(halfEdge),
						target: anchorId(next)
					},
					classes: cycle.length === 1 ? 'ordering-arrow singleton' : 'ordering-arrow',
					selectable: false
				});
			});
		}
	});

	for (let edge = 1; edge <= graph.n; edge += 1) {
		if (orbifoldEdges.has(edge)) continue;

		elements.push({
			group: 'edges',
			data: {
				id: connectingEdgeId(edge),
				source: anchorId(edge),
				target: anchorId(-edge),
				h: edge,
				edgeId: `p${edge}`,
				label: options.showEdgeLabels ? `[${edge}]` : ''
			},
			classes: 'ce-edge ordinary-edge'
		});
	}

	return elements;
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
