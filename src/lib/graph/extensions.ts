let registered = false;

export async function registerCytoscapeExtensions(): Promise<void> {
	if (registered) return;

	const [{ default: cytoscape }, { default: contextMenus }, { default: edgeEditing }, { default: Konva }] =
		await Promise.all([
			import('cytoscape'),
			import('cytoscape-context-menus'),
			import('cytoscape-edge-editing'),
			import('konva')
		]);

	cytoscape.use(contextMenus);
	edgeEditing(cytoscape, Konva);
	registered = true;
}
