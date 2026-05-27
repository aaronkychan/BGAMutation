Make following changes before moving to the next stage (Stage 2).

## Top priority

- [x] After user pressed "Draw graph" from `NumericalAccordion`, and the graph is generated, immediately switch to Canvas Edit mode (and so, also hide the numerical input section and show the canvas edit section).
- [x] Remove the "gap" between arm and connecting edges, the anchor point should be invisible (unless we specifically need to check their behvaiour in development/debug mode). Integrated into `03-rendering.md`.
- [x] Forbid user to manually changes the star-shaped subgraph, i.e. user are not allowed to randomly drag the anchor node which will alter its position and also the half-edge arms' length. Drag anchor should move the associated star-shaped subgraph as a whole. This needs to be enforced always regardless of Canvas Edit mode or Mutation mode or Numerical input mode.
- [x] Better curve control on the connecting edges when the graph generates (and when re/connecting half-edges): When connecting `u-p{h}` to `u-m{h}`, the Bezier control starting from `u-p{h}` (respectively `u-m{h}`) needs to be in the same direction as the half-edge arm `he-p{h}` (respectively `he-m{h}`), the "length" of these Bezier control should be stored as another pre-defined constant; for testing we can use the same value as `ARM_LENGTH` first. This procedure applies to `(Re)connect arcs` in Canvas Edit mode.
- [x] CSS style for cyclic ordering input in `CycleRow` changed (removed the use of class `vertex-badge` which looks very ugly); instead I want to use similar styling as in neighbour field for multiplicity. But the CSS now shows the label "vtx" in a different row than the text input for the cyclic ordering; fix this so that the label and the input are always in the same line.

## Delay to Later Stage(s)

- Instead of fixing the distribution of half-edge arms attached to each vertex node with equal spacing, allow user to modify each indivisual arm.
    - [x] Add a button "Adjust emanating angle" to "Canvas Edit" subpanel. Integrated into `04-ui.md` and `06-canvas-editing.md`.
    - [x] Add "Rotate vertex" button to "Canvas Edit" subpanel. Integrated into `04-ui.md` and `06-canvas-editing.md`.
- [x] Add "Undo" button and functionality to "Canvas Edit" mode. Integrated into `04-ui.md` and `06-canvas-editing.md`.
- [x] CSS `label` class in `NumericalAccordion` makes mathematicail notation appeared as a capital letter. We need to force small letter `σ₀` and mulitplicity `m`, etc.

## Less urgent / Simple modification

- [x] Instead of toggle "Brauer" / "Skew Brauer", just always show the "Orbifold edges" text field input for `orbifoldEdge`. If it is empty, then we know autmatically it is Brauer graph. Nature of the graph (Brauer or skew Brauer) can be shown in the Info box.
- [x] In `NumericalAccordion`, the display for the half-edge set $H$ (in via `hDisplay`) will take up a lot of space; we don't need it. Instead, display `#H=2{r}` (where `r` is the number of full ordinary edges, i.e. $(n-o)/2$ where `n` is the input edge count and `o` is the number of orbifold edges). This will be shown on the same line as the edge count input text field since both takes up very little space.
- [x] When a graph is already drawn on the cytoscape, and any of the "Display Toggle" in the `NumericalAccordion` changes state, update the cytoscape graph immediately. Integrated into `04-ui.md`.
    - Proposed solution: lift the current display-toggle state from `NumericalAccordion` into shared render state owned by `+page.svelte`, and pass an `onRenderOptionsChange` callback down through `ControlPanel`. `DisplayPanel` should then update label data/classes and add/remove cyclic-order arrow elements in place, preserving existing Cytoscape node positions and edge handles. Avoid calling the current full `renderGraph()` path for toggle-only changes because it recomputes initial layout and would reset manually adjusted canvas positions.
- [x] Cyclic ordering arrows needs to be curved. For a self-loop arrow (i.e. starts from one half-edge and ends in the same half-edge), it should be drawn almost like a circle, and the cricle should goes around the associated vertex node. Integrated into `03-rendering.md`.
