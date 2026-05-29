# Canvas Edit Mode

## Canvas Edit Mode (Accordion B)

When accordion B ("Edit graph on canvas") is open:

- All content in accordion A (Numerical edit) is disabled.
- Info box and Mutation controls remain active.
- Draw / Clear buttons are disabled (they live inside accordion A).
- There will be a Brauer graph data sotred in the background that keep track of the data shown on the canvas (it may not be a proper valid Brauer graph).
- Many of the actions to follow require a common last step in their procedure. We call this "tidy up of Brauer graph data". This means going through the entries of the $\sigma_0$, and flag any missing positive integer, and decrease the value of each positive entry $k$ from $k$ to $k-r$, where $r$ is the number of flagged positive integers smaller than $k$, and update $-k$ (if exists in $\sigma_0$) to $-(k-r)$. This will keep all the numbers appeared in $\sigma_0$ being in $\{\pm 1,\pm 2,\ldots, \pm n\}$ for some $n$. Now we renew the number `n` in the stored Brauer graph data to $n$. (During development phase, console log the resulting Brauer graph data.)

### Shared State Invariants

Canvas Edit mode owns user-adjusted graph state that later stages must preserve:

- Current vertex positions, anchor positions, orbifold-end positions, and ordinary-edge Bezier controls are state, not disposable render output.
- Canvas Edit may temporarily hold partial graph states that are not valid Brauer graphs. Rendering must tolerate dangling half-edge arms: draw the vertex, anchor, and arm, but do not draw an ordinary connecting arc unless both endpoint anchors exist.
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

Canvas edit actions are grouped in accordion B:

- **Add/Edit**: Add vertex, Add half-edge, Add orbifold edge, (Re)connect arcs, Modify multiplicities.
- **Remove**: Remove vertex, Remove arc, Remove half-edge.
- **Display edit**: Adjust emanating angle, Rotate vertex, Adjust arc curvature, Arm length.

Keyboard shortcuts use a group key followed by an action key:

- `a` selects the Add/Edit group; then `v` = Add vertex, `h` = Add half-edge, `o` = Add orbifold edge, `c` = (Re)connect arcs, `m` = Modify multiplicities.
- `d` selects the Remove group; then `v` = Remove vertex, `a` = Remove arc, `h` = Remove half-edge.
- `e` selects the Display edit group; then `a` = Adjust emanating angle, `r` = Rotate vertex, `c` = Adjust arc curvature, `ArrowUp` / `ArrowDown` adjust global arm length.
- `z` triggers Undo.
- Pressing a group key highlights that group in the Canvas Edit panel.
- Pressing `Esc` clears the selected group and exits any active Canvas Edit tool such as Adjust emanating angle or Rotate vertex.
- Each group and individual function displays its hotkey as a small keyboard-style hint at the right end of the row.

**"Edit curve"**: enters curve-editing mode for `cytoscape-edge-editing`. User can drag anchor handles on connecting curves. Click background to exit.

**"Modify multiplicity"**:

- When the tool is active, temporarily show multiplicity labels on every vertex, the same as enabling the "Multiplicity labels" display toggle. If the toggle was off, restore that off state when the tool exits.
- Info bar shows _"Click a vertex to change its multiplicity."_
- User clicks a vertex node `v-{i}`.
- Open a numeric up/down control showing the current multiplicity assigned on the vertex and defaulted to that current multiplicity. The lower bound is `1`.
- Validate user input as a positive integer, update the corresponding `multiplicity[i]`, and update the vertex rendering immediately.
- After confirming or cancelling the prompt, keep the user in Modify multiplicities mode so the user can choose another vertex. Pressing `Esc` exits the mode.
- Record the operation for Undo.

**"Adjust emanating angle"**:

- Info bar shows _"Click a half-edge arm to adjust its emanating angle."_
- Highlight all half-edge arms.
- User selects a half-edge arm `he-{s}{h}` attached to vertex node `v-{i}`. Because anchor nodes are intentionally small/hidden, the user may click the half-edge arm itself. If the user clicks a connecting edge while this tool is active, choose the nearer endpoint half-edge arm as the one to adjust.
- After selection, pointer movement rotates the corresponding anchor node around `v-{i}` while preserving the arm length exactly. The user does not need to keep the mouse button held down after selecting the arm.
- The anchor's allowed angular interval is constrained to its sector between the neighbouring anchors in the cyclic order around `v-{i}`. In the default generated position for a vertex of degree $k$, anchors start at degree $0$ (12 o'clock) and then appear at increments $\theta = 360/k$ in the cyclic-order direction. If the second anchor is initially at $\theta$, then it may move only between degree $1$ and degree $2\theta - 1$.
- The sector bounds should be computed from the current neighbouring anchor positions, not from the original generated layout, because users may have already adjusted angles.
- After selecting an arm, a second click anywhere on the canvas confirms the current preview angle, deselects the current half-edge arm, and keeps the user in Adjust emanating angle mode so the user can immediately choose another arm. Clicking the Adjust emanating angle button again or pressing `Esc` exits the mode.
- On confirm/release/deselect/exit, update the anchor position and apply **Arm-Tangent Bezier Construction** from `03-rendering.md` to every ordinary connecting edge incident to the adjusted anchor.
- Record the operation for Undo.

**"Arm length" numeric control**:

- This is a global Canvas Edit numeric input, styled like the numerical edit number fields.
- The input displays the current canvas arm length, computed as the average centre-to-anchor distance across all half-edge arms.
- Changing the value sets every anchor node to that centre-to-anchor distance from its own vertex node, preserving each arm's current angle.
- Arm length must never fall below a small positive minimum, so anchors cannot collapse onto the vertex node.
- Orbifold endpoints move along the same ray as their positive orbifold anchor so the orbifold segment remains attached.
- After the update, apply **Arm-Tangent Bezier Construction** to all ordinary connecting edges.
- Record the operation for Undo.

**"Rotate vertex"**:

- Info bar shows _"Click a vertex to rotate its half-edge arms."_
- Highlight all vertex nodes.
- User selects vertex node `v-{i}`.
- After selection, highlight all half-edge arms emanating from that vertex.
- Pointer movement rotates all anchors in that star around the selected vertex while preserving each arm length and preserving the cyclic order.
- The user does not need to keep the mouse button held down after selecting the vertex.
- A second click anywhere on the canvas confirms the current preview rotation, deselects the vertex, and keeps the user in Rotate vertex mode so the user can immediately choose another vertex. Clicking the Rotate vertex button again or pressing `Esc` exits the mode.
- Orbifold ends attached to orbifold anchors move along the same rotated rays as their corresponding anchors.
- On confirm/deselect/exit, apply **Arm-Tangent Bezier Construction** from `03-rendering.md` to every ordinary connecting edge incident to any moved anchor.
- Record the operation for Undo.

**"Remove arc"**:

- If a connecting edge or orbifold edge is already selected: remove the connecting arc and update graph data accordingly.
- If not: info bar shows _"Click an arc or orbifold edge to remove it."_ → user clicks → remove.
- Removing an ordinary connecting arc keeps both endpoint half-edge arms on the canvas as dangling positive half-edges. Concretely, if the removed full edge is `{h,-h}`, keep `h` and replace `-h` by a fresh positive label before the standard label tidy-up.
- Removing an orbifold connecting arc keeps the half-edge arm on the canvas, removes the orbifold endpoint/segment, and removes the label from `orbifoldEdges`.
- Preserve all remaining vertex and anchor positions.
- Record the removed arc.
- Tidy up the Brauer graph data.
- Keyboard: if a connecting edge is selected, `Delete` or `Backspace` also triggers this.

**"Remove half-edge"**:

- Info bar shows _"Click a half-edge to remove it."_
- Highlight all half-edge arms using the same highlight style as Adjust emanating angle.
- User clicks a half-edge arm or anchor.
- Remove that half-edge from its $\sigma_0$ cycle. If this leaves the vertex cycle empty, remove the vertex and its multiplicity entry.
- Remove the associated half-edge arm and anchor from the canvas. If this half-edge was attached to an orbifold endpoint, remove the orbifold endpoint and its connecting segment. If it was part of an ordinary connecting arc, the arc disappears because one endpoint is now missing.
- Tidy up the Brauer graph data.
- Preserve remaining vertex and anchor positions while rebuilding the affected canvas state.

**"Add vertex"**:

- If no graph is currently rendered on the canvas, entering Add vertex immediately opens the prompt and confirming it draws a one-vertex graph at the canvas centre. The user does not need to press Draw graph first.
- If a graph is already rendered, the info bar shows _"Click an empty area to place a new vertex."_
- User clicks canvas. If click position is within `FAR_ENOUGH_PX` of any existing vertex centre: do nothing (show brief info bar message _"Too close to an existing vertex."_).
- Otherwise: open `Modal.svelte` with labelled numeric up/down controls: _"Number of half-edge arms"_ and _"Multiplicity"_. Both have lower bound `1`.
- On confirm: increment `n` by (the number of new half-edges), assign new half-edge integers, append a new cycle to `σ₀`, add a new entry to `multiplicity`, and draw the new star-shaped subgraph at the clicked position.
  For example, if before adding a vertex `n` is 5, and user input 4 to the prompt, then set `n=n+4=9`, and push `[k+1,k+2,k+3,k+4]` to $\sigma_0$, where `k` is the maximal positive integer appearing in $\sigma_0$ (before the addition of new vertex).
- Add the new vertex imperatively to the existing canvas. Do not redraw or regenerate the already-rendered graph.

**"Add half-edge"**:

- Info bar shows _"Select a half-edge to insert after."_
- Highlight all half-edge arms using the same highlight style as Adjust emanating angle.
- User clicks a half-edge arm or anchor.
- Open a numeric up/down prompt asking _"Number of half-edge arms"_ with lower bound `1`.
- On confirm, increment `n` by the requested count, assign new positive half-edge labels, and insert those labels immediately after the selected half-edge in that vertex's `sigma0` cycle.
- Place the new anchor nodes in the angular sector after the selected half-edge and before the next half-edge in the current cyclic order, without redistributing the rest of the vertex.
- Draw only the new half-edge arms/anchors and refresh ordering arrows for the affected vertex if ordering arrows are visible.
- Record the operation for Undo.

**"Remove vertex"**:

- Info bar shows _"Click a vertex to remove it."_
- User clicks vertex node `v-{i}`: remove `v-{i}`, all its anchor nodes (`u-*`), all half-edge arms (`he-*`), all connecting edges incident to those anchors.
- We take out the corresponding cycle (the $i$-th array) from `σ₀`, and check through its entries.
    - If there is an entry $h$ in this cycle and $-h$ is an entry in another cycle of $\sigma_0$, then we replace $-h$ by $m+1$, where $m$ is the maximal positive integer appearing in $\sigma_0$ (note $m$ may not be `n`). The corresponding `he-{s}{|h|}` and `u-{s}{h}` needs to be updated to `he-p{m+1}` and `u-p{m+1}` respectively (here `s` is the sign of $-h$). The connecting edge `ce-{h}` needs to be removed.
    - If both $h,-h$ are in the same cycle, then remove all their associated half-edge arms, anchor nodes, and connecting edge.
- Remove also the corresponding ($i$-th) entry from `multiplicity`.
- Perform tidy up of Brauer graph data.
- Keyboard: if a vertex node is selected, `Delete` or `Backspace` triggers this.
- Canvas implementation preserves remaining vertex and anchor positions while rebuilding the affected graph state.

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
- Canvas implementation preserves current vertex and anchor positions while rebuilding the graph state.

**"Adjust arc curvature"**:

- Info bar shows _"Click an arc to adjust its curvature."_
- User clicks an ordinary connecting arc.
- Highlight the selected arc with a distinct colour.
- Show Bezier control-point handles for the selected arc.
- Show dashed guide lines from the endpoint anchor nodes to the visible Bezier control handles.
- User drags the control-point handles; the arc updates live by writing back to its stored `controlPointDistances` and `controlPointWeights`.
- Clicking another ordinary arc switches the visible handles to that arc.
- Pressing `Esc` exits the mode and hides the control-point handles.
- User-edited curvature is part of Canvas Edit state and must be preserved by display toggles, save/load, and graph updates unless the corresponding arc is removed or replaced.

**"Add orbifold edge"**:

- If the current canvas has dangling positive half-edge arms, info bar shows _"Connect to half-edge"_.
- Highlight the dangling half-edge arms using the same highlight style as Adjust emanating angle.
- User clicks the body of a dangling half-edge arm `he-p{h}` or its corresponding anchor `u-p{h}`. Then create an orbifold end node `orb-x{h}` and connect `u-p{h}` to `orb-x{h}`. Update `orbifoldEdges` by inserting `h`.
- The info bar also tells the user that clicking blank canvas creates a new orbifold vertex.
- If the user clicks blank canvas, create a new one-half-edge orbifold vertex at that clicked position and update `n`, `sigma0`, `multiplicity`, and `orbifoldEdges` accordingly.
- If the user presses `Esc` during this selection stage, exit the tool and do not connect any half-edge arm.
- If there are no dangling positive half-edge arms, keep the tool active with the same blank-canvas creation behavior.

### Ordering of half-edges within a new star

New anchor nodes in a freshly added star are placed in clockwise order starting from north, evenly spaced. The clockwise order around the canvas defines the initial σ₀ cycle ordering. (The user can edit the cycle text in accordion A after exiting accordion B to reorder.)

---
