# Backlog and Later Work

## Stage 3: Simultaneous Mutation (Generalised Kaur Move)

### User Flow

1. "Select edges to mutate" toggle in Mutation controls enters multi-edge selection mode.
2. User clicks edges to toggle selection; each highlighted in `var(--highlight-color)`.
3. "Mutate selected" button becomes enabled once ≥ 1 edge is selected.
4. Animation generalises Stage 2 to the selected edge set.

---

## Stretch Goal: TikZ Export

- "Export to TikZ" button in Panel 1 (below Save/Load).
- Generates a `tikzpicture` environment: vertex positions (scaled), half-edge arms, Bezier control points, cyclic ordering arrows (if toggled on), orbifold crosses, edge labels and multiplicity labels (if toggled on).
- Output in a `<textarea>` with copy button; also offered as `.tex` file download.

---

## Open Questions

1. **Surface drawing** — long-term; format TBD.
2. **Animation speed** — default ~1 s total; expose `ANIMATION_TOTAL_MS` and `ANIMATION_PAUSE_MS` in `constants.ts` for tuning during development.

---
