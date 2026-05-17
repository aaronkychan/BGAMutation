export const VERTEX_RADIUS = 10;
export const ARM_LENGTH = 22;
export const ANCHOR_RADIUS = 4;
export const STROKE_WIDTH = 2;
export const CLUSTER_RADIUS = VERTEX_RADIUS + ARM_LENGTH + ANCHOR_RADIUS;
export const FAR_ENOUGH_PX = Math.round(CLUSTER_RADIUS * 1.5);
export const CIRCULAR_LAYOUT_RADIUS = 180;
export const GRID_LAYOUT_SPACE = 120;
export const LINE_LAYOUT_SPACE = 120;

export const ANIMATION_TOTAL_MS = 1000;
export const ANIMATION_POST_MS = 500;
export const ANIMATION_PHASE1_MS = Math.round(ANIMATION_TOTAL_MS * 0.25);
export const ANIMATION_PHASE2_MS = Math.round(ANIMATION_TOTAL_MS * 0.25);
export const ANIMATION_PHASE3_MS = Math.round(ANIMATION_TOTAL_MS * 0.5);
