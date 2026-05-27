import type cytoscape from 'cytoscape';
import {
	ANIMATION_INVOLVED_EDGE_PAUSE_MS,
	ANIMATION_PHASE1_MS,
	ANIMATION_PHASE2_MS,
	ANIMATION_PHASE3_MS,
	ANIMATION_SELECTED_EDGE_PAUSE_MS,
	STROKE_WIDTH
} from './constants';
import { anchorId, armId, connectingEdgeId, orbifoldConnectingEdgeId } from './ids';
import { computeFans, type MutationDirection } from '$lib/math/kaur';
import type { BrauerGraph } from '$lib/math/types';

type GradientArrangement = 'spread' | 'forward' | 'reverse';

export async function animateMutation(
	cy: cytoscape.Core,
	graph: BrauerGraph,
	selectedEdge: number,
	direction: MutationDirection
): Promise<void> {
	const selected = selectedHalfEdges(selectedEdge, graph.orbifoldEdges);
	const orbifoldEdges = graph.orbifoldEdges ?? [];
	const colors = getAnimationColors();
	const animatedEdges = new Set<cytoscape.EdgeSingular>();
	const involvedEdges = collectInvolvedEdges(graph, selected, selectedEdge, direction);
	const emphasizedEdges = emphasizeInvolvedEdges(cy, involvedEdges);

	const animateAndTrack = (edge: cytoscape.EdgeSingular, arrangement: GradientArrangement, durationMs: number) => {
		if (!edge.nonempty()) return Promise.resolve();
		animatedEdges.add(edge);
		return animateEdge(edge, arrangement, colors.edgeColor, colors.highlightColor, durationMs);
	};

	await delay(ANIMATION_INVOLVED_EDGE_PAUSE_MS);

	await Promise.all(
		[...selected]
			.filter((halfEdge) => halfEdge > 0)
			.map((halfEdge) =>
				animateAndTrack(getConnectingElement(cy, halfEdge, orbifoldEdges), 'spread', ANIMATION_PHASE1_MS)
			)
	);

	await Promise.all(
		[...selected].map((halfEdge) =>
			animateAndTrack(edgeById(cy, armId(halfEdge)), 'reverse', ANIMATION_PHASE2_MS)
		)
	);
	for (const halfEdge of selected) {
		edgeById(cy, armId(halfEdge)).style({
			'line-fill': 'solid',
			'line-color': colors.highlightColor,
			'target-arrow-color': colors.highlightColor
		});
	}
	for (const halfEdge of [...selected].filter((halfEdge) => halfEdge > 0)) {
		getConnectingElement(cy, halfEdge, orbifoldEdges).style({
			'line-fill': 'solid',
			'line-color': colors.highlightColor,
			'target-arrow-color': colors.highlightColor
		});
	}

	await delay(ANIMATION_SELECTED_EDGE_PAUSE_MS);

	const fanFlows = computeFans(graph.sigma0, selected)
		.filter((fan) => !fan.isFullCycle)
		.map(async (fan) => {
			const cycle = graph.sigma0[fan.cycleIndex];
			const e =
				direction === 'left'
					? cycle[(fan.endIndex + 1) % cycle.length]
					: cycle[(fan.startIndex - 1 + cycle.length) % cycle.length];
			if (selected.has(e)) return;

			await animateAndTrack(edgeById(cy, armId(e)), 'forward', ANIMATION_PHASE3_MS / 3);

			if (isOrbifoldHalfEdge(e, orbifoldEdges)) {
				const orbifoldEdge = edgeById(cy, orbifoldConnectingEdgeId(Math.abs(e)));
				await animateAndTrack(orbifoldEdge, 'forward', ANIMATION_PHASE3_MS / 6);
				await animateAndTrack(orbifoldEdge, 'reverse', ANIMATION_PHASE3_MS / 6);
				return;
			}

			const connectingEdge = getConnectingElement(cy, e, orbifoldEdges);
			const arrangement = connectingEdge.source().id() === anchorId(e) ? 'forward' : 'reverse';
			await animateAndTrack(connectingEdge, arrangement, ANIMATION_PHASE3_MS / 3);
			await animateAndTrack(edgeById(cy, armId(-e)), 'reverse', ANIMATION_PHASE3_MS / 3);
		});

	await Promise.all(fanFlows);
	restoreEdges([...animatedEdges]);
	restoreEmphasizedEdges(emphasizedEdges);
}

function collectInvolvedEdges(
	graph: BrauerGraph,
	selected: Set<number>,
	selectedEdge: number,
	direction: MutationDirection
): Set<number> {
	const involved = new Set<number>([Math.abs(selectedEdge)]);

	for (const fan of computeFans(graph.sigma0, selected)) {
		if (fan.isFullCycle) continue;

		const cycle = graph.sigma0[fan.cycleIndex];
		const neighbor =
			direction === 'left'
				? cycle[(fan.endIndex + 1) % cycle.length]
				: cycle[(fan.startIndex - 1 + cycle.length) % cycle.length];
		if (!selected.has(neighbor)) involved.add(Math.abs(neighbor));
	}

	return involved;
}

function emphasizeInvolvedEdges(cy: cytoscape.Core, edgeNumbers: Set<number>): cytoscape.EdgeSingular[] {
	const edges: cytoscape.EdgeSingular[] = [];

	for (const edgeNumber of edgeNumbers) {
		cy.edges(`[edgeId = "p${edgeNumber}"]`).forEach((edge) => {
			const singular = edge as unknown as cytoscape.EdgeSingular;
			edges.push(singular);
			singular.style({
				width: STROKE_WIDTH * 2.4,
				'line-opacity': 1
			});
		});
	}

	return edges;
}

function animateEdge(
	edge: cytoscape.EdgeSingular,
	arrangement: GradientArrangement,
	edgeColor: string,
	highlightColor: string,
	durationMs: number
): Promise<void> {
	return new Promise((resolve) => {
		const start = performance.now();
		const colors = buildColors(arrangement, edgeColor, highlightColor).join(' ');

		const frame = (now: number) => {
			const t = Math.min(1, (now - start) / durationMs);
			edge.style({
				'line-fill': 'linear-gradient',
				'line-color': highlightColor,
				'target-arrow-color': highlightColor,
				'line-gradient-stop-colors': colors,
				'line-gradient-stop-positions': buildPositions(arrangement, t).join(' ')
			});

			if (t < 1) {
				requestAnimationFrame(frame);
			} else {
				resolve();
			}
		};

		requestAnimationFrame(frame);
	});
}

function buildColors(arrangement: GradientArrangement, edgeColor: string, highlightColor: string): string[] {
	if (arrangement === 'reverse') return [edgeColor, edgeColor, highlightColor];
	if (arrangement === 'forward') return [highlightColor, edgeColor, edgeColor];
	return [edgeColor, highlightColor, edgeColor];
}

function buildPositions(arrangement: GradientArrangement, t: number): string[] {
	if (arrangement === 'reverse') return ['0%', `${Math.round(100 * (1 - t))}%`, '100%'];
	if (arrangement === 'forward') return ['0%', `${Math.round(100 * t)}%`, '100%'];
	return [`${Math.round(50 * (1 - t))}%`, '50%', `${Math.round(50 + 50 * t)}%`];
}

function getAnimationColors() {
	const root = getComputedStyle(document.documentElement);
	return {
		edgeColor: root.getPropertyValue('--edge-color').trim(),
		highlightColor: root.getPropertyValue('--highlight-color').trim()
	};
}

function restoreEdges(edges: cytoscape.EdgeSingular[]) {
	for (const edge of edges) {
		edge.style({
			'line-fill': 'solid',
			'line-color': '',
			'target-arrow-color': '',
			'line-gradient-stop-colors': '',
			'line-gradient-stop-positions': ''
		});
	}
}

function restoreEmphasizedEdges(edges: cytoscape.EdgeSingular[]) {
	for (const edge of edges) {
		edge.style({
			width: '',
			'line-opacity': ''
		});
	}
}

function delay(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function selectedHalfEdges(edge: number, orbifoldEdges: number[] = []): Set<number> {
	const h = Math.abs(edge);
	return new Set(orbifoldEdges.includes(h) ? [h] : [h, -h]);
}

function isOrbifoldHalfEdge(halfEdge: number, orbifoldEdges: number[] = []): boolean {
	return orbifoldEdges.includes(Math.abs(halfEdge));
}

function getConnectingElement(cy: cytoscape.Core, halfEdge: number, orbifoldEdges: number[]): cytoscape.EdgeSingular {
	const edgeId = isOrbifoldHalfEdge(halfEdge, orbifoldEdges)
		? orbifoldConnectingEdgeId(Math.abs(halfEdge))
		: connectingEdgeId(halfEdge);
	return edgeById(cy, edgeId);
}

function edgeById(cy: cytoscape.Core, edgeId: string): cytoscape.EdgeSingular {
	return cy.getElementById(edgeId).first() as unknown as cytoscape.EdgeSingular;
}
