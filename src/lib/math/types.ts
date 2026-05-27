import type cytoscape from 'cytoscape';
import type { RenderOptions } from '$lib/graph/types';

export interface BrauerGraph {
	n: number;
	orbifoldEdges?: number[];
	sigma0: number[][];
	multiplicity: number[];
}

export type NodePosition = { x: number; y: number };

export type NodePositions = Record<string, NodePosition>;

export type CytoscapeJson = {
	elements: cytoscape.ElementDefinition[] | {
		nodes?: cytoscape.ElementDefinition[];
		edges?: cytoscape.ElementDefinition[];
	};
} & Record<string, unknown>;

export interface SavedFile {
	label: string;
	savedAt: string;
	graph: BrauerGraph;
	cytoscapeJson: CytoscapeJson;
	edgeAnchors: Record<string, number[]>;
	renderOptions?: RenderOptions;
}

export interface ValidationError {
	field: string;
	message: string;
}

export interface TopologyMetrics {
	vertices: number;
	edges: number;
	faces: number;
	genus: number;
	orbifoldEdges: number;
	connected: boolean;
}
