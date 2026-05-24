# Canvas Edit Mode

## Canvas Edit Mode (Accordion B)

When accordion B ("Edit graph on canvas") is open:

- All content in accordion A (Numerical input) is disabled.
- Info box and Mutation controls remain active.
- Draw / Clear buttons are disabled (they live inside accordion A).
- There will be a Brauer graph data sotred in the background that keep track of the data shown on the canvas (it may not be a proper valid Brauer graph).
- Many of the actions to follow require a common last step in their procedure. We call this "tidy up of Brauer graph data". This means going through the entries of the $\sigma_0$, and flag any missing positive integer, and decrease the value of each positive entry $k$ from $k$ to $k-r$, where $r$ is the number of flagged positive integers smaller than $k$, and update $-k$ (if exists in $\sigma_0$) to $-(k-r)$. This will keep all the numbers appeared in $\sigma_0$ being in $\{\pm 1,\pm 2,\ldots, \pm n\}$ for some $n$. Now we renew the number `n` in the stored Brauer graph data to $n$. (During development phase, console log the resulting Brauer graph data.)

### Shared State Invariants

Canvas Edit mode owns user-adjusted graph state that later stages must preserve:

- Current vertex positions, anchor positions, orbifold-end positions, and ordinary-edge Bezier controls are state, not disposable render output.
- Display-toggle changes, mutation animation cleanup, save/load, and graph updates must not reset these positions or controls.
- Outside the dedicated **"Adjust emanating angle"** procedure, dragging any node in a star-shaped subgraph translates that star rigidly and does not change arm length.
- Any procedure that creates or replaces an ordinary connecting edge must either restore saved/user-edited Bezier controls or initialise the edge with Arm-Tangent Bezier Construction from `03-rendering.md`.
- Every user-visible mutation in Canvas Edit mode records Undo state before changing graph data or Cytoscape elements.

### Edit History and Undo

Canvas Edit mode maintains an undo stack for user-visible edit actions. Before each mutating edit, snapshot enough state to restore:

- current `BrauerGraph` data,
- Cytoscape JSON including node positions,
- ordinary edge Bezier anchors/control data,
- current edge/vertex multiplicity display state that is stored on Cytoscape elements.

The **"Undo"** button is disabled when the stack is empty. When clicked, restore the most recent snapshot, update the InfoBox, and leave Canvas Edit mode active. Undo is required for add/remove vertex, remove arc/half-edge, reconnect arc, add orbifold edge, modify multiplicity, adjust emanating angle, rotate vertex, and curve edits.

### Edit Buttons

**"Edit curve"**: enters curve-editing mode for `cytoscape-edge-editing`. User can drag anchor handles on connecting curves. Click background to exit.

**"Modify multiplicity"**:

- If a vertex node is already selected: open prompt and show current multiplicity assigned on the vertex, ask for a new multiplicity and default the input text to be the current multiplicity. Validate user input and change multiplicity on the vertex.
- If not: info bar shows _"Click on a vertex to change its multiplicity."_ → user clicks → carry out the same procedure as described in the previous point.

**"Adjust emanating angle"**:

- Info bar shows _"Click a half-edge arm to adjust its emanating angle."_
- Highlight all half-edge arms.
- User selects a half-edge arm `he-{s}{h}` attached to vertex node `v-{i}`.
- After selection, pointer movement rotates the corresponding anchor node around `v-{i}` while preserving the arm length exactly. The user does not need to keep the mouse button held down after selecting the arm.
- The anchor's allowed angular interval is constrained to its sector between the neighbouring anchors in the cyclic order around `v-{i}`. In the default generated position for a vertex of degree $k$, anchors start at degree $0$ (12 o'clock) and then appear at increments $\theta = 360/k$ in the cyclic-order direction. If the second anchor is initially at $\theta$, then it may move only between degree $1$ and degree $2\theta - 1$.
- The sector bounds should be computed from the current neighbouring anchor positions, not from the original generated layout, because users may have already adjusted angles.
- On confirm/release/exit, update the anchor position and apply **Arm-Tangent Bezier Construction** from `03-rendering.md` to every ordinary connecting edge incident to the adjusted anchor.
- Record the operation for Undo.

**"Rotate vertex"**:

- Info bar shows _"Click a vertex to rotate its half-edge arms."_
- Highlight all vertex nodes.
- User selects vertex node `v-{i}`.
- Rotate the star by cyclically permuting the positions of its anchor nodes in the direction of the current cyclic ordering. Example: if `v-{i}` has clockwise arms `he-p1`, `he-p2`, `he-p3`, then move `u-p1` to the previous position of `u-p2`, `u-p2` to the previous position of `u-p3`, and `u-p3` to the previous position of `u-p1`.
- Orbifold ends attached to orbifold anchors move rigidly with their corresponding anchor direction.
- After the permutation, apply **Arm-Tangent Bezier Construction** from `03-rendering.md` to every ordinary connecting edge incident to any moved anchor.
- Record the operation for Undo.

**"Remove arc/half-edge"**:

- If a connecting edge or a half-edge arm or an orbifold edge is already selected: remove the full edge (i.e. two half-edges, two anchors, one connecting edge for an ordinary Brauer graph edge, and half-edge + anchor + connecting edge + orbifold end for an orbifold edge) associated to it.
- If not: info bar shows _"Click an arc, or orbifold edge, or half-edge arm to remove it."_ → user clicks → remove.
- Record the removed edge(s):
  a. if these include `ce-orb-{h}`, then remove `h` from $\sigma_0$.
  b. if it includes `ce-{h}`, then remove `h` and `-h` from $\sigma_0$.
- Tidy up the Brauer graph data.
- Keyboard: if a connecting edge is selected, `Delete` or `Backspace` also triggers this.

**"Add vertex"**:

- Info bar shows _"Click an empty area to place a new vertex."_
- User clicks canvas. If click position is within `FAR_ENOUGH_PX` of any existing vertex centre: do nothing (show brief info bar message _"Too close to an existing vertex."_).
- Otherwise: open `Modal.svelte` prompting _"Number of half-edges for new vertex:"_ (positive integer input); the prompt includes an optional additional input of multiplicity of the vertex.
- On confirm: increment `n` by (the number of new half-edges), assign new half-edge integers, append a new cycle to `σ₀`, add a new entry to `multiplicity`, and draw the new star-shaped subgraph at the clicked position.
  For example, if before adding a vertex `n` is 5, and user input 4 to the prompt, then set `n=n+4=9`, and push `[k+1,k+2,k+3,k+4]` to $\sigma_0$, where `k` is the maximal positive integer appearing in $\sigma_0$ (before the addition of new vertex).

**"Remove vertex"**:

- Info bar shows _"Click a vertex to remove it."_
- User clicks vertex node `v-{i}`: remove `v-{i}`, all its anchor nodes (`u-*`), all half-edge arms (`he-*`), all connecting edges incident to those anchors.
- We take out the corresponding cycle (the $i$-th array) from `σ₀`, and check through its entries.
    - If there is an entry $h$ in this cycle and $-h$ is an entry in another cycle of $\sigma_0$, then we replace $-h$ by $m+1$, where $m$ is the maximal positive integer appearing in $\sigma_0$ (note $m$ may not be `n`). The corresponding `he-{s}{|h|}` and `u-{s}{h}` needs to be updated to `he-p{m+1}` and `u-p{m+1}` respectively (here `s` is the sign of $-h$). The connecting edge `ce-{h}` needs to be removed.
    - If both $h,-h$ are in the same cycle, then remove all their associated half-edge arms, anchor nodes, and connecting edge.
- Remove also the corresponding ($i$-th) entry from `multiplicity`.
- Perform tidy up of Brauer graph data.
- Keyboard: if a vertex node is selected, `Delete` or `Backspace` triggers this.

**"Reconnect arc"**:

- Info bar shows _"Click a source anchor node."_
- User clicks anchor `u-{s}{h}` (here `h` is a positive number and `s` is `p` or `m`) → it is highlighted.
- Info bar shows _"Click a target anchor node."_
- User clicks anchor `u-{s'}{h'}` (here `h'` is a positive number and `s'` is `p` or `m`).
- If `s=p` and `s'=p`. Let $x=\max\{h,h'\}$ and $y=\min\{h,h'\}$ (in JS: `let [x,y]=h>h'?[h,h']:[h',h];`). Then we replace $x$ in $\sigma_0$ by $-y$, rename `he-p{y}` and `u-p{y}` by `he-m{x}` and `u-m{x}`. Now remove any connecting edge `ce-{h}` and `ce-{h'}` (if they exist) and create a new connecting edge `ce-{x}`.
- If `s=p` and `s'=m`, then replace the number `h'` in $\sigma_0$ by `-h`, rename `he-m{h'}` and `u-m{h'}` by `he-m{h}` and `u-m{h}` respectively, and then remove the connecting edge `ce-{h'}` and create a new connecting edge `ce-{h}`.
- If `s=m` and `s'=p`, then replace the number `h` in $\sigma_0$ by `-h'`, rename `he-m{h}` and `u-m{h}` by `he-m{h'}` and `u-m{h'}` respecitvely, and then remove the connecint edge `ce-{h}` and create a new connecting edge `ce-{h'}`.
- If `s=m` and `s'=m`, then replace the number `h` and `h'` in $\sigma_0$ by `n+1` and `-(n+1)` respectively, rename `he-m{h}`, `u-m{h}`, `he-m{h'}`, `u-m{h'}` by `he-p{n+1}`, `u-p{n+1}`, `he-m{n+1}`, `u-m{n+1}` respecitvely, create new connecting edge `ce-{n+1}`.
- Every time this flow creates a new ordinary connecting edge (`ce-{x}`, `ce-{h}`, `ce-{h'}`, or `ce-{n+1}`), initialise its Bezier controls with **Arm-Tangent Bezier Construction** from `03-rendering.md`. In particular, the control direction at each endpoint must agree with the outgoing direction of the half-edge arm attached to that endpoint, and the initial control length is `BEZIER_CONTROL_LENGTH`.
- Perform tidy up of Brauer graph data.
- Keyboard (tablet/mobile): selecting an anchor node is understood as initiating this flow.

**"Add orbifold edge"**:

- Info bar shows _"Select half-edge to be orbifold"_
- User click on the body of a half-edge arm `he-{h}` or corresponding anchor `u-{h}`, then check if it is connected to any connecting arc. If it is, then show a warning telling the user to select a half-edge that is not connected to anywhere. If it is dangling, which also means that `h>0`, then create an orbifold end node `orb-x{h}` (for position, see graph geneartion in the numerical input part) and connects `u-p{h}` to `orb-x{h}`. Update the `orbifoldEdges` array by inserting `{e}`.

### Ordering of half-edges within a new star

New anchor nodes in a freshly added star are placed in clockwise order starting from north, evenly spaced. The clockwise order around the canvas defines the initial σ₀ cycle ordering. (The user can edit the cycle text in accordion A after exiting accordion B to reorder.)

---
