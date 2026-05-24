# Kaur Mutation and Graph Updates

## Stage Dependencies

Stage 2 mutation depends on the current rendering/editing state model:

- Mutation must operate on the current in-memory `BrauerGraph`, current Cytoscape node positions, and any current ordinary-edge Bezier controls, not only on the original numerical-input layout.
- Before a mutation changes the graph, push an undo snapshot as described in `06-canvas-editing.md` if the mutation is exposed as a user-visible canvas operation.
- During graph update after animation, preserve user-positioned vertex nodes, manually adjusted arm angles for unaffected stars, and user-edited Bezier controls for unaffected ordinary connecting edges.
- When mutation creates, retargets, or rebuilds an ordinary connecting edge without a saved/user-edited control to preserve, initialise that edge with Arm-Tangent Bezier Construction from `03-rendering.md`.
- Mutation updates must not re-run the full initial layout unless the user explicitly requests a redraw from numerical input.

## Mutation Algorithm

Mutation of orbifold ribbon graph $\Gamma$ is a procedue that changes the local structure around a selected subset $\mathcal{X}$ of edges. There are two types of mutation which are inverse of each other, we call them left and right, denoted by $\mu_{\mathcal{X}}^-(\Gamma)$ and $\mu_{\mathcal{X}}^+(\Gamma)$ respectively.
By irreducible mutation we mean the special case when $|\mathcal{X}|=1$.
Stage 2 aims to implement left and right irreducible mutation, and Stage 3 implements the general case (it maybe possible to combine both stages if it does not complicate matter; in fact, irreducible case may require some more specific case check -- reconfirm with AI planner).
A mutation of a (skew) Brauer graph is just a mutation of the underlying (orbifold) ribbon graph, where the multiplicities of the vertices stay unchanged.

### Setup and Notation

Let $\Gamma = (H, \sigma_0, \sigma_1)$ be the current ribbon orbifold graph.

Let $\mathcal{X} = \{X_1, \ldots, X_s\}$ be the set of selected edges (each $X_i$ is a
$\sigma_1$-orbit: an ordinary edge $\{x, -x\}$ or an orbifold edge $\{x\}$).

Let $\widetilde{\mathcal{X}} = \bigcup_i X_i \subseteq H$ be the set of all half-edges
involved in $\mathcal{X}$.

### Fans

Partition $\widetilde{\mathcal{X}}$ into **fans** $\mathcal{X}_1, \ldots, \mathcal{X}_p$,
where each fan is a maximal consecutive run within a single $\sigma_0$-cycle that lies
entirely in $\widetilde{\mathcal{X}}$.

Formally, fan $\mathcal{X}_i$ is written as:

$$\mathcal{X}_i = \{ h_{i,1},\; h_{i,2}:=\sigma_0(h_{i,1}),\; \ldots,\; h_{i,k_i+1}:=\sigma_0^{k_i}(h_{i,1}) \}$$

where $h_{i,1}$ is called the **first half-edge** of the fan and $h_{i,k_i+1} :=
\sigma_0^{k_i}(h_{i,1})$ is the **last half-edge**, with $k_i \ge 0$. The integer
$k_i + 1$ is the size of the fan.

The **boundary conditions** that define $h_{i,1}$ uniquely (up to Rule 1 below):

- $\sigma_0^{-1}(h_{i,1}) \notin \widetilde{\mathcal{X}}$ — nothing in $\mathcal{X}$
  immediately precedes the fan.
- $\sigma_0(\sigma_0^{k_i}(h_{i,1})) \notin \widetilde{\mathcal{X}}$ — nothing in
  $\mathcal{X}$ immediately follows the fan.

**Implementation note** (`src/lib/math/kaur.ts`): to detect fans, for each
$\sigma_0$-cycle, scan for maximal consecutive subsequences of elements that all belong
to $\widetilde{\mathcal{X}}$. A full cycle (all elements in $\widetilde{\mathcal{X}}$)
is a single fan with no well-defined first element — handled by Rule 1 below.

In code, using the `sigma0` array of cycles and the `halfEdgeId` helper from `ids.ts`:

```ts
function computeFans(sigma0: number[][], selected: Set<number>): Fan[] {
    // For each cycle, find maximal consecutive runs in `selected`.
    // A Fan is { elements: number[], isFullCycle: boolean }
}
```

---

### Left Mutation $\mu^-_{\mathcal{X}}(\Gamma)$

For each fan $\mathcal{X}_i$ with first half-edge $h_{i,1}$ and last half-edge
$h_{i,k_i+1}$, define:

$$e_i := \sigma_0^{-1}(h_{i,1})$$

the half-edge **immediately before the fan** in the current $\sigma_0$-cycle.

The new cyclic ordering $\sigma_0'$ is defined as follows:

**Rule 1** — If $e_i \in \widetilde{\mathcal{X}}$ (equivalently, the fan $\mathcal{X}_i$
fills an entire $\sigma_0$-cycle):

$$\sigma_0'\big|_{\mathcal{X}_i} = \sigma_0\big|_{\mathcal{X}_i}$$

No change for this fan.

**Rule 2** — If $e_i \notin \widetilde{\mathcal{X}}$:

$$
\sigma_0'(h_{i,j}) = \sigma_0(h_{i,j}) \quad \text{for } 1 \le j < k_i + 1
\quad\text{(interior of fan unchanged)}
$$

$$
\sigma_0'(h_{i,k_i+1}) = \sigma_1(e_i)
$$

$$
\sigma_0'(e_i) = \sigma_0(h_{i,k_i+1})
\quad\text{(}e_i \text{ skips the fan, pointing to what used to follow it)}
$$

$$\sigma_0'(\sigma_0^{-1}(\sigma_1(e_i))) = h_{i,1}$$

**Rule 3** — Everything else is unchanged, i.e.

$$
\sigma_0'\big|_{H \setminus (\{h_{i,k_i+1}, e_i, \sigma_0^{-1}(\sigma_1(e_i))\})}
= \sigma_0\big|_{H \setminus (\{h_{i,k_i+1}, e_i, \sigma_0^{-1}(\sigma_1(e_i))\})} \quad \text{ for all } {1 \le i \le p}
$$

**Cycle-level description of Rule 2**: in the original $\sigma_0$-cycle, the segment
reads $\ldots \to e_i \to h_{i,1} \to \cdots \to h_{i,k_i+1} \to f_i \to \ldots$
(where $f_i = \sigma_0(h_{i,k_i+1})$). After left mutation:

- $e_i$ skips the fan: $e_i \to f_i$.
- The fan is reattached ending just before $\sigma_1(e_i)$:
  $h_{i,k_i+1} \to \sigma_1(e_i)$.

Note $\sigma_1(e_i) = -e_i$ if $e_i$ is an ordinary half-edge, or $\sigma_1(e_i) = e_i$
if $e_i$ is an orbifold half-edge.

---

### Right Mutation $\mu^+_{\mathcal{X}}(\Gamma)$

For each fan $\mathcal{X}_i$, define:

$$e_i := \sigma_0(h_{i,k_i+1})$$

the half-edge **immediately after the fan**. Let $f_i := \sigma_0^{-1}(h_{i,1})$
(immediately before the fan).

**Rule 1** — same as left mutation.

**Rule 2** — If $e_i \notin \widetilde{\mathcal{X}}$, the direct $\sigma_0'$ formulation
is:

$$
\sigma_0'(h_{i,j}) = h\_{i,j+1} \quad \text{for } 1 \le j < k_i + 1
\quad\text{(interior unchanged)}
$$

$$
\sigma_0'(h_{i,k_i+1}) = \sigma_0(\sigma_1(e_i))
\quad\text{(last fan element points to what used to follow } \sigma_1(e_i)\text{)}
$$

$$
\sigma_0'(\sigma_1(e_i)) = h_{i,1}
\quad\text{(}\sigma_1\text{-partner of }e_i\text{ now points into start of fan)}
$$

$$
\sigma_0'(f_i) = e_i
\quad\text{(}f_i\text{ skips the fan)}
$$

**Rule 3** Analgous to left mutation:

$$
\sigma_0'\big|_{H \setminus \{h_{i,k_i+1}, f_i, \sigma_1(e_i)\}}
= \sigma_0\big|_{H \setminus \{h_{i,k_i+1}, f_i, \sigma_1(e_i)\}} \quad \text{ for all } {1 \le i \le p}
$$

**Cycle-level description of Rule 2**: original reads
$\ldots \to f_i \to h_{i,1} \to \cdots \to h_{i,k_i+1} \to e_i \to \ldots$. After right
mutation:

- $f_i$ skips the fan: $f_i \to e_i$.
- The fan is reattached starting just after $\sigma_1(e_i)$:
  $\sigma_1(e_i) \to h_{i,1}$, and $h_{i,k_i+1} \to \sigma_0(\sigma_1(e_i))$.

### Remark in the case of irreducible mutation (mutate at a single edge)

In Stage 2, $\mathcal{X} = \{X\}$ is a single selected edge. Let $X = \{x, \sigma_1(x)\}$.

The fans are detected from $\widetilde{\mathcal{X}} = X$:

- If $x$ and $\sigma_1(x)$ are in **different** $\sigma_0$-cycles: two fans,
  $\{x\}$ and $\{\sigma_1(x)\}$, each of size 1.
- If they are in the **same** $\sigma_0$-cycle and adjacent ($\sigma_0(x) = \sigma_1(x)$
  or $\sigma_0(\sigma_1(x)) = x$): one fan of size 2.
- If same cycle but not adjacent: two fans $\{x\}$ and $\{\sigma_1(x)\}$ within one cycle.
- For orbifold $X = \{x\}$ ($\sigma_1(x) = x$): one fan $\{x\}$ of size 1.

For each fan, apply left mutation Rules 1–3 as above.

**Verification of Rule 1 (valency-1 vertex)**: if vertex $v_i$ has valency 1 with
cycle $[x]$, then $\sigma_0(x) = x$ and $e_i = \sigma_0^{-1}(x) = x \in \widetilde{\mathcal{X}}$.
Rule 1 applies: $\sigma_0'(x) = \sigma_0(x) = x$. The vertex $v_i$ survives unchanged
as a degree-1 vertex attached to $x$. No special-casing is needed.

---

## Graph Update After Animation

After all three phases complete, pause for `ANIMATION_POST_MS` (default 500 ms), then:

### Step 1 — Update $\sigma_0$ in graph store

Apply left/right mutation Rules 1–3 to the in-memory `sigma0` array. The update touches only
the half-edges and $e_i$ values identified during fan computation. No other entries change.

### Step 2 — Identify changed vertices

Determine the set of vertices $V_\Delta$ whose $\sigma_0$-cycle has changed. A vertex
$v$ is in $V_\Delta$ if any of the following are in its new (post-mutation) cycle or its
old cycle:

- Any half-edge in $\widetilde{\mathcal{X}}$ that moved to a different cycle.
- Any $e_i$ whose successor changed.

### Step 3 — Rebuild star-shaped subgraphs for changed vertices

For each vertex $v \in V_\Delta$:

1. **Remove** from Cytoscape all existing arm edges (`he-*`) and anchor nodes (`u-*`,
   `orb-x*`) belonging to $v$'s old star subgraph $S(v)$.
2. **Recompute** anchor positions using the current star geometry state, keeping $v$'s
   position fixed. If the user has adjusted emanating angles around this vertex, preserve
   those angular positions as far as the new cyclic ordering allows; otherwise fall back
   to the generated star geometry formula with the current CW/CCW setting.
3. **Add** new arm edges and anchor/orbifold-end nodes to Cytoscape with the updated
   positions and IDs.
4. **Update** connecting edges (`ce-*`, `ce-orb-*`) whose endpoints have moved:
   rebind source/target to the newly created anchor nodes. Preserve existing Bezier
   control point data (`edgeAnchors` entry for that edge) when the edge represents the
   same user-edited ordinary curve. If the ordinary edge is newly created or has no
   saved/user-edited control data, initialise it with Arm-Tangent Bezier Construction
   from `03-rendering.md`.

> **Note**: The vertex node `v-{i}` itself does not move. Only the arms and anchors
> are rebuilt. The compound parent `s-{i}` is updated to include the new anchor nodes.

### Step 4 — Update Panel 1 and Info Box

Reflect the new `sigma0` in the `NumericalAccordion` cycle inputs (read-only display
while canvas accordion is open). Recompute and display updated topology metrics in
`InfoBox` (v, e, f, g, orbifold edge count).

---

### `src/lib/math/kaur.ts`

Responsibility: Kaur move combinatorial logic — fan decomposition, left/right σ₀ mutation.

```ts
// A fan: a maximal consecutive run of selected half-edges within one σ₀ cycle.
interface Fan {
    elements: number[]; // ordered h_{i,1} … h_{i,k+1}
    isFullCycle: boolean; // true when the entire σ₀ cycle is selected (Rule 1)
    cycleIndex: number;
    startIndex: number; // if isFullCycle, then startIndex is 0, endIndex=cycle.length-1
    endIndex: number; // possible that this is less than startIndex, since each array in sigma_0 encodes a cycle, not a linear list
}

// Decompose the selected half-edges into fans.
// `selected` is the union of all half-edges in the chosen σ₁-orbits (X̃).
function computeFans(sigma0: number[][], selected: Set<number>): Fan[];

// Apply left mutation μ⁻ to sigma0 given the fan decomposition.
// Returns a new sigma0 array; does not mutate the input.
function applyLeftMutation(
    sigma0: number[][],
    fans: Fan[],
    orbifoldEdges: number[],
): number[][];

// Apply right mutation μ⁺ to sigma0 given the fan decomposition.
// Returns a new sigma0 array; does not mutate the input.
function applyRightMutation(
    sigma0: number[][],
    fans: Fan[],
    orbifoldEdges: number[],
): number[][];

// Convenience wrapper: run left mutation on a BrauerGraph for a set of selected edges.
// selectedEdgeHalfEdges: the Set of all half-edges h such that the σ₁-orbit of h is selected.
function mutateLeft(
    graph: BrauerGraph,
    selectedEdgeHalfEdges: Set<number>,
): BrauerGraph; // (implied)

// Convenience wrapper for right mutation.
function mutateRight(
    graph: BrauerGraph,
    selectedEdgeHalfEdges: Set<number>,
): BrauerGraph; // (implied)

// Identify which vertices (by σ₀ cycle index) have changed between oldSigma0 and newSigma0.
// Used by "Graph Update After Animation" Step 2.
function changedVertices(
    oldSigma0: number[][],
    newSigma0: number[][],
): number[]; // (implied)
```

---
