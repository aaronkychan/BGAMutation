let registered = false;

export async function registerCytoscapeExtensions(): Promise<void> {
	if (registered) return;

	registered = true;
}
