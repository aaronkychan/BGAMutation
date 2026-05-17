<svelte:head>
	<title>Brauer Graph Mutation Visualiser</title>
	<meta
		name="description"
		content="Interactive visualiser for Brauer and skew Brauer graph mutation."
	/>
</svelte:head>

<main class="app-shell">
	<section class="sidebar" aria-label="Controls">
		<h1>Brauer Graph Mutation Visualiser</h1>
		<p>Project scaffold is ready. Implementation will proceed from the focused spec files.</p>
	</section>

	<section class="canvas-panel" aria-label="Graph display">
		<div class="canvas-placeholder">Cytoscape display panel</div>
	</section>
</main>

<style>
	.app-shell {
		display: grid;
		grid-template-columns: 320px minmax(0, 1fr);
		min-height: 100vh;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.sidebar {
		border-right: 1px solid var(--border);
		background: var(--bg-panel);
		padding: 24px;
	}

	.sidebar h1 {
		margin: 0 0 12px;
		font-size: 20px;
		line-height: 1.2;
	}

	.sidebar p {
		margin: 0;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.canvas-panel {
		display: grid;
		min-width: 0;
		background: var(--bg-secondary);
		padding: 24px;
	}

	.canvas-placeholder {
		display: grid;
		place-items: center;
		border: 1px dashed var(--border);
		color: var(--text-secondary);
		background: var(--bg-primary);
	}

	@media (max-width: 640px) {
		.app-shell {
			grid-template-columns: 1fr;
		}

		.sidebar {
			order: 2;
			border-top: 1px solid var(--border);
			border-right: 0;
		}

		.canvas-panel {
			min-height: 55vh;
		}
	}
</style>
