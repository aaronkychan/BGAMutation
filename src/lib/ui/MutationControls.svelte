<script lang="ts">
	import { graphState } from '$lib/state/graph.svelte';

	let canMutate = $derived(Boolean(graphState.graph));

	function selectMutation(direction: 'left' | 'right') {
		graphState.mode = direction === 'left' ? 'select-left-mutation-edge' : 'select-right-mutation-edge';
	}
</script>

<section class="mutation-controls">
	<h2>Mutation</h2>
	<div class="button-grid">
		<button
			type="button"
			class:active={graphState.mode === 'select-left-mutation-edge'}
			disabled={!canMutate}
			onclick={() => selectMutation('left')}
		>
			Left mutation
		</button>
		<button
			type="button"
			class:active={graphState.mode === 'select-right-mutation-edge'}
			disabled={!canMutate}
			onclick={() => selectMutation('right')}
		>
			Right mutation
		</button>
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
		color: var(--text-primary);
		cursor: pointer;
	}

	button:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	button.active:not(:disabled) {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 700;
	}
</style>
