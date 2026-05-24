import type cytoscape from 'cytoscape';
import { ANCHOR_RADIUS, STROKE_WIDTH, VERTEX_RADIUS } from './constants';

export function createStylesheet(): cytoscape.StylesheetCSS[] {
	const styles = getComputedStyle(document.documentElement);
	const cssVar = (name: string) => styles.getPropertyValue(name).trim();
	const orbifoldColor = cssVar('--orbifold-color');

	return [
		{
			selector: 'node',
			css: {
				'font-family': 'var(--font-mono)',
				'font-size': 11,
				'text-valign': 'center',
				'text-halign': 'center',
				'text-outline-width': 2,
				'text-outline-color': cssVar('--bg-primary'),
				color: cssVar('--text-primary')
			}
		},
		{
			selector: '.star-parent',
			css: {
				'background-opacity': 0,
				'border-width': 0,
				events: 'no'
			}
		},
		{
			selector: '.v-node',
			css: {
				width: VERTEX_RADIUS * 2,
				height: VERTEX_RADIUS * 2,
				shape: 'ellipse',
				label: 'data(multiplicityLabel)',
				'font-family': 'var(--font-mono)',
				'font-size': 11,
				'text-margin-y': -18,
				'border-width': 2,
				'border-color': cssVar('--vertex-hollow-border')
			}
		},
		{
			selector: '.v-node.hollow',
			css: {
				'background-color': cssVar('--bg-primary')
			}
		},
		{
			selector: '.v-node.filled',
			css: {
				'background-color': cssVar('--vertex-filled')
			}
		},
		{
			selector: '.u-node',
			css: {
				width: ANCHOR_RADIUS * 2,
				height: ANCHOR_RADIUS * 2,
				opacity: 0,
				label: 'data(label)',
				'font-family': 'var(--font-mono)',
				'font-size': 10,
				'text-margin-y': -10,
				'border-width': 1,
				'border-style': 'dashed',
				'border-color': cssVar('--text-secondary'),
				'background-opacity': 0
			}
		},
		{
			selector: '.u-node[label]',
			css: {
				opacity: 1,
				'background-opacity': 0,
				'border-opacity': 0
			}
		},
		{
			selector: '.orbifold-node',
			css: {
				width: VERTEX_RADIUS * 2,
				height: VERTEX_RADIUS * 2,
				shape: 'rectangle',
				'background-opacity': 0,
				'background-image': crossSvgDataUri(orbifoldColor),
				'background-fit': 'contain'
			}
		},
		{
			selector: 'edge',
			css: {
				width: STROKE_WIDTH,
				'line-color': cssVar('--edge-color'),
				'target-arrow-color': cssVar('--edge-color'),
				'curve-style': 'bezier',
				'font-family': 'var(--font-mono)',
				'font-size': 11,
				color: cssVar('--text-primary'),
				'text-background-color': cssVar('--bg-primary'),
				'text-background-opacity': 0.9,
				'text-background-padding': '2px'
			}
		},
		{
			selector: '.he-edge',
			css: {
				'curve-style': 'straight'
			}
		},
		{
			selector: '.ce-edge',
			css: {
				label: 'data(label)'
			}
		},
		{
			selector: '.ordinary-edge',
			css: {
				'curve-style': 'unbundled-bezier',
				'control-point-distances': 36,
				'control-point-weights': 0.5
			}
		},
		{
			selector: '.orbifold-edge',
			css: {
				'curve-style': 'straight',
				'line-color': cssVar('--orbifold-color')
			}
		},
		{
			selector: '.ordering-arrow',
			css: {
				width: 1,
				'curve-style': 'bezier',
				'line-style': 'dashed',
				'line-color': cssVar('--arrow-color'),
				'target-arrow-shape': 'triangle',
				'target-arrow-color': cssVar('--arrow-color'),
				'arrow-scale': 0.7,
				events: 'no'
			}
		},
		{
			selector: '.ordering-arrow.singleton',
			css: {
				'curve-style': 'bezier',
				'loop-direction': '-45deg',
				'loop-sweep': '120deg'
			}
		}
	];
}

function crossSvgDataUri(color: string): string {
	const encoded = encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M4 4L16 16M16 4L4 16" stroke="${color}" stroke-width="3" stroke-linecap="round"/></svg>`
	);
	return `data:image/svg+xml,${encoded}`;
}
