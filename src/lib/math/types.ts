import type cytoscape from 'cytoscape';

export interface BrauerGraph {
	n: number;
	orbifoldEdges?: number[];
	sigma0: number[][];
	multiplicity: number[];
}

export type NodePosition = { x: number; y: number };

export type NodePositions = Record<string, NodePosition>;

export interface SavedFile {
	label: string;
	savedAt: string;
	graph: BrauerGraph;
	cytoscapeJson: cytoscape.CytoscapeOptions;
	edgeAnchors: Record<string, number[]>;
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
