export function halfEdgeTag(h: number): string {
	return h > 0 ? `p${h}` : `m${-h}`;
}

export function vertexId(index: number): string {
	return `v-${index}`;
}

export function anchorId(h: number): string {
	return `u-${halfEdgeTag(h)}`;
}

export function armId(h: number): string {
	return `he-${halfEdgeTag(h)}`;
}

export function connectingEdgeId(h: number): string {
	return `ce-${Math.abs(h)}`;
}

export function orbifoldConnectingEdgeId(h: number): string {
	return `ce-orb-${h}`;
}

export function orbifoldEndId(h: number): string {
	return `orb-x${h}`;
}

export function starParentId(index: number): string {
	return `s-${index}`;
}
