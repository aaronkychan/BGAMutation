declare module 'cytoscape-context-menus' {
	import type cytoscape from 'cytoscape';

	const contextMenus: cytoscape.Ext;
	export default contextMenus;
}

declare module 'cytoscape-edge-editing' {
	import type cytoscape from 'cytoscape';
	import type Konva from 'konva';

	export default function edgeEditing(cytoscape: cytoscape.CytoscapeStatic, konva: typeof Konva): void;
}
