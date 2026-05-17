import cytoscape from 'cytoscape';
import contextMenus from 'cytoscape-context-menus';
import edgeEditing from 'cytoscape-edge-editing';
import Konva from 'konva';

let registered = false;

export function registerCytoscapeExtensions(): void {
	if (registered) return;

	cytoscape.use(contextMenus);
	edgeEditing(cytoscape, Konva);
	registered = true;
}
