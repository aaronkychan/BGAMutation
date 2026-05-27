<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import { graphState } from '$lib/state/graph.svelte';

	let open = $state(true);
	let canMutate = $derived(Boolean(graphState.graph));

	function selectMutation(direction: 'left' | 'right') {
		graphState.mode = direction === 'left' ? 'select-left-mutation-edge' : 'select-right-mutation-edge';
	}
</script>

<section class="mutation-controls">
	<button class="section-trigger" type="button" aria-expanded={open} onclick={() => (open = !open)}>
		<span>Mutation</span>
		<ChevronDown class={open ? 'open' : ''} size={18} />
	</button>
	{#if open}
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
	{/if}
</section>

<style>
	.mutation-controls {
		border-bottom: 1px solid var(--border);
		padding: 16px 0;
	}

	.section-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		border: 0;
		background: transparent;
		color: var(--section-title);
		padding: 0 0 10px;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
	}

	:global(.open) {
		transform: rotate(180deg);
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
