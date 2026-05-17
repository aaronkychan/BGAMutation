import { CIRCULAR_LAYOUT_RADIUS, GRID_LAYOUT_SPACE, LINE_LAYOUT_SPACE } from './constants';
import { vertexId } from './ids';
import type { NodePosition, NodePositions } from '$lib/math/types';

export type InitialLayout = 'circle' | 'grid' | 'line';

export function computeInitialVertexPositions(
	count: number,
	layout: InitialLayout,
	center: NodePosition
): NodePositions {
	if (layout === 'grid') return computeGridPositions(count, center);
	if (layout === 'line') return computeLinePositions(count, center);
	return computeCirclePositions(count, center);
}

function computeCirclePositions(count: number, center: NodePosition): NodePositions {
	const positions: NodePositions = {};

	for (let index = 0; index < count; index += 1) {
		const theta = (2 * Math.PI * index) / Math.max(count, 1);
		positions[vertexId(index)] = {
			x: center.x + CIRCULAR_LAYOUT_RADIUS * Math.sin(theta),
			y: center.y - CIRCULAR_LAYOUT_RADIUS * Math.cos(theta)
		};
	}

	return positions;
}

function computeGridPositions(count: number, center: NodePosition): NodePositions {
	const positions: NodePositions = {};
	const columns = Math.ceil(Math.sqrt(count));
	const rows = Math.ceil(count / columns);

	for (let index = 0; index < count; index += 1) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		positions[vertexId(index)] = {
			x: center.x + (column - (columns - 1) / 2) * GRID_LAYOUT_SPACE,
			y: center.y + (row - (rows - 1) / 2) * GRID_LAYOUT_SPACE
		};
	}

	return positions;
}

function computeLinePositions(count: number, center: NodePosition): NodePositions {
	const positions: NodePositions = {};

	for (let index = 0; index < count; index += 1) {
		positions[vertexId(index)] = {
			x: center.x + (index - (count - 1) / 2) * LINE_LAYOUT_SPACE,
			y: center.y
		};
	}

	return positions;
}
