<section class="save-load">
	<h2>Save / Load</h2>
	<div class="button-grid">
		<button type="button" disabled>Save current</button>
		<button type="button" disabled>Export all</button>
		<button type="button" disabled>Import</button>
	</div>
</section>

<style>
	.save-load {
		padding: 16px 0 4px;
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

	button:first-child {
		grid-column: 1 / -1;
	}
</style>
