# Extra Bezier Anchor Failure Notes

This note records why the attempted "extra Bezier anchor/control" functionality was removed.

## Intended Feature

The intended feature was to let an ordinary connecting arc contain extra editable Bezier anchors between the two half-edge endpoint anchors. The planned id scheme was:

- Bezier anchor: `ba-{eid}-{aid}`
- Control point attached to a Bezier anchor: `bac-{eid}-{aid}-{cid}`
- Endpoint control attached to a half-edge anchor: `uc-{hid}`

The expected editing model was that a Bezier anchor would carry its own two local controls, while endpoint controls would remain attached to the original half-edge anchor nodes.

## Observed Failures

- **Unexpected control creation**: operations that should only align an existing endpoint control sometimes inserted additional controls. This made Align Bezier control behave like Add Bezier anchor in some interaction paths.
- **Accidental add during drag**: dragging an existing Bezier anchor/control could be interpreted as a canvas click, causing an extra control/anchor to be added. This was intermittent because it depended on event order and whether the drag ended with a tap-like event.
- **Wrong attachment model**: newly added controls were visually connected to the original half-edge endpoint anchors instead of the new Bezier anchor. The dashed guide lines therefore described the wrong parent-child relation.
- **Ambiguous control identity**: control identity was inferred partly from array order, partly from stored roles, and partly from nearest-point matching. After edits or graph rebuilds, nearby controls could be "glued" together or assigned to the wrong anchor.
- **Stale role metadata**: `controlRoles` and `bezierAnchors` were stored on Cytoscape edge data, then restored across redraws. Once that metadata became inconsistent with the visible nodes, later operations used stale roles and produced incorrect guides or extra handles.
- **Mixed interaction modes**: the same Arc curvature mode handled dragging endpoint controls, adding anchors, selecting align targets, and moving Bezier anchors. These workflows shared canvas tap/drag handlers, so one workflow could accidentally trigger another.
- **Poor separation of endpoint controls and internal anchors**: endpoint controls should be relative to half-edge anchors, while internal Bezier anchors should own their own controls. The implementation did not maintain this invariant reliably.

## Decision

The extra Bezier anchor/control workflow was removed. Arc curvature editing now keeps only:

- dragging existing Bezier control handles for an ordinary arc,
- dashed guide lines from endpoint half-edge anchors to endpoint controls,
- Align Bezier control with half-edge.

Future work should reintroduce internal Bezier anchors only with a clean data model where anchors and controls are first-class curve-local data, not inferred from Cytoscape node ids and control-array order.
