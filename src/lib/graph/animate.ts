import type cytoscape from "cytoscape";
import {
    ANIMATION_FINAL_VERTEX_PAUSE_MS,
    ANIMATION_INVOLVED_EDGE_BLINK_MS,
    ANIMATION_INVOLVED_EDGE_PAUSE_MS,
    ANIMATION_NEIGHBOR_PHASE_MS,
    ANIMATION_PHASE1_MS,
    ANIMATION_PHASE2_MS,
    ANIMATION_SELECTED_EDGE_PAUSE_MS,
    STROKE_WIDTH,
} from "./constants";
import {
    anchorId,
    armId,
    connectingEdgeId,
    orbifoldConnectingEdgeId,
    orbifoldEndId,
} from "./ids";
import type { MutationDirection } from "$lib/math/kaur";
import type { BrauerGraph } from "$lib/math/types";

type GradientArrangement = "spread" | "forward" | "reverse";

export interface MutationAnimationResult {
    neighborEdgeColors: Map<number, string>;
}

export async function animateMutation(
    cy: cytoscape.Core,
    graph: BrauerGraph,
    selectedEdge: number,
    direction: MutationDirection,
    onStage?: (message: string) => void,
): Promise<MutationAnimationResult> {
    const selected = selectedHalfEdges(selectedEdge, graph.orbifoldEdges);
    const orbifoldEdges = graph.orbifoldEdges ?? [];
    const colors = getAnimationColors();
    const animatedEdges = new Set<cytoscape.EdgeSingular>();
    const involvedEdges = collectInvolvedEdges(
        graph,
        selected,
        selectedEdge,
        direction,
    );
    const endpointVertices = selectedEndpointVertices(cy, selected);
    const neighborEdgeColors = assignNeighborColors(
        involvedEdges,
        selectedEdge,
        colors.neighborColors,
    );
    const emphasizedEdges = emphasizeInvolvedEdges(
        cy,
        involvedEdges,
    );
    onStage?.("Invovled edges highlighted");

    const animateAndTrack = (
        edge: cytoscape.EdgeSingular,
        arrangement: GradientArrangement,
        durationMs: number,
        highlightColor = colors.selectedColor,
    ) => {
        if (!edge.nonempty()) return Promise.resolve();
        animatedEdges.add(edge);
        return animateEdge(
            edge,
            arrangement,
            colors.edgeColor,
            highlightColor,
            durationMs,
        );
    };

    await blinkInvolvedEdges(cy, involvedEdges);
    await delay(ANIMATION_INVOLVED_EDGE_PAUSE_MS);
    onStage?.("Concatenating arcs");

    await Promise.all(
        [...selected]
            .filter((halfEdge) => halfEdge > 0)
            .map((halfEdge) =>
                animateAndTrack(
                    getConnectingElement(cy, halfEdge, orbifoldEdges),
                    "spread",
                    ANIMATION_PHASE1_MS,
                ),
            ),
    );

    await Promise.all(
        [...selected].map((halfEdge) =>
            animateAndTrack(
                edgeById(cy, armId(halfEdge)),
                "reverse",
                ANIMATION_PHASE2_MS,
            ),
        ),
    );
    colorEndpointVertices(endpointVertices, colors.selectedColor);
    for (const halfEdge of selected) {
        edgeById(cy, armId(halfEdge)).style({
            "line-fill": "solid",
            "line-color": colors.selectedColor,
            "target-arrow-color": colors.selectedColor,
        });
    }
    for (const halfEdge of [...selected].filter((halfEdge) => halfEdge > 0)) {
        getConnectingElement(cy, halfEdge, orbifoldEdges).style({
            "line-fill": "solid",
            "line-color": colors.selectedColor,
            "target-arrow-color": colors.selectedColor,
        });
    }

    await delay(ANIMATION_FINAL_VERTEX_PAUSE_MS);

    const fanFlows = collectEndpointNeighborFlows(
        graph,
        selected,
        direction,
        colors.neighborColors,
        neighborEdgeColors,
    );
    const neighborCounts = fanFlows.reduce((counts, flow) => {
        const edge = Math.abs(flow.e);
        counts.set(edge, (counts.get(edge) ?? 0) + 1);
        return counts;
    }, new Map<number, number>());

    const farEndpointVertices: cytoscape.NodeSingular[] = [];
    await Promise.all(fanFlows.map(async ({ e, color }) => {
        const duplicateNeighbor = (neighborCounts.get(Math.abs(e)) ?? 0) > 1;

        const segmentDuration = ANIMATION_NEIGHBOR_PHASE_MS / 3;
        const entryArm = edgeById(cy, armId(e));
        primeEdgeColor(entryArm, color);
        await animateAndTrack(entryArm, "forward", segmentDuration, color);
        holdEdgeColor(entryArm, color);

        if (isOrbifoldHalfEdge(e, orbifoldEdges)) {
            const orbifoldEdge = edgeById(
                cy,
                orbifoldConnectingEdgeId(Math.abs(e)),
            );
            const orbifoldEnd = nodeById(cy, orbifoldEndId(Math.abs(e)));
            primeEdgeColor(orbifoldEdge, color);
            await animateAndTrack(
                orbifoldEdge,
                "forward",
                segmentDuration * 0.4,
                color,
            );
            await pulseOrbifoldEnd(
                orbifoldEnd,
                color,
                colors.selectedColor,
                segmentDuration * 0.2,
            );
            await animateAndTrack(
                orbifoldEdge,
                "reverse",
                segmentDuration * 0.4,
                colors.selectedColor,
            );
            holdEdgeColor(orbifoldEdge, color);
            restoreOrbifoldEnd(orbifoldEnd);
            return;
        }

        const connectingEdge = getConnectingElement(cy, e, orbifoldEdges);
        const arrangement =
            connectingEdge.source().id() === anchorId(e)
                ? "forward"
                : "reverse";
        primeEdgeColor(connectingEdge, color);
        await animateAndTrack(
            connectingEdge,
            arrangement,
            segmentDuration,
            color,
        );
        holdEdgeColor(connectingEdge, color);
        if (!duplicateNeighbor) {
            const exitArm = edgeById(cy, armId(-e));
            primeEdgeColor(exitArm, color);
            await animateAndTrack(exitArm, "reverse", segmentDuration, color);
            holdEdgeColor(exitArm, color);
            const farVertex = exitArm.source();
            if (farVertex.nonempty()) {
                farEndpointVertices.push(farVertex);
                colorEndpointVertices([farVertex], color);
            }
        }
    }));
    await delay(ANIMATION_SELECTED_EDGE_PAUSE_MS);
    restoreEdges(
        [...animatedEdges].filter(
            (edge) => !neighborEdgeColors.has(edgeNumberForElement(edge)),
        ),
    );
    restoreEndpointVertices([...endpointVertices, ...farEndpointVertices]);
    restoreEmphasizedEdges(emphasizedEdges);

    return { neighborEdgeColors };
}

function edgeNumberForElement(element: cytoscape.EdgeSingular): number {
    const edgeId = String(element.data("edgeId") ?? "");
    const match = /^p(\d+)$/.exec(edgeId);
    return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

function assignNeighborColors(
    involvedEdges: Set<number>,
    selectedEdge: number,
    neighborColors: string[],
): Map<number, string> {
    const colors = new Map<number, string>();
    const selected = Math.abs(selectedEdge);
    let colorIndex = 0;

    for (const edgeNumber of involvedEdges) {
        if (edgeNumber === selected) continue;

        const color = neighborColors[colorIndex % neighborColors.length];
        colors.set(edgeNumber, color);
        colorIndex += 1;
    }

    return colors;
}

async function blinkInvolvedEdges(
    cy: cytoscape.Core,
    involvedEdges: Set<number>,
): Promise<void> {
    const edges = [...involvedEdges].flatMap((edgeNumber) => {
        return cy
            .edges(`[edgeId = "p${edgeNumber}"]`)
            .map((edge) => edge as unknown as cytoscape.EdgeSingular);
    });

    for (let count = 0; count < 2; count += 1) {
        for (const edge of edges) {
            edge.style({
                "line-fill": "solid",
                "line-color": "",
                "target-arrow-color": "",
                "line-opacity": 1,
            });
        }
        await delay(ANIMATION_INVOLVED_EDGE_BLINK_MS);
        for (const edge of edges) {
            edge.style({
                "line-opacity": 0.12,
            });
        }
        await delay(ANIMATION_INVOLVED_EDGE_BLINK_MS);
    }

    for (const edge of edges) {
        edge.style({
            "line-opacity": 1,
        });
    }
}

function collectEndpointNeighborFlows(
    graph: BrauerGraph,
    selected: Set<number>,
    direction: MutationDirection,
    neighborColors: string[],
    neighborEdgeColors: Map<number, string>,
): Array<{ e: number; color: string }> {
    return [...selected]
        .map((halfEdge, index) => {
            const e = endpointNeighbor(
                graph.sigma0,
                halfEdge,
                selected,
                direction,
            );
            if (e === undefined) return null;
            return {
                e,
                color:
                    neighborEdgeColors.get(Math.abs(e)) ??
                    neighborColors[index % neighborColors.length],
            };
        })
        .filter((flow): flow is { e: number; color: string } => flow !== null);
}

function endpointNeighbor(
    sigma0: number[][],
    halfEdge: number,
    selected: Set<number>,
    direction: MutationDirection,
): number | undefined {
    for (const cycle of sigma0) {
        const index = cycle.indexOf(halfEdge);
        if (index === -1) continue;

        const step = direction === "left" ? -1 : 1;
        let cursor = (index + step + cycle.length) % cycle.length;
        while (cursor !== index) {
            const neighbor = cycle[cursor];
            if (!selected.has(neighbor)) return neighbor;
            cursor = (cursor + step + cycle.length) % cycle.length;
        }

        return undefined;
    }

    return undefined;
}

function collectInvolvedEdges(
    graph: BrauerGraph,
    selected: Set<number>,
    selectedEdge: number,
    direction: MutationDirection,
): Set<number> {
    const involved = new Set<number>([Math.abs(selectedEdge)]);

    for (const halfEdge of selected) {
        const neighbor = endpointNeighbor(
            graph.sigma0,
            halfEdge,
            selected,
            direction,
        );
        if (neighbor !== undefined) involved.add(Math.abs(neighbor));
    }

    return involved;
}

function emphasizeInvolvedEdges(
    cy: cytoscape.Core,
    edgeNumbers: Set<number>,
): cytoscape.EdgeSingular[] {
    const edges: cytoscape.EdgeSingular[] = [];

    for (const edgeNumber of edgeNumbers) {
        cy.edges(`[edgeId = "p${edgeNumber}"]`).forEach((edge) => {
            const singular = edge as unknown as cytoscape.EdgeSingular;
            edges.push(singular);
            singular.style({
                width: STROKE_WIDTH * 2.4,
                "line-opacity": 1,
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
    durationMs: number,
): Promise<void> {
    return new Promise((resolve) => {
        const start = performance.now();
        const colors = buildColors(arrangement, edgeColor, highlightColor).join(
            " ",
        );

        const frame = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            edge.style({
                "line-fill": "linear-gradient",
                "line-color": highlightColor,
                "target-arrow-color": highlightColor,
                "line-gradient-stop-colors": colors,
                "line-gradient-stop-positions": buildPositions(
                    arrangement,
                    t,
                ).join(" "),
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

function primeEdgeColor(edge: cytoscape.EdgeSingular, color: string): void {
    if (!edge.nonempty()) return;

    edge.style({
        "line-color": color,
        "target-arrow-color": color,
    });
}

function holdEdgeColor(edge: cytoscape.EdgeSingular, color: string): void {
    if (!edge.nonempty()) return;

    edge.style({
        "line-fill": "solid",
        "line-color": color,
        "target-arrow-color": color,
    });
}

function clearEdgeColor(edge: cytoscape.EdgeSingular): void {
    if (!edge.nonempty()) return;

    edge.style({
        "line-fill": "solid",
        "line-color": "",
        "target-arrow-color": "",
        "line-gradient-stop-colors": "",
        "line-gradient-stop-positions": "",
    });
}

function selectedEndpointVertices(
    cy: cytoscape.Core,
    selected: Set<number>,
): cytoscape.NodeSingular[] {
    const vertices = new Map<string, cytoscape.NodeSingular>();

    for (const halfEdge of selected) {
        const arm = edgeById(cy, armId(halfEdge));
        const vertex = arm.source();
        if (vertex.nonempty()) vertices.set(vertex.id(), vertex);
    }

    return [...vertices.values()];
}

function colorEndpointVertices(
    vertices: cytoscape.NodeSingular[],
    highlightColor: string,
): void {
    for (const vertex of vertices) {
        vertex.style({
            "border-color": highlightColor,
        });
    }
}

function restoreEndpointVertices(vertices: cytoscape.NodeSingular[]): void {
    for (const vertex of vertices) {
        vertex.style({
            "background-color": "",
            "border-color": "",
        });
    }
}

function pulseOrbifoldEnd(
    orbifoldEnd: cytoscape.NodeSingular,
    color: string,
    wrapColor: string,
    durationMs: number,
): Promise<void> {
    if (!orbifoldEnd.nonempty()) return Promise.resolve();

    return new Promise((resolve) => {
        const start = performance.now();

        const frame = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            const pulse = 0.5 - Math.abs(t - 0.5);
            const activeColor = t < 0.5 ? color : wrapColor;

            orbifoldEnd.style({
                color: activeColor,
                "border-color": activeColor,
                "border-width": 2 + pulse * 5,
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

function restoreOrbifoldEnd(orbifoldEnd: cytoscape.NodeSingular): void {
    if (!orbifoldEnd.nonempty()) return;

    orbifoldEnd.style({
        color: "",
        "border-color": "",
        "border-width": "",
    });
}

function buildColors(
    arrangement: GradientArrangement,
    edgeColor: string,
    highlightColor: string,
): string[] {
    if (arrangement === "reverse")
        return [edgeColor, edgeColor, highlightColor];
    if (arrangement === "forward")
        return [highlightColor, edgeColor, edgeColor];
    return [edgeColor, highlightColor, edgeColor];
}

function buildPositions(arrangement: GradientArrangement, t: number): string[] {
    if (arrangement === "reverse")
        return ["0%", `${Math.round(100 * (1 - t))}%`, "100%"];
    if (arrangement === "forward")
        return ["0%", `${Math.round(100 * t)}%`, "100%"];
    return [
        `${Math.round(50 * (1 - t))}%`,
        "50%",
        `${Math.round(50 + 50 * t)}%`,
    ];
}

function getAnimationColors() {
    const root = getComputedStyle(document.documentElement);
    return {
        edgeColor: root.getPropertyValue("--edge-color").trim(),
        selectedColor: root.getPropertyValue("--highlight-color").trim(),
        neighborColors: [
            root.getPropertyValue("--mutation-neighbor-a-color").trim() ||
                "#d97706",
            root.getPropertyValue("--mutation-neighbor-b-color").trim() ||
                "#3aed76",
        ],
    };
}

function restoreEdges(edges: cytoscape.EdgeSingular[]) {
    for (const edge of edges) {
        edge.style({
            "line-fill": "solid",
            "line-color": "",
            "target-arrow-color": "",
            "line-gradient-stop-colors": "",
            "line-gradient-stop-positions": "",
        });
    }
}

function restoreEmphasizedEdges(edges: cytoscape.EdgeSingular[]) {
    for (const edge of edges) {
        edge.style({
            width: "",
            "line-opacity": "",
        });
    }
}

function delay(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function selectedHalfEdges(
    edge: number,
    orbifoldEdges: number[] = [],
): Set<number> {
    const h = Math.abs(edge);
    return new Set(orbifoldEdges.includes(h) ? [h] : [h, -h]);
}

function isOrbifoldHalfEdge(
    halfEdge: number,
    orbifoldEdges: number[] = [],
): boolean {
    return orbifoldEdges.includes(Math.abs(halfEdge));
}

function getConnectingElement(
    cy: cytoscape.Core,
    halfEdge: number,
    orbifoldEdges: number[],
): cytoscape.EdgeSingular {
    const edgeId = isOrbifoldHalfEdge(halfEdge, orbifoldEdges)
        ? orbifoldConnectingEdgeId(Math.abs(halfEdge))
        : connectingEdgeId(halfEdge);
    return edgeById(cy, edgeId);
}

function edgeById(cy: cytoscape.Core, edgeId: string): cytoscape.EdgeSingular {
    return cy
        .getElementById(edgeId)
        .first() as unknown as cytoscape.EdgeSingular;
}

function nodeById(cy: cytoscape.Core, nodeId: string): cytoscape.NodeSingular {
    return cy
        .getElementById(nodeId)
        .first() as unknown as cytoscape.NodeSingular;
}
