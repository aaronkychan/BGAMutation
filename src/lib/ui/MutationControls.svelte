<section class="mutation-controls">
	<h2>Mutation</h2>
	<div class="button-grid">
		<button type="button" disabled>Left mutation</button>
		<button type="button" disabled>Right mutation</button>
	</div>
</section>

<style>
	.mutation-controls {
		border-bottom: 1px solid var(--border);
		padding: 16px 0;
	}

	h2 {
		margin: 0 0 10px;
		color: var(--section-title);
		font-size: 15px;
	}

	.button-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	button {
		min-height: 34px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--button-bg);
		color: var(--text-disabled);
		cursor: not-allowed;
	}
</style>
