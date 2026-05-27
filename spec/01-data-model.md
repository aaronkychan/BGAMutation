# Data Model, Validation, and Examples

## Mathematical Background

### Half-Edge Set H

Given the user-supplied integer $n \geq 0$ (total number of ordinary and orbifold edges) and an optional array `orbifoldEdges` of positive integers each $\leq n$:

$$H = \bigl(\{-n, \ldots, -1, 1, \ldots, n\} \setminus \{-i : i \in \mathtt{orbifoldEdges}\}\bigr)$$

That is, for each orbifold index $i \in \mathtt{orbifoldEdges}$, the **negative** half-edge $-i$ is excluded from $H$; the positive half-edge $+i$ remains.

### Cyclic Ordering σ₀

Stored as an array of cycles `number[][]`, where each cycle lists the half-edges around one vertex in cyclic order. $\sigma_0$ must partition $H$ exactly.
A vertex in a ribbon graph is a $\sigma_0$-orbit, that is, one single array in the cyclic order array. On canvas, we display this by a star-shaped graph consisting of "vertex node" in the center and "half-edge arms" connecting the vertex node to the "anchor nodes". We refer the star-shaped graph by $S(v)$ for a vertex $v$ of the ribbon graph. The "anchor nodes" are purely for cytoscape-drawing purpose and has no mathematical meaning.

### Edge Involution σ₁

$$\sigma_1(h) = \begin{cases} -h & \text{if } h \in H \text{ and } |h| \notin \mathtt{orbifoldEdges} \quad\text{(ordinary edge)}\\ h & \text{if } h \in H \text{ and } h \in \mathtt{orbifoldEdges} \quad\text{(orbifold edge, fixed point)} \end{cases}$$

$\sigma_1$ is **never stored** — it is always derived from $n$ and `orbifoldEdges`.

An edge, or an arc, in the ribbon graph is a $\sigma_1$-orbit. A $\sigma_1$-orbit of size 1 in a ribbon orbifold graph is called an orbifold edge.
On canvas, we display an edge refers to "the half-edge arms" and a "connecting edge/arc" that connects the two anchor nodes of the two half-edge arms; c.f. [###Edge-rendering] below
For orbifold edge, we display it on canvas with an half-edge and a straight connecting edge that connects the anchor node to a node that we will refer as "orbifold end".
The orbifold end will be drawn as a cross; this end does not count as a vertex in the ribbon orbifold graph.

### Multiplicity Function

Each vertex $v_i$ has a positive integer multiplicity $m_i$, stored as a flat array `number[]` indexed by position in $\sigma_0$. Default to all 1's.

### Brauer Graph and Skew Brauer Graph

- **Brauer graph**: `orbifoldEdges` is empty (or absent). All edges are ordinary.
- **Skew Brauer graph**: `orbifoldEdges` is non-empty.

The data model below handles both cases uniformly.

## Data Structures (`src/lib/math/types.ts`)

```ts
interface BrauerGraph {
    n: number; // total number of ordinary and orbifold edges
    orbifoldEdges?: number[]; // positive integers ≤ n; each removes its negative from H
    sigma0: number[][]; // vertex cycles; must partition H
    multiplicity: number[]; // [m_1, ..., m_v], one entry per cycle in sigma0
}

// Positions keyed by Cytoscape node ID (vertex nodes only; anchor node positions derived)
type NodePositions = Record<string, { x: number; y: number }>;

// Full saved file (JSON download/upload)
interface SavedFile {
    label: string; // user-supplied name
    savedAt: string; // ISO timestamp
    graph: BrauerGraph;
    cytoscapeJson: cytoscape.CytoscapeOptions; // output of cy.json() — nodes carry position:{x,y}
    edgeAnchors: Record<string, number[]>; // keyed by 'ce-{h}'; flat [x0,y0,x1,y1,...]
    renderOptions?: RenderOptions; // display toggles, direction, and initial layout metadata
}
```

---

## Test Data (`src/lib/math/examples.ts`)

Each example stores a `BrauerGraph` plus a `NodePositions` map with hardcoded vertex positions arranged in a circle. The positions are hand-tuned during prototyping; the initial values are computed by the circle-arrangement formula with a sensible radius (e.g., 200 px for most examples).

### Ordinary Brauer graphs

| Name            | σ₀                                       | n   |
| --------------- | ---------------------------------------- | --- |
| Star (5 edges)  | `[[1,2,3,4,5],[-1],[-2],[-3],[-4],[-5]]` | 5   |
| Line (4 edges)  | `[[-1],[1,-2],[2,-3],[3,-4],[4]]`        | 4   |
| Torus (3 edges) | `[[1,2,3],[-1,-2,-3]]`                   | 3   |
| Pants (3 edges) | `[[1,2,3],[-1,-3,-2]]`                   | 3   |

All multiplicities default to 1.

### Skew Brauer graphs

| Name               | σ₀                  | n   | orbifoldEdges |
| ------------------ | ------------------- | --- | ------------- |
| One orbifold edge  | `[[1,2,3],[-1,-2]]` | 3   | `[3]`         |
| Two orbifold edges | `[[1,2]]`           | 2   | `[1,2]`       |

---

### `src/lib/math/ribbon.ts`

Responsibility: σ₀/σ₁ utilities, H computation, topology metrics, validation.

```ts
// Compute the full half-edge set H from n and orbifoldEdges.
function computeH(n: number, orbifoldEdges?: number[]): number[];

// σ₁ for a single half-edge (derived, never stored).
function sigma1(h: number, orbifoldEdges: number[]): number;

// Build a Map<h, successor> from σ₀ cycles (forward direction).
function buildSigma0Map(sigma0: number[][]): Map<number, number>; // (implied)

// Build a Map<h, predecessor> from σ₀ cycles (inverse direction).
function buildSigma0InverseMap(sigma0: number[][]): Map<number, number>; // (implied)

// Compute σ₀ orbit (face) as σ₁ ∘ σ₀ — returns all face cycles.
function computeFaces(sigma0: number[][], orbifoldEdges: number[]): number[][]; // (implied)

// For each ordinary edge index i, return the source vertices of +i and -i.
// For orbifold edge i, returns [a, a] where a is the source vertex of +i.
function computeHalfedgeSourcePairs(
    graph: BrauerGraph,
): Array<[positiveSource: number, negativeSource: number]>;

// Returns true if the half-edge h belongs to an ordinary (non-orbifold) edge,
// i.e. σ₁(h) = -h.  Equivalently, |h| is not in orbifoldEdges.
// h must be a non-zero integer in H; orbifoldEdges must contain only positive integers.
function isOrdinary(h: number, orbifoldEdges: number[]): boolean;

// Validate a BrauerGraph; returns per-field error messages or an empty array.
function validateBrauerGraph(graph: BrauerGraph): ValidationError[];

// Compute topology metrics for the InfoBox: v, e, f, g, orbifold count, connected flag.
function computeTopologyMetrics(graph: BrauerGraph): TopologyMetrics;

// Check whether the ribbon graph is connected (σ₀ and σ₁ generate a transitive action on H).
function isConnected(sigma0: number[][], orbifoldEdges: number[]): boolean; // (implied)
```

---
